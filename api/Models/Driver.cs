using System.Collections.Generic;

namespace api.Models
{
    public class Driver
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        // Status e.g. "Available", "OnTrip", "Offline"
        public string Status { get; set; } = "Available";
        public decimal BaseSalary { get; set; } = 0;
        // Commission on net income; empty means the company default.
        public decimal? CommissionPercent { get; set; }
        public ICollection<Trip> Trips { get; set; } = new List<Trip>();
    }
}
