import { expect, test } from '@playwright/test';

test.describe('Kite Project Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5275/');
  });

  test('implements no WebMCP of its own', async ({ page }) => {
    expect(await page.evaluate(() => 'modelContext' in window)).toBe(false);
  });

  test('creates a task through the form', async ({ page }) => {
    await page.getByRole('button', { name: 'New task' }).click();
    await page.getByTestId('task-form').locator('[name="title"]').fill('Write the docs');
    await page.getByTestId('task-form').locator('[name="assignee"]').selectOption('Priya Nair');
    await page.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByTestId('task-form')).toHaveCount(0);
    await expect(page.getByTestId('task-list').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('task-list')).toContainText('Write the docs');
  });

  test('changes assignee and status', async ({ page }) => {
    const row = page.locator('[data-task-id="t-202"]');
    await row.locator('select[data-action="assign"]').selectOption('Priya Nair');
    await expect(row.locator('[data-field="assignee"]')).toHaveText('Priya Nair');
    await row.locator('select[data-action="status"]').selectOption('done');
    await expect(row).toHaveAttribute('data-status', 'done');
  });

  test('flags and unflags a task', async ({ page }) => {
    const flag = page.locator('[data-task-id="t-201"] input[data-action="toggle-flag"]');
    await expect(flag).not.toBeChecked();
    await flag.check();
    await expect(flag).toBeChecked();
    await flag.uncheck();
    await expect(flag).not.toBeChecked();
  });

  test('deletes a task', async ({ page }) => {
    await page.getByTestId('task-search').fill('Audit vendor');
    await expect(page.getByTestId('task-list').locator('li')).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('task-empty')).toBeVisible();
    await page.getByTestId('task-search').fill('');
    await expect(page.getByTestId('task-list').locator('li')).toHaveCount(2);
  });
});
