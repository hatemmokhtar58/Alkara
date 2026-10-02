using System;

namespace api.Models
{
    /// <summary>Every SMS the system tried to send, with whether the provider accepted it.</summary>
    public class SmsLog
    {
        public int Id { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        // Created, Ongoing, Completed, Cancelled, Postponed, Departed, Test
        public string Event { get; set; } = string.Empty;
        public int? TripId { get; set; }
        public bool Success { get; set; }
        public string? Error { get; set; }
        public DateTime SentAt { get; set; }
        public int? SentByUserId { get; set; }
    }
}
