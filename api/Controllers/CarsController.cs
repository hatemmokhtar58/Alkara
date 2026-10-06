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
    public class CarsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IClock _clock;

        public CarsController(AppDbContext context, IClock clock)
        {
            _context = context;
            _clock = clock;
        }

        [RequirePermission(Permissions.Trips, Permissions.Fleet, Permissions.Expenses, Permissions.Wallet, Permissions.Reports)]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Car>>> GetCars()
        {
            return await _context.Cars.ToListAsync();
        }

        [RequirePermission(Permissions.Fleet, Permissions.Reports)]
        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetCarStats(int id)
        {
            var carExists = await _context.Cars.AnyAsync(c => c.Id == id);
            if (!carExists) return NotFound("السيارة غير موجودة");

            var since = StatsRanges.From(_clock.Now);

            var carTrips = _context.Trips.Where(t => t.CarId == id && t.Status == TripStatuses.Completed && t.EndTime != null);
            var todayTrips = await carTrips.CountAsync(t => t.EndTime >= since.Today);
            var weekTrips = await carTrips.CountAsync(t => t.EndTime >= since.Week);
            var monthTrips = await carTrips.CountAsync(t => t.EndTime >= since.Month);
            var yearTrips = await carTrips.CountAsync(t => t.EndTime >= since.Year);
            var totalTrips = await carTrips.CountAsync();

            var carExp = _context.Expenses.Where(e => e.CarId == id);
            var todayExp = await carExp.Where(e => e.Date >= since.Today).SumAsync(e => e.Amount);
            var weekExp = await carExp.Where(e => e.Date >= since.Week).SumAsync(e => e.Amount);
            var monthExp = await carExp.Where(e => e.Date >= since.Month).SumAsync(e => e.Amount);
            var yearExp = await carExp.Where(e => e.Date >= since.Year).SumAsync(e => e.Amount);
            var totalExp = await carExp.SumAsync(e => e.Amount);

            return Ok(new {
                trips = new {
                    total = totalTrips,
                    today = todayTrips,
                    week = weekTrips,
                    month = monthTrips,
                    year = yearTrips
                },
                expenses = new {
                    total = totalExp,
                    today = todayExp,
                    week = weekExp,
                    month = monthExp,
                    year = yearExp
                }
            });
        }

        [HttpPost]
        public async Task<ActionResult<Car>> PostCar(CarRequest request)
        {
            var error = request.Validate(_clock.Now.Year);
            if (error != null) return BadRequest(new { message = error });

            var plate = PhoneNumbers.NormalizePlate(request.PlateNumber);
            if (await _context.Cars.AnyAsync(c => c.PlateNumber == plate))
                return Conflict(new { message = $"يوجد سيارة مسجلة بنفس رقم اللوحة {plate}." });

            var car = new Car { PlateNumber = plate, Make = (request.Make ?? "").Trim(), Model = (request.Model ?? "").Trim(), Color = (request.Color ?? "").Trim(), Year = request.Year, Status = "Available" };
            _context.Cars.Add(car);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCars), new { id = car.Id }, car);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCar(int id, CarRequest request)
        {
            var car = await _context.Cars.FindAsync(id);
            if (car == null) return NotFound();

            var error = request.Validate(_clock.Now.Year);
            if (error != null) return BadRequest(new { message = error });

            var plate = PhoneNumbers.NormalizePlate(request.PlateNumber);
            if (await _context.Cars.AnyAsync(c => c.PlateNumber == plate && c.Id != id))
                return Conflict(new { message = $"يوجد سيارة مسجلة بنفس رقم اللوحة {plate}." });

            car.PlateNumber = plate;
            car.Make = (request.Make ?? "").Trim();
            car.Model = (request.Model ?? "").Trim();
            car.Color = (request.Color ?? "").Trim();
            car.Year = request.Year;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/Cars/5/status - manual availability; a car on an ongoing trip stays busy
        [HttpPut("{id}/status")]
        public async Task<IActionResult> PutCarStatus(int id, StatusRequest request)
        {
            var car = await _context.Cars.FindAsync(id);
            if (car == null) return NotFound();
            if (!AvailabilityStatuses.All.Contains(request.Status)) return BadRequest(new { message = "الحالة غير صالحة." });

            var onTrip = await _context.Trips.AnyAsync(t => t.CarId == id && t.Status == TripStatuses.Ongoing);
            if (onTrip && request.Status != "Busy") return BadRequest(new { message = "السيارة في مشوار جاري حالياً." });

            car.Status = request.Status;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/Cars/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCar(int id)
        {
            var car = await _context.Cars.FindAsync(id);
            if (car == null)
            {
                return NotFound();
            }

            // Check if car has trips or expenses
            var hasTrips = await _context.Trips.AnyAsync(t => t.CarId == id);
            var hasExpenses = await _context.Expenses.AnyAsync(e => e.CarId == id);
            
            if (hasTrips || hasExpenses)
            {
                return BadRequest("لا يمكن حذف السيارة لوجود سجلات (مشاوير أو مصاريف) مرتبطة بها.");
            }

            _context.Cars.Remove(car);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
