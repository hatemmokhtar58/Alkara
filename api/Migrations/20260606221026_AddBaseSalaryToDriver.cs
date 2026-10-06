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
        }
    }
}
