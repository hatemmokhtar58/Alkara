using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services
{
    public record SalaryRate(decimal BaseSalary, decimal? CommissionPercent);

    /// <summary>
    /// Which base salary and commission a driver has in a given month.
    /// A change applies from its month on; months before it keep the old values.
    /// Changing a month that is already over changes that month only.
    /// </summary>
    public static class SalaryRates
    {
        // Row that keeps "what the driver had before the first change" for every earlier month.
        private const int BaselineYear = 2000;

        private static int Index(int year, int month) => year * 12 + month - 1;

        /// <summary>The rate in force in the month: the latest row at or before it, else the driver's own values.</summary>
        public static SalaryRate For(IEnumerable<DriverSalaryRate> driverRows, int year, int month, decimal driverBaseSalary, decimal? driverCommissionPercent)
        {
            var row = driverRows
                .Where(r => Index(r.Year, r.Month) <= Index(year, month))
                .OrderByDescending(r => Index(r.Year, r.Month))
                .FirstOrDefault();
            return row != null
                ? new SalaryRate(row.BaseSalary, row.CommissionPercent)
                : new SalaryRate(driverBaseSalary, driverCommissionPercent);
        }

        /// <summary>Sets the rate from the given month. Does not save; the caller saves with the rest of its changes.</summary>
        public static async Task SetAsync(AppDbContext context, Driver driver, int year, int month, decimal baseSalary, decimal? commissionPercent, DateTime now)
        {
            var rows = await context.DriverSalaryRates.Where(r => r.DriverId == driver.Id).ToListAsync();
            var current = For(rows, year, month, driver.BaseSalary, driver.CommissionPercent);
            if (current.BaseSalary == baseSalary && current.CommissionPercent == commissionPercent) return;

            if (rows.Count == 0)
            {
                Add(context, rows, driver.Id, BaselineYear, 1, new SalaryRate(driver.BaseSalary, driver.CommissionPercent));
            }

            var next = new DateTime(year, month, 1).AddMonths(1);
            var nextBefore = For(rows, next.Year, next.Month, driver.BaseSalary, driver.CommissionPercent);

            var row = rows.FirstOrDefault(r => r.Year == year && r.Month == month);
            if (row == null)
            {
                Add(context, rows, driver.Id, year, month, new SalaryRate(baseSalary, commissionPercent));
            }
            else
            {
                row.BaseSalary = baseSalary;
                row.CommissionPercent = commissionPercent;
            }

            // A month that is already over: the months after it keep what they had.
            var isPast = Index(year, month) < Index(now.Year, now.Month);
            if (isPast && !rows.Any(r => r.Year == next.Year && r.Month == next.Month))
            {
                Add(context, rows, driver.Id, next.Year, next.Month, nextBefore);
            }

            // The driver record shows today's rate.
            var today = For(rows, now.Year, now.Month, driver.BaseSalary, driver.CommissionPercent);
            driver.BaseSalary = today.BaseSalary;
            driver.CommissionPercent = today.CommissionPercent;
        }

        private static void Add(AppDbContext context, List<DriverSalaryRate> rows, int driverId, int year, int month, SalaryRate rate)
        {
            var row = new DriverSalaryRate { DriverId = driverId, Year = year, Month = month, BaseSalary = rate.BaseSalary, CommissionPercent = rate.CommissionPercent };
            context.DriverSalaryRates.Add(row);
            rows.Add(row);
        }
    }
}
