using Microsoft.EntityFrameworkCore;
using api.Models;
using api.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql("server=localhost;port=3307;database=alkara;uid=root;pwd=;", ServerVersion.AutoDetect("server=localhost;port=3307;database=alkara;uid=root;pwd=;")));

using var host = builder.Build();
using var scope = host.Services.CreateScope();
var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

var users = await context.Users.ToListAsync();
foreach (var u in users)
{
    Console.WriteLine($"ID: {u.Id}, Username: {u.Username}, Role: {u.Role}, Permissions: '{u.Permissions}'");
}
