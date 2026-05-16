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
        public async Task<ActionResult> GetTrips()
        {
            var trips = await _context.Trips
                .Include(t => t.Customer)
                .Include(t => t.Driver)
                .Include(t => t.Car)
                .OrderByDescending(t => t.Id)
                .Select(t => new {
                    t.Id,
                    t.CustomerId,
                    customer = t.Customer == null ? null : new { t.Customer.Id, t.Customer.Name, t.Customer.Phone, t.Customer.WalletBalance },
                    t.DriverId,
                    driver = t.Driver == null ? null : new { t.Driver.Id, t.Driver.Name, t.Driver.Phone, t.Driver.Status },
                    t.CarId,
                    car = t.Car == null ? null : new { t.Car.Id, t.Car.Make, t.Car.Model, t.Car.PlateNumber, t.Car.Color, t.Car.Year, t.Car.Status },
                    t.RequestTime,
                    t.ScheduledFor,
                    t.StartTime,
                    t.EndTime,
                    t.PickupLocation,
                    t.DropoffLocation,
                    t.PricingType,
                    t.HourlyRate,
                    t.FixedPrice,
                    t.DiscountType,
                    t.DiscountValue,
                    t.FinalTotal,
                    t.PaidAmount,
                    t.Status,
                    t.PaymentMethod,
                    t.Notes
                })
                .ToListAsync();

            return Ok(trips);
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
                var totalMinutes = (trip.EndTime.Value - trip.StartTime.Value).TotalMinutes;
                decimal basePrice;
                
                if (totalMinutes <= 60)
                {
                    // أول ساعة أو أقل: المبلغ كامل
                    basePrice = trip.HourlyRate.Value;
                }
                else
                {
                    // أول ساعة كاملة + باقي الدقائق بالتناسب
                    var extraMinutes = (decimal)(totalMinutes - 60);
                    var ratePerMinute = trip.HourlyRate.Value / 60m;
                    basePrice = trip.HourlyRate.Value + (extraMinutes * ratePerMinute);
                }
                
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

            // Handle payment and remaining debt when completing trip
            if (trip.Status == "Completed" && existingTrip.Status != "Completed")
            {
                var customer = await _context.Customers.FindAsync(trip.CustomerId);
                if (customer != null)
                {
                    if (trip.PaymentMethod == "Wallet")
                    {
                        // Deduct trip total from wallet credit
                        // Negative walletBalance = credit, Positive = debt
                        var credit = customer.WalletBalance < 0 ? Math.Abs(customer.WalletBalance) : 0;
                        var deductFromWallet = Math.Min(credit, trip.FinalTotal);
                        
                        // Add to wallet balance (makes it less negative = deducted credit)
                        customer.WalletBalance += deductFromWallet;
                        
                        _context.WalletTransactions.Add(new WalletTransaction {
                            CustomerId = customer.Id,
                            TripId = trip.Id,
                            Amount = deductFromWallet,
                            Type = "WalletDeduction",
                            Description = $"خصم من المحفظة لمشوار #{trip.Id}",
                            TransactionDate = DateTime.Now
                        });

                        // If wallet didn't cover full amount, remaining is debt
                        var remaining = trip.FinalTotal - deductFromWallet;
                        if (remaining > 0)
                        {
                            customer.WalletBalance += remaining;
                            _context.WalletTransactions.Add(new WalletTransaction {
                                CustomerId = customer.Id,
                                TripId = trip.Id,
                                Amount = remaining,
                                Type = "Trip",
                                Description = $"مديونية متبقية من مشوار #{trip.Id}",
                                TransactionDate = DateTime.Now
                            });
                        }

                        trip.PaidAmount = deductFromWallet;
                    }
                    else
                    {
                        // Cash or Transfer
                        var remaining = trip.FinalTotal - trip.PaidAmount;
                        if (remaining > 0)
                        {
                            // Customer paid less than total → add difference as debt
                            customer.WalletBalance += remaining;
                            _context.WalletTransactions.Add(new WalletTransaction {
                                CustomerId = customer.Id,
                                TripId = trip.Id,
                                Amount = remaining,
                                Type = "Trip",
                                Description = $"مديونية مشوار #{trip.Id}",
                                TransactionDate = DateTime.Now
                            });
                        }
                        else if (remaining < 0)
                        {
                            // Customer paid MORE than total → reduce existing debt
                            var overpayment = Math.Abs(remaining);
                            customer.WalletBalance -= overpayment;
                            _context.WalletTransactions.Add(new WalletTransaction {
                                CustomerId = customer.Id,
                                TripId = trip.Id,
                                Amount = overpayment,
                                Type = "Deposit",
                                Description = $"سداد مديونية من فائض مشوار #{trip.Id}",
                                TransactionDate = DateTime.Now
                            });
                        }
                    }
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

        // POST: api/Trips/5/depart - إرسال إشعار خروج السائق من المكتب
        [HttpPost("{id}/depart")]
        public async Task<IActionResult> DepartTrip(int id)
        {
            var trip = await _context.Trips.FindAsync(id);
            if (trip == null) return NotFound();

            if (trip.Status != "Scheduled" && trip.Status != "Ongoing")
                return BadRequest(new { message = "لا يمكن إرسال إشعار الخروج إلا للمشاوير المجدولة أو الجارية." });

            var customer = await _context.Customers.FindAsync(trip.CustomerId);
            var driver = await _context.Drivers.FindAsync(trip.DriverId);
            var car = await _context.Cars.FindAsync(trip.CarId);

            if (customer == null || string.IsNullOrEmpty(customer.Phone))
                return BadRequest(new { message = "لا يوجد رقم جوال للعميل." });

            string plateNumber = car?.PlateNumber ?? "";
            string message = $"عميلنا العزيز تم توجه السيارة {plateNumber} السائق {driver?.Name} {driver?.Phone} الكرى";

            bool success = await _smsService.SendSmsAsync(customer.Phone, message);

            if (success)
                return Ok(new { message = "تم إرسال إشعار الخروج للعميل بنجاح." });
            else
                return BadRequest(new { message = "فشل إرسال الإشعار، يرجى المحاولة مرة أخرى." });
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
                        message = $"عميلنا العزيز تم تأكيد حجز مشوارك من '{pickup}' إلى '{dropoff}' مع السائق {driver?.Name} {driver?.Phone} بسيارة {car?.PlateNumber}. الكرى";
                        break;
                    case "Ongoing":
                        message = $"عميلنا العزيز بدأ السائق {driver?.Name} مشوارك الآن من '{pickup}'. الكرى";
                        break;
                    case "Completed":
                        message = $"عميلنا العزيز تم إتمام مشوارك بنجاح. القيمة الإجمالية: {trip.FinalTotal} ريال. شكراً لاختيارك الكرى";
                        break;
                    case "Cancelled":
                        message = $"عميلنا العزيز تم إلغاء مشوارك من '{pickup}'. نعتذر عن أي إزعاج. الكرى";
                        break;
                    case "Postponed":
                        string newTime = trip.ScheduledFor?.ToString("dd/MM/yyyy HH:mm") ?? "";
                        message = $"عميلنا العزيز تم تحديث موعد مشوارك ليكون في {newTime}. الكرى";
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
