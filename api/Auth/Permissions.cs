namespace api.Auth
{
    /// <summary>Permission keys stored (comma separated) in User.Permissions.</summary>
    public static class Permissions
    {
        public const string Trips = "trips";
        public const string Fleet = "fleet";
        public const string Expenses = "expenses";
        public const string Wallet = "wallet";
        public const string Reports = "reports";

        public static readonly string[] All = { Trips, Fleet, Expenses, Wallet, Reports };

        public const string AdminRole = "Admin";
        public const string EmployeeRole = "Employee";

        public static readonly string[] Roles = { AdminRole, EmployeeRole };

        public static HashSet<string> Parse(string? permissions) =>
            (permissions ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(p => p.ToLowerInvariant())
                .ToHashSet();

        /// <summary>Keeps known keys only, in a stable order.</summary>
        public static string Normalize(IEnumerable<string>? permissions)
        {
            var requested = (permissions ?? Enumerable.Empty<string>())
                .Select(p => p.Trim().ToLowerInvariant())
                .ToHashSet();
            return string.Join(',', All.Where(requested.Contains));
        }
    }
}
