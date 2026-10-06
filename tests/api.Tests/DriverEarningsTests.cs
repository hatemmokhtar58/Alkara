using System.Net.Http.Json;
using System.Text.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

public class DriverEarningsTests
{
    private static async Task<JsonElement> EarningsAsync(HttpClient client, int year, int month) =>
        await client.GetFromJsonAsync<JsonElement>($"/api/Reports/driver-earnings?period=monthly&year={year}&month={month}");

    private static decimal Collected(JsonElement report, int driverId) =>
        report.GetProperty("drivers").EnumerateArray()
            .Where(d => d.GetProperty("driverId").GetInt32() == driverId)
            .Select(d => d.GetProperty("collected").GetDecimal())
            .SingleOrDefault();

    private static decimal Outstanding(JsonElement report, int driverId) =>
        report.GetProperty("drivers").EnumerateArray()
            .Where(d => d.GetProperty("driverId").GetInt32() == driverId)
            .Select(d => d.GetProperty("outstanding").GetDecimal())
            .SingleOrDefault();

    private static async Task<decimal> SalaryIncomeAsync(HttpClient client, int driverId, int year, int month)
    {
        var data = await client.GetFromJsonAsync<JsonElement>($"/api/Salaries?month={month}&year={year}");
        return data.GetProperty("drivers").EnumerateArray()
            .Single(d => d.GetProperty("driverId").GetInt32() == driverId).GetProperty("totalIncome").GetDecimal();
    }

    private static async Task TransferAsync(HttpClient client, int customerId, decimal amount)
    {
        var response = await client.PostAsJsonAsync("/api/Wallet/Deposit", new { customerId, amount, method = "Transfer", note = "تحويل" });
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Transfers_PayTheOldestTrips_First_AndCountInTheMonthReceived()
    {
        await using var factory = new AlkaraApiFactory();
        factory.Clock.Now = new DateTime(2026, 10, 5, 10, 0, 0);
        var admin = await factory.CreateAdminClientAsync();
        var ayman = await admin.CreateCustomerAsync("أيمن");
        var car = await admin.CreateCarAsync();
        var ahmed = await admin.CreateDriverAsync("أحمد");
        var mohamed = await admin.CreateDriverAsync("محمد");
        var ali = await admin.CreateDriverAsync("علي");
        var khalid = await admin.CreateDriverAsync("خالد");

        // 10 unpaid trips, 800 in total, in this order.
        foreach (var (driver, price) in new[]
        {
            (ahmed, 100m), (ahmed, 50m), (mohamed, 100m),
            (ali, 100m), (ali, 100m), (ali, 50m),
            (khalid, 100m), (khalid, 100m), (khalid, 50m), (khalid, 50m),
        })
        {
            await admin.RunFixedTripAsync(ayman, driver, car, price, paidAmount: 0);
        }

        var october = await EarningsAsync(admin, 2026, 10);
        Assert.Equal(0, october.GetProperty("totals").GetProperty("collected").GetDecimal());
        Assert.Equal(800, october.GetProperty("totals").GetProperty("outstanding").GetDecimal());

        // 300 transferred in October: Ahmed 150, Mohamed 100, Ali 50.
        factory.Clock.Now = new DateTime(2026, 10, 20, 10, 0, 0);
        await TransferAsync(admin, ayman, 300);
        october = await EarningsAsync(admin, 2026, 10);
        Assert.Equal(150, Collected(october, ahmed));
        Assert.Equal(100, Collected(october, mohamed));
        Assert.Equal(50, Collected(october, ali));
        Assert.Equal(0, Collected(october, khalid));
        Assert.Equal(200, Outstanding(october, ali));
        Assert.Equal(300, Outstanding(october, khalid));
        Assert.Equal(15, october.GetProperty("drivers").EnumerateArray().Single(d => d.GetProperty("driverId").GetInt32() == ahmed).GetProperty("commission").GetDecimal());

        // 200 more in November: all of it goes to Ali, and counts in November only.
        factory.Clock.Now = new DateTime(2026, 11, 3, 10, 0, 0);
        await TransferAsync(admin, ayman, 200);
        var november = await EarningsAsync(admin, 2026, 11);
        Assert.Equal(200, Collected(november, ali));
        Assert.Equal(0, Collected(november, ahmed));
        Assert.Equal(300, Outstanding(november, khalid));
        Assert.Equal(50, Collected(await EarningsAsync(admin, 2026, 10), ali));

        // Salaries follow the same money.
        Assert.Equal(50, await SalaryIncomeAsync(admin, ali, 2026, 10));
        Assert.Equal(200, await SalaryIncomeAsync(admin, ali, 2026, 11));
        Assert.Equal(150, await SalaryIncomeAsync(admin, ahmed, 2026, 10));
        Assert.Equal(0, await SalaryIncomeAsync(admin, khalid, 2026, 11));
    }

    [Fact]
    public async Task CashAtTheEndOfATrip_PaysThatTrip_AndPrepaidMoneyCountsOnTheTripDay()
    {
        await using var factory = new AlkaraApiFactory();
        factory.Clock.Now = new DateTime(2026, 9, 10, 10, 0, 0);
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync();
        var car = await admin.CreateCarAsync();
        var first = await admin.CreateDriverAsync("الأول");
        var second = await admin.CreateDriverAsync("الثاني");

        // An older unpaid trip, then a trip paid in cash: the cash stays with its own trip.
        await admin.RunFixedTripAsync(customer, first, car, 100, paidAmount: 0);
        await admin.RunFixedTripAsync(customer, second, car, 70);
        var september = await EarningsAsync(admin, 2026, 9);
        Assert.Equal(70, Collected(september, second));
        Assert.Equal(0, Collected(september, first));
        Assert.Equal(100, Outstanding(september, first));

        // Prepaid in September clears the old debt and leaves 50 credit for an October trip.
        await admin.DepositAsync(customer, 150);
        factory.Clock.Now = new DateTime(2026, 10, 2, 10, 0, 0);
        await admin.RunFixedTripAsync(customer, second, car, 50, paymentMethod: "Wallet");

        september = await EarningsAsync(admin, 2026, 9);
        Assert.Equal(100, Collected(september, first));
        Assert.Equal(70, Collected(september, second));
        Assert.Equal(50, Collected(await EarningsAsync(admin, 2026, 10), second));
    }
}
