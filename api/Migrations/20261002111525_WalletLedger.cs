using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class WalletLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The balance is now the sum of wallet transactions. Keep every existing balance by
            // recording the difference between the stored value and the transactions as one adjustment.
            migrationBuilder.Sql(@"
                INSERT INTO WalletTransactions (CustomerId, Amount, Type, Description, TransactionDate, TripId)
                SELECT c.Id,
                       c.WalletBalance - COALESCE((SELECT SUM(w.Amount) FROM WalletTransactions w WHERE w.CustomerId = c.Id), 0),
                       'Adjustment',
                       'تسوية رصيد افتتاحي عند تحديث النظام',
                       UTC_TIMESTAMP() + INTERVAL 3 HOUR,
                       NULL
                FROM Customers c
                WHERE c.WalletBalance <> COALESCE((SELECT SUM(w.Amount) FROM WalletTransactions w WHERE w.CustomerId = c.Id), 0);");

            migrationBuilder.DropColumn(
                name: "WalletBalance",
                table: "Customers");

            migrationBuilder.AlterColumn<decimal>(
                name: "PaidAmount",
                table: "Trips",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)");

            migrationBuilder.AddColumn<DateTime>(
                name: "DepartedAt",
                table: "Trips",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ExtraCharge",
                table: "Trips",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "BaseSalary",
                table: "Drivers",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DepartedAt",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "ExtraCharge",
                table: "Trips");

            migrationBuilder.AlterColumn<decimal>(
                name: "PaidAmount",
                table: "Trips",
                type: "decimal(65,30)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "BaseSalary",
                table: "Drivers",
                type: "decimal(65,30)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AddColumn<decimal>(
                name: "WalletBalance",
                table: "Customers",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
