using api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CustomersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CustomersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Customer>>> GetCustomers()
        {
            return await _context.Customers.ToListAsync();
        }

        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetCustomerStats(int id)
        {
            var customerExists = await _context.Customers.AnyAsync(c => c.Id == id);
            if (!customerExists) return NotFound();

            var completedTrips = await _context.Trips
                .Where(t => t.CustomerId == id && t.Status == "Completed" && t.EndTime != null)
                .ToListAsync();

            var today = DateTime.Today;
            
            var todaySpent = completedTrips.Where(t => t.EndTime.Value.Date == today).Sum(t => t.FinalTotal);
            var weekSpent = completedTrips.Where(t => t.EndTime.Value.Date >= today.AddDays(-7)).Sum(t => t.FinalTotal);
            var monthSpent = completedTrips.Where(t => t.EndTime.Value.Year == today.Year && t.EndTime.Value.Month == today.Month).Sum(t => t.FinalTotal);
            var yearSpent = completedTrips.Where(t => t.EndTime.Value.Year == today.Year).Sum(t => t.FinalTotal);

            return Ok(new {
                totalTrips = completedTrips.Count,
                todaySpent = todaySpent,
                weekSpent = weekSpent,
                monthSpent = monthSpent,
                yearSpent = yearSpent
            });
        }

        [HttpPost]
        public async Task<ActionResult<Customer>> PostCustomer(Customer customer)
        {
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCustomers), new { id = customer.Id }, customer);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCustomer(int id, Customer customer)
        {
            if (id != customer.Id)
            {
                return BadRequest();
            }

            _context.Entry(customer).State = EntityState.Modified;
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
