using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

public class SalariesAndTimeTests
{
    private static async Task<JsonElement> SalaryRowAsync(HttpClient client, int driverId, int year, int month)
    {
        var data = await client.GetFromJsonAsync<JsonElement>($"/api/Salaries?month={month}&year={year}");
        return data.GetProperty("drivers").EnumerateArray().Single(d => d.GetProperty("driverId").GetInt32() == driverId);
    }

    private static async Task AddFuelAsync(HttpClient client, int driverId, int carId, decimal amount)
    {
        var response = await client.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount, note = "بنزين", driverId, carId });
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Salary_IsBasePlusCommissionOnNetIncomePlusAllowancesMinusDeductions()
    {
        await using var factory = new AlkaraApiFactory();
        factory.Clock.Now = new DateTime(2026, 5, 10, 12, 0, 0);
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync();
        var driver = await admin.CreateDriverAsync("سائق", baseSalary: 3000);
        var car = await admin.CreateCarAsync();

        await admin.RunFixedTripAsync(customer, driver, car, 1000);
        await admin.RunFixedTripAsync(customer, driver, car, 500, paidAmount: 0); // unpaid: no commission until the customer pays
        await AddFuelAsync(admin, driver, car, 200);

        var update = await admin.PutAsJsonAsync($"/api/Salaries/{driver}?month=5&year=2026", new { allowances = 100, deductions = 50, notes = "سلفة" });
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var row = await SalaryRowAsync(admin, driver, 2026, 5);
        Assert.Equal(1000, row.GetProperty("totalIncome").GetDecimal());
        Assert.Equal(200, row.GetProperty("totalExpenses").GetDecimal());
        Assert.Equal(10, row.GetProperty("commissionPercent").GetDecimal());
        Assert.Equal(80, row.GetProperty("commission").GetDecimal());
        Assert.Equal(3130, row.GetProperty("totalSalary").GetDecimal());
        Assert.Equal(2, row.GetProperty("tripsCount").GetInt32());

        // The driver's own percentage wins over the default; the default can be changed.
        await admin.PutAsJsonAsync($"/api/Salaries/{driver}?month=5&year=2026", new { commissionPercent = 20, allowances = 100, deductions = 50, notes = "سلفة" });
        Assert.Equal(160, (await SalaryRowAsync(admin, driver, 2026, 5)).GetProperty("commission").GetDecimal());

        var other = await admin.CreateDriverAsync("آخر");
        await admin.RunFixedTripAsync(customer, other, car, 1000);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync("/api/Salaries/settings", new { defaultCommissionPercent = 15 })).StatusCode);
        Assert.Equal(150, (await SalaryRowAsync(admin, other, 2026, 5)).GetProperty("commission").GetDecimal());
        Assert.Equal(160, (await SalaryRowAsync(admin, driver, 2026, 5)).GetProperty("commission").GetDecimal());

        // Edits survive a reload (they used to live only in the browser).
        row = await SalaryRowAsync(admin, driver, 2026, 5);
        Assert.Equal(100, row.GetProperty("allowances").GetDecimal());
        Assert.Equal(50, row.GetProperty("deductions").GetDecimal());
        Assert.Equal("سلفة", row.GetProperty("notes").GetString());
    }

    [Fact]
    public async Task PaidSalary_IsFrozen_UntilAnAdminReopensIt()
    {
        await using var factory = new AlkaraApiFactory();
        factory.Clock.Now = new DateTime(2026, 6, 10, 12, 0, 0);
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync();
        var driver = await admin.CreateDriverAsync("سائق", baseSalary: 2000);
        var car = await admin.CreateCarAsync();
        await admin.RunFixedTripAsync(customer, driver, car, 1000);

        var pay = await admin.PostAsJsonAsync("/api/Salaries/pay", new { year = 2026, month = 6, driverIds = new[] { driver } });
        Assert.Equal(HttpStatusCode.OK, pay.StatusCode);
        var paidRow = await SalaryRowAsync(admin, driver, 2026, 6);
        Assert.True(paidRow.GetProperty("isPaid").GetBoolean());
        Assert.Equal(2100, paidRow.GetProperty("totalSalary").GetDecimal());

        // Later trips and edits do not change a paid salary.
        await admin.RunFixedTripAsync(customer, driver, car, 1000);
        Assert.Equal(2100, (await SalaryRowAsync(admin, driver, 2026, 6)).GetProperty("totalSalary").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/Salaries/{driver}?month=6&year=2026", new { allowances = 500 })).StatusCode);

        var reports = await factory.CreateEmployeeClientAsync("rep" + Guid.NewGuid().ToString("N")[..6], "reports");
        Assert.Equal(HttpStatusCode.Forbidden, (await reports.PostAsync($"/api/Salaries/{driver}/unpay?month=6&year=2026", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/Salaries/{driver}/unpay?month=6&year=2026", null)).StatusCode);
        Assert.Equal(2200, (await SalaryRowAsync(admin, driver, 2026, 6)).GetProperty("totalSalary").GetDecimal());
    }

    [Fact]
    public async Task LateEveningWork_StaysOnItsOwnDayAndMonth()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync();
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();

        // 11:30 pm Saudi time on the last day of July (20:30 UTC)
        factory.Clock.Now = new DateTime(2026, 7, 31, 23, 30, 0);
        await admin.RunFixedTripAsync(customer, driver, car, 300, paidAmount: 100);

        Assert.Equal(100, (await SalaryRowAsync(admin, driver, 2026, 7)).GetProperty("totalIncome").GetDecimal());
        Assert.Equal(0, (await SalaryRowAsync(admin, driver, 2026, 8)).GetProperty("totalIncome").GetDecimal());

        var daily = await admin.GetFromJsonAsync<JsonElement>("/api/Wallet/daily?date=2026-07-31");
        Assert.Equal(2, daily.EnumerateArray().Count(t => t.GetProperty("customerId").GetInt32() == customer));
    }

    [Fact]
    public async Task Times_TravelWithTheSaudiOffset()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync();
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();

        // A browser sends 07:00 UTC; that is 10:00 in Riyadh.
        var response = await admin.PostAsJsonAsync("/api/Trips?skipSms=true", new { customerId = customer, driverId = driver, carId = car, scheduledFor = "2026-10-05T07:00:00.000Z" });
        response.EnsureSuccessStatusCode();
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var trips = await admin.GetFromJsonAsync<JsonElement>("/api/Trips");
        var trip = trips.EnumerateArray().Single(t => t.GetProperty("id").GetInt32() == id);
        Assert.Equal("2026-10-05T10:00:00.000+03:00", trip.GetProperty("scheduledFor").GetString());

        // A value without an offset is already Saudi time.
        await admin.PutAsJsonAsync($"/api/Trips/{id}?skipSms=true", new { scheduledFor = "2026-10-06T09:15:00" });
        trips = await admin.GetFromJsonAsync<JsonElement>("/api/Trips");
        trip = trips.EnumerateArray().Single(t => t.GetProperty("id").GetInt32() == id);
        Assert.Equal("2026-10-06T09:15:00.000+03:00", trip.GetProperty("scheduledFor").GetString());
    }

    [Fact]
    public async Task SalaryInput_IsValidated()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var driver = await admin.CreateDriverAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/Salaries/{driver}?month=1&year=2026", new { deductions = -5 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/Salaries/{driver}?month=1&year=2026", new { commissionPercent = 150 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync("/api/Salaries/settings", new { defaultCommissionPercent = -1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/Salaries?month=13&year=2026")).StatusCode);
    }
}
