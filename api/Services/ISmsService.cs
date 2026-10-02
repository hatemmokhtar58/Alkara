namespace api.Services
{
    public record SmsSendResult(bool Success, string? Error = null)
    {
        public static SmsSendResult Ok() => new(true);
        public static SmsSendResult Fail(string error) => new(false, error);
    }

    public interface ISmsService
    {
        Task<SmsSendResult> SendSmsAsync(string phoneNumber, string message);
    }
}
