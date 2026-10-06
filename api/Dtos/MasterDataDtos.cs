using api.Services;

namespace api.Dtos
{
    // Each Validate() returns an Arabic message for the user, or null when the request is fine.

    public class CustomerRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;

        public string? Validate()
        {
            if (string.IsNullOrWhiteSpace(Name)) return "اسم العميل مطلوب.";
            if (Name.Trim().Length > 150) return "اسم العميل طويل جداً.";
            if (PhoneNumbers.NormalizeSaudiMobile(Phone) == null) return "رقم الجوال غير صحيح. اكتبه بالشكل 05XXXXXXXX.";
            return null;
        }
    }

    public class DriverRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public decimal BaseSalary { get; set; }

        public string? Validate()
        {
            if (string.IsNullOrWhiteSpace(Name)) return "اسم السائق مطلوب.";
            if (Name.Trim().Length > 150) return "اسم السائق طويل جداً.";
            if (PhoneNumbers.NormalizeSaudiMobile(Phone) == null) return "رقم جوال السائق غير صحيح. اكتبه بالشكل 05XXXXXXXX.";
            if (BaseSalary < 0 || BaseSalary > 1_000_000) return "الراتب الأساسي غير صالح.";
            return null;
        }
    }

    public class CarRequest
    {
        public string PlateNumber { get; set; } = string.Empty;
        public string Make { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public int? Year { get; set; }

        public string? Validate(int currentYear)
        {
            var plate = PhoneNumbers.NormalizePlate(PlateNumber);
            if (plate.Length == 0) return "رقم اللوحة مطلوب.";
            if (plate.Length > 20) return "رقم اللوحة طويل جداً.";
            if (Year is { } year && (year < 1980 || year > currentYear + 1)) return "سنة الصنع غير صالحة.";
            return null;
        }
    }

    public class ExpenseRequest
    {
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? Note { get; set; }
        public int? DriverId { get; set; }
        public int? CarId { get; set; }

        public string? Validate()
        {
            if (!ExpenseCategories.All.Contains(Category)) return "نوع المصروف غير صالح.";
            if (Amount <= 0) return "المبلغ يجب أن يكون أكبر من صفر.";
            if (Amount > 100_000) return "المبلغ كبير جداً، راجع الرقم.";
            if (Note != null && Note.Length > 500) return "الملاحظة طويلة جداً.";
            if (Category == ExpenseCategories.Fuel && DriverId == null) return "اختر السائق لمصروف البنزين.";
            return null;
        }
    }

    public static class ExpenseCategories
    {
        public const string Fuel = "Fuel";
        public static readonly string[] All = { Fuel, "Oil", "Wash", "Maintenance", "Other" };
    }

    public class StatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    public static class AvailabilityStatuses
    {
        public static readonly string[] All = { "Available", "Busy", "Offline" };
    }
}
