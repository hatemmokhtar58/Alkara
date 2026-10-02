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
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IClock _clock;

        public UsersController(AppDbContext context, IClock clock)
        {
            _context = context;
            _clock = clock;
        }

        public class UserRequest
        {
            public string Username { get; set; } = string.Empty;
            // Required when creating; when editing, empty keeps the current password.
            public string? Password { get; set; }
            public string Role { get; set; } = "Employee";
            public string Permissions { get; set; } = string.Empty;
        }

        // GET: api/Users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            return await _context.Users
                .OrderBy(u => u.Id)
                .Select(u => new { u.Id, u.Username, u.Role, u.Permissions, u.MustChangePassword })
                .ToListAsync();
        }

        // POST: api/Users
        [HttpPost]
        public async Task<ActionResult> PostUser(UserRequest request)
        {
            var error = await ValidateAsync(request, existingId: null)
                ?? AuthController.ValidateNewPassword(request.Password);
            if (error != null) return BadRequest(new { message = error });

            var user = new User
            {
                Username = request.Username.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                Permissions = Permissions.Normalize(request.Permissions.Split(',')),
                MustChangePassword = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, AuthController.ToDto(user));
        }

        // PUT: api/Users/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUser(int id, UserRequest request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            var error = await ValidateAsync(request, existingId: id);
            if (error != null) return BadRequest(new { message = error });

            if (user.Role == Permissions.AdminRole && request.Role != Permissions.AdminRole && await IsLastAdminAsync(id))
            {
                return BadRequest(new { message = "لا يمكن إزالة صلاحية المدير من آخر مدير في النظام." });
            }

            user.Username = request.Username.Trim();
            user.Role = request.Role;
            user.Permissions = Permissions.Normalize(request.Permissions.Split(','));

            if (!string.IsNullOrEmpty(request.Password))
            {
                var passwordError = AuthController.ValidateNewPassword(request.Password);
                if (passwordError != null) return BadRequest(new { message = passwordError });

                // An admin reset: the user picks their own password on next login, old sessions end.
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                user.MustChangePassword = id != CurrentUser.Get(HttpContext)?.Id;
                user.TokenVersion++;
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            if (id == CurrentUser.Get(HttpContext)?.Id)
            {
                return BadRequest(new { message = "لا يمكنك حذف حسابك الحالي." });
            }

            if (user.Role == Permissions.AdminRole && await IsLastAdminAsync(id))
            {
                return BadRequest(new { message = "لا يمكن حذف آخر مدير في النظام." });
            }

            // Kept for history: the name stays on the trips and payments this user recorded.
            // The username gets a suffix so it can be used again for a new account.
            var suffix = $" (محذوف #{user.Id})";
            user.Username = (user.Username.Length + suffix.Length > 100 ? user.Username[..(100 - suffix.Length)] : user.Username) + suffix;
            user.DeletedAt = _clock.Now;
            user.TokenVersion++;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private async Task<string?> ValidateAsync(UserRequest request, int? existingId)
        {
            if (string.IsNullOrWhiteSpace(request.Username))
            {
                return "اسم المستخدم مطلوب.";
            }

            if (!Permissions.Roles.Contains(request.Role))
            {
                return "الدور غير صالح.";
            }

            var username = request.Username.Trim();
            var taken = await _context.Users.IgnoreQueryFilters().AnyAsync(u => u.Username == username && u.Id != existingId);
            return taken ? "اسم المستخدم مستخدم بالفعل." : null;
        }

        private Task<bool> IsLastAdminAsync(int id) =>
            _context.Users.AllAsync(u => u.Id == id || u.Role != Permissions.AdminRole);
    }
}
