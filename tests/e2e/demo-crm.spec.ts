import { expect, test } from '@playwright/test';

test.describe('Acme CRM', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5273/');
  });

  test('implements no WebMCP of its own', async ({ page }) => {
    // The entire premise: this app is agent-ready only because of an adapter.
    const tools = await page.evaluate(async () => {
      const mc = (document as Document & { modelContext?: { getTools(): Promise<unknown[]> } }).modelContext;
      return mc ? (await mc.getTools()).length : 'no-webmcp';
    });
    expect(tools === 'no-webmcp' || tools === 0).toBe(true);
    expect(await page.evaluate(() => 'modelContext' in window)).toBe(false);
  });

  test('lists the seed customers', async ({ page }) => {
    await expect(page.getByTestId('customer-list').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('customer-count')).toHaveText('3');
  });

  test('creates a customer through the dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Add customer' }).click();
    await page.getByTestId('customer-form').locator('[name="name"]').fill('Dana Lopez');
    await page.getByTestId('customer-form').locator('[name="email"]').fill('dana@example.com');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('customer-dialog')).toHaveCount(0);
    await expect(page.getByTestId('customer-list').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('customer-list')).toContainText('dana@example.com');
  });

  test('validates the form rather than creating an empty record', async ({ page }) => {
    await page.getByRole('button', { name: 'Add customer' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('form-error')).toBeVisible();
    await expect(page.getByTestId('customer-dialog')).toBeVisible();
  });

  test('filters the list by name or email', async ({ page }) => {
    await page.getByTestId('customer-search').fill('globex');
    await expect(page.getByTestId('customer-list').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('customer-list')).toContainText('Jordan Reyes');
    await page.getByTestId('customer-search').fill('nobody');
    await expect(page.getByTestId('customer-empty')).toBeVisible();
  });

  test('edits an existing customer', async ({ page }) => {
    await page.getByTestId('customer-search').fill('mika@northwind.test');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByTestId('customer-edit-form').locator('[name="name"]').fill('Mika Tanaka-Ito');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('customer-list')).toContainText('Mika Tanaka-Ito');
  });
});
