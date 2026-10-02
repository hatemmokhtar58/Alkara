using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <summary>
    /// The model no longer seeds users with HasData. Existing user rows are real accounts,
    /// so this migration only updates the model snapshot and deliberately leaves the data alone.
    /// </summary>
    public partial class RemoveUserSeedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
