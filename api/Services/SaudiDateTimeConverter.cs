using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace api.Services
{
    /// <summary>
    /// Times are stored as Saudi local time. On the wire they carry the +03:00 offset so every
    /// browser shows them correctly whatever its own time zone. Incoming values with an offset
    /// (or Z) are converted to Saudi time; values without one are taken as Saudi time already.
    /// </summary>
    public class SaudiDateTimeConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var text = reader.GetString();
            if (string.IsNullOrWhiteSpace(text)) throw new JsonException("Empty date.");

            if (DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var withOffset) && HasOffset(text))
            {
                return DateTime.SpecifyKind(withOffset.UtcDateTime + SaudiClock.Offset, DateTimeKind.Unspecified);
            }

            return DateTime.SpecifyKind(DateTime.Parse(text, CultureInfo.InvariantCulture), DateTimeKind.Unspecified);
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value.ToString("yyyy-MM-dd'T'HH:mm:ss.fff", CultureInfo.InvariantCulture) + "+03:00");
        }

        private static bool HasOffset(string text)
        {
            var timePart = text.Contains('T') ? text[text.IndexOf('T')..] : string.Empty;
            return timePart.EndsWith("Z", StringComparison.OrdinalIgnoreCase) || timePart.Contains('+') || timePart.LastIndexOf('-') > 0;
        }
    }
}
