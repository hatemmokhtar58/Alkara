using api.Auth;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequirePermission(Permissions.Reports)]
    public class SalariesController : ControllerBase
    {
        public const string DefaultCommissionKey = "Salaries.DefaultCommissionPercent";
        public const decimal FallbackCommissionPercent = 10;

        private readonly AppDbContext _context;
        private readonly IClock _clock;
        private readonly DriverEarnings _earnings;

        public SalariesController(AppDbContext context, IClock clock, DriverEarnings earnings)
        {
            _context = context;
            _clock = clock;
            _earnings = earnings;
        }

        public class SalaryUpdateRequest
        {
            public decimal? BaseSalary { get; set; }
            // Empty string or null clears the driver's own percentage (back to the default)
            public decimal? CommissionPercent { get; set; }
            public bool UseDefaultCommission { get; set; }
            public decimal Allowances { get; set; }
            public decimal Deductions { get; set; }
            public string? Notes { get; set; }
        }

        public class SettingsRequest
        {
            public decimal DefaultCommissionPercent { get; set; }
        }

        public class PayRequest
        {
            public int Year { get; set; }
            public int Month { get; set; }
            // Empty pays every driver not yet paid for the month
            public List<int>? DriverIds { get; set; }
        }

        public record SalaryRow(
            int DriverId, string DriverName, decimal BaseSalary, decimal TotalIncome, decimal TotalExpenses,
            decimal NetIncome, decimal CommissionPercent, bool UsesDefaultCommission, decimal Commission,
            decimal Allowances, decimal Deductions, decimal TotalSalary, int TripsCount,
            string? Notes, bool IsPaid, DateTime? PaidAt);

        // GET: api/Salaries?month=5&year=2026
        [HttpGet]
        public async Task<ActionResult<object>> GetSalaries([FromQuery] int? month, [FromQuery] int? year)
        {
            var now = _clock.Now;
            var targetMonth = month ?? now.Month;
            var targetYear = year ?? now.Year;
            if (targetMonth < 1 || targetMonth > 12 || targetYear < 2000 || targetYear > 2100)
            {
                return BadRequest(new { message = "الشهر أو السنة غير صالحة." });
            }

            var rows = await CalculateAsync(targetYear, targetMonth);
            var defaultPercent = await GetDefaultCommissionAsync();

            return Ok(new
            {
                month = targetMonth,
                year = targetYear,
                defaultCommissionPercent = defaultPercent,
                drivers = rows,
                totals = new
                {
                    totalBaseSalary = rows.Sum(r => r.BaseSalary),
                    totalIncome = rows.Sum(r => r.TotalIncome),
                    totalExpenses = rows.Sum(r => r.TotalExpenses),
                    totalNetIncome = rows.Sum(r => r.NetIncome),
                    totalCommission = rows.Sum(r => r.Commission),
                    totalAllowances = rows.Sum(r => r.Allowances),
                    totalDeductions = rows.Sum(r => r.Deductions),
                    totalSalaries = rows.Sum(r => r.TotalSalary)
                }
            });
        }

        // PUT: api/Salaries/7?month=5&year=2026 - base salary and commission (driver level), allowances and deductions (this month)
        [HttpPut("{driverId:int}")]
        public async Task<IActionResult> UpdateDriverSalary(int driverId, [FromQuery] int month, [FromQuery] int year, SalaryUpdateRequest request)
        {
            var driver = await _context.Drivers.FindAsync(driverId);
            if (driver == null) return NotFound(new { message = "السائق غير موجود." });

            if (request.BaseSalary < 0 || request.Allowances < 0 || request.Deductions < 0)
                return BadRequest(new { message = "المبالغ لا يمكن أن تكون بالسالب." });
            if (request.CommissionPercent is < 0 or > 100)
                return BadRequest(new { message = "النسبة يجب أن تكون بين 0 و 100." });

            var record = await GetOrCreateMonthAsync(driverId, year, month);
            if (record.IsPaid)
                return BadRequest(new { message = "راتب هذا الشهر تم صرفه ولا يمكن تعديله." });

            if (request.BaseSalary.HasValue) driver.BaseSalary = request.BaseSalary.Value;
            if (request.UseDefaultCommission) driver.CommissionPercent = null;
            else if (request.CommissionPercent.HasValue) driver.CommissionPercent = request.CommissionPercent;

            record.Allowances = request.Allowances;
            record.Deductions = request.Deductions;
            record.Notes = request.Notes;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/Salaries/settings
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings(SettingsRequest request)
        {
            if (request.DefaultCommissionPercent < 0 || request.DefaultCommissionPercent > 100)
                return BadRequest(new { message = "النسبة يجب أن تكون بين 0 و 100." });

            var setting = await _context.AppSettings.FindAsync(DefaultCommissionKey);
            if (setting == null)
            {
                setting = new AppSetting { Key = DefaultCommissionKey };
                _context.AppSettings.Add(setting);
            }
            setting.Value = request.DefaultCommissionPercent.ToString(System.Globalization.CultureInfo.InvariantCulture);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/Salaries/pay - freezes the month's figures for the chosen drivers
        [HttpPost("pay")]
        public async Task<IActionResult> Pay(PayRequest request)
        {
            if (request.Month < 1 || request.Month > 12) return BadRequest(new { message = "الشهر غير صالح." });

            var rows = await CalculateAsync(request.Year, request.Month);
            var toPay = rows.Where(r => !r.IsPaid && (request.DriverIds == null || request.DriverIds.Count == 0 || request.DriverIds.Contains(r.DriverId))).ToList();
            var userId = CurrentUser.Get(HttpContext)?.Id;

            foreach (var row in toPay)
            {
                var record = await GetOrCreateMonthAsync(row.DriverId, request.Year, request.Month);
                record.BaseSalary = row.BaseSalary;
                record.TotalIncome = row.TotalIncome;
                record.TotalExpenses = row.TotalExpenses;
                record.CommissionPercent = row.CommissionPercent;
                record.Commission = row.Commission;
                record.TripsCount = row.TripsCount;
                record.Total = row.TotalSalary;
                record.IsPaid = true;
                record.PaidAt = _clock.Now;
                record.PaidByUserId = userId;
            }

            await _context.SaveChangesAsync();
            return Ok(new { paid = toPay.Count, total = toPay.Sum(r => r.TotalSalary) });
        }

        // POST: api/Salaries/7/unpay?month=5&year=2026 - admin reopens a paid salary
        [RequireAdmin]
        [HttpPost("{driverId:int}/unpay")]
        public async Task<IActionResult> Unpay(int driverId, [FromQuery] int month, [FromQuery] int year)
        {
            var record = await _context.DriverMonthlySalaries.FirstOrDefaultAsync(s => s.DriverId == driverId && s.Year == year && s.Month == month);
            if (record == null || !record.IsPaid) return BadRequest(new { message = "هذا الراتب غير مصروف." });

            record.IsPaid = false;
            record.PaidAt = null;
            record.PaidByUserId = null;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task<List<SalaryRow>> CalculateAsync(int year, int month)
        {
            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);
            var defaultPercent = await GetDefaultCommissionAsync();

            var drivers = await _context.Drivers.OrderBy(d => d.Id).ToListAsync();
            var records = await _context.DriverMonthlySalaries
                .Where(s => s.Year == year && s.Month == month)
                .ToDictionaryAsync(s => s.DriverId);

            // Commission is earned on money actually received from customers this month, wherever the trip fell.
            var earnings = await _earnings.CalculateAsync();
            var collected = earnings.Allocations
                .Where(a => a.DriverId != null && a.CollectedAt >= startDate && a.CollectedAt < endDate)
                .GroupBy(a => a.DriverId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(a => a.Amount));

            var tripCounts = await _context.Trips
                .Where(t => t.Status == TripStatuses.Completed && t.EndTime >= startDate && t.EndTime < endDate)
                .GroupBy(t => t.DriverId)
                .Select(g => new { DriverId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.DriverId, x => x.Count);

            // Fuel paid for the driver's work comes off the income the commission is based on.
            var fuel = await _context.Expenses
                .Where(e => e.DriverId != null && e.Category == "Fuel" && e.Date >= startDate && e.Date < endDate)
                .GroupBy(e => e.DriverId!.Value)
                .Select(g => new { DriverId = g.Key, Total = g.Sum(e => e.Amount) })
                .ToDictionaryAsync(x => x.DriverId, x => x.Total);

            return drivers.Select(driver =>
            {
                records.TryGetValue(driver.Id, out var record);

                if (record is { IsPaid: true })
                {
                    return new SalaryRow(driver.Id, driver.Name, record.BaseSalary, record.TotalIncome, record.TotalExpenses,
                        record.TotalIncome - record.TotalExpenses, record.CommissionPercent, false, record.Commission,
                        record.Allowances, record.Deductions, record.Total, record.TripsCount, record.Notes, true, record.PaidAt);
                }

                var totalIncome = collected.GetValueOrDefault(driver.Id);
                var totalExpenses = fuel.GetValueOrDefault(driver.Id);
                var netIncome = totalIncome - totalExpenses;
                var percent = driver.CommissionPercent ?? defaultPercent;
                var commission = CommissionOn(netIncome, percent);
                var allowances = record?.Allowances ?? 0;
                var deductions = record?.Deductions ?? 0;
                var total = driver.BaseSalary + commission + allowances - deductions;

                return new SalaryRow(driver.Id, driver.Name, driver.BaseSalary, totalIncome, totalExpenses, netIncome,
                    percent, driver.CommissionPercent == null, commission, allowances, deductions, total,
                    tripCounts.GetValueOrDefault(driver.Id), record?.Notes, false, null);
            }).ToList();
        }

        private async Task<DriverMonthlySalary> GetOrCreateMonthAsync(int driverId, int year, int month)
        {
            var record = await _context.DriverMonthlySalaries.FirstOrDefaultAsync(s => s.DriverId == driverId && s.Year == year && s.Month == month);
            if (record == null)
            {
                record = new DriverMonthlySalary { DriverId = driverId, Year = year, Month = month };
                _context.DriverMonthlySalaries.Add(record);
            }
            return record;
        }

        public static decimal CommissionOn(decimal netIncome, decimal percent) =>
            netIncome > 0 ? Math.Round(netIncome * percent / 100m, 2, MidpointRounding.AwayFromZero) : 0;

        private Task<decimal> GetDefaultCommissionAsync() => GetDefaultCommissionAsync(_context);

        public static async Task<decimal> GetDefaultCommissionAsync(AppDbContext context)
        {
            var setting = await context.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == DefaultCommissionKey);
            return setting != null && decimal.TryParse(setting.Value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var value)
                ? value
                : FallbackCommissionPercent;
        }
    }
}
