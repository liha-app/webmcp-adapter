import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@liha/demo-crm/app';
import { mountApp, rows, type Harness } from './harness';

let crm: Harness;

beforeEach(async () => {
  window.history.replaceState({}, '', '/');
  crm = await mountApp(App, 'demo-crm');
});
afterEach(() => crm.cleanup());

describe('demo-crm adapter against the real app', () => {
  it('registers every declared tool', async () => {
    expect(await crm.toolNames()).toEqual(['search_customers', 'create_customer', 'update_customer']);
  });

  it('search_customers returns the matching records', async () => {
    const result = await crm.call('search_customers', { query: 'Jordan' });
    expect(result.isError).toBeUndefined();
    expect(result.text).toContain('Jordan Reyes');
    expect(result.text).not.toContain('Mika Tanaka');
    expect(result.structuredContent?.customers).toHaveLength(1);
  });

  it('create_customer drives the real form and the app assigns the id', async () => {
    const result = await crm.call('create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.created_customer).toBe('Alice Smith');
    // The id comes from the CRM's own submit handler, which is how we know the
    // app's logic ran rather than a row being pushed into the DOM.
    expect(result.structuredContent?.customer_id).toMatch(/^c-\d+$/);
  });

  // A create tool that reports "the last row" reports the wrong record whenever
  // an earlier call left a search filter active. It has to verify what it made.
  it('create_customer reports the record it created even after an earlier search', async () => {
    await crm.call('search_customers', { query: 'Jordan' });
    const result = await crm.call('create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    expect(result.structuredContent?.created_customer).toBe('Alice Smith');
    expect(rows('[data-testid="customer-list"] li')).toHaveLength(1);
  });

  it('update_customer renames the record it found by email', async () => {
    await crm.call('create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    const result = await crm.call('update_customer', { email: 'alice@example.com', name: 'Alice Chen' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.updated_customer).toBe('Alice Chen');
    expect(document.body.textContent).toContain('Alice Chen');
  });

  // The core safety property, exercised end to end: when a lookup does not
  // identify a single record, the tool refuses rather than editing whichever
  // one happened to be first.
  it('update_customer refuses when the lookup matches more than one record', async () => {
    await crm.call('create_customer', { name: 'Alice One', email: 'alice@team.test' });
    await crm.call('create_customer', { name: 'Alice Two', email: 'alice2@team.test' });
    const result = await crm.call('update_customer', { email: 'alice', name: 'Should Not Happen' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/matched 2 elements|timed out/);
    expect(document.body.textContent).not.toContain('Should Not Happen');
  });

  it('reports a readable error when required input is missing', async () => {
    const result = await crm.call('create_customer', { name: 'Alice Smith' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('missing required property "email"');
  });

  it('reports the adapter as healthy against the app it targets', () => {
    expect(crm.runtime.checkHealth('demo-crm')[0]?.status).toBe('healthy');
  });

  it('keeps the values it typed out of the execution log', async () => {
    await crm.call('create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    expect(JSON.stringify(crm.runtime.status().log)).not.toContain('alice@example.com');
  });
});
