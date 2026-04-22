using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPermissionsFixed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Permissions",
                table: "Users",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "PasswordHash", "Permissions" },
                values: new object[] { "$2a$11$1FSpc0ovbGpy4aHQEqiKKenx6ig/MYjNZKHSmZftB3lNibe8k1rFC", "trips,fleet,expenses,wallet,reports,users" });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "PasswordHash", "Permissions" },
                values: new object[] { "$2a$11$2ncjhPyOBxQW.TWg7B2xye.IfRACH5EGxKeW7NruwrRFHl9ZOks3S", "trips" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Permissions",
                table: "Users");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                column: "PasswordHash",
                value: "$2a$11$f7VTAL.ygj4ZL8wu2UyHtOwSPSvpGcznj.0zOIkk3YEPBMH6I/bPy");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                column: "PasswordHash",
                value: "$2a$11$xu1c9l20.jF25BNpinvtnO8WTwJ/R06I41XNdUHrS4Nmrv24StZFe");
        }
    }
}
