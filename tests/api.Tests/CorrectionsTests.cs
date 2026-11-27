using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

/// <summary>Removing an expense or a deposit entered by mistake needs the "corrections" permission.</summary>
public class CorrectionsTests
{
    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..6];

    private static async Task<decimal> CashboxNetAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<JsonElement>("/api/Reports/cashbox?period=daily&year=2026&month=5&day=10")).GetProperty("net").GetDecimal();

    [Fact]
    public async Task OnlyUsersGivenCorrections_CanDeleteAnExpenseOrADeposit()
    {
        await using var factory = new AlkaraApiFactory();
        factory.Clock.Now = new DateTime(2026, 5, 10, 10, 0, 0);
        var admin = await factory.CreateAdminClientAsync();
        var customer = await admin.CreateCustomerAsync("عميل التصحيح");
        var driver = await admin.CreateDriverAsync();
        var car = await admin.CreateCarAsync();

        await admin.RunFixedTripAsync(customer, driver, car, 100, "Cash", paidAmount: 0);
        await admin.DepositAsync(customer, 500); // typed 500 instead of 50
        var expense = await admin.PostAsJsonAsync("/api/Expenses", new { category = "Fuel", amount = 300, driverId = driver });
        expense.EnsureSuccessStatusCode();
        var expenseId = (await expense.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var wallet = await admin.WalletAsync(customer);
        var depositId = wallet.Transactions.Single(t => t.Type == "CashDeposit").Id;
        var chargeId = wallet.Transactions.Single(t => t.Type == "TripCharge").Id;
        Assert.Equal(-400, wallet.Balance);
        Assert.Equal(200, await CashboxNetAsync(admin));

        // Working with expenses and the wallet is not enough.
        var clerk = await factory.CreateEmployeeClientAsync(Unique("clerk"), "expenses", "wallet");
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.DeleteAsync($"/api/Expenses/{expenseId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.DeleteAsync($"/api/Wallet/transactions/{depositId}")).StatusCode);

        // The admin gave this accountant the corrections permission.
        var accountant = await factory.CreateEmployeeClientAsync(Unique("acc"), "expenses", "wallet", "corrections");
        Assert.Equal(HttpStatusCode.NoContent, (await accountant.DeleteAsync($"/api/Expenses/{expenseId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await accountant.DeleteAsync($"/api/Expenses/{expenseId}")).StatusCode);
        Assert.Equal(500, await CashboxNetAsync(admin));

        // A trip's own entries are not deleted here; the trip is cancelled instead.
        Assert.Equal(HttpStatusCode.BadRequest, (await accountant.DeleteAsync($"/api/Wallet/transactions/{chargeId}")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await accountant.DeleteAsync($"/api/Wallet/transactions/{depositId}")).StatusCode);
        Assert.Equal(100, await admin.AssertBalanceConsistentAsync(customer));
        Assert.Equal(0, await CashboxNetAsync(admin));

        // The deletions stay in the audit log.
        foreach (var entityType in new[] { "Expense", "WalletTransaction" })
        {
            var audit = await admin.GetFromJsonAsync<JsonElement>($"/api/Audit?action=Deleted&entityType={entityType}");
            Assert.Equal(1, audit.GetProperty("total").GetInt32());
        }
    }
}
