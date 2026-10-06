using api.Auth;
using api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequireAdmin]
    public class AuditController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Audit?page=1&pageSize=50&entityType=Trip&entityId=5&userId=2&action=Deleted - newest first
        [HttpGet]
        public async Task<ActionResult> GetAudit([FromQuery] int page = 1, [FromQuery] int pageSize = 50,
            [FromQuery] string? entityType = null, [FromQuery] string? entityId = null, [FromQuery] int? userId = null, [FromQuery] string? action = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var query = _context.AuditLogs.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(a => a.EntityType == entityType);
            if (!string.IsNullOrWhiteSpace(entityId)) query = query.Where(a => a.EntityId == entityId);
            if (userId != null) query = query.Where(a => a.UserId == userId);
            if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action == action);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.Id)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }
    }
}
