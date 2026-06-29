using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddBaseSalaryToDriver : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BaseSalary",
                table: "Drivers",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                column: "PasswordHash",
                value: "$2a$11$uU9hTD0lV6UeOqi2nETZ7uyB0OObYvT8Q4SH0/1/sHcIKXHvHlSY2");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                column: "PasswordHash",
                value: "$2a$11$Guqr1V9TiFNeL0Vds91Jfu0RiZREtCn7a0kW/UYOiy5IAAUlwaP6q");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_DriverId",
                table: "Expenses",
                column: "DriverId");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Drivers_DriverId",
                table: "Expenses",
                column: "DriverId",
                principalTable: "Drivers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Drivers_DriverId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_DriverId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "BaseSalary",
                table: "Drivers");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                column: "PasswordHash",
                value: "$2a$11$PDDnCVWz6x59kqsSp9SlTec6rIlQwFkqhYJMRQkqY6ikLAV7cRzT6");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                column: "PasswordHash",
                value: "$2a$11$85H1eeAYk1tU7XDTEsDplOO498qZR/vdB9X6d5gcwAairb0edSmO6");
        }
    }
}
