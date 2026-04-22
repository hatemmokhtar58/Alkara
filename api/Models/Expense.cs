using System;

namespace api.Models
{
    public class Expense
    {
        public int Id { get; set; }
        public string Category { get; set; } = string.Empty; // Fuel, Oil, Wash, Maintenance, Other
        public decimal Amount { get; set; }
        public string Note { get; set; } = string.Empty;
        public DateTime Date { get; set; } = DateTime.Now;
        
        // Optional link to a car
        public int? CarId { get; set; }
        public Car? Car { get; set; }
    }
}
