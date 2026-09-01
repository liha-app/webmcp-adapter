import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@liha/demo-shop/app';
import { mountApp, type Harness } from './harness';

let shop: Harness;

beforeEach(async () => {
  window.history.replaceState({}, '', '/');
  shop = await mountApp(App, 'demo-shop');
});
afterEach(() => shop.cleanup());

describe('demo-shop adapter against the real app', () => {
  it('registers every declared tool', async () => {
    expect(await shop.toolNames()).toEqual(['search_products', 'view_cart', 'add_to_cart', 'apply_coupon']);
  });

  it('search_products returns matching products with prices', async () => {
    const result = await shop.call('search_products', { query: 'lighting' });
    expect(result.structuredContent?.products).toHaveLength(2);
    expect(result.text).toContain('Aurora Desk Lamp');
  });

  it('add_to_cart drives the storefront and reports the new cart count', async () => {
    const result = await shop.call('add_to_cart', { product: 'Aurora Desk Lamp' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.cart_item_count).toBe('1');
    expect(document.querySelector('[data-testid="cart-count"]')?.textContent).toBe('1');
  });

  it('add_to_cart refuses an ambiguous product rather than guessing', async () => {
    const result = await shop.call('add_to_cart', { product: 'lighting' });
    expect(result.isError).toBe(true);
    expect(document.querySelector('[data-testid="cart-count"]')?.textContent).toBe('0');
  });

  // Exercises the navigate step: same-origin, client-side, and the tool call
  // survives it.
  it('view_cart navigates to the cart route and reads it back', async () => {
    await shop.call('add_to_cart', { product: 'Cirrus Mesh Chair' });
    const result = await shop.call('view_cart');
    expect(window.location.pathname).toBe('/cart');
    expect(result.structuredContent?.items).toHaveLength(1);
    expect(result.text).toContain('Cirrus Mesh Chair');
    expect(result.structuredContent?.total).toContain('410');
  });

  it('apply_coupon reports acceptance and the recalculated total', async () => {
    await shop.call('add_to_cart', { product: 'Nimbus Standing Desk' });
    const result = await shop.call('apply_coupon', { code: 'SAVE10' });
    expect(result.text).toContain('SAVE10 applied');
    expect(result.structuredContent?.cart_total).toContain('576');
  });

  it('apply_coupon reports a rejected code without pretending it worked', async () => {
    await shop.call('add_to_cart', { product: 'Vapor Cable Tray' });
    const result = await shop.call('apply_coupon', { code: 'NOPE' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.coupon_status).toContain('not valid');
    expect(result.structuredContent?.cart_total).toContain('38');
  });

  it('has no tool that could complete a purchase', async () => {
    for (const name of await shop.toolNames()) {
      expect(name).not.toMatch(/checkout|purchase|pay|order/);
    }
  });
});
