using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    public class User
    {
        public int Id { get; set; }
        
        [Required]
        public string Username { get; set; } = string.Empty;
        
        public string PasswordHash { get; set; } = string.Empty;
        
        [Required]
        public string Role { get; set; } = "Employee"; // Admin or Employee

        public string Permissions { get; set; } = string.Empty; // Comma separated keys: trips,fleet,expenses,wallet,reports

        // Set when an admin creates the account or resets its password; the user must pick their own on next login.
        public bool MustChangePassword { get; set; }

        // Bumped on password changes; tokens issued with an older value stop working.
        public int TokenVersion { get; set; }
    }
}
