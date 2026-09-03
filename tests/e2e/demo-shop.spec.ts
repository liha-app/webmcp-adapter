import { expect, test } from '@playwright/test';

test.describe('Nimbus Supply', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5274/');
  });

  test('implements no WebMCP of its own', async ({ page }) => {
    expect(await page.evaluate(() => 'modelContext' in window)).toBe(false);
  });

  test('configures a desk and the price follows', async ({ page }) => {
    await expect(page.getByTestId('config-total')).toContainText('899');
    await expect(page.locator('[data-step="top"]').locator('li')).toHaveCount(3);

    await page.locator('[data-step="top"] li[data-option-id="walnut"]').getByRole('button').click();
    await expect(page.getByTestId('config-total')).toContainText('1159');
    await expect(page.locator('[data-step="top"] li[data-option-id="walnut"]')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  test('the summary control and the option cards are the same choice', async ({ page }) => {
    // Two ways into one piece of state: a person clicks a card, an adapter sets
    // the select. If they ever disagree, one of them is lying.
    await page.getByTestId('config-base').selectOption({ label: 'Height-adjustable' });
    await expect(page.locator('[data-step="base"] li[data-option-id="adjustable"]')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(page.getByTestId('config-total')).toContainText('1319');
  });

  test('the gallery pages through the product photos', async ({ page }) => {
    const shot = page.getByTestId('gallery-image');
    const first = await shot.getAttribute('src');
    await expect(page.getByTestId('gallery-caption')).toHaveText('Three-quarter view');

    await page.locator('[data-action="gallery-next"]').click();
    await expect(page.getByTestId('gallery-caption')).toHaveText('Front');
    expect(await shot.getAttribute('src')).not.toBe(first);

    // The dots are the same control from the other end, and it wraps.
    await page.locator('[data-action="gallery-prev"]').click();
    await page.locator('[data-action="gallery-prev"]').click();
    await expect(page.getByTestId('gallery-caption')).toHaveText('In use');
    await page.locator('[data-action="gallery-select"]').first().click();
    expect(await shot.getAttribute('src')).toBe(first);
  });

  test('adds the configuration to the bag and totals it', async ({ page }) => {
    await page.getByTestId('config-size').selectOption({ label: '180 × 80 cm' });
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page).toHaveURL(/\/bag$/);
    await expect(page.getByTestId('bag-count')).toHaveText('1');
    await expect(page.getByTestId('bag-items').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('bag-total')).toContainText('1219');
  });

  test('applies a valid coupon and rejects an invalid one', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await page.getByTestId('coupon-form').locator('[name="coupon"]').fill('NIMBUS10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('coupon-status')).toContainText('NIMBUS10 applied');
    await expect(page.getByTestId('bag-total')).toContainText('809');

    await page.getByTestId('coupon-form').locator('[name="coupon"]').fill('BOGUS');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('coupon-status')).toContainText('not valid');
    await expect(page.getByTestId('bag-total')).toContainText('899');
  });

  test('the review is the end of the flow, and asks for nothing', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await page.getByRole('button', { name: 'Review order' }).click();
    await expect(page.getByTestId('order-review')).toBeVisible();
    await expect(page.getByTestId('review-total')).toContainText('899');

    // The store stops where a real one would start collecting payment. There is
    // no step after the review, and no field anywhere that could hold a card.
    await expect(page.getByRole('button', { name: /checkout|pay|buy|purchase|place order/i })).toHaveCount(0);
    await expect(page.locator('input[type="password"], [autocomplete^="cc-"]')).toHaveCount(0);
    await expect(page.locator('[data-action="place-order"]')).toHaveCount(0);
  });
});
