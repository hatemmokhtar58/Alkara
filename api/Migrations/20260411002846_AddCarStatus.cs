using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddCarStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Cars",
                type: "longtext",
                nullable: false,
                defaultValue: "Available")
                .Annotation("MySql:CharSet", "utf8mb4");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "Cars");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                column: "PasswordHash",
                value: "$2a$11$V2lIUhpWpE50Cjn9Dv2Wq.6HXLCCc1BonwEKZFhEIptB/wco6VePG");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                column: "PasswordHash",
                value: "$2a$11$TzVCSrwJMm7zG92GjfSV2.yDIs7LvSq7NXtdYkVupQnZClFOwboI.");
        }
    }
}
