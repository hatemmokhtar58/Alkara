using System;

namespace api.Models
{
    /// <summary>One change to the data (or a login), who made it and when.</summary>
    public class AuditLog
    {
        public long Id { get; set; }
        public DateTime At { get; set; }
        public int? UserId { get; set; }
        public string? Username { get; set; }
        // Created, Updated, Deleted, Login, LoginFailed, PasswordChanged
        public string Action { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string? EntityId { get; set; }
        // JSON: created/deleted -> { field: value }, updated -> { field: [old, new] }
        public string? Changes { get; set; }
    }
}
