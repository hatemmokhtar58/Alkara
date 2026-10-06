namespace api.Services
{
    /// <summary>Writes messages to the log instead of sending them (for local development).</summary>
    public class MockSmsService : ISmsService
    {
        private readonly ILogger<MockSmsService> _logger;

        public MockSmsService(ILogger<MockSmsService> logger)
        {
            _logger = logger;
        }

        public Task<SmsSendResult> SendSmsAsync(string phoneNumber, string message)
        {
            _logger.LogInformation("[SMS MOCK] To {Phone}: {Message}", phoneNumber, message);
            return Task.FromResult(SmsSendResult.Ok());
        }
    }
}
