using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

public class AuditTests
{
    private static async Task<List<JsonElement>> AuditAsync(HttpClient admin, string query = "")
    {
        var page = await admin.GetFromJsonAsync<JsonElement>("/api/Audit?pageSize=200" + query);
        return page.GetProperty("items").EnumerateArray().ToList();
    }

    [Fact]
    public async Task RecordsShowWhoCreatedThem()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var employee = await factory.CreateEmployeeClientAsync("sara", "trips", "fleet", "wallet", "expenses");
        var customer = await employee.CreateCustomerAsync();
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();

        await employee.RunFixedTripAsync(customer, driver, car, 120, "Cash", paidAmount: 100);
        (await employee.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = 30, driverId = driver })).EnsureSuccessStatusCode();

        var trip = (await admin.GetFromJsonAsync<JsonElement>("/api/Trips/log")).GetProperty("items")[0];
        Assert.Equal("sara", trip.GetProperty("createdBy").GetString());

        var expense = (await admin.GetFromJsonAsync<JsonElement>("/api/Expenses")).GetProperty("items")[0];
        Assert.Equal("sara", expense.GetProperty("createdBy").GetString());

        var wallet = await admin.GetFromJsonAsync<JsonElement>($"/api/Wallet/{customer}");
        Assert.All(wallet.GetProperty("transactions").EnumerateArray(), t => Assert.Equal("sara", t.GetProperty("createdBy").GetString()));
    }

    [Fact]
    public async Task EveryChangeIsLoggedWithItsUserAndOldAndNewValues()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var employee = await factory.CreateEmployeeClientAsync("omar", "trips", "fleet");
        var customer = await employee.CreateCustomerAsync("عميل");
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();
        var tripId = await employee.CreateTripAsync(customer, driver, car);
        (await employee.StartTripAsync(tripId)).EnsureSuccessStatusCode();

        var tripLog = await AuditAsync(admin, $"&entityType=Trip&entityId={tripId}");
        var created = Assert.Single(tripLog, a => a.GetProperty("action").GetString() == "Created");
        Assert.Equal("omar", created.GetProperty("username").GetString());

        var started = Assert.Single(tripLog, a => a.GetProperty("action").GetString() == "Updated");
        var changes = JsonDocument.Parse(started.GetProperty("changes").GetString()!).RootElement;
        Assert.Equal("Scheduled", changes.GetProperty("Status")[0].GetString());
        Assert.Equal("Ongoing", changes.GetProperty("Status")[1].GetString());

        (await admin.PutAsJsonAsync($"/api/Customers/{customer}", new { name = "عميل جديد", phone = "0551231234" })).EnsureSuccessStatusCode();
        var customerUpdate = (await AuditAsync(admin, $"&entityType=Customer&entityId={customer}&action=Updated")).Single();
        Assert.Equal("admin", customerUpdate.GetProperty("username").GetString());
        Assert.Contains("عميل جديد", customerUpdate.GetProperty("changes").GetString());

        // Passwords never reach the log
        var all = await AuditAsync(admin);
        Assert.DoesNotContain(all, a => (a.GetProperty("changes").GetString() ?? "").Contains("$2"));

        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Audit")).StatusCode);
    }

    [Fact]
    public async Task LoginsAndFailedLoginsAreLogged()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateClient();
        (await anonymous.PostAsJsonAsync("/api/Auth/login", new { username = "admin", password = "wrong-password" })).Dispose();
        (await anonymous.PostAsJsonAsync("/api/Auth/login", new { username = "ghost", password = "x" })).Dispose();

        var failed = await AuditAsync(admin, "&action=LoginFailed");
        Assert.Contains(failed, a => a.GetProperty("username").GetString() == "admin" && a.GetProperty("userId").ValueKind == JsonValueKind.Number);
        Assert.Contains(failed, a => a.GetProperty("username").GetString() == "ghost" && a.GetProperty("userId").ValueKind == JsonValueKind.Null);
        Assert.NotEmpty(await AuditAsync(admin, "&action=Login"));
    }

    [Fact]
    public async Task DeletedUser_IsLockedOut_ButStillNamedOnTheirRecords()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var employee = await factory.CreateEmployeeClientAsync("ali", "trips", "fleet");
        var customer = await employee.CreateCustomerAsync();
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();
        await employee.CreateTripAsync(customer, driver, car);

        var users = await admin.GetFromJsonAsync<JsonElement>("/api/Users");
        var aliId = users.EnumerateArray().Single(u => u.GetProperty("username").GetString() == "ali").GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/Users/{aliId}")).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await employee.GetAsync("/api/Trips")).StatusCode);
        var login = await factory.CreateClient().PostAsJsonAsync("/api/Auth/login", new { username = "ali", password = AlkaraApiFactory.EmployeePassword });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);

        users = await admin.GetFromJsonAsync<JsonElement>("/api/Users");
        Assert.DoesNotContain(users.EnumerateArray(), u => u.GetProperty("id").GetInt32() == aliId);

        var trip = (await admin.GetFromJsonAsync<JsonElement>("/api/Trips/log")).GetProperty("items")[0];
        Assert.StartsWith("ali (محذوف", trip.GetProperty("createdBy").GetString());

        Assert.Single(await AuditAsync(admin, $"&entityType=User&entityId={aliId}&action=Deleted"));

        // The name is free for a new account
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/Users", new { username = "ali", password = "Temp-Pass-123", role = "Employee", permissions = "trips" })).StatusCode);
    }
}
