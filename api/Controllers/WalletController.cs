using api.Auth;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequirePermission(Permissions.Wallet)]
    public class WalletController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly WalletLedger _wallet;

        public WalletController(AppDbContext context, WalletLedger wallet)
        {
            _context = context;
            _wallet = wallet;
        }

        // GET: api/Wallet/{customerId}
        [RequirePermission(Permissions.Wallet, Permissions.Reports)]
        [HttpGet("{customerId}")]
        public async Task<ActionResult> GetCustomerWallet(int customerId)
        {
            var customer = await _context.Customers.FindAsync(customerId);
            if (customer == null) return NotFound(new { message = "العميل غير موجود" });

            var transactions = await _context.WalletTransactions
                .Where(w => w.CustomerId == customerId)
                .OrderByDescending(w => w.TransactionDate)
                .ThenByDescending(w => w.Id)
                .Select(w => new
                {
                    w.Id,
                    w.CustomerId,
                    w.Amount,
                    w.Type,
                    w.Description,
                    w.TransactionDate,
                    w.TripId,
                    createdBy = _context.Users.IgnoreQueryFilters().Where(u => u.Id == w.CreatedByUserId).Select(u => u.Username).FirstOrDefault()
                })
                .ToListAsync();

            return Ok(new {
                balance = transactions.Sum(t => t.Amount),
                transactions
            });
        }

        // GET: api/Wallet/daily?date=2026-06-06
        [RequirePermission(Permissions.Wallet, Permissions.Reports)]
        [HttpGet("daily")]
        public async Task<ActionResult> GetDailyTransactions([FromQuery] string date)
        {
            if (!DateTime.TryParse(date, out var targetDate))
                return BadRequest(new { message = "تاريخ غير صالح" });

            var startOfDay = targetDate.Date;
            var endOfDay = startOfDay.AddDays(1);

            var transactions = await _context.WalletTransactions
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

        // POST: api/Wallet/Deposit - money received from the customer (settles debt first, the rest is credit)
        [HttpPost("Deposit")]
        public async Task<IActionResult> Deposit([FromBody] DepositRequest request)
        {
            if (request.Amount <= 0)
                return BadRequest(new { message = "المبلغ يجب أن يكون أكبر من صفر." });
            if (request.Method != PaymentMethods.Cash && request.Method != PaymentMethods.Transfer)
                return BadRequest(new { message = "طريقة الدفع غير صالحة." });
            var isTransfer = request.Method == PaymentMethods.Transfer;

            await using var transaction = await _context.Database.BeginTransactionAsync();

            var customer = await _context.Customers.FindAsync(request.CustomerId);
            if (customer == null) return NotFound(new { message = "العميل غير موجود" });

            await _wallet.LockCustomerAsync(customer.Id);
            _wallet.Add(customer.Id, -request.Amount, isTransfer ? WalletTypes.TransferDeposit : WalletTypes.CashDeposit,
                string.IsNullOrWhiteSpace(request.Note) ? (isTransfer ? "تحويل للإدارة" : "إيداع نقدي للمحفظة") : request.Note.Trim());

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { success = true, newBalance = await _wallet.GetBalanceAsync(customer.Id) });
        }
    }

    public class DepositRequest
    {
        public int CustomerId { get; set; }
        public decimal Amount { get; set; }
        public string Note { get; set; } = string.Empty;
        // Cash counts in the cash box; Transfer only settles the customer's balance
        public string Method { get; set; } = PaymentMethods.Cash;
    }
}
