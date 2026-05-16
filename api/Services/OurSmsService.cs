using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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
                var apiUrl = smsSection["ApiUrl"];
                var token = smsSection["Token"];
                var sender = smsSection["Src"];

                if (string.IsNullOrEmpty(apiUrl) || string.IsNullOrEmpty(token))
                {
                    _logger.LogError("[OurSMS] SMS configuration is missing. Make sure 'OurSms:ApiUrl' and 'OurSms:Token' are set in appsettings.json.");
                    return false;
                }

                // Format phone number - ensure it starts with 966 country code
                string cleanPhone = phoneNumber.Replace("+", "").Replace(" ", "").Trim();
                if (cleanPhone.StartsWith("05"))
                {
                    cleanPhone = "966" + cleanPhone.Substring(1);
                }
                else if (cleanPhone.StartsWith("5") && cleanPhone.Length == 9)
                {
                    cleanPhone = "966" + cleanPhone;
                }

                // Build the JSON payload per OurSms modern API spec
                var payload = new
                {
                    src = sender,
                    dests = new[] { cleanPhone },
                    body = message
                };

                var jsonContent = JsonSerializer.Serialize(payload);
                var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                // Set Bearer token in Authorization header
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

                _logger.LogInformation($"[OurSMS] Sending SMS to {cleanPhone} ...");

                var response = await _httpClient.PostAsync(apiUrl, httpContent);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"[OurSMS] ✅ Success. Response: {responseBody}");
                    return true;
                }
                else
                {
                    _logger.LogError($"[OurSMS] ❌ Failed. Status: {response.StatusCode}. Response: {responseBody}");
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
