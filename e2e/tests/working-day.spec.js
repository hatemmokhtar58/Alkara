import { test, expect } from '@playwright/test';
import { ADMIN } from '../playwright.config.js';

// One working day in the office, through the UI, on an empty database:
// set up a driver, car and employee, run a trip with a partial payment, collect the rest,
// record fuel, then check the reports, salaries, permissions and audit log.

const DRIVER = { name: 'سعيد القحطاني', phone: '0551112233', salary: '3000' };
const CAR = { make: 'Toyota', model: 'Camry', plate: 'abc 1234' };
const CUSTOMER = { name: 'شركة النخبة', phone: '+966 55 987 6543' };
const EMPLOYEE = { username: 'reem', tempPassword: 'Temp-Pass-123', password: 'Reem-Pass-2026' };

async function login(page, username, password) {
  await page.goto('/login');
  await page.locator('input[type=text]').fill(username);
  await page.locator('input[type=password]').fill(password);
  await page.locator('button[type=submit]').click();
}

async function pickOption(scope, text) {
  // react-select: open the control, type, choose the matching option
  await scope.locator('div[class*="-control"]').first().click();
  await scope.page().keyboard.type(text);
  await scope.page().locator('div[class*="-option"]', { hasText: text }).first().click();
}

const toast = (page) => page.locator('.toast-premium');

