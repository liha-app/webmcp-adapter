import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Step } from '@liha/adapter-schema';
import { executeSteps, type ExecutorDeps } from './executor';

const navigate = vi.fn();

const deps: ExecutorDeps = {
  root: document,
  origin: 'https://app.test',
  navigate,
  sleep: () => Promise.resolve(),
  settle: () => Promise.resolve(),
  now: () => Date.now(),
};

function form(): void {
  document.body.innerHTML = `
    <button data-action="add">Add</button>
    <form data-testid="f">
      <input name="name" />
      <input name="email" />
      <select name="role"><option value="dev">Dev</option><option value="ops">Ops</option></select>
      <input type="checkbox" name="urgent" />
      <button type="submit" data-action="create">Create</button>
    </form>
    <ul data-testid="list"></ul>`;
  const list = document.querySelector('[data-testid="list"]')!;
  document.querySelector('[data-action="create"]')!.addEventListener('click', (event) => {
    event.preventDefault();
    const name = (document.querySelector('[name="name"]') as HTMLInputElement).value;
    const role = (document.querySelector('[name="role"]') as HTMLSelectElement).value;
    list.insertAdjacentHTML('beforeend', `<li data-id="x1"><span data-field="name">${name}</span><em>${role}</em></li>`);
  });
}

beforeEach(() => {
  navigate.mockReset();
  form();
});

const steps: Step[] = [
  { type: 'click', selector: '[data-action="add"]' },
  { type: 'fill', selector: '[name="name"]', value: '{{name}}' },
  { type: 'fill', selector: '[name="email"]', value: '{{email}}' },
  { type: 'click', selector: '[data-action="create"]' },
  { type: 'readText', selector: '[data-testid="list"] li:last-child [data-field="name"]', as: 'created' },
];

