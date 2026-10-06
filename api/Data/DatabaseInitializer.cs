using System.Data.Common;
using System.Security.Cryptography;
using api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;

namespace api.Data
{
    public static class DatabaseInitializer
    {
        // Migrations that a database created by the old EnsureCreated() startup already contains.
        private const string InitialCreate = "20260517061751_InitialCreate";
        private const string AddBaseSalaryToDriver = "20260606221026_AddBaseSalaryToDriver";

        public static async Task InitializeAsync(AppDbContext context, IConfiguration configuration, ILogger logger)
        {
            await BaselineLegacyDatabaseAsync(context, logger);
            await context.Database.MigrateAsync();
            await SeedInitialAdminAsync(context, configuration, logger);
            await FlagDefaultPasswordsAsync(context, logger);
        }

        // Older installs created accounts with the password "123456"; make their owners pick a new one.
        private static async Task FlagDefaultPasswordsAsync(AppDbContext context, ILogger logger)
        {
            var users = await context.Users.Where(u => !u.MustChangePassword).ToListAsync();
            var flagged = users.Where(u => BCrypt.Net.BCrypt.Verify("123456", u.PasswordHash)).ToList();
            if (flagged.Count == 0) return;

            foreach (var user in flagged) user.MustChangePassword = true;
            await context.SaveChangesAsync();
            logger.LogWarning("{Count} user(s) still had the default password and must change it at next login.", flagged.Count);
        }

        // Databases created by EnsureCreated() have all the tables but no __EFMigrationsHistory,
        // so Migrate() would try to create the tables again and fail. Record the migrations
        // that the existing schema already reflects, without touching any data.
        private static async Task BaselineLegacyDatabaseAsync(AppDbContext context, ILogger logger)
        {
            if (!await context.Database.CanConnectAsync()) return;

            var connection = context.Database.GetDbConnection();
            await connection.OpenAsync();
            try
            {
                if (await TableExistsAsync(connection, "__EFMigrationsHistory")) return;
                if (!await TableExistsAsync(connection, "Users")) return;

                logger.LogWarning("Database was created without migrations; recording the existing schema as migrated.");

                // Very old databases predate the Permissions column.
                if (!await ColumnExistsAsync(connection, "Users", "Permissions"))
                {
                    await ExecuteAsync(connection, "ALTER TABLE `Users` ADD `Permissions` LONGTEXT NOT NULL DEFAULT ('');");
                }

                await ExecuteAsync(connection,
                    "CREATE TABLE `__EFMigrationsHistory` (" +
                    "`MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL, " +
                    "`ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL, " +
                    "CONSTRAINT `PK___EFMigrationsHistory` PRIMARY KEY (`MigrationId`)) CHARACTER SET=utf8mb4;");

                var applied = new List<string> { InitialCreate };
                if (await ColumnExistsAsync(connection, "Drivers", "BaseSalary"))
                {
                    applied.Add(AddBaseSalaryToDriver);
                }

                var productVersion = typeof(Migration).Assembly.GetName().Version!.ToString(3);
                foreach (var migrationId in applied)
                {
                    await ExecuteAsync(connection,
                        "INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES (@id, @version);",
                        ("@id", migrationId), ("@version", productVersion));
                }
            }
            finally
            {
                await connection.CloseAsync();
            }
        }

        // An empty database gets one admin. The password comes from InitialAdmin:Password,
        // or is generated and written to the log once so nobody ships with a known default.
        private static async Task SeedInitialAdminAsync(AppDbContext context, IConfiguration configuration, ILogger logger)
        {
            if (await context.Users.AnyAsync()) return;

            var username = configuration["InitialAdmin:Username"];
            if (string.IsNullOrWhiteSpace(username)) username = "admin";

            var password = configuration["InitialAdmin:Password"];
            var generated = string.IsNullOrWhiteSpace(password);
            if (generated)
            {
                password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(12));
            }

            context.Users.Add(new User
            {
                Username = username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Role = "Admin",
                Permissions = api.Auth.Permissions.Normalize(api.Auth.Permissions.All),
                MustChangePassword = generated
            });
            await context.SaveChangesAsync();

            if (generated)
            {
                logger.LogWarning("Created the first admin user '{Username}' with generated password: {Password}  (change it after logging in)", username, password);
            }
            else
            {
                logger.LogInformation("Created the first admin user '{Username}' from InitialAdmin settings.", username);
            }
        }

        private static async Task<bool> TableExistsAsync(DbConnection connection, string table)
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @table;";
            AddParameter(cmd, "@table", table);
            return Convert.ToInt64(await cmd.ExecuteScalarAsync()) > 0;
        }

        private static async Task<bool> ColumnExistsAsync(DbConnection connection, string table, string column)
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @table AND COLUMN_NAME = @column;";
            AddParameter(cmd, "@table", table);
            AddParameter(cmd, "@column", column);
            return Convert.ToInt64(await cmd.ExecuteScalarAsync()) > 0;
        }

        private static async Task ExecuteAsync(DbConnection connection, string sql, params (string Name, object Value)[] parameters)
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = sql;
            foreach (var (name, value) in parameters) AddParameter(cmd, name, value);
            await cmd.ExecuteNonQueryAsync();
        }

        private static void AddParameter(DbCommand cmd, string name, object value)
        {
            var parameter = cmd.CreateParameter();
            parameter.ParameterName = name;
            parameter.Value = value;
            cmd.Parameters.Add(parameter);
        }
    }
}
