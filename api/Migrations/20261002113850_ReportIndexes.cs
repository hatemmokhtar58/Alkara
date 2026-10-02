using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class ReportIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Trips",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_CustomerId_TransactionDate",
                table: "WalletTransactions",
                columns: new[] { "CustomerId", "TransactionDate" });

            // Dropped after the (CustomerId, TransactionDate) index exists so the foreign key keeps an index.
            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_CustomerId",
                table: "WalletTransactions");

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_TransactionDate",
                table: "WalletTransactions",
                column: "TransactionDate");

            migrationBuilder.CreateIndex(
                name: "IX_Trips_Status_EndTime",
                table: "Trips",
                columns: new[] { "Status", "EndTime" });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_Date",
                table: "Expenses",
                column: "Date");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_CustomerId",
                table: "WalletTransactions",
                column: "CustomerId");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_CustomerId_TransactionDate",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_TransactionDate",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_Trips_Status_EndTime",
                table: "Trips");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_Date",
                table: "Expenses");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Trips",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

        }
    }
}
