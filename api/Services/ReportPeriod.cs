namespace api.Services
{
    /// <summary>A report's date range in Saudi time: [Start, End).</summary>
    public record ReportPeriod(string Period, DateTime Start, DateTime End)
    {
        public const string Daily = "daily";
        public const string Monthly = "monthly";
        public const string Yearly = "yearly";

        /// <summary>Builds the range for daily/monthly/yearly, or returns an Arabic error.</summary>
        public static ReportPeriod? TryCreate(string? period, int year, int? month, int? day, out string? error)
        {
            error = null;
            period = (period ?? Daily).ToLowerInvariant();
            if (year < 2000 || year > 2100) { error = "السنة غير صالحة."; return null; }

            if (period == Yearly)
                return new ReportPeriod(period, new DateTime(year, 1, 1), new DateTime(year + 1, 1, 1));

            if (month is not (>= 1 and <= 12)) { error = "الشهر غير صالح."; return null; }
            var monthStart = new DateTime(year, month.Value, 1);

            if (period == Monthly)
                return new ReportPeriod(period, monthStart, monthStart.AddMonths(1));

            if (period != Daily) { error = "نوع التقرير غير صالح."; return null; }
            if (day is not { } d || d < 1 || d > DateTime.DaysInMonth(year, month.Value)) { error = "اليوم غير صالح."; return null; }
            var dayStart = monthStart.AddDays(d - 1);
            return new ReportPeriod(period, dayStart, dayStart.AddDays(1));
        }
    }

    /// <summary>Start of today, the last 7 days, this month and this year for stats cards.</summary>
    public record StatsRanges(DateTime Today, DateTime Week, DateTime Month, DateTime Year)
    {
        public static StatsRanges From(DateTime now) =>
            new(now.Date, now.Date.AddDays(-7), new DateTime(now.Year, now.Month, 1), new DateTime(now.Year, 1, 1));
    }
}
