using api.Auth;
using api.Controllers;
using api.Data;
using System.Security.Claims;
using System.Threading.RateLimiting;
using api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authorization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers().AddJsonOptions(x =>
{
    x.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles; // Prevent cyclic JSON Reference
    x.JsonSerializerOptions.Converters.Add(new api.Services.SaudiDateTimeConverter());
});

// Every endpoint requires a logged-in user unless it opts out with [AllowAnonymous]
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Register HTTP Client for API integrations
builder.Services.AddHttpClient();

builder.Services.AddSingleton<api.Services.IClock, api.Services.SaudiClock>();
builder.Services.AddScoped<api.Services.WalletLedger>();

// Register SMS Notification Service
// Sms:Provider = "Mock" logs messages instead of sending them (local development).
if (string.Equals(builder.Configuration["Sms:Provider"], "Mock", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddScoped<api.Services.ISmsService, api.Services.MockSmsService>();
else
    builder.Services.AddScoped<api.Services.ISmsService, api.Services.OurSmsService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<api.Services.SmsNotifier>();
builder.Services.AddScoped<api.Services.IAuditContext, api.Services.HttpAuditContext>();

// Configure MySQL Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// Configure CORS for React
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

builder.Services.AddOpenApi(); // For API documentation

// JWT Authentication Configuration
// The signing secret is never stored in source control. Set it with the
// JwtSettings__Secret environment variable (or `dotnet user-secrets` in development).
var jwtSecret = builder.Configuration["JwtSettings:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || Encoding.UTF8.GetByteCount(jwtSecret) < 32)
{
    throw new InvalidOperationException(
        "JwtSettings:Secret is missing or shorter than 32 bytes. " +
        "Set the JwtSettings__Secret environment variable (see api/SECRETS.md).");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "AlkaraApi",
            ValidAudience = builder.Configuration["JwtSettings:Audience"] ?? "AlkaraReactClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
        // A valid signature is not enough: the user must still exist and the token must not
        // predate a password change. The loaded user is kept for permission checks.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var idClaim = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var versionClaim = context.Principal?.FindFirst(AuthController.TokenVersionClaim)?.Value;
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var user = int.TryParse(idClaim, out var userId)
                    ? await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)
                    : null;

                if (user == null || versionClaim != user.TokenVersion.ToString())
                {
                    context.Fail("User no longer valid.");
                    return;
                }

                CurrentUser.Set(context.HttpContext, user);
            }
        };
    });

// Slow down password guessing on the login endpoint
var loginAttemptsPerMinute = builder.Configuration.GetValue("RateLimiting:LoginPerMinute", 10);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = loginAttemptsPerMinute, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

// Bring the database schema up to date (and seed the first admin on an empty database)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();
    await DatabaseInitializer.InitializeAsync(context, app.Configuration, logger);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");

app.UseRateLimiter();

app.UseAuthentication();

// Accounts created or reset by an admin can only change their password until they do.
app.Use(async (context, next) =>
{
    var user = CurrentUser.Get(context);
    var path = context.Request.Path;
    if (user is { MustChangePassword: true }
        && !path.StartsWithSegments("/api/Auth/change-password", StringComparison.OrdinalIgnoreCase)
        && !path.StartsWithSegments("/api/Auth/me", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { message = "يجب تغيير كلمة المرور أولاً.", code = "MustChangePassword" });
        return;
    }
    await next();
});

app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposed so integration tests can host the API with WebApplicationFactory<Program>
public partial class Program { }
