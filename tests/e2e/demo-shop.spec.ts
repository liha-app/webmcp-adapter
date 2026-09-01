import { expect, test } from '@playwright/test';

test.describe('Nimbus Supply', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5274/');
  });

  test('implements no WebMCP of its own', async ({ page }) => {
    expect(await page.evaluate(() => 'modelContext' in window)).toBe(false);
  });

  test('searches the catalogue', async ({ page }) => {
    await expect(page.getByTestId('product-list').locator('li')).toHaveCount(6);
    await page.getByTestId('product-search').fill('lighting');
    await expect(page.getByTestId('product-list').locator('li')).toHaveCount(2);
    await page.getByTestId('product-search').fill('nothing here');
    await expect(page.getByTestId('product-empty')).toBeVisible();
  });

  test('adds items to the cart and totals them', async ({ page }) => {
    await page.getByTestId('product-search').fill('Aurora');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await page.getByRole('button', { name: /^Cart/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId('cart-items').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('cart-total')).toContainText('89');
  });

  test('applies a valid coupon and rejects an invalid one', async ({ page }) => {
    await page.getByTestId('product-search').fill('Nimbus Standing Desk');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.getByRole('button', { name: /^Cart/ }).click();
    await page.getByTestId('coupon-form').locator('[name="coupon"]').fill('SAVE10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('coupon-status')).toContainText('SAVE10 applied');
    await expect(page.getByTestId('cart-total')).toContainText('576');

    await page.getByTestId('coupon-form').locator('[name="coupon"]').fill('BOGUS');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('coupon-status')).toContainText('not valid');
    await expect(page.getByTestId('cart-total')).toContainText('640');
  });

  test('has no checkout or payment step at all', async ({ page }) => {
    await page.getByRole('button', { name: /^Cart/ }).click();
    await expect(page.getByRole('button', { name: /checkout|pay|buy|purchase/i })).toHaveCount(0);
    await expect(page.locator('input[type="password"], [autocomplete^="cc-"]')).toHaveCount(0);
  });
});
