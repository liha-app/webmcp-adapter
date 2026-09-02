#!/usr/bin/env node
/**
 * Phase 0 acceptance runner.
 *
 * Walks the ten Phase 0 acceptance criteria against a real browser. Tools are
 * observed and invoked through the DevTools `WebMCP` domain — the same
 * out-of-page surface a WebMCP agent or Tool Inspector uses — so a pass here
 * means the tool is genuinely discoverable outside the page, not merely
 * "registered somewhere internally".
 *
 * Run with:  pnpm build && pnpm acceptance
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findChromeBinary, sleep } from './chrome.mjs';
import { serveStatic } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEMO_DIST = join(root, 'apps/demo-crm/dist');
const EXT_DIST = join(root, 'apps/extension/dist');
const PORT = 5273;
const ORIGIN = `http://localhost:${PORT}`;

const results = [];
const timings = {};
let currentCriterion = null;

function criterion(number, title) {
  currentCriterion = { number, title, checks: [] };
  results.push(currentCriterion);
}

function assert(ok, message, detail = '') {
  currentCriterion.checks.push({ ok: Boolean(ok), message, detail: String(detail) });
  if (!ok) throw new Error(`${message}${detail ? ` — ${detail}` : ''}`);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Live view of the tools an out-of-page agent can see, built from CDP events. */
function trackWebMcpTools(session) {
  const tools = new Map();
  const events = [];
  session.on((message) => {
    if (!message.method?.startsWith('WebMCP')) return;
    events.push(message.method);
    if (message.method === 'WebMCP.toolsAdded') {
      for (const tool of message.params.tools ?? []) tools.set(tool.name, tool);
    } else if (message.method === 'WebMCP.toolsRemoved') {
      for (const name of message.params.names ?? message.params.toolNames ?? []) tools.delete(name);
      for (const tool of message.params.tools ?? []) tools.delete(tool.name ?? tool);
    }
  });
  return { tools, events };
}

/**
 * Polls until a condition holds. Every wait in this runner is a poll rather
 * than a fixed sleep: a suite that passes because a sleep happened to be long
 * enough is not evidence of anything.
 */
async function waitUntil(describe, probe, timeoutMs = 20000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await probe();
    if (last) return { ok: true, elapsed: Date.now() - started, value: last };
    await sleep(150);
  }
  return { ok: false, elapsed: Date.now() - started, value: last, describe };
}

/** Waits for the out-of-page agent to be told about a tool, with a fresh frameId. */
async function waitForAnnouncedTool(watch, name, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tool = watch.tools.get(name);
    if (tool) return tool;
    await sleep(150);
  }
  return null;
}

async function pageTools(page) {
  return await page.eval(
    '(async () => (document.modelContext ? (await document.modelContext.getTools()).map((t) => t.name) : null))()',
  );
}

