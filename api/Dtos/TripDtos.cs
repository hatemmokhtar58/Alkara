namespace api.Dtos
{
    public class CreateTripRequest
    {
        public int CustomerId { get; set; }
        public int DriverId { get; set; }
        public int CarId { get; set; }
        public DateTime? ScheduledFor { get; set; }
        public string? PickupLocation { get; set; }
        public string? DropoffLocation { get; set; }
        public string? PricingType { get; set; }
        public decimal? HourlyRate { get; set; }
        public decimal? FixedPrice { get; set; }
        public string? Notes { get; set; }
    }

    /// <summary>Changes allowed while a trip is still scheduled or ongoing.</summary>
    public class UpdateTripRequest
    {
        public DateTime? ScheduledFor { get; set; }
        public int? DriverId { get; set; }
        public int? CarId { get; set; }
        public string? PickupLocation { get; set; }
        public string? DropoffLocation { get; set; }
        public string? PricingType { get; set; }
        public decimal? HourlyRate { get; set; }
        public decimal? FixedPrice { get; set; }
        public string? Notes { get; set; }
    }

    public class CompleteTripRequest
    {
        public string PricingType { get; set; } = string.Empty;
        public decimal? HourlyRate { get; set; }
        public decimal? FixedPrice { get; set; }

        public string DiscountType { get; set; } = "None"; // None, Amount, Percentage
        public decimal DiscountValue { get; set; }
        public decimal ExtraCharge { get; set; }

        public string PaymentMethod { get; set; } = "Cash"; // Cash, Transfer, Wallet

        // Cash/Transfer: what the customer actually paid. Empty means paid in full.
        // Ignored for Wallet, where the trip is taken from the customer's credit.
        public decimal? PaidAmount { get; set; }

        // Old debt collected in cash during this trip.
        public decimal CollectionAmount { get; set; }

        public string? Notes { get; set; }
    }
}
