using api.Models;
using api.Controllers;
using Microsoft.EntityFrameworkCore;

namespace api.Services
{
    /// <summary>One piece of customer money matched to one trip, so it can be credited to that trip's driver.</summary>
    public record EarningAllocation(
        int CustomerId, int? TripId, int? DriverId, decimal Amount,
        DateTime CollectedAt, DateTime TripDate, string Source);

    /// <summary>Money still owed on one trip.</summary>
    public record OpenCharge(int CustomerId, int? TripId, int? DriverId, decimal Remaining, DateTime TripDate);

    public record EarningsResult(List<EarningAllocation> Allocations, List<OpenCharge> Outstanding);

    /// <summary>
    /// Matches every customer's payments to their trips so commission can be paid on money actually received.
    ///
    /// Rules, per customer, in the order things happened:
    /// - Cash or transfer paid when a trip is closed goes to that trip first.
    /// - Any other money (a transfer or cash later, old debt collected by a driver, the rest of an overpayment)
    ///   pays the oldest unpaid trips first.
    /// - Money paid in advance waits as credit and pays the next trips as they happen.
    /// - A piece of money counts as collected on the later of the day it was received and the day of the trip.
    /// - Cancelled trips and their entries are left out entirely.
    /// </summary>
    public class DriverEarnings
    {
        private readonly AppDbContext _context;

        public DriverEarnings(AppDbContext context)
        {
            _context = context;
        }

        public async Task<EarningsResult> CalculateAsync()
        {
            var trips = await _context.Trips.AsNoTracking()
                .Select(t => new { t.Id, t.DriverId, t.Status })
                .ToDictionaryAsync(t => t.Id);

            var entries = await _context.WalletTransactions.AsNoTracking()
                .OrderBy(w => w.TransactionDate).ThenBy(w => w.Id)
                .Select(w => new { w.CustomerId, w.TripId, w.Amount, w.Type, w.TransactionDate })
                .ToListAsync();

            var allocations = new List<EarningAllocation>();
            var outstanding = new List<OpenCharge>();

            foreach (var customer in entries.GroupBy(e => e.CustomerId))
            {
                var charges = new List<Charge>();   // unpaid trips, oldest first
                var credits = new Queue<Credit>();  // money received and not yet used

                foreach (var e in customer)
                {
                    if (e.TripId is { } tid && trips.TryGetValue(tid, out var t) && t.Status == TripStatuses.Cancelled) continue;
                    if (e.Amount == 0) continue;

                    if (e.Amount > 0)
                    {
                        int? driverId = e.TripId is { } id && trips.TryGetValue(id, out var trip) ? trip.DriverId : null;
                        var charge = new Charge(e.TripId, driverId, e.Amount, e.TransactionDate);
                        while (charge.Remaining > 0 && credits.Count > 0)
                        {
                            var credit = credits.Peek();
                            var used = Math.Min(credit.Remaining, charge.Remaining);
                            allocations.Add(new EarningAllocation(customer.Key, charge.TripId, charge.DriverId, used, charge.Date, charge.Date, credit.Source));
                            credit.Remaining -= used;
                            charge.Remaining -= used;
                            if (credit.Remaining == 0) credits.Dequeue();
                        }
                        if (charge.Remaining > 0) charges.Add(charge);
                        continue;
                    }

                    var money = -e.Amount;

                    // Paid at the end of a trip: that trip first.
                    if (e.Type == WalletTypes.TripPayment && e.TripId != null)
                    {
                        var own = charges.FirstOrDefault(c => c.TripId == e.TripId);
                        if (own != null) money -= Pay(own, money, e.TransactionDate, e.Type, customer.Key, allocations);
                    }

                    foreach (var charge in charges)
                    {
                        if (money == 0) break;
                        money -= Pay(charge, money, e.TransactionDate, e.Type, customer.Key, allocations);
                    }
                    charges.RemoveAll(c => c.Remaining == 0);

                    if (money > 0) credits.Enqueue(new Credit(money, e.Type));
                }

                outstanding.AddRange(charges.Select(c => new OpenCharge(customer.Key, c.TripId, c.DriverId, c.Remaining, c.Date)));
            }

            return new EarningsResult(allocations, outstanding);
        }

        private static decimal Pay(Charge charge, decimal money, DateTime when, string source, int customerId, List<EarningAllocation> allocations)
        {
            var used = Math.Min(money, charge.Remaining);
            if (used <= 0) return 0;
            allocations.Add(new EarningAllocation(customerId, charge.TripId, charge.DriverId, used,
                when > charge.Date ? when : charge.Date, charge.Date, source));
            charge.Remaining -= used;
            return used;
        }

        private sealed class Charge(int? tripId, int? driverId, decimal amount, DateTime date)
        {
            public int? TripId { get; } = tripId;
            public int? DriverId { get; } = driverId;
            public decimal Remaining { get; set; } = amount;
            public DateTime Date { get; } = date;
        }

        private sealed class Credit(decimal amount, string source)
        {
            public decimal Remaining { get; set; } = amount;
            public string Source { get; } = source;
        }
    }
}
