using api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SalariesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SalariesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Salaries?month=5&year=2026&percentage=10
        [HttpGet]
        public async Task<ActionResult<object>> GetSalaries([FromQuery] int? month, [FromQuery] int? year, [FromQuery] decimal percentage = 10)
        {
            var now = DateTime.Now;
            int targetMonth = month ?? now.Month;
            int targetYear = year ?? now.Year;

            var startDate = new DateTime(targetYear, targetMonth, 1);
            var endDate = startDate.AddMonths(1);

            var drivers = await _context.Drivers.ToListAsync();

            // Get completed trips in the period
            var trips = await _context.Trips
                .Where(t => t.Status == "Completed" && t.EndTime != null
                    && t.EndTime >= startDate && t.EndTime < endDate)
                .ToListAsync();

            // Get fuel expenses only in the period linked to drivers
            var expenses = await _context.Expenses
                .Where(e => e.DriverId != null && e.Category == "Fuel" && e.Date >= startDate && e.Date < endDate)
                .ToListAsync();

            var result = drivers.Select(driver =>
            {
                var driverTrips = trips.Where(t => t.DriverId == driver.Id).ToList();
                var totalIncome = driverTrips.Sum(t => t.FinalTotal);
                var totalExpenses = expenses.Where(e => e.DriverId == driver.Id).Sum(e => e.Amount);
                var netIncome = totalIncome - totalExpenses;
                var commission = netIncome > 0 ? netIncome * (percentage / 100m) : 0;
                var totalSalary = driver.BaseSalary + commission;

                return new
                {
                    driverId = driver.Id,
                    driverName = driver.Name,
                    baseSalary = driver.BaseSalary,
                    totalIncome = totalIncome,
                    totalExpenses = totalExpenses,
                    netIncome = netIncome,
                    commission = commission,
                    totalSalary = totalSalary,
                    tripsCount = driverTrips.Count
                };
            }).ToList();

            return Ok(new
            {
                month = targetMonth,
                year = targetYear,
                percentage = percentage,
                drivers = result,
                totals = new
                {
                    totalBaseSalary = result.Sum(r => r.baseSalary),
                    totalIncome = result.Sum(r => r.totalIncome),
                    totalExpenses = result.Sum(r => r.totalExpenses),
                    totalNetIncome = result.Sum(r => r.netIncome),
                    totalCommission = result.Sum(r => r.commission),
                    totalSalaries = result.Sum(r => r.totalSalary)
                }
            });
        }
    }
}
