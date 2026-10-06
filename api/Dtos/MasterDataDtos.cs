namespace api.Dtos
{
    public class CustomerRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }

    public class DriverRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public decimal BaseSalary { get; set; }
    }

    public class CarRequest
    {
        public string PlateNumber { get; set; } = string.Empty;
        public string Make { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public int? Year { get; set; }
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
