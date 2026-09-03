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
    expect(await shop.toolNames()).toEqual([
      'view_configure',
      'read_configuration',
      'next_photo',
      'choose_top',
      'choose_size',
      'choose_base',
      'add_to_bag',
      'view_bag',
      'apply_coupon',
      'review_order',
    ]);
  });

  it('read_configuration reports what the store currently has selected', async () => {
    const result = await shop.call('read_configuration');
    expect(result.structuredContent?.top).toBe('Solid oak');
    expect(result.structuredContent?.price).toContain('899');
  });

  /*
   * The configurator's choices are <select>s, so a parameter reaches the page
   * through the app's own control rather than through a selector built out of
   * the argument. That is the only shape the step vocabulary allows, and it is
   * why the runtime can promise no adapter interpolates into a selector.
   */
  it('choose_top sets the top and the price follows', async () => {
    const result = await shop.call('choose_top', { top: 'Solid walnut' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.top).toBe('Solid walnut');
    expect(result.structuredContent?.price).toContain('1159');
  });

  it('refuses an option the store does not offer, and says which it does', async () => {
    const result = await shop.call('choose_size', { size: '200 × 90 cm' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/120|140|180/);
  });

  it('choose_size and choose_base compose into one price', async () => {
    await shop.call('choose_size', { size: '140 × 70 cm' });
    const result = await shop.call('choose_base', { base: 'Height-adjustable' });
    expect(result.structuredContent?.price).toContain('1439');
  });

  // The gallery is the store's own control, so paging it is an ordinary tool
  // call rather than anything the adapter has to know about images.
  it('next_photo pages the gallery and says which view is showing', async () => {
    const first = document.querySelector('[data-testid="gallery-image"]')?.getAttribute('src');
    const result = await shop.call('next_photo');
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.view).toBe('Front');
    expect(document.querySelector('[data-testid="gallery-image"]')?.getAttribute('src')).not.toBe(first);
  });

  it('add_to_bag puts the configured desk in the bag', async () => {
    await shop.call('choose_base', { base: 'Adjustable + memory' });
    const result = await shop.call('add_to_bag');
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.bag).toHaveLength(1);
    expect(result.text).toContain('Adjustable + memory');
    expect(document.querySelector('[data-testid="bag-count"]')?.textContent).toBe('1');
  });

  // Exercises the navigate step: same-origin, client-side, and the tool call
  // survives it.
  it('view_bag navigates to the bag route and reads it back', async () => {
    await shop.call('add_to_bag');
    const result = await shop.call('view_bag');
    expect(window.location.pathname).toBe('/bag');
    expect(result.structuredContent?.items).toHaveLength(1);
    expect(result.structuredContent?.total).toContain('899');
  });

  it('apply_coupon reports acceptance and the recalculated total', async () => {
    await shop.call('add_to_bag');
    const result = await shop.call('apply_coupon', { code: 'NIMBUS10' });
    expect(result.text).toContain('NIMBUS10 applied');
    expect(result.structuredContent?.total).toContain('809');
  });

  it('apply_coupon reports a rejected code without pretending it worked', async () => {
    await shop.call('add_to_bag');
    const result = await shop.call('apply_coupon', { code: 'NOPE' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.coupon_status).toContain('not valid');
    expect(result.structuredContent?.total).toContain('899');
  });

  it('review_order stops at the review, which is where payment would start', async () => {
    await shop.call('add_to_bag');
    const result = await shop.call('review_order');
    expect(result.structuredContent?.total).toContain('899');
    // The review is the end of the flow. There is nothing after it to drive.
    expect(document.querySelector('[data-action="place-order"]')).toBeNull();
    expect(document.querySelector('input[type="password"], [autocomplete^="cc-"]')).toBeNull();
  });

  it('has no tool that could complete a purchase', async () => {
    for (const name of await shop.toolNames()) {
      expect(name).not.toMatch(/checkout|purchase|pay|place_order/);
    }
  });
});
