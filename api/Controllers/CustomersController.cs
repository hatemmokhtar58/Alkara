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
    public class CustomersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IClock _clock;

        public CustomersController(AppDbContext context, IClock clock)
        {
            _context = context;
            _clock = clock;
        }

        [RequirePermission(Permissions.Trips, Permissions.Fleet, Permissions.Expenses, Permissions.Wallet, Permissions.Reports)]
        [HttpGet]
        public async Task<ActionResult> GetCustomers()
        {
            var customers = await _context.Customers
                .OrderBy(c => c.Name)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Phone,
                    c.CreatedAt,
                    WalletBalance = c.WalletTransactions.Sum(w => w.Amount)
                })
                .ToListAsync();
            return Ok(customers);
        }

        [RequirePermission(Permissions.Fleet, Permissions.Reports, Permissions.Wallet)]
        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetCustomerStats(int id)
        {
            var customerExists = await _context.Customers.AnyAsync(c => c.Id == id);
            if (!customerExists) return NotFound();

            var completedTrips = _context.Trips.Where(t => t.CustomerId == id && t.Status == TripStatuses.Completed && t.EndTime != null);
            var since = StatsRanges.From(_clock.Now);

            var todaySpent = await completedTrips.Where(t => t.EndTime >= since.Today).SumAsync(t => t.FinalTotal);
            var weekSpent = await completedTrips.Where(t => t.EndTime >= since.Week).SumAsync(t => t.FinalTotal);
            var monthSpent = await completedTrips.Where(t => t.EndTime >= since.Month).SumAsync(t => t.FinalTotal);
            var yearSpent = await completedTrips.Where(t => t.EndTime >= since.Year).SumAsync(t => t.FinalTotal);

            return Ok(new {
                totalTrips = await completedTrips.CountAsync(),
                todaySpent = todaySpent,
                weekSpent = weekSpent,
                monthSpent = monthSpent,
                yearSpent = yearSpent
            });
        }

        [RequirePermission(Permissions.Fleet, Permissions.Trips)]
        [HttpPost]
        public async Task<ActionResult> PostCustomer(CustomerRequest request)
        {
            var error = request.Validate();
            if (error != null) return BadRequest(new { message = error });

            var phone = PhoneNumbers.NormalizeSaudiMobile(request.Phone)!;
            var existing = await _context.Customers.FirstOrDefaultAsync(c => c.Phone == phone);
            if (existing != null)
                return Conflict(new { message = $"الرقم {phone} مسجل بالفعل باسم العميل {existing.Name}." });

            var customer = new Customer { Name = request.Name.Trim(), Phone = phone, CreatedAt = _clock.Now };
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCustomers), new { id = customer.Id }, new { customer.Id, customer.Name, customer.Phone, customer.CreatedAt, WalletBalance = 0m });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCustomer(int id, CustomerRequest request)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();

            var error = request.Validate();
            if (error != null) return BadRequest(new { message = error });

            var phone = PhoneNumbers.NormalizeSaudiMobile(request.Phone)!;
            var existing = await _context.Customers.FirstOrDefaultAsync(c => c.Phone == phone && c.Id != id);
            if (existing != null)
                return Conflict(new { message = $"الرقم {phone} مسجل بالفعل باسم العميل {existing.Name}." });

            // Only the contact details; the balance comes from wallet transactions.
            customer.Name = request.Name.Trim();
            customer.Phone = phone;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null)
            {
                return NotFound();
            }

            var hasTrips = await _context.Trips.AnyAsync(t => t.CustomerId == id);
            var hasTransactions = await _context.WalletTransactions.AnyAsync(w => w.CustomerId == id);

            if (hasTrips || hasTransactions)
            {
                return BadRequest("لا يمكن حذف العميل لوجود مشاوير أو حركات مالية مسجلة باسمه.");
            }

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
