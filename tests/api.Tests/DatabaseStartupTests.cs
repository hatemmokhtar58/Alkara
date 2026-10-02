using System.Net;
using System.Net.Http.Json;
using api.Data;
using api.Models;
using api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
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

        Assert.Equal(AllMigrations(factory), await CountAppliedMigrationsAsync(factory));
    }

    [Fact]
    public async Task DatabaseCreatedByEnsureCreated_IsBaselinedWithoutLosingData()
    {
        await using var factory = new AlkaraApiFactory();

        // Recreate what the old startup left behind: the schema as of AddBaseSalaryToDriver
        // (as EnsureCreated() built it) with no migrations history table.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql(factory.ConnectionString, ServerVersion.AutoDetect(AlkaraApiFactory.ServerConnectionString))
            .Options;
        await using (var legacy = new AppDbContext(options))
        {
            await legacy.GetService<IMigrator>().MigrateAsync("20260606221026_AddBaseSalaryToDriver");
            await legacy.Database.ExecuteSqlRawAsync("DROP TABLE `__EFMigrationsHistory`;");
            await legacy.Database.ExecuteSqlRawAsync(
                "INSERT INTO Users (Username, PasswordHash, Role, Permissions) VALUES ('owner', {0}, 'Admin', 'trips');",
                BCrypt.Net.BCrypt.HashPassword("owner-pass"));
            await legacy.Database.ExecuteSqlRawAsync(
                "INSERT INTO Users (Username, PasswordHash, Role, Permissions) VALUES ('employee', {0}, 'Employee', 'trips');",
                BCrypt.Net.BCrypt.HashPassword("123456"));
            await legacy.Database.ExecuteSqlRawAsync(
                "INSERT INTO Customers (Name, Phone, CreatedAt, WalletBalance) VALUES ('عميل قديم', '0500000000', NOW(), 75);");
        }

        var owner = await factory.CreateClientAsAsync("owner", "owner-pass");
        var customers = await owner.GetFromJsonAsync<List<Customer>>("/api/Customers");
        var customer = Assert.Single(customers!);
        Assert.Equal("عميل قديم", customer.Name);
        Assert.Equal(75, customer.WalletBalance);

        // Existing users are kept, and no extra admin is created when users already exist.
        var users = await owner.GetFromJsonAsync<List<UserRow>>("/api/Users");
        Assert.Equal(new[] { "owner", "employee" }, users!.Select(u => u.Username));

        // The old default password still logs in, but only to choose a new one.
        var employee = await factory.CreateClientAsAsync("employee", "123456");
        var me = await employee.GetFromJsonAsync<Me>("/api/Auth/me");
        Assert.True(me!.MustChangePassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync("/api/Trips")).StatusCode);

        Assert.Equal(AllMigrations(factory), await CountAppliedMigrationsAsync(factory));
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

        Assert.Equal(AllMigrations(factory), await CountAppliedMigrationsAsync(factory));
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

    private static long AllMigrations(AlkaraApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.GetMigrations().Count();
    }

    private static async Task<long> CountAppliedMigrationsAsync(AlkaraApiFactory factory)
    {
        await using var connection = new MySqlConnection(factory.ConnectionString);
        await connection.OpenAsync();
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM `__EFMigrationsHistory`;";
        return Convert.ToInt64(await cmd.ExecuteScalarAsync());
    }

    private record UserRow(int Id, string Username, string Role, string Permissions, bool MustChangePassword);
}
