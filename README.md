# Alkara

Operations and accounting system for a chauffeur business: trips, drivers, cars, customers, expenses, customer wallets, salaries and reports.

- `api/` ASP.NET Core 9 Web API with EF Core and MySQL
- `frontend/` React 18 + Vite (Arabic first)
- `tests/api.Tests/` integration tests that run the real API against MySQL

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

CI runs the same checks on every pull request (`.github/workflows/ci.yml`).

## Database changes

Schema changes go through EF Core migrations only:

```bash
cd api
dotnet ef migrations add <Name>
```
