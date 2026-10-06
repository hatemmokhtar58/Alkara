namespace api.Services
{
    public static class PricingTypes
    {
        public const string Hourly = "Hourly";
        public const string Fixed = "Fixed";
    }

    public static class DiscountTypes
    {
        public const string None = "None";
        public const string Amount = "Amount";
        public const string Percentage = "Percentage";
    }

    public record TripPrice(decimal BasePrice, decimal Discount, decimal ExtraCharge, decimal Total, int DurationMinutes);

    /// <summary>The one place a trip's price is calculated.</summary>
    public static class TripPricing
    {
        /// <summary>
        /// Hourly: the first hour is charged in full, after that by the minute.
        /// Fixed: the agreed price. Discount and extra charge apply to both; the total never goes below zero.
        /// </summary>
        public static TripPrice Calculate(
            string pricingType, decimal? hourlyRate, decimal? fixedPrice,
            DateTime? startTime, DateTime endTime,
            string? discountType, decimal discountValue, decimal extraCharge)
        {
            var minutes = startTime.HasValue ? Math.Max(0, (decimal)(endTime - startTime.Value).TotalMinutes) : 0;

            decimal basePrice;
            if (pricingType == PricingTypes.Hourly)
            {
                var rate = hourlyRate ?? 0;
                basePrice = minutes <= 60 ? rate : rate + (minutes - 60) * rate / 60m;
            }
            else
            {
                basePrice = fixedPrice ?? 0;
            }
            basePrice = Math.Round(basePrice, 2, MidpointRounding.AwayFromZero);

            var discount = discountType switch
            {
                DiscountTypes.Amount => discountValue,
                DiscountTypes.Percentage => basePrice * discountValue / 100m,
                _ => 0
            };
            discount = Math.Round(Math.Min(discount, basePrice + extraCharge), 2, MidpointRounding.AwayFromZero);

            var total = Math.Max(0, basePrice + extraCharge - discount);
            return new TripPrice(basePrice, discount, extraCharge, Math.Round(total, 2, MidpointRounding.AwayFromZero), (int)Math.Round(minutes));
        }
    }
}
