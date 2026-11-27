using api.Auth;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    /// <summary>Report figures are computed here so pages do not download every trip and expense.</summary>
    [Route("api/[controller]")]
    [ApiController]
    [RequirePermission(Permissions.Reports)]
    public class ReportsController : ControllerBase
    {
        private const string NoDriver = "بدون سائق";

        private readonly AppDbContext _context;
        private readonly DriverEarnings _earnings;
        private readonly IClock _clock;

        public ReportsController(AppDbContext context, DriverEarnings earnings, IClock clock)
        {
            _context = context;
            _earnings = earnings;
            _clock = clock;
        }

        // GET: api/Reports/today
        // The dashboard summary: today's trips and revenue, today's cash box, and what customers owe now. Admins only.
        [RequireAdmin]
        [HttpGet("today")]
        public async Task<ActionResult> GetToday()
        {
            var start = _clock.Now.Date;
            var end = start.AddDays(1);

            var completed = await _context.Trips.AsNoTracking()
                .Where(t => t.Status == TripStatuses.Completed && t.EndTime >= start && t.EndTime < end)
                .Select(t => new { t.FinalTotal, t.PaidAmount, t.PaymentMethod })
                .ToListAsync();
            var cashTrips = await CashTrips(start, end).SumAsync(t => t.PaidAmount);

            var collections = -await _context.WalletTransactions.AsNoTracking()
                .Where(w => (w.Type == WalletTypes.CashCollection || w.Type == WalletTypes.CashDeposit) && w.TransactionDate >= start && w.TransactionDate < end)
                .SumAsync(w => w.Amount);
            var refunds = (await CashRefundsAsync(start, end)).Sum(r => r.Amount);
            var expenses = await _context.Expenses.AsNoTracking()
                .Where(e => e.Date >= start && e.Date < end)
                .SumAsync(e => e.Amount);

            var balances = await _context.Customers.AsNoTracking()
                .Select(c => c.WalletTransactions.Sum(w => w.Amount))
                .ToListAsync();
            var owing = balances.Where(b => b > 0).ToList();

            return Ok(new
            {
                date = start,
                tripsCount = completed.Count,
                revenue = completed.Sum(t => t.FinalTotal),
                cashNet = cashTrips + collections - expenses - refunds, // same as the daily cash box
                debt = owing.Sum(),
                customersOwing = owing.Count
            });
        }

        public record StatementRow(string Kind, int Id, DateTime Time, decimal BaseFare, decimal FinalTotal, decimal Cash, decimal NonCash, decimal Fuel, decimal Debt, decimal Remaining, string? CustomerName, string? Category);
        public record StatementTotals(decimal BaseFare, decimal FinalTotal, decimal Cash, decimal NonCash, decimal Fuel, decimal Debt, decimal Remaining);
        public record StatementDriver(int? DriverId, string DriverName, List<StatementRow> Rows, StatementTotals Totals);

        // GET: api/Reports/statement?period=daily&year=2026&month=10&day=2
        // Completed trips and expenses in the period, grouped by driver.
        // Debt is what was left unpaid when the trip ended (so a day's row always adds up);
        // Remaining is what the customer still owes on that trip today.
        [HttpGet("statement")]
        public async Task<ActionResult> GetStatement([FromQuery] string? period, [FromQuery] int year, [FromQuery] int? month, [FromQuery] int? day)
        {
            var range = ReportPeriod.TryCreate(period, year, month, day, out var error);
            if (range == null) return BadRequest(new { message = error });

            var trips = await _context.Trips.AsNoTracking()
                .Where(t => t.Status == TripStatuses.Completed && t.EndTime >= range.Start && t.EndTime < range.End)
                .Select(t => new
                {
                    t.Id, t.DriverId, DriverName = t.Driver != null ? t.Driver.Name : null,
                    CustomerName = t.Customer != null ? t.Customer.Name : null,
                    t.StartTime, EndTime = t.EndTime!.Value, t.PricingType, t.FixedPrice, t.HourlyRate, t.FinalTotal, t.PaidAmount, t.PaymentMethod
                })
                .ToListAsync();

            var remaining = (await _earnings.CalculateAsync()).Outstanding
                .Where(o => o.TripId != null)
                .GroupBy(o => o.TripId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(o => o.Remaining));

            var expenses = await _context.Expenses.AsNoTracking()
                .Where(e => e.Date >= range.Start && e.Date < range.End)
                .Select(e => new { e.Id, e.DriverId, DriverName = e.Driver != null ? e.Driver.Name : null, e.Date, e.Amount, e.Category })
                .ToListAsync();

            var rows = trips.Select(t =>
            {
                var isCash = t.PaymentMethod == PaymentMethods.Cash;
                // The fare before discount and extras; for an hourly trip that is the rate times its duration, not the rate.
                var baseFare = t.PricingType is PricingTypes.Hourly or PricingTypes.Fixed
                    ? TripPricing.Calculate(t.PricingType, t.HourlyRate, t.FixedPrice, t.StartTime, t.EndTime, DiscountTypes.None, 0, 0).BasePrice
                    : t.FinalTotal;
                return (DriverId: (int?)t.DriverId, t.DriverName, Row: new StatementRow("trip", t.Id, t.EndTime, baseFare, t.FinalTotal,
                    isCash ? t.PaidAmount : 0, isCash ? 0 : t.PaidAmount, 0, Math.Max(0, t.FinalTotal - t.PaidAmount), remaining.GetValueOrDefault(t.Id), t.CustomerName, null));
            })
            .Concat(expenses.Select(e => (DriverId: e.DriverId, e.DriverName,
                Row: new StatementRow("expense", e.Id, e.Date, 0, 0, 0, 0, e.Amount, 0, 0, null, e.Category))));

            var drivers = rows
                .GroupBy(r => r.DriverId)
                .Select(g =>
                {
                    var list = g.Select(r => r.Row).OrderBy(r => r.Time).ThenBy(r => r.Kind == "trip" ? 0 : 1).ThenBy(r => r.Id).ToList();
                    return new StatementDriver(g.Key, g.First().DriverName ?? NoDriver, list, Sum(list));
                })
                .OrderBy(d => d.DriverId == null).ThenBy(d => d.DriverName)
                .ToList();

            return Ok(new
            {
                range.Period,
                range.Start,
                range.End,
                drivers,
                totals = Sum(drivers.SelectMany(d => d.Rows))
            });
        }

        // GET: api/Reports/cashbox?period=daily&year=2026&month=10&day=2
        // Cash in (cash trips, collections, deposits) and out (expenses, refunds of cancelled trips) for the period.
        [HttpGet("cashbox")]
        public async Task<ActionResult> GetCashbox([FromQuery] string? period, [FromQuery] int year, [FromQuery] int? month, [FromQuery] int? day)
        {
            var range = ReportPeriod.TryCreate(period, year, month, day, out var error);
            if (range == null) return BadRequest(new { message = error });

            var cashTrips = await CashTrips(range.Start, range.End)
                .GroupBy(t => new { t.DriverId, Name = t.Driver != null ? t.Driver.Name : null })
                .Select(g => new { g.Key.DriverId, g.Key.Name, Count = g.Count(), Total = g.Sum(t => t.PaidAmount) })
                .ToListAsync();

            var collections = await _context.WalletTransactions.AsNoTracking()
                .Where(w => (w.Type == WalletTypes.CashCollection || w.Type == WalletTypes.CashDeposit) && w.TransactionDate >= range.Start && w.TransactionDate < range.End)
                .OrderBy(w => w.TransactionDate).ThenBy(w => w.Id)
                .Select(w => new { w.Id, w.Type, CustomerName = w.Customer.Name, Amount = -w.Amount, w.TransactionDate })
                .ToListAsync();

            var expenses = await _context.Expenses.AsNoTracking()
                .Where(e => e.Date >= range.Start && e.Date < range.End)
                .GroupBy(e => new { e.DriverId, Name = e.Driver != null ? e.Driver.Name : null })
                .Select(g => new { g.Key.DriverId, g.Key.Name, Count = g.Count(), Total = g.Sum(e => e.Amount) })
                .ToListAsync();

            var totalTrips = cashTrips.Sum(t => t.Total);
            var totalCollections = collections.Sum(c => c.Amount);
            var totalExpenses = expenses.Sum(e => e.Total);
            var refunds = await CashRefundsAsync(range.Start, range.End);
            var totalRefunds = refunds.Sum(r => r.Amount);

            return Ok(new
            {
                range.Period,
                range.Start,
                range.End,
                trips = cashTrips.Select(t => new { t.DriverId, driverName = t.Name ?? NoDriver, t.Count, t.Total }).OrderBy(t => t.driverName),
                totalTrips,
                collections,
                totalCollections,
                expenses = expenses.Select(e => new { e.DriverId, driverName = e.Name ?? NoDriver, e.Count, e.Total }).OrderBy(e => e.DriverId == null).ThenBy(e => e.driverName),
                totalExpenses,
                refunds,
                totalRefunds,
                net = totalTrips + totalCollections - totalExpenses - totalRefunds
            });
        }

        public record CashRefund(int TripId, string? CustomerName, DateTime CancelledAt, decimal Amount);

        // Cash trips that ended in the range. A finished trip cancelled later still counts on the day it was
        // paid, so past days never change; its refund is counted on the day of the cancellation instead.
        private IQueryable<Trip> CashTrips(DateTime start, DateTime end) =>
            _context.Trips.AsNoTracking()
                .Where(t => t.PaymentMethod == PaymentMethods.Cash && t.EndTime >= start && t.EndTime < end
                    && (t.Status == TripStatuses.Completed || (t.Status == TripStatuses.Cancelled && t.CancelledAt != null)));

        // Cash given back for finished trips cancelled in the range: what was paid in cash for the trip
        // plus any old debt collected in cash during it.
        private async Task<List<CashRefund>> CashRefundsAsync(DateTime start, DateTime end)
        {
            var cancelled = await _context.Trips.AsNoTracking()
                .Where(t => t.Status == TripStatuses.Cancelled && t.EndTime != null && t.CancelledAt >= start && t.CancelledAt < end)
                .OrderBy(t => t.CancelledAt)
                .Select(t => new { t.Id, CustomerName = t.Customer != null ? t.Customer.Name : null, CancelledAt = t.CancelledAt!.Value, t.PaymentMethod, t.PaidAmount })
                .ToListAsync();
            if (cancelled.Count == 0) return new List<CashRefund>();

            var ids = cancelled.Select(t => t.Id).ToList();
            var collected = (await _context.WalletTransactions.AsNoTracking()
                    .Where(w => w.Type == WalletTypes.CashCollection && w.TripId != null && ids.Contains(w.TripId.Value))
                    .Select(w => new { TripId = w.TripId!.Value, w.Amount })
                    .ToListAsync())
                .GroupBy(w => w.TripId)
                .ToDictionary(g => g.Key, g => -g.Sum(w => w.Amount));

            return cancelled
                .Select(t => new CashRefund(t.Id, t.CustomerName, t.CancelledAt,
                    (t.PaymentMethod == PaymentMethods.Cash ? t.PaidAmount : 0) + collected.GetValueOrDefault(t.Id)))
                .Where(r => r.Amount > 0)
                .ToList();
        }

        // GET: api/Reports/driver-earnings?period=monthly&year=2026&month=10
        // Customer money received in the period, matched to the trips it paid for (oldest unpaid trips first),
        // per driver, with the commission it earns. Outstanding is what customers still owe on each driver's trips today.
        [HttpGet("driver-earnings")]
        public async Task<ActionResult> GetDriverEarnings([FromQuery] string? period, [FromQuery] int year, [FromQuery] int? month, [FromQuery] int? day)
        {
            var range = ReportPeriod.TryCreate(period, year, month, day, out var error);
            if (range == null) return BadRequest(new { message = error });

            var earnings = await _earnings.CalculateAsync();
            var inRange = earnings.Allocations.Where(a => a.DriverId != null && a.CollectedAt >= range.Start && a.CollectedAt < range.End).ToList();

            var drivers = await _context.Drivers.AsNoTracking().OrderBy(d => d.Name)
                .Select(d => new { d.Id, d.Name, d.CommissionPercent }).ToListAsync();
            var customers = await _context.Customers.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
            var defaultPercent = await SalariesController.GetDefaultCommissionAsync(_context);

            var trips = await _context.Trips.AsNoTracking()
                .Where(t => t.Status == TripStatuses.Completed && t.EndTime >= range.Start && t.EndTime < range.End)
                .GroupBy(t => t.DriverId)
                .Select(g => new { DriverId = g.Key, Count = g.Count(), Total = g.Sum(t => t.FinalTotal) })
                .ToDictionaryAsync(x => x.DriverId);
            var fuel = await _context.Expenses.AsNoTracking()
                .Where(e => e.DriverId != null && e.Category == "Fuel" && e.Date >= range.Start && e.Date < range.End)
                .GroupBy(e => e.DriverId!.Value)
                .Select(g => new { DriverId = g.Key, Total = g.Sum(e => e.Amount) })
                .ToDictionaryAsync(x => x.DriverId, x => x.Total);

            var rows = drivers.Select(d =>
            {
                var mine = inRange.Where(a => a.DriverId == d.Id).OrderBy(a => a.CollectedAt).ThenBy(a => a.TripDate).ToList();
                var collected = mine.Sum(a => a.Amount);
                var driverFuel = fuel.GetValueOrDefault(d.Id);
                var percent = d.CommissionPercent ?? defaultPercent;
                trips.TryGetValue(d.Id, out var t);
                return new
                {
                    driverId = d.Id,
                    driverName = d.Name,
                    tripsCount = t?.Count ?? 0,
                    tripsValue = t?.Total ?? 0,
                    collected,
                    fuel = driverFuel,
                    commissionPercent = percent,
                    commission = SalariesController.CommissionOn(collected - driverFuel, percent),
                    outstanding = earnings.Outstanding.Where(o => o.DriverId == d.Id).Sum(o => o.Remaining),
                    payments = mine.Select(a => new
                    {
                        a.CollectedAt,
                        customerName = customers.GetValueOrDefault(a.CustomerId),
                        a.TripId,
                        a.TripDate,
                        a.Amount,
                        a.Source
                    })
                };
            })
            .Where(r => r.tripsCount > 0 || r.collected > 0 || r.outstanding > 0 || r.fuel > 0)
            .ToList();

            return Ok(new
            {
                range.Period,
                range.Start,
                range.End,
                drivers = rows,
                totals = new
                {
                    tripsValue = rows.Sum(r => r.tripsValue),
                    collected = rows.Sum(r => r.collected),
                    fuel = rows.Sum(r => r.fuel),
                    commission = rows.Sum(r => r.commission),
                    outstanding = rows.Sum(r => r.outstanding)
                }
            });
        }

        private static StatementTotals Sum(IEnumerable<StatementRow> rows)
        {
            var list = rows as ICollection<StatementRow> ?? rows.ToList();
            return new StatementTotals(list.Sum(r => r.BaseFare), list.Sum(r => r.FinalTotal), list.Sum(r => r.Cash),
                list.Sum(r => r.NonCash), list.Sum(r => r.Fuel), list.Sum(r => r.Debt), list.Sum(r => r.Remaining));
        }
    }
}
