using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using api.Tests.Infrastructure;

namespace api.Tests;

/// <summary>
/// Money rules for trips and the customer wallet. Positive balance = the customer owes us,
/// negative = the customer has credit. Every test also checks that the customer list, the
/// wallet page and the statement lines agree.
/// </summary>
public class WalletAndTripsTests : IClassFixture<AlkaraApiFactory>
{
    private readonly AlkaraApiFactory _factory;

    public WalletAndTripsTests(AlkaraApiFactory factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Admin, int Customer, int Driver, int Car)> SetupAsync()
    {
        var admin = await _factory.CreateAdminClientAsync();
        return (admin, await admin.CreateCustomerAsync(), await admin.CreateDriverAsync(), await admin.CreateCarAsync());
    }

    [Fact]
    public async Task CashPaidInFull_LeavesNoDebt()
    {
        var (admin, customer, driver, car) = await SetupAsync();

        var result = await admin.RunFixedTripAsync(customer, driver, car, 150, "Cash");

        Assert.Equal(150, result.GetProperty("finalTotal").GetDecimal());
        Assert.Equal(150, result.GetProperty("paidAmount").GetDecimal());
        Assert.Equal(0, await admin.AssertBalanceConsistentAsync(customer));
        var wallet = await admin.WalletAsync(customer);
        Assert.Contains(wallet.Transactions, t => t.Type == "TripCharge" && t.Amount == 150);
        Assert.Contains(wallet.Transactions, t => t.Type == "TripPayment" && t.Amount == -150);
    }

