namespace api.Models
{
    /// <summary>Simple key/value business settings (e.g. the default driver commission).</summary>
    public class AppSetting
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }
}