test('a full working day', async ({ page, browser }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await test.step('owner signs in', async () => {
    await login(page, ADMIN.username, ADMIN.password);
    await expect(page.locator('.top-navbar')).toBeVisible();
  });

  await test.step('adds a driver, rejecting a bad phone first', async () => {
    await page.goto('/drivers');
    const form = page.locator('form').first();
    await form.locator('input').nth(0).fill(DRIVER.name);
    await form.locator('input[type=tel]').fill('12345');
    await form.locator('input[type=number]').fill(DRIVER.salary);
    await form.locator('button[type=submit]').click();
    await expect(toast(page)).toContainText('رقم جوال السائق غير صحيح');

    await form.locator('input[type=tel]').fill(DRIVER.phone);
    await form.locator('button[type=submit]').click();
    await expect(page.locator('table')).toContainText(DRIVER.name);
  });

  await test.step('adds a car; the plate is stored in capitals', async () => {
    await page.goto('/cars');
    const form = page.locator('form').first();
    const inputs = form.locator('input');
    await inputs.nth(0).fill(CAR.make);
    await inputs.nth(1).fill(CAR.model);
    await inputs.nth(2).fill('2024');
    await inputs.nth(3).fill('أبيض');
    await inputs.nth(4).fill(CAR.plate);
    await form.locator('button[type=submit]').click();
    await expect(page.locator('table')).toContainText('ABC 1234');
  });

  await test.step('adds an employee who can only run trips', async () => {
    await page.goto('/users');
    await page.getByRole('button', { name: 'إضافة مستخدم جديد' }).click();
    const modal = page.locator('.modal-content');
    await modal.locator('input').nth(0).fill(EMPLOYEE.username);
    await modal.locator('input[type=password]').fill(EMPLOYEE.tempPassword);
    await modal.locator('label', { hasText: 'إدارة المشاوير' }).locator('input').check();
    await modal.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.locator('table')).toContainText(EMPLOYEE.username);
  });

  const driverRow = () => page.locator('.drivers-live-table tbody tr', { hasText: DRIVER.name });

  await test.step('books a 200 SAR trip for a new customer from the dashboard', async () => {
    await page.goto('/');
    await driverRow().click();
    await page.getByRole('button', { name: 'مشوار جديد' }).click();
    const modal = page.locator('.modal-content');
    await modal.locator('input[type=tel]').fill(CUSTOMER.phone);
    await modal.getByPlaceholder('اكتب اسم العميل').fill(CUSTOMER.name);
    await pickOption(modal, 'ABC 1234');
    await modal.getByRole('button', { name: 'مبلغ ثابت' }).click();
    await modal.getByPlaceholder('50').fill('200');
    await modal.getByRole('button', { name: 'حجز المشوار وتأكيده' }).click();
    await expect(driverRow()).toContainText(CUSTOMER.name);
    await expect(driverRow()).toContainText('0559876543');
  });

  await test.step('driver leaves the office, starts and finishes; customer pays 150', async () => {
    await driverRow().click();
    await page.getByRole('button', { name: 'خروج من مكتب' }).click();
    await expect(page.getByRole('button', { name: 'مباشرة' })).toBeEnabled();
    await page.getByRole('button', { name: 'مباشرة' }).click();
    await expect(page.getByRole('button', { name: 'إغلاق مشوار' })).toBeEnabled();
    await page.getByRole('button', { name: 'إغلاق مشوار' }).click();

    const modal = page.locator('.modal-content');
    await expect(modal).toContainText('200');
    const paid = modal.locator('.form-group', { hasText: 'المبلغ المدفوع' }).locator('input');
    await paid.fill('150');
    await modal.getByRole('button', { name: 'تاكيد الاغلاق' }).click();
    await expect(modal).toBeHidden();
    await expect(driverRow()).not.toContainText(CUSTOMER.name);
  });

  await test.step('the customer owes 50, then pays it at the office', async () => {
    await page.goto('/wallet');
    await pickOption(page.locator('.card').first(), CUSTOMER.name);
    const balance = page.locator('.card', { hasText: 'رصيد المحفظة الحالي' });
    await expect(balance).toContainText('50');
    await expect(balance).toContainText('متبقي عليه');

    await balance.locator('input[type=number]').fill('50');
    await balance.getByRole('button', { name: 'تحصيل وحفظ' }).click();
    await expect(balance).toContainText('خالص');
    await expect(page.locator('table')).toContainText('admin');
  });

  await test.step('records 40 SAR of fuel for the driver', async () => {
    await page.goto('/expense-create');
    await pickOption(page.locator('form'), DRIVER.name);
    await page.locator('form input[type=number]').fill('40');
    await page.getByRole('button', { name: 'تسجيل المصروف' }).click();
    await expect(toast(page)).toBeVisible();
  });

  await test.step('daily statement and cash box add up', async () => {
    await page.goto('/statement-daily');
    // total, fare, value, cash box, transfers, fuel, debt
    await expect(page.locator('tfoot tr td')).toHaveText(['الإجمالي', '200', '200', '150', '0', '40', '50', '', '']);

    await page.goto('/daily-report');
    // 150 cash trip + 50 collected - 40 fuel
    await expect(page.locator('tbody tr').last()).toContainText('160.00');
  });

  await test.step('salary: 3000 + 10% of (200 - 40) = 3016, then paid and frozen', async () => {
    await page.goto('/salaries');
    const row = page.locator('tbody tr', { hasText: DRIVER.name });
    await expect(row).toContainText('3016.0');
    await row.getByRole('button', { name: 'صرف' }).click();
    await expect(row).toContainText('مصروف');
    await expect(row.locator('input')).toHaveCount(0);
  });

  await test.step('the employee must change the temporary password and sees only trips', async () => {
    const context = await browser.newContext({ timezoneId: 'Asia/Riyadh', viewport: { width: 1400, height: 900 } });
    const employee = await context.newPage();
    await login(employee, EMPLOYEE.username, EMPLOYEE.tempPassword);
    await expect(employee.getByText('لازم تختار كلمة مرور جديدة')).toBeVisible();
    const passwords = employee.locator('input[type=password]');
    await passwords.nth(0).fill(EMPLOYEE.tempPassword);
    await passwords.nth(1).fill(EMPLOYEE.password);
    await passwords.nth(2).fill(EMPLOYEE.password);
    await employee.getByRole('button', { name: 'حفظ كلمة المرور' }).click();

    const nav = employee.locator('.top-navbar');
    await expect(nav).toContainText('سجل المشاوير');
    await expect(nav).not.toContainText('التقارير');
    await expect(nav).not.toContainText('السائقين');

    await employee.goto('/salaries');
    await expect(employee).toHaveURL(/\/$/);
    await context.close();
  });

  await test.step('the audit log shows who did what', async () => {
    await page.goto('/audit-log');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('tbody')).toContainText(EMPLOYEE.username);

    await page.locator('select').first().selectOption('Trip');
    await expect(page.locator('tbody')).toContainText('Ongoing');
    await expect(page.locator('tbody')).toContainText('Completed');
  });
});
