namespace api.Services
{
    /// <summary>The business runs on Saudi time (UTC+3, no daylight saving). All stored times use it.</summary>
    public interface IClock
    {
        DateTime Now { get; }
    }

    public class SaudiClock : IClock
    {
        public static readonly TimeSpan Offset = TimeSpan.FromHours(3);

        public DateTime Now => DateTime.SpecifyKind(DateTime.UtcNow + Offset, DateTimeKind.Unspecified);
    }
}