    [Fact]
    public async Task CashPaidPartly_LeavesTheRestAsDebt()
    {
        var (admin, customer, driver, car) = await SetupAsync();

        await admin.RunFixedTripAsync(customer, driver, car, 150, "Cash", paidAmount: 100);

        Assert.Equal(50, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task CashOverpayment_SettlesOldDebt()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        await admin.RunFixedTripAsync(customer, driver, car, 80, "Cash", paidAmount: 30); // owes 50

        await admin.RunFixedTripAsync(customer, driver, car, 100, "Cash", paidAmount: 150); // pays 50 extra

        Assert.Equal(0, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task UnpaidTrip_IsAllDebt()
    {
        var (admin, customer, driver, car) = await SetupAsync();

        await admin.RunFixedTripAsync(customer, driver, car, 120, "Cash", paidAmount: 0);

        Assert.Equal(120, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task WalletWithEnoughCredit_PaysTheWholeTrip()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        await admin.DepositAsync(customer, 200);
        Assert.Equal(-200, await admin.AssertBalanceConsistentAsync(customer));

        var result = await admin.RunFixedTripAsync(customer, driver, car, 150, "Wallet");

        Assert.Equal(150, result.GetProperty("paidAmount").GetDecimal());
        Assert.Equal(-50, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task WalletWithSomeCredit_LeavesTheRestAsDebt()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        await admin.DepositAsync(customer, 50);

        var result = await admin.RunFixedTripAsync(customer, driver, car, 150, "Wallet");

        Assert.Equal(50, result.GetProperty("paidAmount").GetDecimal());
        Assert.Equal(100, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task WalletWithNoCredit_IsAllDebt()
    {
        var (admin, customer, driver, car) = await SetupAsync();

        var result = await admin.RunFixedTripAsync(customer, driver, car, 150, "Wallet");

        Assert.Equal(0, result.GetProperty("paidAmount").GetDecimal());
        Assert.Equal(150, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task CollectionDuringTrip_ReducesOldDebt()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        await admin.RunFixedTripAsync(customer, driver, car, 80, "Cash", paidAmount: 0); // owes 80

        await admin.RunFixedTripAsync(customer, driver, car, 100, "Cash", collectionAmount: 80);

        Assert.Equal(0, await admin.AssertBalanceConsistentAsync(customer));
        var wallet = await admin.WalletAsync(customer);
        Assert.Contains(wallet.Transactions, t => t.Type == "CashCollection" && t.Amount == -80);
    }

    [Fact]
    public async Task HourlyTrip_IsPricedByTheServerFromRealTimes()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var tripId = await admin.CreateTripAsync(customer, driver, car, "Hourly", 60);
        (await admin.StartTripAsync(tripId)).EnsureSuccessStatusCode();
        _factory.Clock.Advance(TimeSpan.FromMinutes(90));

        // A total sent by the browser is ignored.
        var response = await admin.CompleteTripAsync(tripId, new { pricingType = "Hourly", hourlyRate = 60, paymentMethod = "Cash", paidAmount = 0, finalTotal = 1 });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(90, result.GetProperty("finalTotal").GetDecimal());
        Assert.Equal(90, result.GetProperty("durationMinutes").GetInt32());
        Assert.Equal(90, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task DiscountAndExtraCharge_AreApplied()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var tripId = await admin.CreateTripAsync(customer, driver, car, "Fixed", 200);
        (await admin.StartTripAsync(tripId)).EnsureSuccessStatusCode();

        var response = await admin.CompleteTripAsync(tripId, new { pricingType = "Fixed", fixedPrice = 200, discountType = "Amount", discountValue = 30, extraCharge = 10, paymentMethod = "Cash", paidAmount = 0 });
        response.EnsureSuccessStatusCode();

        Assert.Equal(180, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task CompletingTwice_ChargesOnce()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var tripId = await admin.CreateTripAsync(customer, driver, car, "Fixed", 100);
        (await admin.StartTripAsync(tripId)).EnsureSuccessStatusCode();
        var body = new { pricingType = "Fixed", fixedPrice = 100, paymentMethod = "Cash", paidAmount = 0 };

        Assert.Equal(HttpStatusCode.OK, (await admin.CompleteTripAsync(tripId, body)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.CompleteTripAsync(tripId, body)).StatusCode);

        Assert.Equal(100, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task CompletingAtTheSameMomentFromTwoScreens_ChargesOnce()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var tripId = await admin.CreateTripAsync(customer, driver, car, "Fixed", 100);
        (await admin.StartTripAsync(tripId)).EnsureSuccessStatusCode();
        var body = new { pricingType = "Fixed", fixedPrice = 100, paymentMethod = "Cash", paidAmount = 0 };

        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => admin.CompleteTripAsync(tripId, body)));

        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Equal(100, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task ParallelDeposits_AreAllCounted()
    {
        var (admin, customer, _, _) = await SetupAsync();

        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => admin.DepositAsync(customer, 10)));

        Assert.Equal(-100, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task Deposit_RejectsZeroAndNegativeAmounts()
    {
        var (admin, customer, _, _) = await SetupAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Wallet/Deposit", new { customerId = customer, amount = 0 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Wallet/Deposit", new { customerId = customer, amount = -50 })).StatusCode);
        Assert.Equal(0, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task CancellingACompletedTrip_ReversesItsMoney_AdminOnly()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        await admin.RunFixedTripAsync(customer, driver, car, 70, "Cash", paidAmount: 0); // unrelated debt of 70
        var result = await admin.RunFixedTripAsync(customer, driver, car, 150, "Cash", paidAmount: 100, collectionAmount: 20);
        var tripId = result.GetProperty("id").GetInt32();
        Assert.Equal(100, await admin.AssertBalanceConsistentAsync(customer));

        var employee = await _factory.CreateEmployeeClientAsync("cancel" + Guid.NewGuid().ToString("N")[..6], "trips");
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.PostAsync($"/api/Trips/{tripId}/cancel?skipSms=true", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/Trips/{tripId}/cancel?skipSms=true", null)).StatusCode);
        Assert.Equal(70, await admin.AssertBalanceConsistentAsync(customer));

        // Cancelling again does nothing more.
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsync($"/api/Trips/{tripId}/cancel?skipSms=true", null)).StatusCode);
        Assert.Equal(70, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task CancellingAScheduledTrip_TouchesNoMoney()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var tripId = await admin.CreateTripAsync(customer, driver, car);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/Trips/{tripId}/cancel?skipSms=true", null)).StatusCode);

        Assert.Empty((await admin.WalletAsync(customer)).Transactions);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.StartTripAsync(tripId)).StatusCode);
    }

    [Fact]
    public async Task EditingACustomer_NeverChangesTheBalance()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        await admin.RunFixedTripAsync(customer, driver, car, 90, "Cash", paidAmount: 0);

        var response = await admin.PutAsJsonAsync($"/api/Customers/{customer}", new { id = customer, name = "اسم جديد", phone = "0599999999", walletBalance = 0 });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        Assert.Equal(90, await admin.AssertBalanceConsistentAsync(customer));
    }

    [Fact]
    public async Task NewTrip_IsAlwaysScheduled_WhateverTheBrowserSends()
    {
        var (admin, customer, driver, car) = await SetupAsync();

        var response = await admin.PostAsJsonAsync("/api/Trips?skipSms=true", new { customerId = customer, driverId = driver, carId = car, status = "Completed", finalTotal = 999, paidAmount = 999 });
        response.EnsureSuccessStatusCode();
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var trips = await admin.GetFromJsonAsync<JsonElement>("/api/Trips");
        var trip = trips.EnumerateArray().Single(t => t.GetProperty("id").GetInt32() == id);
        Assert.Equal("Scheduled", trip.GetProperty("status").GetString());
        Assert.Equal(0, trip.GetProperty("finalTotal").GetDecimal());
        Assert.Empty((await admin.WalletAsync(customer)).Transactions);
    }

    [Fact]
    public async Task FinishedTrips_CannotBeEdited()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var result = await admin.RunFixedTripAsync(customer, driver, car, 100, "Cash");
        var otherDriver = await admin.CreateDriverAsync();

        var edit = await admin.PutAsJsonAsync($"/api/Trips/{result.GetProperty("id").GetInt32()}?skipSms=true", new { driverId = otherDriver });

        Assert.Equal(HttpStatusCode.BadRequest, edit.StatusCode);
    }

    [Fact]
    public async Task ADriverOrCar_CanOnlyBeOnOneTripAtATime()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var otherCar = await admin.CreateCarAsync();
        var otherDriver = await admin.CreateDriverAsync();
        var first = await admin.CreateTripAsync(customer, driver, car);
        var sameDriver = await admin.CreateTripAsync(customer, driver, otherCar);
        var sameCar = await admin.CreateTripAsync(customer, otherDriver, car);

        Assert.Equal(HttpStatusCode.OK, (await admin.StartTripAsync(first)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.StartTripAsync(sameDriver)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.StartTripAsync(sameCar)).StatusCode);

        var drivers = await admin.GetFromJsonAsync<JsonElement>("/api/Drivers");
        Assert.Equal("Busy", drivers.EnumerateArray().Single(d => d.GetProperty("id").GetInt32() == driver).GetProperty("status").GetString());

        (await admin.CompleteTripAsync(first, new { pricingType = "Fixed", fixedPrice = 50, paymentMethod = "Cash" })).EnsureSuccessStatusCode();
        drivers = await admin.GetFromJsonAsync<JsonElement>("/api/Drivers");
        Assert.Equal("Available", drivers.EnumerateArray().Single(d => d.GetProperty("id").GetInt32() == driver).GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, (await admin.StartTripAsync(sameDriver)).StatusCode);
    }

    [Fact]
    public async Task CompletionInput_IsValidated()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var tripId = await admin.CreateTripAsync(customer, driver, car, "Hourly", 50);
        (await admin.StartTripAsync(tripId)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.CompleteTripAsync(tripId, new { pricingType = "Hourly", hourlyRate = 0, paymentMethod = "Cash" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.CompleteTripAsync(tripId, new { pricingType = "Fixed", fixedPrice = 50, paymentMethod = "Cash", paidAmount = -1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.CompleteTripAsync(tripId, new { pricingType = "Fixed", fixedPrice = 50, paymentMethod = "Cash", discountType = "Percentage", discountValue = 120 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.CompleteTripAsync(tripId, new { pricingType = "Fixed", fixedPrice = 50, paymentMethod = "Bitcoin" })).StatusCode);
        Assert.Empty((await admin.WalletAsync(customer)).Transactions);
    }

    [Fact]
    public async Task Departure_IsRemembered()
    {
        var (admin, customer, driver, car) = await SetupAsync();
        var tripId = await admin.CreateTripAsync(customer, driver, car);

        (await admin.PostAsync($"/api/Trips/{tripId}/depart?skipSms=true", null)).EnsureSuccessStatusCode();

        var trips = await admin.GetFromJsonAsync<JsonElement>("/api/Trips");
        var trip = trips.EnumerateArray().Single(t => t.GetProperty("id").GetInt32() == tripId);
        Assert.NotEqual(JsonValueKind.Null, trip.GetProperty("departedAt").ValueKind);
    }
}
