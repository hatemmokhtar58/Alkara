using api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers().AddJsonOptions(x =>
    x.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles); // Prevent cyclic JSON Reference

// Register HTTP Client for API integrations
builder.Services.AddHttpClient();

// Register SMS Notification Service
builder.Services.AddScoped<api.Services.ISmsService, api.Services.OurSmsService>();

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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"] ?? "MySuperSecretKeyForAlkaraSystem32Chars!!"))
        };
    });

var app = builder.Build();

// We removed EnsureDeleted() because it was wiping the user's data on every restart!
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Make sure database is created safely (but DO NOT DELETE IT!)
    try 
    {
        context.Database.EnsureCreated(); 
        
        // Manual schema sync for Permissions column if needed
        var conn = context.Database.GetDbConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SHOW COLUMNS FROM Users LIKE 'Permissions';";
        var columnExists = cmd.ExecuteScalar() != null;
        
        if (!columnExists)
        {
            cmd.CommandText = "ALTER TABLE Users ADD Permissions LONGTEXT NOT NULL DEFAULT '';";
            cmd.ExecuteNonQuery();
            Console.WriteLine("Manual DB Sync: Added 'Permissions' column to Users table.");
        }
        conn.Close();
    } 
    catch(Exception ex)
    {
        Console.WriteLine($"DB Sync Error: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
