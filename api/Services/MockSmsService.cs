namespace api.Services
{
    public class MockSmsService : ISmsService
    {
        private readonly ILogger<MockSmsService> _logger;

        public MockSmsService(ILogger<MockSmsService> logger)
        {
            _logger = logger;
        }

        public Task<bool> SendSmsAsync(string phoneNumber, string message)
        {
            // سيتم استبدال هذا الكود لاحقاً للربط مع SMS API الحقيقي (مثل Unifonic أو Jawaly)
            _logger.LogInformation("================================================");
            _logger.LogInformation($"[SMS MOCK] Sending SMS to: {phoneNumber}");
            _logger.LogInformation($"[SMS MOCK] Message: {message}");
            _logger.LogInformation("================================================");
            
            return Task.FromResult(true); // يفترض أن عملية الإرسال نجحت ہمیشہ
        }
    }
}
