using api.Auth;
using api.Dtos;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    public static class TripStatuses
    {
        public const string Scheduled = "Scheduled";
        public const string Ongoing = "Ongoing";
        public const string Completed = "Completed";
        public const string Cancelled = "Cancelled";
    }

    public static class PaymentMethods
    {
        public const string Cash = "Cash";
        public const string Transfer = "Transfer";
        public const string Wallet = "Wallet";

        public static readonly string[] All = { Cash, Transfer, Wallet };
    }

    [Route("api/[controller]")]
    [ApiController]
    [RequirePermission(Permissions.Trips)]
    public class TripsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SmsNotifier _sms;
        private readonly WalletLedger _wallet;
        private readonly IClock _clock;

        public TripsController(AppDbContext context, SmsNotifier sms, WalletLedger wallet, IClock clock)
        {
            _context = context;
            _sms = sms;
            _wallet = wallet;
            _clock = clock;
        }

        // GET: api/Trips?status=Scheduled,Ongoing - without a status every trip is returned
        [RequirePermission(Permissions.Trips, Permissions.Reports, Permissions.Fleet)]
        [HttpGet]
        public async Task<ActionResult> GetTrips([FromQuery] string? status)
        {
            var query = _context.Trips.AsQueryable();
            var statuses = ParseStatuses(status);
            if (statuses.Length > 0) query = query.Where(t => statuses.Contains(t.Status));

            return Ok(await Project(query.OrderByDescending(t => t.Id)).ToListAsync());
        }

        // GET: api/Trips/log?page=1&pageSize=50&search=&status= - one page of the trips log, newest first
        [RequirePermission(Permissions.Trips, Permissions.Reports, Permissions.Fleet)]
        [HttpGet("log")]
        public async Task<ActionResult> GetTripsLog([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? search = null, [FromQuery] string? status = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var query = _context.Trips.AsQueryable();
            var statuses = ParseStatuses(status);
            if (statuses.Length > 0) query = query.Where(t => statuses.Contains(t.Status));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(t =>
                    (t.Customer != null && (t.Customer.Name.Contains(term) || t.Customer.Phone.Contains(term))) ||
                    (t.Driver != null && t.Driver.Name.Contains(term)) ||
                    (t.Car != null && t.Car.PlateNumber.Contains(term)) ||
                    (t.PickupLocation != null && t.PickupLocation.Contains(term)) ||
                    (t.DropoffLocation != null && t.DropoffLocation.Contains(term)));
            }

            var total = await query.CountAsync();
            var items = await Project(query.OrderByDescending(t => t.Id).Skip((page - 1) * pageSize).Take(pageSize)).ToListAsync();
            return Ok(new { total, page, pageSize, items });
        }

        private static string[] ParseStatuses(string? status) =>
            (status ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        private IQueryable<object> Project(IQueryable<Trip> query)
        {
            var users = _context.Users.IgnoreQueryFilters();
            return query
                .Select(t => new {
                    t.Id,
                    t.CustomerId,
                    customer = t.Customer == null ? null : new { t.Customer.Id, t.Customer.Name, t.Customer.Phone, WalletBalance = t.Customer.WalletTransactions.Sum(w => w.Amount) },
                    t.DriverId,
                    driver = t.Driver == null ? null : new { t.Driver.Id, t.Driver.Name, t.Driver.Phone, t.Driver.Status },
                    t.CarId,
                    car = t.Car == null ? null : new { t.Car.Id, t.Car.Make, t.Car.Model, t.Car.PlateNumber, t.Car.Color, t.Car.Year, t.Car.Status },
                    t.RequestTime,
                    t.ScheduledFor,
                    t.DepartedAt,
                    t.StartTime,
                    t.EndTime,
                    t.PickupLocation,
                    t.DropoffLocation,
                    t.PricingType,
                    t.HourlyRate,
                    t.FixedPrice,
                    t.DiscountType,
                    t.DiscountValue,
                    t.ExtraCharge,
                    t.FinalTotal,
                    t.PaidAmount,
                    t.Status,
                    t.PaymentMethod,
                    t.Notes,
                    createdBy = users.Where(u => u.Id == t.CreatedByUserId).Select(u => u.Username).FirstOrDefault()
                });
        }

        // POST: api/Trips - a new trip is always scheduled; it moves on through start/complete/cancel
        [HttpPost]
        public async Task<ActionResult> PostTrip(CreateTripRequest request, [FromQuery] bool skipSms = false)
        {
            var error = await ValidateReferencesAsync(request.CustomerId, request.DriverId, request.CarId)
                ?? ValidatePlannedPrice(request.PricingType, request.HourlyRate, request.FixedPrice);
            if (error != null) return BadRequest(new { message = error });

            var now = _clock.Now;
            var trip = new Trip
            {
                CustomerId = request.CustomerId,
                DriverId = request.DriverId,
                CarId = request.CarId,
                RequestTime = now,
                ScheduledFor = request.ScheduledFor ?? now,
                PickupLocation = request.PickupLocation,
                DropoffLocation = request.DropoffLocation,
                PricingType = string.IsNullOrEmpty(request.PricingType) ? null : request.PricingType,
                HourlyRate = request.HourlyRate,
                FixedPrice = request.FixedPrice,
                Notes = request.Notes,
                Status = TripStatuses.Scheduled,
                PaymentMethod = PaymentMethods.Cash,
                DiscountType = DiscountTypes.None
            };

            _context.Trips.Add(trip);
            await _context.SaveChangesAsync();

            if (!skipSms) await SendTripSms(trip, "Created");

            return CreatedAtAction(nameof(GetTrips), new { id = trip.Id }, new { trip.Id, trip.Status });
        }

        // PUT: api/Trips/5 - change schedule, driver, car, places or planned price before the trip ends
        [HttpPut("{id}")]
        public async Task<IActionResult> PutTrip(int id, UpdateTripRequest request, [FromQuery] bool skipSms = false)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var trip = await LockTripAsync(id);
            if (trip == null) return NotFound();

            if (trip.Status != TripStatuses.Scheduled && trip.Status != TripStatuses.Ongoing)
            {
                return BadRequest(new { message = "لا يمكن تعديل مشوار منتهي أو ملغي." });
            }

            var driverId = request.DriverId ?? trip.DriverId;
            var carId = request.CarId ?? trip.CarId;
            var pricingType = request.PricingType ?? trip.PricingType;
            var hourlyRate = request.HourlyRate ?? trip.HourlyRate;
            var fixedPrice = request.FixedPrice ?? trip.FixedPrice;

            var error = await ValidateReferencesAsync(trip.CustomerId, driverId, carId)
                ?? ValidatePlannedPrice(pricingType, hourlyRate, fixedPrice);
            if (error != null) return BadRequest(new { message = error });

            if (trip.Status == TripStatuses.Ongoing && (driverId != trip.DriverId || carId != trip.CarId))
            {
                var busy = await BusyMessageAsync(driverId, carId, trip.Id);
                if (busy != null) return BadRequest(new { message = busy });

                var oldDriverId = trip.DriverId;
                var oldCarId = trip.CarId;
                trip.DriverId = driverId;
                trip.CarId = carId;
                await _context.SaveChangesAsync();
                await ReleaseIfIdleAsync(oldDriverId, oldCarId);
                await SetBusyAsync(driverId, carId);
            }

            var rescheduled = request.ScheduledFor.HasValue && request.ScheduledFor != trip.ScheduledFor;

            trip.DriverId = driverId;
            trip.CarId = carId;
            trip.ScheduledFor = request.ScheduledFor ?? trip.ScheduledFor;
            trip.PickupLocation = request.PickupLocation ?? trip.PickupLocation;
            trip.DropoffLocation = request.DropoffLocation ?? trip.DropoffLocation;
            trip.PricingType = string.IsNullOrEmpty(pricingType) ? null : pricingType;
            trip.HourlyRate = hourlyRate;
            trip.FixedPrice = fixedPrice;
            trip.Notes = request.Notes ?? trip.Notes;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            if (!skipSms && rescheduled) await SendTripSms(trip, "Postponed");

            return NoContent();
        }

        // POST: api/Trips/5/start
        [HttpPost("{id}/start")]
        public async Task<IActionResult> StartTrip(int id, [FromQuery] bool skipSms = false)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var trip = await LockTripAsync(id);
            if (trip == null) return NotFound();

            if (trip.Status != TripStatuses.Scheduled)
            {
                return BadRequest(new { message = "لا يمكن بدء إلا المشاوير المجدولة." });
            }

            var busy = await BusyMessageAsync(trip.DriverId, trip.CarId, trip.Id);
            if (busy != null) return BadRequest(new { message = busy });

            trip.Status = TripStatuses.Ongoing;
            trip.StartTime = _clock.Now;
            await SetBusyAsync(trip.DriverId, trip.CarId);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            if (!skipSms) await SendTripSms(trip, TripStatuses.Ongoing);

            return Ok(new { trip.Id, trip.Status, trip.StartTime });
        }

        // POST: api/Trips/5/complete - the server prices the trip and records the money
        [HttpPost("{id}/complete")]
        public async Task<IActionResult> CompleteTrip(int id, CompleteTripRequest request, [FromQuery] bool skipSms = false)
        {
            var error = ValidateCompletion(request);
            if (error != null) return BadRequest(new { message = error });

            await using var transaction = await _context.Database.BeginTransactionAsync();
            var trip = await LockTripAsync(id);
            if (trip == null) return NotFound();

            if (trip.Status != TripStatuses.Ongoing)
            {
                return BadRequest(new { message = "لا يمكن إنهاء إلا المشاوير الجارية." });
            }

            await _wallet.LockCustomerAsync(trip.CustomerId);

            var endTime = _clock.Now;
            var price = TripPricing.Calculate(
                request.PricingType, request.HourlyRate, request.FixedPrice,
                trip.StartTime, endTime,
                request.DiscountType, request.DiscountValue, request.ExtraCharge);

            trip.Status = TripStatuses.Completed;
            trip.EndTime = endTime;
            trip.PricingType = request.PricingType;
            trip.HourlyRate = request.PricingType == PricingTypes.Hourly ? request.HourlyRate : null;
            trip.FixedPrice = request.PricingType == PricingTypes.Fixed ? request.FixedPrice : null;
            trip.DiscountType = request.DiscountType;
            trip.DiscountValue = request.DiscountValue;
            trip.ExtraCharge = request.ExtraCharge;
            trip.FinalTotal = price.Total;
            trip.PaymentMethod = request.PaymentMethod;
            if (!string.IsNullOrWhiteSpace(request.Notes)) trip.Notes = request.Notes;

            // The trip is charged to the customer's account, then whatever they paid is credited.
            if (price.Total > 0)
            {
                _wallet.Add(trip.CustomerId, price.Total, WalletTypes.TripCharge, $"قيمة مشوار #{trip.Id}", trip.Id);
            }

            if (request.PaymentMethod == PaymentMethods.Wallet)
            {
                // Paid from existing credit as far as it goes; the rest stays as debt.
                var balanceBefore = await _wallet.GetBalanceAsync(trip.CustomerId);
                var credit = Math.Max(0, -balanceBefore);
                trip.PaidAmount = Math.Min(credit, price.Total);
            }
            else
            {
                var paid = request.PaidAmount ?? price.Total;
                trip.PaidAmount = paid;
                if (paid > 0)
                {
                    var method = request.PaymentMethod == PaymentMethods.Transfer ? "تحويل" : "كاش";
                    _wallet.Add(trip.CustomerId, -paid, WalletTypes.TripPayment, $"دفع {method} لمشوار #{trip.Id}", trip.Id);
                }
            }

            if (request.CollectionAmount > 0)
            {
                _wallet.Add(trip.CustomerId, -request.CollectionAmount, WalletTypes.CashCollection, $"تحصيل كاش أثناء مشوار #{trip.Id}", trip.Id);
            }

            await _context.SaveChangesAsync();
            await ReleaseIfIdleAsync(trip.DriverId, trip.CarId);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            if (!skipSms) await SendTripSms(trip, TripStatuses.Completed);

            return Ok(new
            {
                trip.Id,
                trip.Status,
                trip.StartTime,
                trip.EndTime,
                price.DurationMinutes,
                price.BasePrice,
                price.Discount,
                price.ExtraCharge,
                trip.FinalTotal,
                trip.PaidAmount,
                walletBalance = await _wallet.GetBalanceAsync(trip.CustomerId)
            });
        }

        // POST: api/Trips/5/cancel - a finished trip can only be cancelled by an admin, which reverses its money
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelTrip(int id, [FromQuery] bool skipSms = false)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var trip = await LockTripAsync(id);
            if (trip == null) return NotFound();

            if (trip.Status == TripStatuses.Cancelled)
            {
                return BadRequest(new { message = "المشوار ملغي بالفعل." });
            }

            if (trip.Status == TripStatuses.Completed)
            {
                var user = CurrentUser.Get(HttpContext);
                if (user == null || !CurrentUser.IsAdmin(user))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = "إلغاء مشوار منتهي متاح للمدير فقط." });
                }

                await _wallet.LockCustomerAsync(trip.CustomerId);
                var net = await _context.WalletTransactions
                    .Where(w => w.TripId == trip.Id)
                    .SumAsync(w => w.Amount);
                if (net != 0)
                {
                    _wallet.Add(trip.CustomerId, -net, WalletTypes.Reversal, $"عكس حركات مشوار #{trip.Id} بعد إلغائه", trip.Id);
                }
            }

            var wasActive = trip.Status == TripStatuses.Ongoing;
            trip.Status = TripStatuses.Cancelled;
            await _context.SaveChangesAsync();
            if (wasActive) await ReleaseIfIdleAsync(trip.DriverId, trip.CarId);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            if (!skipSms) await SendTripSms(trip, TripStatuses.Cancelled);

            return NoContent();
        }

        // POST: api/Trips/5/depart - إرسال إشعار خروج السائق من المكتب
        [HttpPost("{id}/depart")]
        public async Task<IActionResult> DepartTrip(int id, [FromQuery] bool skipSms = false)
        {
            var trip = await _context.Trips.FindAsync(id);
            if (trip == null) return NotFound();

            if (trip.Status != TripStatuses.Scheduled && trip.Status != TripStatuses.Ongoing)
                return BadRequest(new { message = "لا يمكن إرسال إشعار الخروج إلا للمشاوير المجدولة أو الجارية." });

            trip.DepartedAt ??= _clock.Now;
            await _context.SaveChangesAsync();

            if (skipSms)
                return Ok(new { message = "تم تسجيل الخروج بدون إرسال رسالة.", trip.DepartedAt });

            var customer = await _context.Customers.FindAsync(trip.CustomerId);
            var driver = await _context.Drivers.FindAsync(trip.DriverId);
            var car = await _context.Cars.FindAsync(trip.CarId);

            if (customer == null || string.IsNullOrEmpty(customer.Phone))
                return Ok(new { message = "تم تسجيل الخروج، لكن لا يوجد رقم جوال للعميل.", trip.DepartedAt });

            string plateNumber = car?.PlateNumber ?? "";
            string message = $"عميلنا العزيز تم توجه السيارة {plateNumber} السائق {driver?.Name} {driver?.Phone} الكرى";

            var result = await _sms.SendAsync(customer.Phone, message, "Departed", trip.Id);

            if (result.Success)
                return Ok(new { message = "تم إرسال إشعار الخروج للعميل بنجاح.", trip.DepartedAt });
            else
                return Ok(new { message = "تم تسجيل الخروج، لكن فشل إرسال الرسالة للعميل.", trip.DepartedAt });
        }

        private async Task<Trip?> LockTripAsync(int id)
        {
            // Row lock for the rest of the transaction: two people pressing "finish" at once cannot both charge.
            await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM Trips WHERE Id = {id} FOR UPDATE");
            return await _context.Trips.FirstOrDefaultAsync(t => t.Id == id);
        }

        private async Task<string?> ValidateReferencesAsync(int customerId, int driverId, int carId)
        {
            if (!await _context.Customers.AnyAsync(c => c.Id == customerId)) return "العميل غير موجود.";
            if (!await _context.Drivers.AnyAsync(d => d.Id == driverId)) return "السائق غير موجود.";
            if (!await _context.Cars.AnyAsync(c => c.Id == carId)) return "يرجى اختيار سيارة.";
            return null;
        }

        private static string? ValidatePlannedPrice(string? pricingType, decimal? hourlyRate, decimal? fixedPrice)
        {
            if (!string.IsNullOrEmpty(pricingType) && pricingType != PricingTypes.Hourly && pricingType != PricingTypes.Fixed)
                return "نوع التسعير غير صالح.";
            if (hourlyRate < 0 || fixedPrice < 0) return "السعر لا يمكن أن يكون بالسالب.";
            return null;
        }

        private static string? ValidateCompletion(CompleteTripRequest request)
        {
            if (request.PricingType == PricingTypes.Hourly)
            {
                if (request.HourlyRate is not > 0) return "يرجى إدخال سعر الساعة.";
            }
            else if (request.PricingType == PricingTypes.Fixed)
            {
                if (request.FixedPrice is not >= 0) return "يرجى إدخال السعر الثابت.";
            }
            else
            {
                return "يرجى اختيار نوع التسعير.";
            }

            if (request.DiscountType != DiscountTypes.None && request.DiscountType != DiscountTypes.Amount && request.DiscountType != DiscountTypes.Percentage)
                return "نوع الخصم غير صالح.";
            if (request.DiscountValue < 0) return "الخصم لا يمكن أن يكون بالسالب.";
            if (request.DiscountType == DiscountTypes.Percentage && request.DiscountValue > 100) return "نسبة الخصم لا تتجاوز 100%.";
            if (request.ExtraCharge < 0) return "الإضافي لا يمكن أن يكون بالسالب.";
            if (!PaymentMethods.All.Contains(request.PaymentMethod)) return "طريقة الدفع غير صالحة.";
            if (request.PaidAmount < 0) return "المبلغ المدفوع لا يمكن أن يكون بالسالب.";
            if (request.CollectionAmount < 0) return "مبلغ التحصيل لا يمكن أن يكون بالسالب.";
            return null;
        }

        private async Task<string?> BusyMessageAsync(int driverId, int carId, int tripId)
        {
            if (await _context.Trips.AnyAsync(t => t.DriverId == driverId && t.Status == TripStatuses.Ongoing && t.Id != tripId))
                return "هذا السائق لديه مشوار جاري بالفعل ولا يمكن بدء مشوار جديد بالوقت الحالي.";
            if (await _context.Trips.AnyAsync(t => t.CarId == carId && t.Status == TripStatuses.Ongoing && t.Id != tripId))
                return "هذه السيارة في مشوار جاري بالفعل.";
            return null;
        }

        private async Task SetBusyAsync(int driverId, int carId)
        {
            var driver = await _context.Drivers.FindAsync(driverId);
            var car = await _context.Cars.FindAsync(carId);
            if (driver != null) driver.Status = "Busy";
            if (car != null) car.Status = "Busy";
        }

        // Back to Available unless the driver or car is still on another ongoing trip.
        private async Task ReleaseIfIdleAsync(int driverId, int carId)
        {
            if (!await _context.Trips.AnyAsync(t => t.DriverId == driverId && t.Status == TripStatuses.Ongoing))
            {
                var driver = await _context.Drivers.FindAsync(driverId);
                if (driver != null && driver.Status == "Busy") driver.Status = "Available";
            }
            if (!await _context.Trips.AnyAsync(t => t.CarId == carId && t.Status == TripStatuses.Ongoing))
            {
                var car = await _context.Cars.FindAsync(carId);
                if (car != null && car.Status == "Busy") car.Status = "Available";
            }
        }

        private async Task SendTripSms(Trip trip, string eventType)
        {
            try
            {
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
                    case TripStatuses.Ongoing:
                        message = $"عميلنا العزيز بدأ السائق {driver?.Name} مشوارك الآن من '{pickup}'. الكرى";
                        break;
                    case TripStatuses.Completed:
                        message = $"عميلنا العزيز تم إتمام مشوارك بنجاح. القيمة الإجمالية: {trip.FinalTotal} ريال. شكراً لاختيارك الكرى";
                        break;
                    case TripStatuses.Cancelled:
                        message = $"عميلنا العزيز تم إلغاء مشوارك من '{pickup}'. نعتذر عن أي إزعاج. الكرى";
                        break;
                    case "Postponed":
                        string newTime = trip.ScheduledFor?.ToString("dd/MM/yyyy HH:mm") ?? "";
                        message = $"عميلنا العزيز تم تحديث موعد مشوارك ليكون في {newTime}. الكرى";
                        break;
                }

                if (!string.IsNullOrEmpty(message))
                {
                    await _sms.SendAsync(customer.Phone, message, eventType, trip.Id);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to send lifecycle SMS: {ex.Message}");
            }
        }
    }
}
