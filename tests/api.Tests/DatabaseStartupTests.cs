using System.Net;
using System.Net.Http.Json;
using api.Data;
using api.Models;
using api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using MySqlConnector;

namespace api.Tests;

public class DatabaseStartupTests
{
    [Fact]
    public async Task FreshDatabase_IsMigratedAndGetsOnlyTheConfiguredAdmin()
    {
        await using var factory = new AlkaraApiFactory();
        var admin = await factory.CreateAdminClientAsync();

        var users = await admin.GetFromJsonAsync<List<UserRow>>("/api/Users");
        var user = Assert.Single(users!);
        Assert.Equal("admin", user.Username);
        Assert.Equal("Admin", user.Role);

        // The old hardcoded accounts must not exist on a new install.
        var anonymous = factory.CreateClient();
        var login = await anonymous.PostAsJsonAsync("/api/Auth/login", new { username = "employee", password = "123456" });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);

        Assert.Equal(3, await CountAppliedMigrationsAsync(factory));
    }

    [Fact]
    public async Task DatabaseCreatedByEnsureCreated_IsBaselinedWithoutLosingData()
    {
        await using var factory = new AlkaraApiFactory();

        // Recreate what the old startup did: tables from EnsureCreated(), no migrations history.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql(factory.ConnectionString, ServerVersion.AutoDetect(AlkaraApiFactory.ServerConnectionString))
            .Options;
        await using (var legacy = new AppDbContext(options))
        {
            await legacy.Database.EnsureCreatedAsync();
            legacy.Users.Add(new User { Username = "owner", PasswordHash = BCrypt.Net.BCrypt.HashPassword("owner-pass"), Role = "Admin", Permissions = "trips" });
            legacy.Customers.Add(new Customer { Name = "عميل قديم", Phone = "0500000000", WalletBalance = 75 });
            await legacy.SaveChangesAsync();
        }

        var owner = await factory.CreateClientAsAsync("owner", "owner-pass");
        var customers = await owner.GetFromJsonAsync<List<Customer>>("/api/Customers");
        var customer = Assert.Single(customers!);
        Assert.Equal("عميل قديم", customer.Name);
        Assert.Equal(75, customer.WalletBalance);

        // Existing users are kept, and no extra admin is created when users already exist.
        var users = await owner.GetFromJsonAsync<List<UserRow>>("/api/Users");
        Assert.Equal("owner", Assert.Single(users!).Username);

        Assert.Equal(3, await CountAppliedMigrationsAsync(factory));
    }

    [Fact]
    public async Task RunningTheInitializerAgain_ChangesNothing()
    {
        await using var factory = new AlkaraApiFactory();
        await factory.CreateAdminClientAsync();

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
            await DatabaseInitializer.InitializeAsync(context, configuration, NullLogger.Instance);
            Assert.Equal(1, await context.Users.CountAsync());
        }

        Assert.Equal(3, await CountAppliedMigrationsAsync(factory));
    }

    [Fact]
    public async Task ApiRejectsAnonymousRequestsAndWrongPasswords()
    {
        await using var factory = new AlkaraApiFactory();
        var anonymous = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/Trips")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/Customers")).StatusCode);

        var login = await anonymous.PostAsJsonAsync("/api/Auth/login", new { username = AlkaraApiFactory.AdminUsername, password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    private static async Task<long> CountAppliedMigrationsAsync(AlkaraApiFactory factory)
    {
        await using var connection = new MySqlConnection(factory.ConnectionString);
        await connection.OpenAsync();
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM `__EFMigrationsHistory`;";
        return Convert.ToInt64(await cmd.ExecuteScalarAsync());
    }

    private record UserRow(int Id, string Username, string Role, string Permissions);
}
