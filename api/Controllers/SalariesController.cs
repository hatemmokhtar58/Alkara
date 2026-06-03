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

        // GET: api/Salaries?month=5&year=2026
        [HttpGet]
        public async Task<ActionResult<object>> GetSalaries([FromQuery] int? month, [FromQuery] int? year)
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
                var salary = netIncome > 0 ? netIncome * 0.10m : 0;

                return new
                {
                    driverId = driver.Id,
                    driverName = driver.Name,
                    driverPhone = driver.Phone,
                    totalIncome = totalIncome,
                    totalExpenses = totalExpenses,
                    netIncome = netIncome,
                    salaryPercentage = 10,
                    salary = salary,
                    tripsCount = driverTrips.Count
                };
            }).ToList();

            return Ok(new
            {
                month = targetMonth,
                year = targetYear,
                drivers = result,
                totalSalaries = result.Sum(r => r.salary)
            });
        }
    }
}
