using api.Models;

namespace api.Auth
{
    /// <summary>Gives access to the logged-in user loaded from the database for this request.</summary>
    public static class CurrentUser
    {
        private const string ItemKey = "Alkara.CurrentUser";

        public static void Set(HttpContext context, User user) => context.Items[ItemKey] = user;

        public static User? Get(HttpContext context) => context.Items.TryGetValue(ItemKey, out var user) ? user as User : null;

        public static bool IsAdmin(User user) => user.Role == Permissions.AdminRole;

        public static bool HasAny(User user, IEnumerable<string> permissions)
        {
            if (IsAdmin(user)) return true;
            var granted = Permissions.Parse(user.Permissions);
            return permissions.Any(granted.Contains);
        }
    }
}
