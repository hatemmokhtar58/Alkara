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

        // GET: api/Expenses
        [RequirePermission(Permissions.Expenses, Permissions.Reports)]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Expense>>> GetExpenses()
        {
            return await _context.Expenses
                .Include(e => e.Car)
                .Include(e => e.Driver)
                .OrderByDescending(e => e.Date)
                .ToListAsync();
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
