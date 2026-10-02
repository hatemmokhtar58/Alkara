using api.Auth;

namespace api.Services
{
    /// <summary>Who is making the current change, for CreatedByUserId and the audit log.</summary>
    public interface IAuditContext
    {
        int? UserId { get; }
        string? Username { get; }
        DateTime Now { get; }
    }

    public class HttpAuditContext : IAuditContext
    {
        private readonly IHttpContextAccessor _http;
        private readonly IClock _clock;

        public HttpAuditContext(IHttpContextAccessor http, IClock clock)
        {
            _http = http;
            _clock = clock;
        }

        private Models.User? User => _http.HttpContext == null ? null : CurrentUser.Get(_http.HttpContext);

        public int? UserId => User?.Id;
        public string? Username => User?.Username;
        public DateTime Now => _clock.Now;
    }
}
