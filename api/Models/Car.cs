using System.Collections.Generic;

namespace api.Models
{
    public class Car
    {
        public int Id { get; set; }
        public string PlateNumber { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Make { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public int? Year { get; set; }
        public string Status { get; set; } = "Available";
        
        public ICollection<Trip> Trips { get; set; } = new List<Trip>();
        public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    }
}
