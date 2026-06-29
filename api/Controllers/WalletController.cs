using api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WalletController : ControllerBase
    {
        private readonly AppDbContext _context;

        public WalletController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Wallet/{customerId}
        [HttpGet("{customerId}")]
        public async Task<ActionResult> GetCustomerWallet(int customerId)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return NotFound("العميل غير موجود");

            var transactions = await _context.WalletTransactions
                .Include(w => w.Trip)
                .Where(w => w.CustomerId == customerId)
                .OrderByDescending(w => w.TransactionDate)
                .ToListAsync();

            return Ok(new {
                balance = customer.WalletBalance,
                transactions
            });
        }

        // GET: api/Wallet/daily?date=2026-06-06
        [HttpGet("daily")]
        public async Task<ActionResult> GetDailyTransactions([FromQuery] string date)
        {
            if (!DateTime.TryParse(date, out var targetDate))
                return BadRequest("تاريخ غير صالح");

            var startOfDay = targetDate.Date;
            var endOfDay = startOfDay.AddDays(1);

            var transactions = await _context.WalletTransactions
                .Include(w => w.Customer)
                .Include(w => w.Trip)
                .Where(w => w.TransactionDate >= startOfDay && w.TransactionDate < endOfDay)
                .OrderBy(w => w.TransactionDate)
                .Select(w => new {
                    w.Id,
                    w.CustomerId,
                    customerName = w.Customer != null ? w.Customer.Name : "-",
                    w.Amount,
                    w.Type,
                    w.Description,
                    w.TransactionDate,
                    w.TripId,
                    driverId = w.Trip != null ? (int?)w.Trip.DriverId : null
                })
                .ToListAsync();

            return Ok(transactions);
        }

        // POST: api/Wallet/Deposit
        [HttpPost("Deposit")]
        public async Task<IActionResult> Deposit([FromBody] DepositRequest request)
        {
            var customer = await _context.Customers.FindAsync(request.CustomerId);
            if (customer == null) return NotFound("العميل غير موجود");

            // السالب يعني دفع فلوس مقدم (إضافة لرصيده)
            // إذا كان عليه موجب (مديون 100) ودفع 100 سالب، بيصير 0
            customer.WalletBalance -= request.Amount;

            var transaction = new WalletTransaction
            {
                CustomerId = customer.Id,
                Amount = -request.Amount, // سالب لأن الدفع من بره للنظام، بيقلل الدين
                Type = "CashDeposit",
                Description = string.IsNullOrEmpty(request.Note) ? "إيداع نقدي للمحفظة" : request.Note,
                TransactionDate = DateTime.Now
            };

            _context.WalletTransactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, newBalance = customer.WalletBalance });
        }
    }

    public class DepositRequest
    {
        public int CustomerId { get; set; }
        public decimal Amount { get; set; }
        public string Note { get; set; } = string.Empty;
    }
}
