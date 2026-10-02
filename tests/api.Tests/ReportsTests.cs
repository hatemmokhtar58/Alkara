using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

public class ReportsTests
{
    private static async Task AddFuelAsync(HttpClient client, int driverId, decimal amount)
    {
        var response = await client.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount, driverId });
        response.EnsureSuccessStatusCode();
    }

    /// <summary>
    /// 10 May: driver A, 150 cash with 100 paid (50 debt) and 200 by transfer with 20 old debt collected, 30 fuel, a 40 deposit.
    /// 9 May: driver B, 80 cash.
    /// </summary>
    private static async Task<(AlkaraApiFactory Factory, HttpClient Admin, int DriverA, int DriverB)> SeedAsync()
    {
        var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync("عميل التقارير");
        var driverA = await admin.CreateDriverAsync("أ سائق");
        var driverB = await admin.CreateDriverAsync("ب سائق");
        var car = await admin.CreateCarAsync();
        var car2 = await admin.CreateCarAsync();

        factory.Clock.Now = new DateTime(2026, 5, 9, 22, 30, 0);
        await admin.RunFixedTripAsync(customer, driverB, car2, 80, "Cash");

        factory.Clock.Now = new DateTime(2026, 5, 10, 9, 0, 0);
        await admin.RunFixedTripAsync(customer, driverA, car, 150, "Cash", paidAmount: 100);
        factory.Clock.Now = new DateTime(2026, 5, 10, 13, 0, 0);
        await admin.RunFixedTripAsync(customer, driverA, car, 200, "Transfer", collectionAmount: 20);
        await AddFuelAsync(admin, driverA, 30);
        (await admin.PostAsJsonAsync("/api/Wallet/Deposit", new { customerId = customer, amount = 40 })).EnsureSuccessStatusCode();

        // Not counted: a trip that never finished
        await admin.CreateTripAsync(customer, driverA, car);
        return (factory, admin, driverA, driverB);
    }

    [Fact]
    public async Task Statement_GroupsCompletedTripsAndExpensesByDriver()
    {
        var (factory, admin, driverA, _) = await SeedAsync();
        await using var _ = factory;

        var daily = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/statement?period=daily&year=2026&month=5&day=10");
        var drivers = daily.GetProperty("drivers").EnumerateArray().ToList();
        var a = Assert.Single(drivers);
        Assert.Equal(driverA, a.GetProperty("driverId").GetInt32());
        Assert.Equal(new[] { "trip", "trip", "expense" }, a.GetProperty("rows").EnumerateArray().Select(r => r.GetProperty("kind").GetString()));

        var totals = daily.GetProperty("totals");
        Assert.Equal(350, totals.GetProperty("finalTotal").GetDecimal());
        Assert.Equal(100, totals.GetProperty("cash").GetDecimal());
        Assert.Equal(200, totals.GetProperty("nonCash").GetDecimal());
        Assert.Equal(30, totals.GetProperty("fuel").GetDecimal());
        Assert.Equal(50, totals.GetProperty("debt").GetDecimal());

        // A trip finished at 10:30pm Saudi time belongs to the 9th
        var previous = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/statement?period=daily&year=2026&month=5&day=9");
        Assert.Equal(80, previous.GetProperty("totals").GetProperty("finalTotal").GetDecimal());

        var monthly = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/statement?period=monthly&year=2026&month=5");
        Assert.Equal(2, monthly.GetProperty("drivers").GetArrayLength());
        Assert.Equal(430, monthly.GetProperty("totals").GetProperty("finalTotal").GetDecimal());

        var yearly = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/statement?period=yearly&year=2026");
        Assert.Equal(430, yearly.GetProperty("totals").GetProperty("finalTotal").GetDecimal());
        var otherYear = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/statement?period=yearly&year=2025");
        Assert.Equal(0, otherYear.GetProperty("drivers").GetArrayLength());
    }

    [Fact]
    public async Task Cashbox_AddsCashTripsCollectionsAndDeposits_LessExpenses()
    {
        var (factory, admin, _, _) = await SeedAsync();
        await using var _ = factory;

        var daily = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/cashbox?period=daily&year=2026&month=5&day=10");
        Assert.Equal(100, daily.GetProperty("totalTrips").GetDecimal());
        Assert.Equal(60, daily.GetProperty("totalCollections").GetDecimal());
        Assert.Equal(2, daily.GetProperty("collections").GetArrayLength());
        Assert.Equal(30, daily.GetProperty("totalExpenses").GetDecimal());
        Assert.Equal(130, daily.GetProperty("net").GetDecimal());

        var monthly = await admin.GetFromJsonAsync<JsonElement>("/api/Reports/cashbox?period=monthly&year=2026&month=5");
        Assert.Equal(180, monthly.GetProperty("totalTrips").GetDecimal());
        Assert.Equal(2, monthly.GetProperty("trips").GetArrayLength());
        Assert.Equal(210, monthly.GetProperty("net").GetDecimal());
    }

    [Fact]
    public async Task Reports_RejectBadPeriods_AndNeedReportsPermission()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/Reports/statement?period=daily&year=2026&month=2&day=30")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/Reports/statement?period=monthly&year=2026&month=13")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/Reports/cashbox?period=weekly&year=2026&month=1&day=1")).StatusCode);

        var employee = await factory.CreateEmployeeClientAsync("emp", "trips", "fleet");
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Reports/statement?period=yearly&year=2026")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Reports/cashbox?period=yearly&year=2026")).StatusCode);
    }

    [Fact]
    public async Task TripsLogAndExpenses_ArePaged_AndTripsFilterByStatus()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var khalid = await admin.CreateCustomerAsync("خالد");
        var sara = await admin.CreateCustomerAsync("سارة");
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();
        await admin.RunFixedTripAsync(khalid, driver, car, 100);
        await admin.CreateTripAsync(khalid, driver, car);
        var saraTrip = await admin.CreateTripAsync(sara, driver, car);

        var page1 = await admin.GetFromJsonAsync<JsonElement>("/api/Trips/log?page=1&pageSize=2");
        Assert.Equal(3, page1.GetProperty("total").GetInt32());
        Assert.Equal(2, page1.GetProperty("items").GetArrayLength());
        Assert.Equal(saraTrip, page1.GetProperty("items")[0].GetProperty("id").GetInt32());
        var page2 = await admin.GetFromJsonAsync<JsonElement>("/api/Trips/log?page=2&pageSize=2");
        Assert.Equal(1, page2.GetProperty("items").GetArrayLength());

        var search = await admin.GetFromJsonAsync<JsonElement>("/api/Trips/log?search=" + Uri.EscapeDataString("سارة"));
        Assert.Equal(1, search.GetProperty("total").GetInt32());

        var active = await admin.GetFromJsonAsync<JsonElement>("/api/Trips?status=Scheduled,Ongoing");
        Assert.Equal(2, active.GetArrayLength());
        Assert.All(active.EnumerateArray(), t => Assert.Equal("Scheduled", t.GetProperty("status").GetString()));

        for (var i = 1; i <= 3; i++) await AddFuelAsync(admin, driver, 10 * i);
        var expenses = await admin.GetFromJsonAsync<JsonElement>("/api/Expenses?page=1&pageSize=2");
        Assert.Equal(3, expenses.GetProperty("total").GetInt32());
        Assert.Equal(2, expenses.GetProperty("items").GetArrayLength());
        Assert.Equal("سائق", expenses.GetProperty("items")[0].GetProperty("driverName").GetString());

        var drivers = await admin.GetFromJsonAsync<JsonElement>("/api/Drivers");
        Assert.Equal(car, drivers[0].GetProperty("lastCarId").GetInt32());
    }

    [Fact]
    public async Task DriverStats_CountTodayWeekMonthAndYear()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync();
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();

        factory.Clock.Now = new DateTime(2026, 1, 20, 12, 0, 0);
        await admin.RunFixedTripAsync(customer, driver, car, 1000);   // this year
        factory.Clock.Now = new DateTime(2026, 5, 2, 12, 0, 0);
        await admin.RunFixedTripAsync(customer, driver, car, 100);    // this month
        factory.Clock.Now = new DateTime(2026, 5, 8, 12, 0, 0);
        await admin.RunFixedTripAsync(customer, driver, car, 10);     // this week
        factory.Clock.Now = new DateTime(2026, 5, 10, 8, 0, 0);
        await admin.RunFixedTripAsync(customer, driver, car, 1);      // today

        factory.Clock.Now = new DateTime(2026, 5, 10, 18, 0, 0);
        var stats = await admin.GetFromJsonAsync<JsonElement>($"/api/Drivers/{driver}/stats");
        Assert.Equal(4, stats.GetProperty("totalTrips").GetInt32());
        Assert.Equal(1, stats.GetProperty("todayIncome").GetDecimal());
        Assert.Equal(11, stats.GetProperty("weekIncome").GetDecimal());
        Assert.Equal(111, stats.GetProperty("monthIncome").GetDecimal());
        Assert.Equal(1111, stats.GetProperty("yearIncome").GetDecimal());

        var carStats = await admin.GetFromJsonAsync<JsonElement>($"/api/Cars/{car}/stats");
        Assert.Equal(1, carStats.GetProperty("trips").GetProperty("today").GetInt32());
        Assert.Equal(4, carStats.GetProperty("trips").GetProperty("year").GetInt32());
    }
}
