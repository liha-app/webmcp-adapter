import { expect, test } from '@playwright/test';

test.describe('Adapter Registry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5280/');
  });

  test('lists the official adapters', async ({ page }) => {
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('result-count')).toHaveText('3 adapters');
  });

  test('filters by text, category and capability, and keeps it in the URL', async ({ page }) => {
    await page.getByTestId('adapter-search').fill('coupon');
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(1);
    await expect(page).toHaveURL(/q=coupon/);

    await page.getByTestId('adapter-search').fill('');
    await page.getByTestId('capability-filter').selectOption('DESTRUCTIVE');
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('adapter-list')).toContainText('Kite Project Manager');

    await page.getByTestId('capability-filter').selectOption('all');
    await page.getByTestId('category-filter').selectOption('crm');
    await expect(page.getByTestId('adapter-list')).toContainText('Acme CRM');
  });

  test('shows a shareable filtered view', async ({ page }) => {
    await page.goto('http://localhost:5280/?q=task');
    await expect(page.getByTestId('adapter-search')).toHaveValue('task');
    await expect(page.getByTestId('adapter-list').locator('li')).toHaveCount(1);
  });

  test('reports no results honestly', async ({ page }) => {
    await page.getByTestId('adapter-search').fill('zzzz');
    await expect(page.getByTestId('no-results')).toBeVisible();
  });

  // Auditability is the product argument: the definition must be readable
  // before install, not after.
  test('discloses origins, capabilities and the full source on the detail page', async ({ page }) => {
    await page.getByRole('link', { name: 'Kite Project Manager' }).click();
    await expect(page).toHaveURL(/\/adapter\/demo-project$/);
    await expect(page.getByText('http://localhost:5275')).toBeVisible();
    await expect(page.locator('[data-tool-name="delete_task"]')).toContainText('DESTRUCTIVE');
    await expect(page.getByText(/destructive tool/i)).toBeVisible();

    await page.getByRole('button', { name: 'Show full definition' }).click();
    const source = page.getByTestId('adapter-source');
    await expect(source).toBeVisible();
    const text = (await source.textContent()) ?? '';
    expect(text).toContain('"delete_task"');
    // An adapter cannot contain executable code, and the published source shows it.
    expect(text).not.toMatch(/function\s*\(|=>|eval\(/);
  });

  test('says plainly when WebMCP is unavailable rather than pretending', async ({ page }) => {
    await expect(page.getByRole('status')).toContainText(/WebMCP is not available|registry implements WebMCP itself/);
  });

  test('install without the extension reports the truth', async ({ page }) => {
    await page.goto('http://localhost:5280/adapter/demo-crm');
    await expect(page.getByText('The extension will show you the permissions before installing.')).toBeVisible();
  });
});
