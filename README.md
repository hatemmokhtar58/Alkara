# Alkara

Operations and accounting system for a chauffeur business: trips, drivers, cars, customers, expenses, customer wallets, salaries and reports.

- `api/` ASP.NET Core 9 Web API with EF Core and MySQL
- `frontend/` React 18 + Vite (Arabic first)
- `tests/api.Tests/` integration tests that run the real API against MySQL
- `e2e/` Playwright test of a full working day through the UI

## Run locally

1. MySQL 8 running locally.
2. API secrets and first admin password: see [api/SECRETS.md](api/SECRETS.md).
3. `cd api && dotnet run` (the database and schema are created by migrations on startup).
4. `cd frontend && npm install && npm run dev`
5. Optional demo data: `ALKARA_PASSWORD=<admin password> node seed.js`

## Tests

The tests create and drop their own databases. Point them at a MySQL server with `ALKARA_TEST_MYSQL`
(default `server=localhost;port=3306;user=root;password=test`):

```bash
dotnet test Alkara.sln
cd frontend && npm run lint && npm run build
```

The end-to-end test starts the API (on a new database) and the frontend itself, then runs a full day through the browser:
adds a driver, car and employee, books and closes a trip with a partial payment, collects the rest, records fuel,
checks the statement, cash box and salary, the employee's limited menu, and the audit log.

```bash
cd frontend && npm install
cd ../e2e && npm install && npx playwright install chromium
E2E_MYSQL="server=127.0.0.1;port=3306;user=root;password=test" npx playwright test
```

CI runs all of these on every pull request (`.github/workflows/ci.yml`).

## Database changes

Schema changes go through EF Core migrations only:

```bash
cd api
dotnet ef migrations add <Name>
```
