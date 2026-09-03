import { expect, test } from '@playwright/test';

test.describe('Nimbus Supply', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5274/');
  });

  test('implements no WebMCP of its own', async ({ page }) => {
    expect(await page.evaluate(() => 'modelContext' in window)).toBe(false);
  });

  test('configures a machine and the price follows', async ({ page }) => {
    await expect(page.getByTestId('config-total')).toContainText('1999');
    await expect(page.locator('[data-step="chip"]').locator('li')).toHaveCount(3);

    await page.locator('[data-step="chip"] li[data-option-id="n3-max"]').getByRole('button').click();
    await expect(page.getByTestId('config-total')).toContainText('3399');
    await expect(page.locator('[data-step="chip"] li[data-option-id="n3-max"]')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  test('the summary control and the option cards are the same choice', async ({ page }) => {
    // Two ways into one piece of state: a person clicks a card, an adapter sets
    // the select. If they ever disagree, one of them is lying.
    await page.getByTestId('config-memory').selectOption({ label: '128GB' });
    await expect(page.locator('[data-step="memory"] li[data-option-id="128gb"]')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(page.getByTestId('config-total')).toContainText('2999');
  });

  test('adds the configuration to the bag and totals it', async ({ page }) => {
    await page.getByTestId('config-storage').selectOption({ label: '1TB SSD' });
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page).toHaveURL(/\/bag$/);
    await expect(page.getByTestId('bag-count')).toHaveText('1');
    await expect(page.getByTestId('bag-items').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('bag-total')).toContainText('2199');
  });

  test('applies a valid coupon and rejects an invalid one', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await page.getByTestId('coupon-form').locator('[name="coupon"]').fill('NIMBUS10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('coupon-status')).toContainText('NIMBUS10 applied');
    await expect(page.getByTestId('bag-total')).toContainText('1799');

    await page.getByTestId('coupon-form').locator('[name="coupon"]').fill('BOGUS');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('coupon-status')).toContainText('not valid');
    await expect(page.getByTestId('bag-total')).toContainText('1999');
  });

  test('the review is the end of the flow, and asks for nothing', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await page.getByRole('button', { name: 'Review order' }).click();
    await expect(page.getByTestId('order-review')).toBeVisible();
    await expect(page.getByTestId('review-total')).toContainText('1999');

    // The store stops where a real one would start collecting payment. There is
    // no step after the review, and no field anywhere that could hold a card.
    await expect(page.getByRole('button', { name: /checkout|pay|buy|purchase|place order/i })).toHaveCount(0);
    await expect(page.locator('input[type="password"], [autocomplete^="cc-"]')).toHaveCount(0);
    await expect(page.locator('[data-action="place-order"]')).toHaveCount(0);
  });
});
