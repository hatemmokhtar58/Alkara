using api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Requires login
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            // Only Admin can see the user list
            var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var currentUser = await _context.Users.FindAsync(int.Parse(currentUserId ?? "0"));
            
            if (currentUser == null || currentUser.Role != "Admin")
            {
                return Forbid();
            }

            return await _context.Users
                .Select(u => new { u.Id, u.Username, u.Role, u.Permissions })
                .ToListAsync();
        }

        // POST: api/Users
        [HttpPost]
        public async Task<ActionResult<User>> PostUser(User user)
        {
            // Hash password before saving
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(user.PasswordHash);
            
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            
            return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, new { user.Id, user.Username, user.Role, user.Permissions });
        }

        // PUT: api/Users/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUser(int id, User user)
        {
            if (id != user.Id) return BadRequest();

            var dbUser = await _context.Users.FindAsync(id);
            if (dbUser == null) return NotFound();

            dbUser.Username = user.Username;
            dbUser.Role = user.Role;
            dbUser.Permissions = user.Permissions;

            // Only update password if provided
            if (!string.IsNullOrEmpty(user.PasswordHash) && !user.PasswordHash.StartsWith("$2b$"))
            {
                dbUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(user.PasswordHash);
            }

            _context.Entry(dbUser).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            // Prevent deleting the last admin or yourself? 
            // Simplified for now: just delete.
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
