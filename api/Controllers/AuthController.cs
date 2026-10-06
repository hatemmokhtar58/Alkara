using api.Auth;
using api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        public const string TokenVersionClaim = "token_version";
        public const int MinPasswordLength = 8;

        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public class LoginRequest
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        public class ChangePasswordRequest
        {
            public string CurrentPassword { get; set; } = string.Empty;
            public string NewPassword { get; set; } = string.Empty;
        }

        [AllowAnonymous]
        [EnableRateLimiting("login")]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var username = (request.Username ?? string.Empty).Trim();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == username);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                _context.AddAuditEvent("LoginFailed", nameof(User), user?.Id.ToString(), new { ip = HttpContext.Connection.RemoteIpAddress?.ToString() },
                    userId: user?.Id, username: username.Length > 100 ? username[..100] : username);
                await _context.SaveChangesAsync();
                return Unauthorized(new { message = "اسم المستخدم أو كلمة المرور غير صحيحة" });
            }

            _context.AddAuditEvent("Login", nameof(User), user.Id.ToString(), new { ip = HttpContext.Connection.RemoteIpAddress?.ToString() },
                userId: user.Id, username: user.Username);
            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);
            
            return Ok(new
            {
                Token = token,
                User = ToDto(user)
            });
        }

        // GET: api/Auth/me - the logged-in user's current role and permissions
        [HttpGet("me")]
        public IActionResult Me()
        {
            var user = CurrentUser.Get(HttpContext);
            if (user == null) return Unauthorized();
            return Ok(ToDto(user));
        }

        // POST: api/Auth/change-password - returns a fresh token, older tokens stop working
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var current = CurrentUser.Get(HttpContext);
            if (current == null) return Unauthorized();

            var user = await _context.Users.FindAsync(current.Id);
            if (user == null) return Unauthorized();

            if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            {
                return BadRequest(new { message = "كلمة المرور الحالية غير صحيحة." });
            }

            var error = ValidateNewPassword(request.NewPassword);
            if (error != null) return BadRequest(new { message = error });

            if (BCrypt.Net.BCrypt.Verify(request.NewPassword, user.PasswordHash))
            {
                return BadRequest(new { message = "كلمة المرور الجديدة يجب أن تختلف عن الحالية." });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.MustChangePassword = false;
            user.TokenVersion++;
            await _context.SaveChangesAsync();

            return Ok(new { Token = GenerateJwtToken(user), User = ToDto(user) });
        }

        public static string? ValidateNewPassword(string? password)
        {
            if (string.IsNullOrWhiteSpace(password) || password.Length < MinPasswordLength)
            {
                return $"كلمة المرور يجب أن تكون {MinPasswordLength} أحرف على الأقل.";
            }
            return null;
        }

        public static object ToDto(User user) => new
        {
            user.Id,
            user.Username,
            user.Role,
            user.Permissions,
            user.MustChangePassword
        };

        private string GenerateJwtToken(User user)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JwtSettings:Secret"]
                ?? throw new InvalidOperationException("JwtSettings:Secret is not configured.")));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(TokenVersionClaim, user.TokenVersion.ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _configuration["JwtSettings:Issuer"] ?? "AlkaraApi",
                audience: _configuration["JwtSettings:Audience"] ?? "AlkaraReactClient",
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