describe('executeSteps', () => {
  it('drives the real DOM and returns readText outputs', async () => {
    const result = await executeSteps(steps, { name: 'Alice Smith', email: 'alice@example.com' }, deps);
    expect((document.querySelector('[name="email"]') as HTMLInputElement).value).toBe('alice@example.com');
    expect(result.outputs).toEqual({ created: 'Alice Smith' });
    expect(result.trace.every((entry) => entry.ok)).toBe(true);
  });

  // Trace entries end up in the debug panel, so they must describe the shape of
  // what happened without ever carrying the values that were typed.
  it('never records the values that were typed', async () => {
    const result = await executeSteps(steps, { name: 'Alice Smith', email: 'alice@example.com' }, deps);
    const serialised = JSON.stringify(result.trace);
    expect(serialised).not.toContain('Alice Smith');
    expect(serialised).not.toContain('alice@example.com');
    expect(serialised).toContain('11 chars');
  });

  it('fails the whole call when a selector is ambiguous', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button data-action="add">Another</button>');
    await expect(executeSteps(steps, { name: 'A', email: 'b@c.test' }, deps)).rejects.toThrow(/matched 2 elements/);
    expect(document.querySelectorAll('[data-testid="list"] li')).toHaveLength(0);
  });

  it('stops at the failing step and reports the trace so far', async () => {
    document.querySelector('[name="email"]')!.remove();
    await expect(executeSteps(steps, { name: 'A', email: 'b@c.test' }, deps)).rejects.toMatchObject({
      trace: expect.arrayContaining([expect.objectContaining({ step: 'fill', ok: false })]),
    });
    expect(document.querySelectorAll('[data-testid="list"] li')).toHaveLength(0);
  });

  it('runs select, check, submit and readAttribute', async () => {
    let submitted = false;
    document.querySelector('[data-testid="f"]')!.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    const result = await executeSteps(
      [
        { type: 'select', selector: '[name="role"]', value: '{{role}}' },
        { type: 'check', selector: '[name="urgent"]' },
        { type: 'uncheck', selector: '[name="urgent"]' },
        { type: 'submit', selector: '[data-testid="f"]' },
        { type: 'readAttribute', selector: '[data-testid="f"]', attribute: 'data-testid', as: 'form_id' },
      ],
      { role: 'ops' },
      deps,
    );
    expect((document.querySelector('[name="role"]') as HTMLSelectElement).value).toBe('ops');
    expect((document.querySelector('[name="urgent"]') as HTMLInputElement).checked).toBe(false);
    expect(submitted).toBe(true);
    expect(result.outputs).toEqual({ form_id: 'f' });
  });

  it('reads a list of rows with per-field selectors', async () => {
    document.querySelector('[data-testid="list"]')!.innerHTML =
      '<li data-id="a"><span data-field="name">One</span></li><li data-id="b"><span data-field="name">Two</span></li>';
    const result = await executeSteps(
      [
        {
          type: 'readList',
          selector: '[data-testid="list"] li',
          as: 'rows',
          fields: { id: { attribute: 'data-id' }, name: { selector: '[data-field="name"]' } },
        },
      ],
      {},
      deps,
    );
    expect(result.outputs.rows).toEqual([
      { id: 'a', name: 'One' },
      { id: 'b', name: 'Two' },
    ]);
  });

  it('honours the readList limit', async () => {
    document.querySelector('[data-testid="list"]')!.innerHTML = '<li>1</li><li>2</li><li>3</li>';
    const result = await executeSteps(
      [{ type: 'readList', selector: '[data-testid="list"] li', as: 'rows', limit: 2 }],
      {},
      deps,
    );
    expect(result.outputs.rows).toHaveLength(2);
  });

  it('asserts text and visibility, and fails when the assertion does not hold', async () => {
    document.body.insertAdjacentHTML('beforeend', '<p id="msg">Coupon SAVE10 applied</p>');
    await expect(
      executeSteps(
        [
          { type: 'assertVisible', selector: '#msg' },
          { type: 'assertText', selector: '#msg', contains: '{{code}}' },
        ],
        { code: 'SAVE10' },
        deps,
      ),
    ).resolves.toBeTruthy();

    await expect(
      executeSteps([{ type: 'assertText', selector: '#msg', contains: '{{code}}' }], { code: 'NOPE' }, deps),
    ).rejects.toThrow(/does not contain the expected text/);
  });

  // An assertion message must not leak the value it was checking for.
  it('does not put the expected text into the failure message', async () => {
    document.body.insertAdjacentHTML('beforeend', '<p id="msg">nothing</p>');
    await expect(
      executeSteps([{ type: 'assertText', selector: '#msg', contains: '{{secret}}' }], { secret: 'topsecret' }, deps),
    ).rejects.toThrow(/^(?!.*topsecret).*$/);
  });

  it('waits for an element to appear and to go away', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    setTimeout(() => {
      document.querySelector('#host')!.innerHTML = '<span id="late">ready</span>';
    }, 20);
    const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    await executeSteps([{ type: 'waitFor', selector: '#late', timeoutMs: 1000 }], {}, { ...deps, sleep: realSleep });

    setTimeout(() => document.querySelector('#late')!.remove(), 20);
    await executeSteps(
      [{ type: 'waitFor', selector: '#late', state: 'absent', timeoutMs: 1000 }],
      {},
      { ...deps, sleep: realSleep },
    );
    expect(document.querySelector('#late')).toBeNull();
  });

  it('times out rather than continuing when an element never appears', async () => {
    let clock = 0;
    await expect(
      executeSteps([{ type: 'waitFor', selector: '#never', timeoutMs: 200 }], {}, {
        ...deps,
        sleep: () => {
          clock += 50;
          return Promise.resolve();
        },
        now: () => clock,
      }),
    ).rejects.toThrow(/timed out after 200ms/);
  });

  it('does not wait out an ambiguous selector', async () => {
    document.body.innerHTML = '<p class="x"></p><p class="x"></p>';
    await expect(executeSteps([{ type: 'waitFor', selector: '.x', timeoutMs: 5000 }], {}, deps)).rejects.toThrow(
      /matched 2 elements/,
    );
  });

  it('refuses to type into a password field', async () => {
    document.body.innerHTML = '<input type="password" name="secret" />';
    await expect(
      executeSteps([{ type: 'fill', selector: '[name="secret"]', value: '{{v}}' }], { v: 'hunter2' }, deps),
    ).rejects.toThrow(/credential or payment/);
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('');
  });

  describe('navigate', () => {
    it('navigates within the adapter origin', async () => {
      await executeSteps([{ type: 'navigate', path: '/cart' }], {}, deps);
      expect(navigate).toHaveBeenCalledWith('https://app.test/cart');
    });

    // The single most important property of this step: a tool argument must not
    // be able to send the user somewhere else.
    // eslint-disable-next-line no-script-url -- these are the fixtures under test
    it.each(['https://evil.test/steal', '//evil.test', 'javascript:alert(1)'])(
      'refuses to leave the origin for %s',
      async (target) => {
        await expect(
          executeSteps([{ type: 'navigate', path: '{{target}}' }], { target }, deps),
        ).rejects.toThrow(/leaves the adapter's origin/);
        expect(navigate).not.toHaveBeenCalled();
      },
    );
  });
});
