using System;

namespace api.Models
{
    public class WalletTransaction
    {
        public int Id { get; set; }
        
        public int CustomerId { get; set; }
        public Customer Customer { get; set; } = null!;
        
        public decimal Amount { get; set; } // الموجب خصم من المحفظة (دين)، السالب إيداع للمحفظة
        public string Type { get; set; } = "TripDeduction"; // TripDeduction, CashDeposit, CashRefund
        public string Description { get; set; } = string.Empty;
        
        public DateTime TransactionDate { get; set; } = DateTime.Now;
        
        // ربط اختياري بـ المشوار عشان نعرف الخصم تم على أي مشوار
        public int? TripId { get; set; }
        public Trip? Trip { get; set; }
    }
}
