using api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CarsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CarsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Car>>> GetCars()
        {
            return await _context.Cars.ToListAsync();
        }

        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetCarStats(int id)
        {
            var carExists = await _context.Cars.AnyAsync(c => c.Id == id);
            if (!carExists) return NotFound("السيارة غير موجودة");

            var today = DateTime.Today;

            // Trips
            var carTrips = await _context.Trips
                .Where(t => t.CarId == id && t.Status == "Completed" && t.EndTime != null)
                .ToListAsync();

            var todayTrips = carTrips.Count(t => t.EndTime.Value.Date == today);
            var weekTrips = carTrips.Count(t => t.EndTime.Value.Date >= today.AddDays(-7));
            var monthTrips = carTrips.Count(t => t.EndTime.Value.Year == today.Year && t.EndTime.Value.Month == today.Month);
            var yearTrips = carTrips.Count(t => t.EndTime.Value.Year == today.Year);
            var totalTrips = carTrips.Count;

            // Expenses
            var carExp = await _context.Expenses
                .Where(e => e.CarId == id)
                .ToListAsync();

            var todayExp = carExp.Where(e => e.Date.Date == today).Sum(e => e.Amount);
            var weekExp = carExp.Where(e => e.Date.Date >= today.AddDays(-7)).Sum(e => e.Amount);
            var monthExp = carExp.Where(e => e.Date.Year == today.Year && e.Date.Month == today.Month).Sum(e => e.Amount);
            var yearExp = carExp.Where(e => e.Date.Year == today.Year).Sum(e => e.Amount);
            var totalExp = carExp.Sum(e => e.Amount);

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
        public async Task<ActionResult<Car>> PostCar(Car car)
        {
            _context.Cars.Add(car);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCars), new { id = car.Id }, car);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCar(int id, Car car)
        {
            if (id != car.Id)
            {
                return BadRequest();
            }

            _context.Entry(car).State = EntityState.Modified;
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
