const http = require('http');

const drivers = [
  { name: "فهد العتيبي", phone: "0501112233", status: "Active" },
  { name: "سعد القحطاني", phone: "0559988776", status: "Active" },
  { name: "عبدالله المطيري", phone: "0543322110", status: "Active" }
];

const customers = [
  { name: "شركة الأفق للاستشارات", phone: "0500123456" },
  { name: "خالد بن عبدالعزيز", phone: "0591234567" },
  { name: "محمد الشهراني", phone: "0561122334" }
];

const cars = [
  { plateNumber: "ح ر ف 1234", model: "2023", make: "تويوتا كامري" },
  { plateNumber: "س ص د 9876", model: "2024", make: "هيونداي سوناتا" },
  { plateNumber: "ط ع ك 5555", model: "2022", make: "فورد تورس" }
];

const trips = [
  { customerId: 1, driverId: 1, carId: 1, pickupLocation: "مطار الملك خالد الدولي", dropoffLocation: "فندق الريتز كارلتون", pricingType: "Fixed", fixedPrice: 150, paymentMethod: "Cash", status: "Scheduled" },
  { customerId: 2, driverId: 2, carId: 2, pickupLocation: "مول الرياض بارك", dropoffLocation: "حي الملقا", pricingType: "Hourly", hourlyRate: 35, paymentMethod: "Wallet", status: "Completed" },
  { customerId: 3, driverId: 3, carId: 3, pickupLocation: "محطة قطار سار", dropoffLocation: "جامعة الملك سعود", pricingType: "Fixed", fixedPrice: 85, paymentMethod: "Cash", status: "Completed" }
];

const expenses = [
  { carId: 1, category: "Fuel", amount: 65.50, note: "بنزين", date: new Date().toISOString() },
  { carId: 2, category: "Washing", amount: 35, note: "غسيل سيارة داخلي خارجي", date: new Date().toISOString() }
];

const postData = (path, data) => {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5144,
      path: '/api' + path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      }
    };

    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });

    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
};

async function seed() {
  try {
    console.log("Seeding Drivers...");
    for (const d of drivers) await postData('/Drivers', d);
    console.log("Seeding Customers...");
    for (const c of customers) await postData('/Customers', c);
    console.log("Seeding Cars...");
    for (const c of cars) await postData('/Cars', c);
    
    // الانتظار ثانية واحدة للتأكد من تسجيل البيانات الأساسية
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Seeding Trips & Expenses...");
    for (const t of trips) await postData('/Trips', t);
    for (const e of expenses) await postData('/Expenses', e);
    
    console.log("Realistic Seed Data Added Successfully! 🎉");
  } catch (err) {
    console.error("Error seeding data", err);
  }
}

seed();
