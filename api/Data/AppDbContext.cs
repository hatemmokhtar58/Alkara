using Microsoft.EntityFrameworkCore;

namespace api.Models
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Customer> Customers { get; set; } = null!;
        public DbSet<Driver> Drivers { get; set; } = null!;
        public DbSet<Car> Cars { get; set; } = null!;
        public DbSet<Trip> Trips { get; set; } = null!;
        public DbSet<Expense> Expenses { get; set; } = null!;
        public DbSet<WalletTransaction> WalletTransactions { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            modelBuilder.Entity<User>().HasData(
                new User { Id = 1, Username = "admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), Role = "Admin", Permissions = "trips,fleet,expenses,wallet,reports,users" },
                new User { Id = 2, Username = "employee", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), Role = "Employee", Permissions = "trips" }
            );
            
            // Decimal precision for Trip
            modelBuilder.Entity<Trip>()
                .Property(t => t.HourlyRate)
                .HasColumnType("decimal(18,2)");
                
            modelBuilder.Entity<Trip>()
                .Property(t => t.FixedPrice)
                .HasColumnType("decimal(18,2)");
                
            modelBuilder.Entity<Trip>()
                .Property(t => t.DiscountValue)
                .HasColumnType("decimal(18,2)");
                
            modelBuilder.Entity<Trip>()
                .Property(t => t.FinalTotal)
                .HasColumnType("decimal(18,2)");
                
            // Decimal precision for Expense
            modelBuilder.Entity<Expense>()
                .Property(e => e.Amount)
                .HasColumnType("decimal(18,2)");
                
            modelBuilder.Entity<Customer>()
                .Property(c => c.WalletBalance)
                .HasColumnType("decimal(18,2)");
                
            modelBuilder.Entity<WalletTransaction>()
                .Property(w => w.Amount)
                .HasColumnType("decimal(18,2)");
        }
    }
}
