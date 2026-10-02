// Fills a local API with demo data.
// Usage: ALKARA_USER=admin ALKARA_PASSWORD=... node seed.js
// Optional: ALKARA_API (default http://localhost:5144/api)

const API = process.env.ALKARA_API || 'http://localhost:5144/api';
const USER = process.env.ALKARA_USER || 'admin';
const PASSWORD = process.env.ALKARA_PASSWORD;

const drivers = [
  { name: "فهد العتيبي", phone: "0501112233", baseSalary: 3000 },
  { name: "سعد القحطاني", phone: "0559988776", baseSalary: 3000 },
  { name: "عبدالله المطيري", phone: "0543322110", baseSalary: 2500 }
];

const customers = [
  { name: "شركة الأفق للاستشارات", phone: "0500123456" },
  { name: "خالد بن عبدالعزيز", phone: "0591234567" },
  { name: "محمد الشهراني", phone: "0561122334" }
];

const cars = [
  { plateNumber: "ح ر ف 1234", make: "تويوتا", model: "كامري", year: 2023 },
  { plateNumber: "س ص د 9876", make: "هيونداي", model: "سوناتا", year: 2024 },
  { plateNumber: "ط ع ك 5555", make: "فورد", model: "تورس", year: 2022 }
];

// Trips are created as scheduled; start and close them from the dashboard.
const trips = [
  { customerIndex: 0, driverIndex: 0, carIndex: 0, pickupLocation: "مطار الملك خالد الدولي", dropoffLocation: "فندق الريتز كارلتون", pricingType: "Fixed", fixedPrice: 150 },
  { customerIndex: 1, driverIndex: 1, carIndex: 1, pickupLocation: "مول الرياض بارك", dropoffLocation: "حي الملقا", pricingType: "Hourly", hourlyRate: 35 },
  { customerIndex: 2, driverIndex: 2, carIndex: 2, pickupLocation: "محطة قطار سار", dropoffLocation: "جامعة الملك سعود", pricingType: "Fixed", fixedPrice: 85 }
];

const expenses = [
  { carIndex: 0, driverIndex: 0, category: "Fuel", amount: 65.5, note: "بنزين" },
  { carIndex: 1, category: "Wash", amount: 35, note: "غسيل سيارة داخلي خارجي" }
];

let token;

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function seed() {
  if (!PASSWORD) {
    console.error('Set ALKARA_PASSWORD (and ALKARA_USER if not "admin").');
    process.exit(1);
  }

  const login = await call('POST', '/Auth/login', { username: USER, password: PASSWORD });
  token = login.token;

  console.log('Seeding drivers, customers and cars...');
  const driverIds = [];
  for (const d of drivers) driverIds.push((await call('POST', '/Drivers', d)).id);
  const customerIds = [];
  for (const c of customers) customerIds.push((await call('POST', '/Customers', c)).id);
  const carIds = [];
  for (const c of cars) carIds.push((await call('POST', '/Cars', c)).id);

  console.log('Seeding trips and expenses...');
  for (const { customerIndex, driverIndex, carIndex, ...trip } of trips) {
    await call('POST', '/Trips?skipSms=true', {
      ...trip,
      customerId: customerIds[customerIndex],
      driverId: driverIds[driverIndex],
      carId: carIds[carIndex]
    });
  }
  for (const { carIndex, driverIndex, ...expense } of expenses) {
    await call('POST', '/Expenses', {
      ...expense,
      carId: carIds[carIndex],
      driverId: driverIndex === undefined ? null : driverIds[driverIndex]
    });
  }

  console.log('Demo data added.');
}

seed().catch(err => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
