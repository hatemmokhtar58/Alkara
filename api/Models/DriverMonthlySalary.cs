namespace api.Models
{
    /// <summary>
    /// One driver's salary for one month. Allowances and deductions (including advances) are entered
    /// during the month. When the salary is paid, every figure is frozen here so later edits to trips
    /// or expenses cannot change a salary that was already handed over.
    /// </summary>
    public class DriverMonthlySalary
    {
        public int Id { get; set; }
        public int DriverId { get; set; }
        public Driver? Driver { get; set; }
        public int Year { get; set; }
        public int Month { get; set; }

        public decimal Allowances { get; set; }
        public decimal Deductions { get; set; }
        public string? Notes { get; set; }

        public bool IsPaid { get; set; }
        public DateTime? PaidAt { get; set; }
        public int? PaidByUserId { get; set; }

        // Snapshot taken when paid
        public decimal BaseSalary { get; set; }
        public decimal TotalIncome { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal CommissionPercent { get; set; }
        public decimal Commission { get; set; }
        public int TripsCount { get; set; }
        public decimal Total { get; set; }
    }
}
