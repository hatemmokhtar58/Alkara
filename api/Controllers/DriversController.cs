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
        public async Task<ActionResult> GetDrivers()
        {
            // LastCarId lets the dashboard suggest the car the driver used last.
            var drivers = await _context.Drivers
                .OrderBy(d => d.Id)
                .Select(d => new
                {
                    d.Id, d.Name, d.Phone, d.Status, d.BaseSalary, d.CommissionPercent,
                    lastCarId = d.Trips.OrderByDescending(t => t.Id).Select(t => (int?)t.CarId).FirstOrDefault(),
                    onTrip = d.Trips.Any(t => t.Status == TripStatuses.Ongoing)
                })
                .ToListAsync();
            return Ok(drivers);
        }

        // GET: api/Drivers/5/stats
        [RequirePermission(Permissions.Fleet, Permissions.Reports)]
        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetDriverStats(int id)
        {
            var driverExists = await _context.Drivers.AnyAsync(d => d.Id == id);
            if (!driverExists) return NotFound();

            var completedTrips = _context.Trips.Where(t => t.DriverId == id && t.Status == TripStatuses.Completed && t.EndTime != null);
            var since = StatsRanges.From(_clock.Now);

            // "Week" is the last 7 days.
            var todayInc = await completedTrips.Where(t => t.EndTime >= since.Today).SumAsync(t => t.FinalTotal);
            var weekInc = await completedTrips.Where(t => t.EndTime >= since.Week).SumAsync(t => t.FinalTotal);
            var monthInc = await completedTrips.Where(t => t.EndTime >= since.Month).SumAsync(t => t.FinalTotal);
            var yearInc = await completedTrips.Where(t => t.EndTime >= since.Year).SumAsync(t => t.FinalTotal);

            return Ok(new {
                totalTrips = await completedTrips.CountAsync(),
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
            var error = request.Validate();
            if (error != null) return BadRequest(new { message = error });

            var driver = new Driver { Name = request.Name.Trim(), Phone = PhoneNumbers.NormalizeSaudiMobile(request.Phone)!, BaseSalary = request.BaseSalary, Status = "Available" };
            _context.Drivers.Add(driver);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetDrivers), new { id = driver.Id }, driver);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutDriver(int id, DriverRequest request)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null) return NotFound();

            var error = request.Validate();
            if (error != null) return BadRequest(new { message = error });

            driver.Name = request.Name.Trim();
            driver.Phone = PhoneNumbers.NormalizeSaudiMobile(request.Phone)!;
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
