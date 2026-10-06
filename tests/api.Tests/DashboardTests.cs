using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

public class DashboardTests
{
    [Fact]
    public async Task TodaySummary_ShowsRevenueCashAndWhatCustomersOwe()
    {
        await using var factory = new AlkaraApiFactory();
        factory.Clock.Now = new DateTime(2026, 10, 10, 9, 0, 0);
        var admin = await factory.CreateAdminClientAsync();
        var payer = await admin.CreateCustomerAsync("يدفع");
        var debtor = await admin.CreateCustomerAsync("عليه");
        var prepaid = await admin.CreateCustomerAsync("مقدم");
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();

        // Yesterday's trip does not count today.
        factory.Clock.Now = new DateTime(2026, 10, 9, 22, 0, 0);
        await admin.RunFixedTripAsync(payer, driver, car, 700);

        factory.Clock.Now = new DateTime(2026, 10, 10, 9, 0, 0);
        await admin.RunFixedTripAsync(payer, driver, car, 1000);
        await admin.RunFixedTripAsync(debtor, driver, car, 500, paidAmount: 0);
        await admin.DepositAsync(prepaid, 200);
        (await admin.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = 100, driverId = driver, carId = car })).EnsureSuccessStatusCode();

        var today = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/today");
        Assert.Equal(2, today.GetProperty("tripsCount").GetInt32());
        Assert.Equal(1500, today.GetProperty("revenue").GetDecimal());
        Assert.Equal(1100, today.GetProperty("cashNet").GetDecimal()); // 1000 cash + 200 deposit - 100 fuel
        Assert.Equal(500, today.GetProperty("debt").GetDecimal());
        Assert.Equal(1, today.GetProperty("customersOwing").GetInt32());

        // The summary is for admins only, even an accountant with every permission does not get it.
        var accountant = await factory.CreateEmployeeClientAsync("acc" + Guid.NewGuid().ToString("N")[..6], "trips", "fleet", "expenses", "wallet", "reports");
        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.GetAsync("/api/Reports/today")).StatusCode);
    }
}
