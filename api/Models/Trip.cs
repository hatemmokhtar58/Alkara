using System;

namespace api.Models
{
    public class Trip
    {
        public int Id { get; set; }
        
        // Foreign Keys
        public int CustomerId { get; set; }
        public Customer? Customer { get; set; }
        
        public int DriverId { get; set; }
        public Driver? Driver { get; set; }
        
        public int CarId { get; set; }
        public Car? Car { get; set; }

        // Times
        public DateTime RequestTime { get; set; } = DateTime.Now;
        public DateTime? ScheduledFor { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }

        // Routing
        public string? PickupLocation { get; set; }
        public string? DropoffLocation { get; set; }

        // Pricing
        public string? PricingType { get; set; } = null; // "Fixed" or "Hourly", now optional at creation
        public decimal? HourlyRate { get; set; }
        public decimal? FixedPrice { get; set; }
        
        // Discount
        public string DiscountType { get; set; } = "None"; // "Amount", "Percentage", "None"
        public decimal DiscountValue { get; set; }
        
        // Final Status
        public decimal FinalTotal { get; set; }
        public string Status { get; set; } = "Scheduled"; // Scheduled, Ongoing, Completed, Cancelled
        public string PaymentMethod { get; set; } = "Cash"; // Cash, Wallet
    }
}
