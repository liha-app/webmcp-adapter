import { expect, test } from '@playwright/test';

/**
 * Every demo carries the same way back to the portal, and it has to look like
 * it belongs to the page it sits on.
 *
 * The bar reads `--shell` and `--gutter` from whichever app it lands in. When
 * an app forgets to declare them the bar does not fall over — it silently
 * takes its own fallback width and sits misaligned, which is exactly what
 * happened to Kite. Measuring both is the only way that shows up.
 */
const DEMOS = [
  { id: 'demo-crm', port: 5273, name: 'Acme CRM' },
  { id: 'demo-shop', port: 5274, name: 'Nimbus Supply' },
  { id: 'demo-project', port: 5275, name: 'Kite Project Manager' },
];

for (const demo of DEMOS) {
  test.describe(demo.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`http://localhost:${demo.port}/`);
    });

    test('offers the way back to the portal, and to its own adapter', async ({ page }) => {
      const bar = page.getByTestId('demo-bar');
      await expect(bar).toBeVisible();
      await expect(bar.locator('[data-action="back-to-portal"]')).toHaveAttribute(
        'href',
        'http://localhost:5280',
      );
      await expect(bar.locator('[data-action="view-adapter"]')).toHaveAttribute(
        'href',
        `http://localhost:5280/adapters/${demo.id}`,
      );
    });

    test('lines the bar up with the site it sits above', async ({ page }) => {
      const bar = await page.locator('.demobar__inner').boundingBox();
      const chrome = await page.locator('.topbar__inner').boundingBox();
      expect(bar).not.toBeNull();
      expect(chrome).not.toBeNull();
      expect(Math.round(bar!.x)).toBe(Math.round(chrome!.x));
      expect(Math.round(bar!.width)).toBe(Math.round(chrome!.width));
    });

    test('the bar is chrome, not part of the site', async ({ page }) => {
      // The demos are meant to read as ordinary third-party sites, so the way
      // back sits above their header rather than inside it.
      const inside = await page.locator('.topbar [data-testid="demo-bar"]').count();
      expect(inside).toBe(0);
      const order = await page.evaluate(() => {
        const bar = document.querySelector('[data-testid="demo-bar"]')!;
        const top = document.querySelector('.topbar')!;
        return bar.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING ? 'bar-first' : 'header-first';
      });
      expect(order).toBe('bar-first');
    });
  });
}
