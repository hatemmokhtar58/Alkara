using api.Auth;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequireAdmin]
    public class SmsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SmsNotifier _sms;

        public SmsController(AppDbContext context, SmsNotifier sms)
        {
            _context = context;
            _sms = sms;
        }

        public class TestSmsRequest
        {
            public string Phone { get; set; } = string.Empty;
        }

        // GET: api/Sms/logs?page=1&pageSize=50&failedOnly=false
        [HttpGet("logs")]
        public async Task<ActionResult> GetLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] bool failedOnly = false)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var query = _context.SmsLogs.AsNoTracking();
            if (failedOnly) query = query.Where(l => !l.Success);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(l => l.SentAt).ThenByDescending(l => l.Id)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        // POST: api/Sms/test
        [HttpPost("test")]
        public async Task<IActionResult> SendTest(TestSmsRequest request)
        {
            var phone = PhoneNumbers.NormalizeSaudiMobile(request.Phone);
            if (phone == null) return BadRequest(new { message = "رقم الجوال غير صحيح. اكتبه بالشكل 05XXXXXXXX." });

            var result = await _sms.SendAsync(phone, "تجربة إرسال رسالة نصية من الكرى - Alkara Test SMS", "Test");
            return result.Success
                ? Ok(new { message = "تم إرسال الرسالة بنجاح، يرجى التحقق من جوالك." })
                : BadRequest(new { message = "فشل إرسال الرسالة: " + result.Error });
        }
    }
}
