using api.Auth;
using api.Dtos;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequirePermission(Permissions.Fleet)]
    public class DriversController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IClock _clock;

        public DriversController(AppDbContext context, IClock clock)
        {
            _context = context;
            _clock = clock;
        }

        // GET: api/Drivers
        [RequirePermission(Permissions.Trips, Permissions.Fleet, Permissions.Expenses, Permissions.Wallet, Permissions.Reports)]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Driver>>> GetDrivers()
        {
            return await _context.Drivers.ToListAsync();
        }

        // GET: api/Drivers/5/stats
        [RequirePermission(Permissions.Fleet, Permissions.Reports)]
        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetDriverStats(int id)
        {
            var driverExists = await _context.Drivers.AnyAsync(d => d.Id == id);
            if (!driverExists) return NotFound();

            var completedTrips = await _context.Trips
                .Where(t => t.DriverId == id && t.Status == "Completed" && t.EndTime != null)
                .ToListAsync();

            var today = _clock.Now.Date;
            
            var todayInc = completedTrips.Where(t => t.EndTime.Value.Date == today).Sum(t => t.FinalTotal);
            
            // Week starts from Sunday or roughly last 7 days for simplicity
            var weekInc = completedTrips.Where(t => t.EndTime.Value.Date >= today.AddDays(-7)).Sum(t => t.FinalTotal);
            
            var monthInc = completedTrips.Where(t => t.EndTime.Value.Year == today.Year && t.EndTime.Value.Month == today.Month).Sum(t => t.FinalTotal);
            
            var yearInc = completedTrips.Where(t => t.EndTime.Value.Year == today.Year).Sum(t => t.FinalTotal);

            return Ok(new {
                totalTrips = completedTrips.Count,
                todayIncome = todayInc,
                weekIncome = weekInc,
                monthIncome = monthInc,
                yearIncome = yearInc
            });
        }

        // POST: api/Drivers
        [HttpPost]
        public async Task<ActionResult<Driver>> PostDriver(DriverRequest request)
        {
            var driver = new Driver { Name = request.Name.Trim(), Phone = request.Phone.Trim(), BaseSalary = request.BaseSalary, Status = "Available" };
            _context.Drivers.Add(driver);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetDrivers), new { id = driver.Id }, driver);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutDriver(int id, DriverRequest request)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null) return NotFound();

            driver.Name = request.Name.Trim();
            driver.Phone = request.Phone.Trim();
            driver.BaseSalary = request.BaseSalary;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/Drivers/5/status - manual availability; a driver on an ongoing trip stays busy
        [HttpPut("{id}/status")]
        public async Task<IActionResult> PutDriverStatus(int id, StatusRequest request)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null) return NotFound();
            if (!AvailabilityStatuses.All.Contains(request.Status)) return BadRequest(new { message = "الحالة غير صالحة." });

            var onTrip = await _context.Trips.AnyAsync(t => t.DriverId == id && t.Status == TripStatuses.Ongoing);
            if (onTrip && request.Status != "Busy") return BadRequest(new { message = "السائق في مشوار جاري حالياً." });

            driver.Status = request.Status;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/Drivers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDriver(int id)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null)
            {
                return NotFound();
            }

            // Check if driver has trips
            var hasTrips = await _context.Trips.AnyAsync(t => t.DriverId == id);
            if (hasTrips)
            {
                return BadRequest("لا يمكن حذف السائق لوجود مشاوير مسجلة باسمه. يمكنك تغيير حالته إلى غير متاح بدلاً من الحذف.");
            }

            _context.Drivers.Remove(driver);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
