using api.Auth;
using api.Dtos;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequirePermission(Permissions.Expenses)]
    public class ExpensesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IClock _clock;

        public ExpensesController(AppDbContext context, IClock clock)
        {
            _context = context;
            _clock = clock;
        }

        // GET: api/Expenses?page=1&pageSize=50 - newest first
        [RequirePermission(Permissions.Expenses, Permissions.Reports)]
        [HttpGet]
        public async Task<ActionResult> GetExpenses([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var total = await _context.Expenses.CountAsync();
            var items = await _context.Expenses.AsNoTracking()
                .OrderByDescending(e => e.Date).ThenByDescending(e => e.Id)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(e => new
                {
                    e.Id, e.Category, e.Amount, e.Note, e.Date, e.DriverId, e.CarId,
                    driverName = e.Driver != null ? e.Driver.Name : null,
                    carPlate = e.Car != null ? e.Car.PlateNumber : null
                })
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        // POST: api/Expenses
        [HttpPost]
        public async Task<ActionResult> PostExpense(ExpenseRequest request)
        {
            var error = request.Validate();
            if (error != null) return BadRequest(new { message = error });

            if (request.DriverId is { } driverId && !await _context.Drivers.AnyAsync(d => d.Id == driverId))
                return BadRequest(new { message = "السائق غير موجود." });
            if (request.CarId is { } carId && !await _context.Cars.AnyAsync(c => c.Id == carId))
                return BadRequest(new { message = "السيارة غير موجودة." });

            var expense = new Expense
            {
                Category = request.Category,
                Amount = request.Amount,
                Note = request.Note?.Trim() ?? string.Empty,
                DriverId = request.DriverId,
                CarId = request.CarId,
                Date = _clock.Now
            };
            _context.Expenses.Add(expense);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetExpenses), new { id = expense.Id },
                new { expense.Id, expense.Category, expense.Amount, expense.Note, expense.Date, expense.DriverId, expense.CarId });
        }
    }
}
