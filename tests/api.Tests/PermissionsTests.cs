using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

public class PermissionsTests : IClassFixture<AlkaraApiFactory>
{
    private readonly AlkaraApiFactory _factory;

    public PermissionsTests(AlkaraApiFactory factory)
    {
        _factory = factory;
    }

    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..6];

    [Fact]
    public async Task TripsOnlyEmployee_IsLimitedToTripWork()
    {
        var employee = await _factory.CreateEmployeeClientAsync(Unique("trips"), "trips");

        // Allowed: trip work and the lookups it needs
        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync("/api/Trips")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync("/api/Customers")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync("/api/Drivers")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync("/api/Cars")).StatusCode);
        var customer = await employee.PostAsJsonAsync("/api/Customers", new { name = "عميل", phone = "0500000001" });
        Assert.Equal(HttpStatusCode.Created, customer.StatusCode);

        // Denied: money, reports, fleet changes, users
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.PostAsJsonAsync("/api/Wallet/Deposit", new { customerId = 1, amount = 10 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Wallet/daily?date=2026-01-01")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Salaries")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Expenses")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.PostAsJsonAsync("/api/Drivers", new { name = "x", phone = "1" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.DeleteAsync("/api/Cars/1")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.PostAsJsonAsync("/api/Sms/test", new { phone = "0500000000" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Sms/logs")).StatusCode);
        Assert.DoesNotContain(_factory.Sms.Sent, s => s.Phone == "0500000000");
    }

    [Fact]
    public async Task EmployeeWithoutPermissions_CannotReadAnything()
    {
        var employee = await _factory.CreateEmployeeClientAsync(Unique("none"));

        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Customers")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Trips")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync("/api/Auth/me")).StatusCode);
    }

    [Fact]
    public async Task Employee_CannotCreateOrPromoteUsers()
    {
        var username = Unique("esc");
        var employee = await _factory.CreateEmployeeClientAsync(username, "trips");
        var me = await employee.GetFromJsonAsync<Me>("/api/Auth/me");

        var create = await employee.PostAsJsonAsync("/api/Users", new { username = Unique("evil"), password = "Evil-Pass-1", role = "Admin", permissions = "" });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);

        var promote = await employee.PutAsJsonAsync($"/api/Users/{me!.Id}", new { username, role = "Admin", permissions = "trips,wallet" });
        Assert.Equal(HttpStatusCode.Forbidden, promote.StatusCode);

        me = await employee.GetFromJsonAsync<Me>("/api/Auth/me");
        Assert.Equal("Employee", me!.Role);
        Assert.Equal("trips", me.Permissions);
    }

    [Fact]
    public async Task PermissionChanges_ApplyToExistingSessionsImmediately()
    {
        var username = Unique("chg");
        var employee = await _factory.CreateEmployeeClientAsync(username, "trips");
        var admin = await _factory.CreateAdminClientAsync();
        var me = await employee.GetFromJsonAsync<Me>("/api/Auth/me");

        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync("/api/Trips")).StatusCode);

        var update = await admin.PutAsJsonAsync($"/api/Users/{me!.Id}", new { username, role = "Employee", permissions = "wallet" });
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Trips")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await employee.GetAsync("/api/Wallet/daily?date=2026-01-01")).StatusCode);
    }

    [Fact]
    public async Task NewAccount_MustChangePasswordBeforeWorking()
    {
        var admin = await _factory.CreateAdminClientAsync();
        var username = Unique("new");
        var created = await admin.PostAsJsonAsync("/api/Users", new { username, password = "Given-Pass-1", role = "Employee", permissions = "trips" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var employee = await _factory.CreateClientAsAsync(username, "Given-Pass-1");
        var blocked = await employee.GetAsync("/api/Trips");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("MustChangePassword", await blocked.Content.ReadAsStringAsync());

        var tooShort = await employee.PostAsJsonAsync("/api/Auth/change-password", new { currentPassword = "Given-Pass-1", newPassword = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);

        var changed = await employee.PostAsJsonAsync("/api/Auth/change-password", new { currentPassword = "Given-Pass-1", newPassword = "Own-Pass-123" });
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var body = await changed.Content.ReadFromJsonAsync<AlkaraApiFactory.LoginResponse>();

        // The token used before the change no longer works; the new one does.
        Assert.Equal(HttpStatusCode.Unauthorized, (await employee.GetAsync("/api/Trips")).StatusCode);
        var fresh = _factory.CreateClient();
        fresh.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Token);
        Assert.Equal(HttpStatusCode.OK, (await fresh.GetAsync("/api/Trips")).StatusCode);
    }

    [Fact]
    public async Task DeletedUser_LosesAccessAtOnce()
    {
        var username = Unique("del");
        var employee = await _factory.CreateEmployeeClientAsync(username, "trips");
        var admin = await _factory.CreateAdminClientAsync();
        var me = await employee.GetFromJsonAsync<Me>("/api/Auth/me");

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/Users/{me!.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await employee.GetAsync("/api/Trips")).StatusCode);
    }

    [Fact]
    public async Task UserValidation_RejectsBadInput()
    {
        var admin = await _factory.CreateAdminClientAsync();
        var username = Unique("dup");

        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/Users", new { username, password = "Good-Pass-1", role = "Employee", permissions = "trips" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Users", new { username, password = "Good-Pass-1", role = "Employee", permissions = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Users", new { username = Unique("pw"), password = "123456", role = "Employee", permissions = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Users", new { username = Unique("role"), password = "Good-Pass-1", role = "Owner", permissions = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Users", new { username = "  ", password = "Good-Pass-1", role = "Employee", permissions = "" })).StatusCode);
    }
}

public class LastAdminTests
{
    [Fact]
    public async Task TheLastAdmin_CannotBeDeletedOrDemoted()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var me = await admin.GetFromJsonAsync<Me>("/api/Auth/me");

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.DeleteAsync($"/api/Users/{me!.Id}")).StatusCode);
        var demote = await admin.PutAsJsonAsync($"/api/Users/{me.Id}", new { username = me.Username, role = "Employee", permissions = "trips" });
        Assert.Equal(HttpStatusCode.BadRequest, demote.StatusCode);

        // With a second admin, the first one can be removed by the second.
        var second = await admin.PostAsJsonAsync("/api/Users", new { username = "admin2", password = "Second-Admin-1", role = "Admin", permissions = "" });
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        var admin2 = await factory.CreateClientAsAsync("admin2", "Second-Admin-1");
        await admin2.PostAsJsonAsync("/api/Auth/change-password", new { currentPassword = "Second-Admin-1", newPassword = "Second-Admin-2" });
        admin2 = await factory.CreateClientAsAsync("admin2", "Second-Admin-2");

        Assert.Equal(HttpStatusCode.NoContent, (await admin2.DeleteAsync($"/api/Users/{me.Id}")).StatusCode);
    }
}

public record Me(int Id, string Username, string Role, string Permissions, bool MustChangePassword);
