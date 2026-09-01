import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CRM_FIXTURE, PROJECT_FIXTURE } from './fixtures';
import { createMockModelContext } from './mock-model-context';
import {
  createRuntime,
  needsConfirmation,
  type ConfirmationRequest,
  type LihaRuntime,
  type RuntimeDeps,
} from './runtime';

type ConfirmMock = Mock<(request: ConfirmationRequest) => Promise<boolean>>;

const confirmMock = (answer: boolean): ConfirmMock => vi.fn(async () => answer);
import type { ModelContext } from './webmcp';

const ORIGIN = 'http://localhost:5273';
const crmAdapter = CRM_FIXTURE;
const projectAdapter = PROJECT_FIXTURE;

/** A miniature stand-in for the demo CRM, wired like the real React app. */
function crmDom(): void {
  document.body.innerHTML = `
    <button data-action="add-customer">Add customer</button>
    <input data-testid="customer-search" name="q" />
    <ul data-testid="customer-list">
      <li data-customer-id="c-1"><span data-field="name">Mika Tanaka</span><span data-field="email">mika@a.test</span></li>
    </ul>`;
  const list = document.querySelector('[data-testid="customer-list"]')!;
  const search = document.querySelector('[data-testid="customer-search"]') as HTMLInputElement;
  const rows = [{ id: 'c-1', name: 'Mika Tanaka', email: 'mika@a.test' }];

  const paint = () => {
    const needle = search.value.trim().toLowerCase();
    list.innerHTML = rows
      .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle))
      .map(
        (row) =>
          `<li data-customer-id="${row.id}"><span data-field="name">${row.name}</span><span data-field="email">${row.email}</span><button data-action="edit-customer">Edit</button></li>`,
      )
      .join('');
  };
  paint();
  search.addEventListener('input', paint);

  document.querySelector('[data-action="add-customer"]')!.addEventListener('click', () => {
    if (document.querySelector('[data-testid="customer-dialog"]')) return;
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div data-testid="customer-dialog"><form data-testid="customer-form">
         <input name="name" /><input name="email" />
         <button data-action="create-customer">Create</button></form></div>`,
    );
    document.querySelector('[data-action="create-customer"]')!.addEventListener('click', (event) => {
      event.preventDefault();
      rows.push({
        id: `c-${rows.length + 1}`,
        name: (document.querySelector('[data-testid="customer-form"] [name="name"]') as HTMLInputElement).value,
        email: (document.querySelector('[data-testid="customer-form"] [name="email"]') as HTMLInputElement).value,
      });
      document.querySelector('[data-testid="customer-dialog"]')!.remove();
      paint();
    });
  });
}

function makeRuntime(
  modelContext: ModelContext | null,
  overrides: Partial<RuntimeDeps> = {},
): { runtime: LihaRuntime; confirm: ConfirmMock } {
  const confirm = confirmMock(true);
  const runtime = createRuntime({
    doc: document,
    location: { origin: ORIGIN, href: `${ORIGIN}/` },
    getModelContext: () => modelContext,
    navigate: vi.fn(),
    sleep: () => Promise.resolve(),
    settle: () => Promise.resolve(),
    now: () => Date.now(),
    requestConfirmation: confirm,
    ...overrides,
  });
  return { runtime, confirm };
}

async function invoke(mc: ReturnType<typeof createMockModelContext>, name: string, input: unknown) {
  const tool = (await mc.getTools()).find((candidate) => candidate.name === name)!;
  const raw = await mc.executeTool(tool, JSON.stringify(input));
  return JSON.parse(raw ?? 'null') as { content: Array<{ text: string }>; isError?: boolean };
}

beforeEach(crmDom);

describe('installation', () => {
  it('registers every tool in the adapter', async () => {
    const mc = createMockModelContext();
    const result = await makeRuntime(mc).runtime.install(crmAdapter);
    expect(result.ok).toBe(true);
    expect(mc.registered()).toEqual(['search_customers', 'create_customer', 'update_customer']);
  });

  it('refuses to install on an origin the adapter does not declare', async () => {
    const mc = createMockModelContext();
    const { runtime } = makeRuntime(mc, { location: { origin: 'https://evil.example.com', href: 'https://evil.example.com/' } });
    const result = await runtime.install(crmAdapter);
    expect(result.reason).toContain('not in the adapter');
    expect(mc.registered()).toEqual([]);
  });

  it('reports unsupported rather than shimming when WebMCP is absent', async () => {
    const { runtime } = makeRuntime(null);
    expect((await runtime.install(crmAdapter)).reason).toBe('webmcp-unsupported');
    expect(runtime.status().webmcp).toBe('unsupported');
  });

  it('rejects an adapter that fails validation', async () => {
    const mc = createMockModelContext();
    const result = await makeRuntime(mc).runtime.install({ ...crmAdapter, origins: ['*://*/*'] });
    expect(result.reason).toContain('invalid adapter');
    expect(mc.registered()).toEqual([]);
  });

  // Re-injection happens on every page load and on every enable toggle; WebMCP
  // rejects duplicate names, so install must be idempotent.
  it('is idempotent when installed twice', async () => {
    const mc = createMockModelContext();
    const { runtime } = makeRuntime(mc);
    await runtime.install(crmAdapter);
    expect((await runtime.install(crmAdapter)).ok).toBe(true);
    expect(mc.registered()).toHaveLength(crmAdapter.tools.length);
  });

  it('rolls back every tool when one registration fails', async () => {
    const mc = createMockModelContext();
    await mc.registerTool({ name: 'update_customer', description: 'squatter', execute: () => null });
    const { runtime } = makeRuntime(mc);
    const result = await runtime.install(crmAdapter);
    expect(result.ok).toBe(false);
    expect(result.registered).toEqual([]);
    expect(runtime.status().adapters).toEqual([]);
    expect(mc.registered()).toEqual(['update_customer']);
  });

  it('unregisters everything when the adapter is disabled', async () => {
    const mc = createMockModelContext();
    const { runtime } = makeRuntime(mc);
    await runtime.install(crmAdapter);
    expect(await runtime.uninstall('demo-crm')).toBe(true);
    expect(mc.registered()).toEqual([]);
    expect(await runtime.uninstall('demo-crm')).toBe(false);
  });
});

describe('tool execution', () => {
  it('drives the page UI and reports what it created', async () => {
    const mc = createMockModelContext();
    await makeRuntime(mc).runtime.install(crmAdapter);
    const result = await invoke(mc, 'create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Alice Smith');
    expect(document.body.textContent).toContain('alice@example.com');
  });

  it('returns structured output for a read tool', async () => {
    const mc = createMockModelContext();
    await makeRuntime(mc).runtime.install(crmAdapter);
    const result = await invoke(mc, 'search_customers', { query: 'Mika' });
    expect(result.content[0]?.text).toContain('Mika Tanaka');
  });

  it('returns a readable MCP error instead of throwing when input is invalid', async () => {
    const mc = createMockModelContext();
    await makeRuntime(mc).runtime.install(crmAdapter);
    const result = await invoke(mc, 'create_customer', { name: 'Alice Smith' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('missing required property "email"');
  });

  it('returns a readable MCP error when the page no longer matches', async () => {
    const mc = createMockModelContext();
    await makeRuntime(mc).runtime.install(crmAdapter);
    document.querySelector('[data-action="add-customer"]')!.remove();
    const result = await invoke(mc, 'create_customer', { name: 'A', email: 'a@b.test' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('matched 0 elements');
  });

  it('keeps typed values out of the execution log', async () => {
    const mc = createMockModelContext();
    const { runtime } = makeRuntime(mc);
    await runtime.install(crmAdapter);
    await invoke(mc, 'create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    const log = JSON.stringify(runtime.status().log);
    expect(log).toContain('completed');
    expect(log).not.toContain('alice@example.com');
  });
});

describe('capability confirmation', () => {
  it('decides which capabilities need confirmation', () => {
    expect(needsConfirmation('READ', { confirmWrite: true })).toBe(false);
    expect(needsConfirmation('INTERACT', { confirmWrite: true })).toBe(false);
    expect(needsConfirmation('WRITE', { confirmWrite: false })).toBe(false);
    expect(needsConfirmation('WRITE', { confirmWrite: true })).toBe(true);
    // Not configurable: destructive always asks.
    expect(needsConfirmation('DESTRUCTIVE', { confirmWrite: false })).toBe(true);
  });

  it('does not ask for a WRITE tool by default', async () => {
    const mc = createMockModelContext();
    const { runtime, confirm } = makeRuntime(mc);
    await runtime.install(crmAdapter);
    await invoke(mc, 'create_customer', { name: 'A', email: 'a@b.test' });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks for every WRITE tool once the policy is turned on', async () => {
    const mc = createMockModelContext();
    const { runtime, confirm } = makeRuntime(mc);
    await runtime.install(crmAdapter, { confirmWrite: true });
    await invoke(mc, 'create_customer', { name: 'A', email: 'a@b.test' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({ toolName: 'create_customer', capability: 'WRITE' });
  });

  it('shows the values in the confirmation without logging them', async () => {
    const mc = createMockModelContext();
    const { runtime, confirm } = makeRuntime(mc);
    await runtime.install(crmAdapter, { confirmWrite: true });
    await invoke(mc, 'create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    expect(confirm.mock.calls[0]?.[0].preview).toEqual([
      { key: 'name', value: 'Alice Smith' },
      { key: 'email', value: 'alice@example.com' },
    ]);
    expect(JSON.stringify(runtime.status().log)).not.toContain('alice@example.com');
  });

  it('does not touch the page when the user declines', async () => {
    const mc = createMockModelContext();
    const confirm = confirmMock(false);
    const { runtime } = makeRuntime(mc, { requestConfirmation: confirm });
    await runtime.install(crmAdapter, { confirmWrite: true });
    const before = document.body.innerHTML;
    const result = await invoke(mc, 'create_customer', { name: 'Alice', email: 'a@b.test' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('declined');
    expect(document.body.innerHTML).toBe(before);
  });

  // A confirmation gate that fails open is not a gate.
  it.each([
    ['a rejected promise', () => Promise.reject(new Error('bridge missing'))],
    ['a non-boolean answer', () => Promise.resolve('yes' as unknown as boolean)],
  ])('denies when the confirmation path is broken (%s)', async (_label, behaviour) => {
    const mc = createMockModelContext();
    const { runtime } = makeRuntime(mc, { requestConfirmation: behaviour });
    await runtime.install(crmAdapter, { confirmWrite: true });
    const before = document.body.innerHTML;
    const result = await invoke(mc, 'create_customer', { name: 'Alice', email: 'a@b.test' });
    expect(result.isError).toBe(true);
    expect(document.body.innerHTML).toBe(before);
  });

  it('always asks before a DESTRUCTIVE tool, whatever the policy says', async () => {
    document.body.innerHTML = `
      <input data-testid="task-search" name="q" />
      <ul data-testid="task-list"><li data-task-id="t-1"><span data-field="title">Audit</span>
        <button data-action="delete-task">Delete</button></li></ul>`;
    document.querySelector('[data-action="delete-task"]')!.addEventListener('click', () => {
      document.querySelector('[data-testid="task-list"] li')!.remove();
    });
    const mc = createMockModelContext('http://localhost:5275');
    const confirm = confirmMock(true);
    const { runtime } = createRuntimeFor(mc, confirm);
    await runtime.install(projectAdapter, { confirmWrite: false });
    const result = await invoke(mc, 'delete_task', { title: 'Audit' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({ capability: 'DESTRUCTIVE' });
    expect(result.isError).toBeUndefined();
    expect(document.querySelectorAll('[data-testid="task-list"] li')).toHaveLength(0);
  });
});

function createRuntimeFor(mc: ModelContext, confirm: ConfirmMock) {
  return {
    runtime: createRuntime({
      doc: document,
      location: { origin: 'http://localhost:5275', href: 'http://localhost:5275/' },
      getModelContext: () => mc,
      navigate: vi.fn(),
      sleep: () => Promise.resolve(),
      settle: () => Promise.resolve(),
      now: () => Date.now(),
      requestConfirmation: confirm,
    }),
  };
}

describe('status and health', () => {
  it('reports capability, registration and health for each tool', async () => {
    const mc = createMockModelContext();
    const { runtime } = makeRuntime(mc);
    await runtime.install(crmAdapter);
    const status = runtime.status();
    expect(status.webmcp).toBe('available');
    expect(status.adapters[0]?.tools.map((tool) => tool.capability)).toEqual(['READ', 'WRITE', 'WRITE']);
    expect(status.adapters[0]?.health?.status).toBe('healthy');
  });

  it('reports broken health when the page no longer has the anchors', async () => {
    const mc = createMockModelContext();
    const { runtime } = makeRuntime(mc);
    await runtime.install(crmAdapter);
    document.body.innerHTML = '<p>completely different page</p>';
    expect(runtime.checkHealth('demo-crm')[0]?.status).toBe('broken');
  });
});
