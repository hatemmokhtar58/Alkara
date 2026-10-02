using System;

namespace api.Models
{
    public class Expense : IHasCreator
    {
        public int Id { get; set; }
        public string Category { get; set; } = string.Empty; // Fuel, Oil, Wash, Maintenance, Other
        public decimal Amount { get; set; }
        public string Note { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        
        // Optional link to a car
        public int? CarId { get; set; }
        public Car? Car { get; set; }

        // Optional link to a driver
        public int? DriverId { get; set; }
        public Driver? Driver { get; set; }

        // The user who recorded it (users are never hard-deleted, see User.DeletedAt).
        public int? CreatedByUserId { get; set; }
    }
}
