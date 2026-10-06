using System;

namespace api.Models
{
    public class WalletTransaction : IHasCreator
    {
        public int Id { get; set; }
        
        public int CustomerId { get; set; }
        public Customer Customer { get; set; } = null!;
        
        public decimal Amount { get; set; } // موجب = على العميل (مديونية)، سالب = دفع أو رصيد للعميل
        public string Type { get; set; } = "TripDeduction"; // see api.Services.WalletTypes
        public string Description { get; set; } = string.Empty;
        
        public DateTime TransactionDate { get; set; }
        
        // ربط اختياري بـ المشوار عشان نعرف الخصم تم على أي مشوار
        public int? TripId { get; set; }
        public Trip? Trip { get; set; }

        // The user who recorded it (users are never hard-deleted, see User.DeletedAt).
        public int? CreatedByUserId { get; set; }
    }
}
