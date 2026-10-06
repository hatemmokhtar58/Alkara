using System.Text.Json;
using api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace api.Models
{
    // Every save fills CreatedByUserId on new records and writes one AuditLog row per changed entity.
    public partial class AppDbContext
    {
        private static readonly HashSet<Type> NotAudited = new() { typeof(AuditLog), typeof(SmsLog) };
        private static readonly HashSet<string> HiddenValues = new() { nameof(User.PasswordHash) };
        private static readonly JsonSerializerOptions AuditJson = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

        private readonly IAuditContext? _audit;

        public AppDbContext(DbContextOptions<AppDbContext> options, IAuditContext audit) : base(options)
        {
            _audit = audit;
        }

        public DbSet<AuditLog> AuditLogs { get; set; } = null!;

        /// <summary>Records something that is not a data change, like a login. Saved with the next SaveChanges.</summary>
        public void AddAuditEvent(string action, string entityType, string? entityId, object? details = null, int? userId = null, string? username = null)
        {
            AuditLogs.Add(new AuditLog
            {
                At = _audit?.Now ?? DateTime.Now,
                UserId = userId ?? _audit?.UserId,
                Username = username ?? _audit?.Username,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Changes = details == null ? null : JsonSerializer.Serialize(details, AuditJson)
            });
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            var pending = BeforeSave();
            var result = base.SaveChanges(acceptAllChangesOnSuccess);
            if (AfterSave(pending)) base.SaveChanges(acceptAllChangesOnSuccess);
            return result;
        }

        public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            var pending = BeforeSave();
            var result = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            if (AfterSave(pending)) await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            return result;
        }

        private List<(EntityEntry Entry, AuditLog Log)> BeforeSave()
        {
            var pending = new List<(EntityEntry, AuditLog)>();
            if (_audit == null) return pending;

            ChangeTracker.DetectChanges();
            foreach (var entry in ChangeTracker.Entries().ToList())
            {
                if (entry.State == EntityState.Added && entry.Entity is IHasCreator creator && creator.CreatedByUserId == null)
                    creator.CreatedByUserId = _audit.UserId;

                if (NotAudited.Contains(entry.Entity.GetType())) continue;
                if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;

                var changes = new Dictionary<string, object?>();
                foreach (var property in entry.Properties)
                {
                    var name = property.Metadata.Name;
                    var hidden = HiddenValues.Contains(name);
                    switch (entry.State)
                    {
                        case EntityState.Added when property.CurrentValue != null && !property.Metadata.IsPrimaryKey():
                            changes[name] = hidden ? "***" : property.CurrentValue;
                            break;
                        case EntityState.Deleted when property.OriginalValue != null:
                            changes[name] = hidden ? "***" : property.OriginalValue;
                            break;
                        case EntityState.Modified when property.IsModified && !Equals(property.OriginalValue, property.CurrentValue):
                            changes[name] = hidden ? new object?[] { "***", "***" } : new[] { property.OriginalValue, property.CurrentValue };
                            break;
                    }
                }
                if (entry.State == EntityState.Modified && changes.Count == 0) continue;

                var action = entry.State switch
                {
                    EntityState.Added => "Created",
                    EntityState.Deleted => "Deleted",
                    _ => entry.Entity is User { DeletedAt: not null } && changes.ContainsKey(nameof(User.DeletedAt)) ? "Deleted" : "Updated"
                };

                pending.Add((entry, new AuditLog
                {
                    At = _audit.Now,
                    UserId = _audit.UserId,
                    Username = _audit.Username,
                    Action = action,
                    EntityType = entry.Metadata.ClrType.Name,
                    Changes = JsonSerializer.Serialize(changes, AuditJson)
                }));
            }
            return pending;
        }

        // Ids of new rows exist only after the first save, so the audit rows go in a second one.
        private bool AfterSave(List<(EntityEntry Entry, AuditLog Log)> pending)
        {
            if (pending.Count == 0) return false;
            foreach (var (entry, log) in pending)
            {
                var key = entry.Metadata.FindPrimaryKey();
                log.EntityId = key == null ? null : string.Join(",", key.Properties.Select(p => entry.Property(p.Name).CurrentValue ?? entry.Property(p.Name).OriginalValue));
                AuditLogs.Add(log);
            }
            return true;
        }
    }
}
