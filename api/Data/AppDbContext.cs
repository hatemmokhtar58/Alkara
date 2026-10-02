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
        public DbSet<AppSetting> AppSettings { get; set; } = null!;
        public DbSet<DriverMonthlySalary> DriverMonthlySalaries { get; set; } = null!;
        public DbSet<SmsLog> SmsLogs { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(user =>
            {
                user.Property(u => u.Username).HasMaxLength(100);
                user.HasIndex(u => u.Username).IsUnique();
            });
            
            
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
                
            modelBuilder.Entity<Trip>()
                .Property(t => t.PaidAmount)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<Trip>()
                .Property(t => t.ExtraCharge)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<Driver>()
                .Property(d => d.BaseSalary)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<AppSetting>(setting =>
            {
                setting.HasKey(s => s.Key);
                setting.Property(s => s.Key).HasMaxLength(100);
            });

            // Phone numbers are stored as 05XXXXXXXX and plates normalized, so these catch duplicates.
            modelBuilder.Entity<Customer>(customer =>
            {
                customer.Property(c => c.Phone).HasMaxLength(20);
                customer.HasIndex(c => c.Phone).IsUnique();
            });

            modelBuilder.Entity<Car>(car =>
            {
                car.Property(c => c.PlateNumber).HasMaxLength(20);
                car.HasIndex(c => c.PlateNumber).IsUnique();
            });

            modelBuilder.Entity<Driver>().Property(d => d.Phone).HasMaxLength(20);

            modelBuilder.Entity<SmsLog>(log =>
            {
                log.Property(l => l.Phone).HasMaxLength(20);
                log.Property(l => l.Event).HasMaxLength(30);
                log.Property(l => l.Error).HasMaxLength(500);
                log.HasIndex(l => l.SentAt);
            });

            // Reports filter by these columns.
            modelBuilder.Entity<Trip>().Property(t => t.Status).HasMaxLength(20);
            modelBuilder.Entity<Trip>().HasIndex(t => new { t.Status, t.EndTime });
            modelBuilder.Entity<WalletTransaction>().HasIndex(w => new { w.CustomerId, w.TransactionDate });
            modelBuilder.Entity<WalletTransaction>().HasIndex(w => w.TransactionDate);
            modelBuilder.Entity<Expense>().HasIndex(e => e.Date);

            modelBuilder.Entity<DriverMonthlySalary>(salary =>
            {
                salary.HasIndex(s => new { s.DriverId, s.Year, s.Month }).IsUnique();
                foreach (var property in new[] { "Allowances", "Deductions", "BaseSalary", "TotalIncome", "TotalExpenses", "CommissionPercent", "Commission", "Total" })
                {
                    salary.Property(property).HasColumnType("decimal(18,2)");
                }
            });

            modelBuilder.Entity<Driver>()
                .Property(d => d.CommissionPercent)
                .HasColumnType("decimal(5,2)");

            modelBuilder.Entity<WalletTransaction>()
                .HasOne(w => w.Customer)
                .WithMany(c => c.WalletTransactions)
                .HasForeignKey(w => w.CustomerId);
                
            modelBuilder.Entity<WalletTransaction>()
                .Property(w => w.Amount)
                .HasColumnType("decimal(18,2)");
        }
    }
}
