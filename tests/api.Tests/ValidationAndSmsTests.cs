using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using api.Services;
using api.Tests.Infrastructure;

namespace api.Tests;

public class ValidationAndSmsTests
{
    [Theory]
    [InlineData("0551234567", "0551234567")]
    [InlineData("551234567", "0551234567")]
    [InlineData("+966 55 123 4567", "0551234567")]
    [InlineData("966551234567", "0551234567")]
    [InlineData("00966551234567", "0551234567")]
    [InlineData("055-123-4567", "0551234567")]
    [InlineData("٠٥٥١٢٣٤٥٦٧", "0551234567")]
    [InlineData("0112345678", null)]
    [InlineData("05512345", null)]
    [InlineData("055123456789", null)]
    [InlineData("05512a4567", null)]
    [InlineData("", null)]
    public void SaudiMobile_IsNormalizedOrRejected(string input, string? expected)
    {
        Assert.Equal(expected, PhoneNumbers.NormalizeSaudiMobile(input));
    }

    [Fact]
    public async Task Customer_PhoneIsValidatedNormalizedAndUnique()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Customers", new { name = "عميل", phone = "12345" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Customers", new { name = " ", phone = "0551234567" })).StatusCode);

        var created = await admin.PostAsJsonAsync("/api/Customers", new { name = "أحمد", phone = "+966 55 123 4567" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("0551234567", (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("phone").GetString());

        // Same number written differently is still a duplicate
        var duplicate = await admin.PostAsJsonAsync("/api/Customers", new { name = "آخر", phone = "551234567" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Contains("أحمد", (await duplicate.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString());

        var other = await admin.CreateCustomerAsync("سعد", "0559999999");
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/Customers/{other}", new { name = "سعد", phone = "0551234567" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync($"/api/Customers/{other}", new { name = "سعد", phone = "0559999999" })).StatusCode);
    }

    [Fact]
    public async Task Car_PlateIsUniqueIgnoringCaseAndSpaces()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();

        var created = await admin.PostAsJsonAsync("/api/Cars", new { plateNumber = "abc  1234", make = "Toyota", model = "Camry", color = "White", year = 2024 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("ABC 1234", (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("plateNumber").GetString());

        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/Cars", new { plateNumber = " ABC 1234 ", make = "Kia" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Cars", new { plateNumber = "", make = "Kia" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Cars", new { plateNumber = "XYZ 1", year = 1900 })).StatusCode);
    }

    [Fact]
    public async Task Driver_RequiresNameValidPhoneAndNonNegativeSalary()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Drivers", new { name = "", phone = "0551234567" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Drivers", new { name = "سائق", phone = "1" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Drivers", new { name = "سائق", phone = "0551234567", baseSalary = -1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/Drivers", new { name = "سائق", phone = "0551234567", baseSalary = 3000 })).StatusCode);
    }

    [Fact]
    public async Task Expense_IsValidated()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var driver = await admin.CreateDriverAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = 0, driverId = driver })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = -50, driverId = driver })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Expenses", new { category = "Party", amount = 50, driverId = driver })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = 50 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = 50, driverId = 99999 })).StatusCode);

        var ok = await admin.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = 75.5, driverId = driver, note = "بنزين" });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        Assert.Equal(75.5m, (await ok.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task Sms_EveryAttemptIsLogged_AndTestSmsIsAdminOnly()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync("عميل", "0551112222");
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();
        var trip = await admin.CreateTripAsync(customer, driver, car);

        var depart = await admin.PostAsync($"/api/Trips/{trip}/depart", null);
        depart.EnsureSuccessStatusCode();
        Assert.Contains(factory.Sms.Sent, s => s.Phone == "0551112222");

        // A lifecycle message the provider rejects is still logged, with the reason
        factory.Sms.ShouldSucceed = false;
        var tripToCancel = await admin.CreateTripAsync(customer, driver, car);
        (await admin.PostAsync($"/api/Trips/{tripToCancel}/cancel", null)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Sms/test", new { phone = "123" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Sms/test", new { phone = "0553334444" })).StatusCode);
        factory.Sms.ShouldSucceed = true;
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/Sms/test", new { phone = "+966553334444" })).StatusCode);

        var logs = await admin.GetFromJsonAsync<JsonElement>("/api/Sms/logs");
        var items = logs.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(4, logs.GetProperty("total").GetInt32());
        Assert.Equal("Test", items[0].GetProperty("event").GetString());
        Assert.True(items[0].GetProperty("success").GetBoolean());
        Assert.Contains(items, i => i.GetProperty("event").GetString() == "Departed" && i.GetProperty("tripId").GetInt32() == trip && i.GetProperty("success").GetBoolean());
        Assert.Contains(items, i => i.GetProperty("event").GetString() == "Cancelled" && !i.GetProperty("success").GetBoolean() && i.GetProperty("error").GetString() == "fake failure");

        var failed = await admin.GetFromJsonAsync<JsonElement>("/api/Sms/logs?failedOnly=true");
        Assert.Equal(2, failed.GetProperty("total").GetInt32());

        var employee = await factory.CreateEmployeeClientAsync("emp", "trips", "fleet", "reports");
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Sms/logs")).StatusCode);
    }
}
