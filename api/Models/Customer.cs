using System;
using System.Collections.Generic;

namespace api.Models
{
    public class Customer
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        // سجل المحفظة: سالب يعني ليه فلوس (أو دفع زيادة)، وموجب يعني عليه فلوس (مديون)
        public decimal WalletBalance { get; set; } = 0;

        public ICollection<Trip> Trips { get; set; } = new List<Trip>();
    }
}
