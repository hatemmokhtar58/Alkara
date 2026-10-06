using api.Auth;
using api.Models;

namespace api.Services
{
    /// <summary>Sends an SMS through the configured provider and records the attempt in SmsLogs.</summary>
    public class SmsNotifier
    {
        private readonly AppDbContext _context;
        private readonly ISmsService _sms;
        private readonly IClock _clock;
        private readonly IHttpContextAccessor _http;
        private readonly ILogger<SmsNotifier> _logger;

        public SmsNotifier(AppDbContext context, ISmsService sms, IClock clock, IHttpContextAccessor http, ILogger<SmsNotifier> logger)
        {
            _context = context;
            _sms = sms;
            _clock = clock;
            _http = http;
            _logger = logger;
        }

        public async Task<SmsSendResult> SendAsync(string phone, string message, string eventType, int? tripId = null)
        {
            SmsSendResult result;
            try
            {
                result = await _sms.SendSmsAsync(phone, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMS provider threw while sending {Event}", eventType);
                result = SmsSendResult.Fail(ex.Message);
            }

            var error = result.Error;
            if (error != null && error.Length > 500) error = error[..500];

            _context.SmsLogs.Add(new SmsLog
            {
                Phone = phone,
                Message = message,
                Event = eventType,
                TripId = tripId,
                Success = result.Success,
                Error = result.Success ? null : error ?? "فشل الإرسال",
                SentAt = _clock.Now,
                SentByUserId = _http.HttpContext == null ? null : CurrentUser.Get(_http.HttpContext)?.Id
            });
            await _context.SaveChangesAsync();
            return result;
        }
    }
}
