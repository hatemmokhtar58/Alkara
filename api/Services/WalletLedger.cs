using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services
{
    /// <summary>
    /// Wallet transaction types. Amount sign: positive = the customer owes more, negative = the customer paid or has credit.
    /// A customer's balance is always the sum of their transactions.
    /// </summary>
    public static class WalletTypes
    {
        public const string TripCharge = "TripCharge";         // + trip total
        public const string TripPayment = "TripPayment";       // - cash or transfer paid at the end of a trip
        public const string CashCollection = "CashCollection"; // - old debt collected by the driver during a trip
        public const string CashDeposit = "CashDeposit";       // - payment or prepaid credit recorded from the wallet page
        public const string Reversal = "Reversal";             // opposite of a cancelled trip's entries
        public const string Adjustment = "Adjustment";         // opening balance carried over from the old stored balance
    }

    public class WalletLedger
    {
        private readonly AppDbContext _context;
        private readonly IClock _clock;

        public WalletLedger(AppDbContext context, IClock clock)
        {
            _context = context;
            _clock = clock;
        }

        /// <summary>
        /// Locks the customer's row until the surrounding database transaction ends, so two
        /// money operations for the same customer cannot interleave.
        /// </summary>
        public async Task LockCustomerAsync(int customerId)
        {
            await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM Customers WHERE Id = {customerId} FOR UPDATE");
        }

        public Task<decimal> GetBalanceAsync(int customerId) =>
            _context.WalletTransactions.Where(w => w.CustomerId == customerId).SumAsync(w => w.Amount);

        public WalletTransaction Add(int customerId, decimal amount, string type, string description, int? tripId = null)
        {
            var transaction = new WalletTransaction
            {
                CustomerId = customerId,
                Amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero),
                Type = type,
                Description = description,
                TripId = tripId,
                TransactionDate = _clock.Now
            };
            _context.WalletTransactions.Add(transaction);
            return transaction;
        }
    }
}
