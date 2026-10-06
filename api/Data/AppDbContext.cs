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