/** Clears the CRM search box the way a person would, so row counts are total. */
async function clearSearch(page) {
  await page.eval(`(() => {
    const input = document.querySelector('[data-testid="customer-search"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(150);
}

async function customerRows(page) {
  return await page.eval(
    `[...document.querySelectorAll('[data-testid="customer-list"] li')].map((li) => ({
       id: li.getAttribute('data-customer-id'),
       name: li.querySelector('[data-field="name"]')?.textContent,
       email: li.querySelector('[data-field="email"]')?.textContent,
     }))`,
  );
}

async function main() {
  if (!existsSync(DEMO_DIST) || !existsSync(join(EXT_DIST, 'manifest.json'))) {
    throw new Error('Build output missing. Run `pnpm build` first.');
  }
  const binary = findChromeBinary();
  let stopServer;
  try {
    ({ close: stopServer } = await serveStatic(DEMO_DIST, PORT));
  } catch (error) {
    throw new Error(
      `Could not serve the demo on port ${PORT} (${error.code ?? error.message}). ` +
        'Another process is using it; stop it or change PORT in this file and in the adapter/manifest origins.',
    );
  }
  const preflight = await fetch(`${ORIGIN}/`).then((response) => response.text());
  if (!preflight.includes('Acme CRM')) {
    throw new Error(`${ORIGIN} is not serving the Liha demo CRM. Another app is answering on that port.`);
  }
  const browsers = [];

  try {
    /* ---------------------------------------------------------------- 1 --- */
    criterion(1, 'The demo apps contain no WebMCP implementation');
    for (const app of ['demo-crm', 'demo-shop', 'demo-project']) {
      const sources = walk(join(root, `apps/${app}/src`))
        .concat([join(root, `apps/${app}/index.html`)])
        .filter((file) => /\.(ts|tsx|js|jsx|html|css)$/.test(file));
      const offenders = sources.filter((file) => /modelContext|registerTool|webmcp/i.test(readFileSync(file, 'utf8')));
      assert(offenders.length === 0, `no WebMCP references anywhere in ${app}`, offenders.join(', '));

      const bundle = walk(join(root, `apps/${app}/dist`))
        .filter((file) => file.endsWith('.js'))
        .map((file) => readFileSync(file, 'utf8'))
        .join('');
      assert(!/modelContext/.test(bundle), `no modelContext in the built ${app} bundle`);
    }

    /* ---------------------------------------------------------------- 2 --- */
    criterion(2, 'Without the extension, create_customer does not exist');
    const control = new Browser({ binary }).launch();
    browsers.push(control);
    await control.ready();
    const controlPage = await control.firstPage();
    const controlWatch = trackWebMcpTools(controlPage);
    await controlPage.send('WebMCP.enable');
    await controlPage.goto(`${ORIGIN}/`);
    await sleep(800);
    assert(
      (await controlPage.eval('document.title')) === 'Acme CRM — Demo',
      'the browser loaded the Liha demo CRM and not another app on this port',
      await controlPage.eval('document.title'),
    );
    assert(
      (await controlPage.eval('typeof document.modelContext')) === 'object',
      'WebMCP itself is available in this browser',
      'if this fails the browser was launched without --enable-blink-features=WebMCPTesting',
    );
    assert(
      JSON.stringify(await pageTools(controlPage)) === '[]',
      'the page exposes zero tools without the extension',
      JSON.stringify(await pageTools(controlPage)),
    );
    assert(controlWatch.tools.size === 0, 'the out-of-page agent sees no tools', [...controlWatch.tools.keys()].join(','));
    control.close();

    /* -------------------------------------------------------------- 3-5 --- */
    criterion(3, 'The extension loads and injects into the MAIN world');
    const browser = new Browser({ binary, extensionPath: EXT_DIST }).launch();
    browsers.push(browser);
    await browser.ready();
    const page = await browser.firstPage();
    const watch = trackWebMcpTools(page);
    await page.send('WebMCP.enable');
    await page.goto(`${ORIGIN}/`);
    const injected = await waitUntil(
      'runtime injected',
      async () => (await page.eval('typeof globalThis.__LIHA_WEBMCP_ADAPTER__')) === 'object',
      15000,
    );
    const runtimeGlobal = await page.eval('typeof globalThis.__LIHA_WEBMCP_ADAPTER__');
    assert(
      injected.ok && runtimeGlobal === 'object',
      'the Liha runtime is present in the page MAIN world',
      `typeof __LIHA_WEBMCP_ADAPTER__ = ${runtimeGlobal}. If this is "undefined", the browser probably ignored --load-extension (branded Google Chrome does).`,
    );

    criterion(4, 'The tool is registered through document.modelContext');
    const registered = await pageTools(page);
    assert(
      Array.isArray(registered) && registered.includes('create_customer'),
      'create_customer is registered with WebMCP',
      JSON.stringify(registered),
    );
    const status = await page.eval('globalThis.__LIHA_WEBMCP_ADAPTER__.status()');
    assert(status.webmcp === 'available', 'the runtime reports WebMCP as available');
    assert(status.adapters[0]?.id === 'demo-crm', 'the demo-crm adapter is installed', JSON.stringify(status.adapters));

    criterion(5, 'An out-of-page WebMCP agent can discover the tool');
    const seen = watch.tools.get('create_customer');
    assert(Boolean(seen), 'the DevTools WebMCP domain reported the tool', watch.events.join(','));
    assert(
      ['search_customers', 'create_customer', 'update_customer'].every((name) => watch.tools.has(name)),
      'every tool in the adapter is announced',
      [...watch.tools.keys()].join(', '),
    );
    assert(seen.description.length > 0, 'the tool carries its description', seen.description);
    assert(
      JSON.stringify(seen.inputSchema?.required ?? []) === '["name","email"]',
      'the tool carries its JSON input schema',
      JSON.stringify(seen.inputSchema),
    );
    const provenance = seen.stackTrace?.callFrames?.[0]?.url ?? '';
    assert(provenance.startsWith('chrome-extension://'), 'the tool is attributable to the extension', provenance);
    const extensionId = provenance.split('/')[2];

    // The popup is the surface a person actually reads before trusting a tool,
    // so check what it reports rather than only what the runtime knows.
    const popup = await browser.newPage();
    // The popup reports on the tab in front of it — as it does when opened from
    // the toolbar — and now shows only the adapters scoped to that page, so the
    // CRM has to be in front before it renders rather than after.
    await page.send('Page.bringToFront');
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await waitUntil('popup rendered', async () =>
      popup.eval('Boolean(document.querySelector(\'.card input[type="checkbox"]\'))'),
    );
    const popupState = await popup.eval(
      "chrome.runtime.sendMessage({ type: 'liha/get-state' })",
    );
    assert(popupState.runtime?.webmcp === 'available', 'the popup reports WebMCP as available');
    assert(
      popupState.runtime?.adapters?.[0]?.tools?.every((tool) => tool.registered) === true,
      'the popup shows the tools as registered',
      JSON.stringify(popupState.runtime?.adapters),
    );
    const shownTools = popupState.catalog?.[0]?.adapter?.tools ?? [];
    assert(
      shownTools.find((tool) => tool.name === 'create_customer')?.capability === 'WRITE',
      'the popup shows the WRITE capability classification before the user trusts it',
      JSON.stringify(shownTools.map((tool) => [tool.name, tool.capability])),
    );
    assert(
      popupState.runtime?.adapters?.[0]?.health?.status === 'healthy',
      'the popup reports the adapter as healthy against this page',
      JSON.stringify(popupState.runtime?.adapters?.[0]?.health?.status),
    );
    assert(
      popupState.catalog?.[0]?.matchesCurrentOrigin === true,
      'the popup shows the adapter as scoped to this page',
    );

    /* -------------------------------------------------------------- 6-8 --- */
    criterion(6, 'The agent can execute create_customer');
    const before = await customerRows(page);
    const invocation = await page.send('WebMCP.invokeTool', {
      frameId: seen.frameId,
      toolName: 'create_customer',
      input: { name: 'Alice Smith', email: 'alice@example.com' },
    });
    assert(Boolean(invocation.invocationId), 'invokeTool returned an invocation id');
    const foreground = await waitUntil(
      'customer added',
      async () => (await customerRows(page)).some((row) => row.name === 'Alice Smith'),
    );
    assert(foreground.ok, 'the invocation completed', `waited ${foreground.elapsed}ms`);
    timings.foregroundMs = foreground.elapsed;

    criterion(7, 'The real DOM form was driven, step by step');
    const log = (await page.eval('globalThis.__LIHA_WEBMCP_ADAPTER__.status()')).log.map((entry) => entry.message);
    for (const expected of [
      'OK click [data-action=\'add-customer\']',
      'OK fill [data-testid=\'customer-form\'] [name=\'name\']',
      'OK fill [data-testid=\'customer-form\'] [name=\'email\']',
      'OK click [data-action=\'create-customer\']',
      'completed',
    ]) {
      assert(log.some((line) => line.includes(expected)), `step recorded: ${expected}`, log.join(' | '));
    }
    assert(
      !JSON.stringify(log).includes('alice@example.com'),
      'the execution log does not contain the values that were typed',
    );

    criterion(8, 'Alice Smith is in the CRM');
    // create_customer verifies its own work by looking the record up, so the
    // list is filtered to it; clear the search to count the whole list.
    const shown = await customerRows(page);
    assert(shown.length === 1, 'the tool leaves the record it created on screen', JSON.stringify(shown));
    await clearSearch(page);
    const after = await customerRows(page);
    assert(after.length === before.length + 1, 'exactly one customer was added', `${before.length} -> ${after.length}`);
    const created = after.at(-1);
    assert(created.name === 'Alice Smith', 'the new row shows the requested name', JSON.stringify(created));
    assert(created.email === 'alice@example.com', 'the new row shows the requested email', JSON.stringify(created));
    // The id is assigned by the CRM's own submit handler, so its presence proves
    // the app's logic ran rather than a row being injected into the DOM.
    assert(/^c-\d+$/.test(created.id ?? ''), 'the CRM assigned the record its own id', String(created.id));

    /* ---------------------------------------------------------------- 9 --- */
    criterion(9, 'Disabling the adapter removes the tool');
    const toggled = await popup.eval(`(() => {
      const box = document.querySelector('.card input[type="checkbox"]');
      if (!box) return 'no-checkbox';
      box.click();
      return box.checked;
    })()`);
    assert(toggled === false, 'the popup toggle switched the adapter off', String(toggled));
    const removed = await waitUntil('tools removed', async () => (await pageTools(page)).length === 0, 10000);
    const afterDisable = await pageTools(page);
    assert(removed.ok, 'the tool disappears without needing a reload', `waited ${removed.elapsed}ms`);
    assert(
      JSON.stringify(afterDisable) === '[]',
      'the page exposes no tools once the adapter is disabled',
      JSON.stringify(afterDisable),
    );
    assert(!watch.tools.has('create_customer'), 'the out-of-page agent no longer lists the tool');
    let invokeFailed = false;
    try {
      await page.send('WebMCP.invokeTool', {
        frameId: seen.frameId,
        toolName: 'create_customer',
        input: { name: 'Mallory', email: 'm@example.com' },
      });
    } catch {
      invokeFailed = true;
    }
    await sleep(1000);
    const rowsAfterDisable = await customerRows(page);
    assert(
      invokeFailed || rowsAfterDisable.length === after.length,
      'invoking the disabled tool changes nothing',
      `${after.length} -> ${rowsAfterDisable.length}`,
    );

    /* --------------------------------------------------------------- 10 --- */
    criterion(10, 'Re-enabling and reloading re-registers the tool');
    const reToggled = await popup.eval(`(() => {
      const box = document.querySelector('.card input[type="checkbox"]');
      box.click();
      return box.checked;
    })()`);
    assert(reToggled === true, 'the popup toggle switched the adapter back on');

    // Forget everything the agent knew: after a reload the tool must be
    // announced again from scratch, with a frame reference that is still valid.
    watch.tools.clear();
    watch.events.length = 0;
    await page.reload();
    const reRegistered = await waitUntil(
      're-registered after reload',
      async () => (await pageTools(page))?.includes('create_customer'),
      15000,
    );
    assert(reRegistered.ok, 'the adapter re-installs itself on reload', `waited ${reRegistered.elapsed}ms`);
    const afterReload = await pageTools(page);
    assert(
      Array.isArray(afterReload) && afterReload.includes('create_customer'),
      'the tool is registered again after a page reload',
      JSON.stringify(afterReload),
    );
    assert(
      (await customerRows(page)).length === 3,
      'the reloaded page is back to its seed data',
      JSON.stringify(await customerRows(page)),
    );
    const reloadedTool = await waitForAnnouncedTool(watch, 'create_customer');
    assert(
      Boolean(reloadedTool),
      'the out-of-page agent is told about the tool again after the reload',
      `WebMCP events since reload: ${watch.events.join(', ') || '(none)'}`,
    );
    await page.send('WebMCP.invokeTool', {
      frameId: reloadedTool.frameId,
      toolName: 'create_customer',
      input: { name: 'Bob Chen', email: 'bob@example.com' },
    });
    // This tab is in the background now (the popup tab has focus), which is
    // exactly how an agent usually drives a page.
    const background = await waitUntil(
      'customer added from a background tab',
      async () => (await customerRows(page)).some((row) => row.name === 'Bob Chen'),
    );
    timings.backgroundMs = background.elapsed;
    const finalRows = await customerRows(page);
    assert(
      finalRows.some((row) => row.name === 'Bob Chen'),
      'the re-registered tool still drives the UI',
      `${JSON.stringify(finalRows.at(-1))} | events: ${watch.events.join(', ')}`,
    );
  } finally {
    for (const browser of browsers) browser.close();
    await stopServer();
  }
}

let failure = null;
try {
  await main();
} catch (error) {
  failure = error;
}

console.log('\nPhase 0 acceptance criteria\n' + '='.repeat(64));
let passed = 0;
for (const item of results) {
  const ok = item.checks.length > 0 && item.checks.every((check) => check.ok);
  if (ok) passed++;
  console.log(`${ok ? ' PASS ' : ' FAIL '} ${String(item.number).padStart(2)}. ${item.title}`);
  for (const check of item.checks) {
    console.log(`        ${check.ok ? '✓' : '✗'} ${check.message}${check.ok || !check.detail ? '' : `\n            ${check.detail}`}`);
  }
}
console.log('='.repeat(64));
if (timings.foregroundMs !== undefined) {
  console.log(
    `tool call latency: ${timings.foregroundMs}ms foreground tab, ${timings.backgroundMs ?? '—'}ms background tab`,
  );
}
console.log(`${passed}/10 criteria passed`);
if (failure) {
  console.error(`\nStopped at criterion ${currentCriterion?.number}: ${failure.message}`);
  process.exit(1);
}
if (passed < 10) process.exit(1);
