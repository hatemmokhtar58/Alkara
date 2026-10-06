using api.Services;

namespace api.Tests;

public class TripPricingTests
{
    private static readonly DateTime Start = new(2026, 10, 1, 9, 0, 0);

    [Theory]
    [InlineData(10, 100)]   // under an hour: full first hour
    [InlineData(60, 100)]   // exactly an hour
    [InlineData(90, 150)]   // then by the minute
    [InlineData(125, 208.33)]
    public void Hourly_ChargesTheFirstHourInFullThenByTheMinute(int minutes, decimal expected)
    {
        var price = TripPricing.Calculate(PricingTypes.Hourly, 100, null, Start, Start.AddMinutes(minutes), DiscountTypes.None, 0, 0);
        Assert.Equal(expected, price.Total);
        Assert.Equal(minutes, price.DurationMinutes);
    }

    [Theory]
    [InlineData("None", 0, 0, 150)]
    [InlineData("Amount", 20, 0, 130)]
    [InlineData("Percentage", 10, 0, 135)]
    [InlineData("None", 0, 25, 175)]
    [InlineData("Amount", 20, 25, 155)]
    [InlineData("Amount", 500, 0, 0)]       // discount larger than the price never goes negative
    [InlineData("Percentage", 100, 0, 0)]
    public void Fixed_AppliesDiscountAndExtraCharge(string discountType, decimal discount, decimal extra, decimal expected)
    {
        var price = TripPricing.Calculate(PricingTypes.Fixed, null, 150, Start, Start.AddMinutes(200), discountType, discount, extra);
        Assert.Equal(expected, price.Total);
    }

    [Fact]
    public void Fixed_IgnoresDuration()
    {
        var shortTrip = TripPricing.Calculate(PricingTypes.Fixed, null, 85, Start, Start.AddMinutes(5), DiscountTypes.None, 0, 0);
        var longTrip = TripPricing.Calculate(PricingTypes.Fixed, null, 85, Start, Start.AddHours(5), DiscountTypes.None, 0, 0);
        Assert.Equal(85, shortTrip.Total);
        Assert.Equal(85, longTrip.Total);
    }
}
