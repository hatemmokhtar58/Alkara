using System.Net.Http.Headers;
using System.Net.Http.Json;
using api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MySqlConnector;

namespace api.Tests.Infrastructure;

/// <summary>
/// Hosts the real API against its own throwaway MySQL database.
/// The server comes from ALKARA_TEST_MYSQL (defaults to a local MySQL with root/test).
/// </summary>
public class AlkaraApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminUsername = "admin";
    public const string AdminPassword = "Test-Admin-Pass-1";
    private const string JwtSecret = "integration-tests-secret-0123456789abcdef";

    public static string ServerConnectionString =>
        Environment.GetEnvironmentVariable("ALKARA_TEST_MYSQL")
        ?? "server=localhost;port=3306;user=root;password=test";

    public string DatabaseName { get; } = "alkara_test_" + Guid.NewGuid().ToString("N")[..12];

    public string ConnectionString => $"{ServerConnectionString};database={DatabaseName};charset=utf8mb4";

    public FakeSmsService Sms { get; } = new();

    public FakeClock Clock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
        builder.UseSetting("JwtSettings:Secret", JwtSecret);
        builder.UseSetting("InitialAdmin:Username", AdminUsername);
        builder.UseSetting("InitialAdmin:Password", AdminPassword);
        builder.UseSetting("RateLimiting:LoginPerMinute", "1000");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<ISmsService>();
            services.AddSingleton<ISmsService>(Sms);
            services.RemoveAll<IClock>();
            services.AddSingleton<IClock>(Clock);
        });
    }

    public async Task<HttpClient> CreateClientAsAsync(string username, string password)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/Auth/login", new { username, password });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Token);
        return client;
    }

    public Task<HttpClient> CreateAdminClientAsync() => CreateClientAsAsync(AdminUsername, AdminPassword);

    /// <summary>Creates an employee through the API and returns a client logged in as them (password already changed).</summary>
    public async Task<HttpClient> CreateEmployeeClientAsync(string username, params string[] permissions)
    {
        var admin = await CreateAdminClientAsync();
        var created = await admin.PostAsJsonAsync("/api/Users", new
        {
            username,
            password = "Temp-Pass-123",
            role = "Employee",
            permissions = string.Join(',', permissions)
        });
        created.EnsureSuccessStatusCode();

        var client = await CreateClientAsAsync(username, "Temp-Pass-123");
        var changed = await client.PostAsJsonAsync("/api/Auth/change-password", new { currentPassword = "Temp-Pass-123", newPassword = EmployeePassword });
        changed.EnsureSuccessStatusCode();
        return await CreateClientAsAsync(username, EmployeePassword);
    }

    public const string EmployeePassword = "Employee-Pass-1";

    public Task InitializeAsync() => Task.CompletedTask;

    Task IAsyncLifetime.DisposeAsync() => DisposeAsync().AsTask();

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await using var connection = new MySqlConnection(ServerConnectionString);
        await connection.OpenAsync();
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $"DROP DATABASE IF EXISTS `{DatabaseName}`;";
        await cmd.ExecuteNonQueryAsync();
    }

    public record LoginResponse(string Token);
}
