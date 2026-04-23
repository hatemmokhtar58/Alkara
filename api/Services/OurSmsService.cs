using System;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace api.Services
{
    public class OurSmsService : ISmsService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<OurSmsService> _logger;
        private readonly IConfiguration _configuration;

        public OurSmsService(HttpClient httpClient, ILogger<OurSmsService> logger, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<bool> SendSmsAsync(string phoneNumber, string message)
        {
            try
            {
                var smsSection = _configuration.GetSection("OurSms");
                var baseUrl = smsSection["ApiUrl"];
                var token = smsSection["Token"];
                var sender = smsSection["Src"];

                if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(token))

                {
                    _logger.LogError("SMS configuration is missing in appsettings.json.");
                    return false;
                }

                // Format phone number if needed (e.g., ensure it starts with country code, though it usually does from frontend)
                string cleanPhone = phoneNumber.Replace("+", "").Trim();
                if (cleanPhone.StartsWith("05"))
                {
                    cleanPhone = "966" + cleanPhone.Substring(1);
                }

                // URL encode parameters - Mapping parameters to the modern Oursms.com structure
                // username=@username (if needed), token=@token, src=@sender, dests=@phone, body=@message
                var url = $"{baseUrl}?token={Uri.EscapeDataString(token)}" +
                          $"&src={Uri.EscapeDataString(sender)}" +
                          $"&dests={Uri.EscapeDataString(cleanPhone)}" +
                          $"&body={Uri.EscapeDataString(message)}" +
                          "&return=json";


                _logger.LogInformation($"[OurSMS] Sending message to {cleanPhone} via modern API...");

                var response = await _httpClient.GetAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"[OurSMS] Success: {content}");
                    return true;
                }
                else
                {
                    _logger.LogError($"[OurSMS] Failed. Status: {response.StatusCode}. Content: {content}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OurSMS] Exception while sending SMS");
                return false;
            }
        }
    }
}
