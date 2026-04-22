using api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TripsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly api.Services.ISmsService _smsService;

        public TripsController(AppDbContext context, api.Services.ISmsService smsService)
        {
            _context = context;
            _smsService = smsService;
        }

        // GET: api/Trips
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Trip>>> GetTrips()
        {
            return await _context.Trips
                .Include(t => t.Customer)
                .Include(t => t.Driver)
                .Include(t => t.Car)
                .ToListAsync();
        }

        // POST: api/Trips
        [HttpPost]
        public async Task<ActionResult<Trip>> PostTrip(Trip trip)
        {
            _context.Trips.Add(trip);
            await _context.SaveChangesAsync();

            // إرسال رسالة SMS للعميل بعد تأكيد المشوار
            await SendTripSms(trip, "Created");


            return CreatedAtAction(nameof(GetTrips), new { id = trip.Id }, trip);
        }

        // PUT: api/Trips/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutTrip(int id, Trip trip)
        {
            if (id != trip.Id)
            {
                return BadRequest();
            }

            // Prevent EF Core tracking conflicts by stripping navigation models from frontend JSON
            trip.Customer = null; 
            trip.Driver = null;
            trip.Car = null;

            var existingTrip = await _context.Trips.AsNoTracking().FirstOrDefaultAsync(t => t.Id == trip.Id);
            if (existingTrip == null) return NotFound();

            // Override StartTime and EndTime explicitly BEFORE any logic using proper KSA Time
            if (trip.Status == "Ongoing" && existingTrip.Status != "Ongoing")
            {
                // Validate driver is not already in another ongoing trip
                bool driverBusy = await _context.Trips.AnyAsync(t => t.DriverId == trip.DriverId && t.Status == "Ongoing" && t.Id != trip.Id);
                if (driverBusy) 
                {
                    return BadRequest(new { message = "هذا السائق لديه مشوار جاري بالفعل ولا يمكن بدء مشوار جديد بالوقت الحالي." });
                }
                trip.StartTime = DateTime.UtcNow.AddHours(3); // Fix TimeZone to KSA
            }
            
            if (trip.Status == "Completed" && existingTrip.Status != "Completed")
            {
                trip.EndTime = DateTime.UtcNow.AddHours(3); // Fix TimeZone to KSA
                // Restore the original StartTime if the frontend messed it up
                trip.StartTime = existingTrip.StartTime; 
            }

            // Calculate FinalTotal dynamically on completion if using hourly rate
            if (trip.Status == "Completed" && trip.PricingType == "Hourly" && trip.StartTime.HasValue && trip.EndTime.HasValue && trip.HourlyRate.HasValue)
            {
                var durationHours = (trip.EndTime.Value - trip.StartTime.Value).TotalHours;
                // تقريب الساعات للأعلى (بحد أدنى ساعة واحدة) زي ما العميل طلب 
                var billedHours = (decimal)Math.Max(1, Math.Ceiling(durationHours));
                
                var basePrice = billedHours * trip.HourlyRate.Value;
                
                // apply discount
                if (trip.DiscountType == "Amount") basePrice -= trip.DiscountValue;
                else if (trip.DiscountType == "Percentage") basePrice -= (basePrice * (trip.DiscountValue / 100));

                trip.FinalTotal = basePrice > 0 ? Math.Round(basePrice, 2) : 0;
            }
            else if (trip.Status == "Completed" && trip.PricingType == "Fixed")
            {
                var basePrice = trip.FixedPrice ?? 0;
                if (trip.DiscountType == "Amount") basePrice -= trip.DiscountValue;
                else if (trip.DiscountType == "Percentage") basePrice -= (basePrice * (trip.DiscountValue / 100));
                
                trip.FinalTotal = basePrice > 0 ? basePrice : 0;
            }

            // Handle Wallet Payment
            if (trip.Status == "Completed" && trip.PaymentMethod == "Wallet" && existingTrip.Status != "Completed")
            {
                var customer = await _context.Customers.FindAsync(trip.CustomerId);
                if (customer != null)
                {
                    // الموجب مبلغ مستحق الدفع على العميل، هينضاف عليه
                    customer.WalletBalance += trip.FinalTotal;
                    
                    // التسجيل في المعاملات المالية
                    _context.WalletTransactions.Add(new WalletTransaction {
                        CustomerId = customer.Id,
                        TripId = trip.Id,
                        Amount = trip.FinalTotal,
                        Type = "TripDeduction",
                        Description = $"خصم قيمة المشوار رقم #{trip.Id}",
                        TransactionDate = DateTime.Now
                    });
                }
            }

            // Handle Driver and Car automatic status updates
            var driver = await _context.Drivers.FindAsync(trip.DriverId);
            var car = await _context.Cars.FindAsync(trip.CarId);

            if (trip.Status == "Ongoing")
            {
                if (driver != null) driver.Status = "Busy";
                if (car != null) car.Status = "Busy";
            }
            else if (trip.Status == "Completed" || trip.Status == "Cancelled")
            {
                if (driver != null) driver.Status = "Available";
                if (car != null) car.Status = "Available";
            }

            _context.Entry(trip).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
                
                // إرسال إشعارات SMS عند تغيرات معينة
                if (trip.Status != existingTrip.Status)
                {
                    await SendTripSms(trip, trip.Status);
                }
                else if (trip.ScheduledFor.HasValue && existingTrip.ScheduledFor.HasValue && trip.ScheduledFor != existingTrip.ScheduledFor)
                {
                    await SendTripSms(trip, "Postponed");
                }
            } catch (DbUpdateConcurrencyException)
            {
                if (!TripExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        // GET: api/Trips/test-sms/05xxxxxxxx
        [HttpGet("test-sms/{phoneNumber}")]
        public async Task<IActionResult> TestSms(string phoneNumber)
        {
            string testMessage = "تجربة إرسال رسالة نصية من الكرى - Alkara Test SMS";
            bool success = await _smsService.SendSmsAsync(phoneNumber, testMessage);
            
            if (success) return Ok(new { message = "تم إرسال الرسالة بنجاح، يرجى التحقق من جوالك." });
            else return BadRequest(new { message = "فشل إرسال الرسالة، يرجى التحقق من سجلات السيرفر (Logs)." });
        }

        private async Task SendTripSms(Trip trip, string eventType)
        {
            try
            {
                // إبطاء التحميل لضمان توفر بيانات العميل والسائق
                var customer = await _context.Customers.FindAsync(trip.CustomerId);
                var driver = await _context.Drivers.FindAsync(trip.DriverId);
                var car = await _context.Cars.FindAsync(trip.CarId);

                if (customer == null || string.IsNullOrEmpty(customer.Phone)) return;

                string message = "";
                string pickup = string.IsNullOrEmpty(trip.PickupLocation) ? "موقع تم تحديده" : trip.PickupLocation;
                string dropoff = string.IsNullOrEmpty(trip.DropoffLocation) ? "وجهتك" : trip.DropoffLocation;

                switch (eventType)
                {
                    case "Created":
                        message = $"أهلاً {customer.Name}، تم تأكيد حجز مشوارك من '{pickup}' إلى '{dropoff}' مع السائق {driver?.Name} بسيارة {car?.PlateNumber}. نتمنى لك رحلة سعيدة!";
                        break;
                    case "Ongoing":
                        message = $"أهلاً {customer.Name}، بدأ السائق {driver?.Name} مشوارك الآن من '{pickup}'. نتمنى لك رحلة ممتعة!";
                        break;
                    case "Completed":
                        message = $"الحمد لله على السلامة {customer.Name}! تم إتمام مشوارك بنجاح. القيمة الإجمالية: {trip.FinalTotal} ريال. شكراً لاختيارك الكرى.";
                        break;
                    case "Cancelled":
                        message = $"عزيزي {customer.Name}، تم إلغاء مشوارك رقم #{trip.Id} من '{pickup}'. نعتذر عن أي إزعاج.";
                        break;
                    case "Postponed":
                        string newTime = trip.ScheduledFor?.ToString("dd/MM/yyyy HH:mm") ?? "";
                        message = $"عزيزي {customer.Name}، تم تحديث موعد مشوارك ليكون في {newTime}. نراك قريباً!";
                        break;
                }

                if (!string.IsNullOrEmpty(message))
                {
                    await _smsService.SendSmsAsync(customer.Phone, message);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to send lifecycle SMS: {ex.Message}");
            }
        }

        private bool TripExists(int id)
        {
            return _context.Trips.Any(e => e.Id == id);
        }
    }
}
