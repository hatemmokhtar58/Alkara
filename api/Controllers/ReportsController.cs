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

        public ReportsController(AppDbContext context, DriverEarnings earnings)
        {
            _context = context;
            _earnings = earnings;
        }

        public record StatementRow(string Kind, int Id, DateTime Time, decimal BaseFare, decimal FinalTotal, decimal Cash, decimal NonCash, decimal Fuel, decimal Debt, string? CustomerName, string? Category);
        public record StatementTotals(decimal BaseFare, decimal FinalTotal, decimal Cash, decimal NonCash, decimal Fuel, decimal Debt);
        public record StatementDriver(int? DriverId, string DriverName, List<StatementRow> Rows, StatementTotals Totals);

        // GET: api/Reports/statement?period=daily&year=2026&month=10&day=2
        // Completed trips and expenses in the period, grouped by driver.
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
                    EndTime = t.EndTime!.Value, t.FixedPrice, t.HourlyRate, t.FinalTotal, t.PaidAmount, t.PaymentMethod
                })
                .ToListAsync();

            var expenses = await _context.Expenses.AsNoTracking()
                .Where(e => e.Date >= range.Start && e.Date < range.End)
                .Select(e => new { e.Id, e.DriverId, DriverName = e.Driver != null ? e.Driver.Name : null, e.Date, e.Amount, e.Category })
                .ToListAsync();

            var rows = trips.Select(t =>
            {
                var isCash = t.PaymentMethod == PaymentMethods.Cash;
                var baseFare = t.FixedPrice is > 0 ? t.FixedPrice.Value : t.HourlyRate is > 0 ? t.HourlyRate.Value : t.FinalTotal;
                return (DriverId: (int?)t.DriverId, t.DriverName, Row: new StatementRow("trip", t.Id, t.EndTime, baseFare, t.FinalTotal,
                    isCash ? t.PaidAmount : 0, isCash ? 0 : t.PaidAmount, 0, Math.Max(0, t.FinalTotal - t.PaidAmount), t.CustomerName, null));
            })
            .Concat(expenses.Select(e => (DriverId: e.DriverId, e.DriverName,
                Row: new StatementRow("expense", e.Id, e.Date, 0, 0, 0, 0, e.Amount, 0, null, e.Category))));

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
        // Cash in (cash trips, collections, deposits) and out (expenses) for the period.
        [HttpGet("cashbox")]
        public async Task<ActionResult> GetCashbox([FromQuery] string? period, [FromQuery] int year, [FromQuery] int? month, [FromQuery] int? day)
        {
            var range = ReportPeriod.TryCreate(period, year, month, day, out var error);
            if (range == null) return BadRequest(new { message = error });

            var cashTrips = await _context.Trips.AsNoTracking()
                .Where(t => t.Status == TripStatuses.Completed && t.PaymentMethod == PaymentMethods.Cash && t.EndTime >= range.Start && t.EndTime < range.End)
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
                net = totalTrips + totalCollections - totalExpenses
            });
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
                list.Sum(r => r.NonCash), list.Sum(r => r.Fuel), list.Sum(r => r.Debt));
        }
    }
}
