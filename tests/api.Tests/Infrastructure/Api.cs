using System.Net.Http.Json;
using System.Text.Json;

namespace api.Tests.Infrastructure;

/// <summary>Small helpers over the HTTP API so tests read like the business steps.</summary>
public static class Api
{
    public static async Task<int> CreateCustomerAsync(this HttpClient client, string name = "عميل", string? phone = null)
    {
        var response = await client.PostAsJsonAsync("/api/Customers", new { name, phone = phone ?? "05" + Random.Shared.Next(10000000, 99999999) });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    public static async Task<int> CreateDriverAsync(this HttpClient client, string name = "سائق", decimal baseSalary = 0)
    {
        var response = await client.PostAsJsonAsync("/api/Drivers", new { name, phone = "0550000000", baseSalary });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    public static async Task<int> CreateCarAsync(this HttpClient client, string plate = "ABC")
    {
        var response = await client.PostAsJsonAsync("/api/Cars", new { plateNumber = plate + Random.Shared.Next(1000, 9999), make = "Toyota", model = "Camry", color = "White", year = 2024 });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    public static async Task<int> CreateTripAsync(this HttpClient client, int customerId, int driverId, int carId, string pricingType = "Fixed", decimal? price = 100)
    {
        var response = await client.PostAsJsonAsync("/api/Trips?skipSms=true", new
        {
            customerId,
            driverId,
            carId,
            pricingType,
            fixedPrice = pricingType == "Fixed" ? price : null,
            hourlyRate = pricingType == "Hourly" ? price : null
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    public static Task<HttpResponseMessage> StartTripAsync(this HttpClient client, int tripId) =>
        client.PostAsync($"/api/Trips/{tripId}/start?skipSms=true", null);

    public static Task<HttpResponseMessage> CompleteTripAsync(this HttpClient client, int tripId, object body) =>
        client.PostAsJsonAsync($"/api/Trips/{tripId}/complete?skipSms=true", body);

    /// <summary>Creates, starts and completes a fixed-price trip.</summary>
    public static async Task<JsonElement> RunFixedTripAsync(this HttpClient client, int customerId, int driverId, int carId, decimal price, string paymentMethod = "Cash", decimal? paidAmount = null, decimal collectionAmount = 0)
    {
        var tripId = await client.CreateTripAsync(customerId, driverId, carId, "Fixed", price);
        (await client.StartTripAsync(tripId)).EnsureSuccessStatusCode();
        var response = await client.CompleteTripAsync(tripId, new { pricingType = "Fixed", fixedPrice = price, paymentMethod, paidAmount, collectionAmount });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    public static async Task DepositAsync(this HttpClient client, int customerId, decimal amount)
    {
        var response = await client.PostAsJsonAsync("/api/Wallet/Deposit", new { customerId, amount, note = "دفعة" });
        response.EnsureSuccessStatusCode();
    }

    public static async Task<decimal> CustomerBalanceAsync(this HttpClient client, int customerId)
    {
        var customers = await client.GetFromJsonAsync<JsonElement>("/api/Customers");
        return customers.EnumerateArray().Single(c => c.GetProperty("id").GetInt32() == customerId).GetProperty("walletBalance").GetDecimal();
    }

    public record WalletView(decimal Balance, List<WalletRow> Transactions);
    public record WalletRow(int Id, decimal Amount, string Type, string Description, int? TripId);

    public static async Task<WalletView> WalletAsync(this HttpClient client, int customerId) =>
        (await client.GetFromJsonAsync<WalletView>($"/api/Wallet/{customerId}"))!;

    /// <summary>
    /// The rule the whole money side rests on: the balance shown on the customer list,
    /// the wallet page balance and the sum of the statement lines are the same number.
    /// </summary>
    public static async Task<decimal> AssertBalanceConsistentAsync(this HttpClient client, int customerId)
    {
        var listed = await client.CustomerBalanceAsync(customerId);
        var wallet = await client.WalletAsync(customerId);
        Assert.Equal(listed, wallet.Balance);
        Assert.Equal(wallet.Balance, wallet.Transactions.Sum(t => t.Amount));
        Assert.DoesNotContain(wallet.Transactions, t => t.Amount == 0);
        return listed;
    }
}
