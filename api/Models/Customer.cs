using System;
using System.Collections.Generic;

namespace api.Models
{
    public class Customer
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }

        // The wallet balance is not stored: it is the sum of WalletTransactions.Amount
        // (positive = the customer owes us, negative = the customer has credit).
        public ICollection<WalletTransaction> WalletTransactions { get; set; } = new List<WalletTransaction>();

        public ICollection<Trip> Trips { get; set; } = new List<Trip>();
    }
}
