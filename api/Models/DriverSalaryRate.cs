namespace api.Models
{
    /// <summary>
    /// A driver's base salary and commission from one month on, until a later row replaces them.
    /// Raising a salary in November adds a November row, so October is still worked out on the old one.
    /// See api.Services.SalaryRates.
    /// </summary>
    public class DriverSalaryRate
    {
        public int Id { get; set; }
        public int DriverId { get; set; }
        public Driver? Driver { get; set; }

        // Applies from this month on
        public int Year { get; set; }
        public int Month { get; set; }

        public decimal BaseSalary { get; set; }
        // Empty means the company default
        public decimal? CommissionPercent { get; set; }
    }
}
