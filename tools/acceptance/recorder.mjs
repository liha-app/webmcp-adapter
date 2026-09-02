#!/usr/bin/env node
/**
 * Recorder and Studio acceptance run.
 *
 * Drives the real flow a person would: open the popup, press Record, use the
 * site by hand, press Stop, and check that the Studio turned what happened into
 * a valid adapter. Nothing is stubbed — the recorder is listening to genuine
 * DOM events from genuine interactions.
 *
 * Run with:  pnpm build && pnpm acceptance:recorder
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, Session, findChromeBinary, findExtensionId, sleep } from './chrome.mjs';
import { serveStatic } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXT_DIST = join(root, 'apps/extension/dist');
const PORT = 5273;
/*
 * A second copy of the same site on an origin no adapter is scoped to. The
 * exported snippet has to stand on its own there: nothing the extension
 * injects reaches this port, so any tool an agent finds was registered by the
 * generated code itself.
 */
const BARE_PORT = 5299;

const results = [];
let current = null;
const group = (title) => results.push((current = { title, checks: [] }));
const check = (ok, message, detail = '') => {
  current.checks.push({ ok: Boolean(ok), message, detail: String(detail) });
  return Boolean(ok);
};
const must = (ok, message, detail = '') => {
  if (!check(ok, message, detail)) throw new Error(`${message}${detail ? ` — ${detail}` : ''}`);
};

async function waitFor(probe, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await probe();
    if (value) return value;
    await sleep(150);
  }
  return null;
}

/** Types into a controlled React input the way a person does. */
const typeInto = (selector, value) => `(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

const clickOn = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.click();
  return true;
})()`;

async function openExtensionPage(browser, url) {
  const target = await browser.waitForTarget((candidate) => candidate.type === 'page' && candidate.url.includes(url));
  if (!target) return null;
  return await new Session(target.webSocketDebuggerUrl).open();
}

async function main() {
  if (!existsSync(join(EXT_DIST, 'manifest.json'))) throw new Error('Extension is not built. Run `pnpm build`.');
  const distDir = join(root, 'apps/demo-crm/dist');
  if (!existsSync(distDir)) throw new Error('Demo CRM is not built. Run `pnpm build`.');

  const binary = findChromeBinary();
  let stopBareServer = null;
  let downloads = null;
  const { close: stopServer } = await serveStatic(distDir, PORT);
  const browser = new Browser({ binary, extensionPath: EXT_DIST }).launch();

  try {
    await browser.ready();
    const crm = await browser.firstPage();
    await crm.goto(`http://localhost:${PORT}/`);
    group('Recording a workflow the way a person performs it');
    must(
      await waitFor(async () => (await crm.eval('typeof globalThis.__LIHA_WEBMCP_ADAPTER__')) === 'object'),
      'the extension is live on the demo site',
    );

    const extensionId = await findExtensionId(browser);
    must(Boolean(extensionId), 'the extension service worker is running');

    /* ------------------------------------------------------------ record -- */
    const popup = await browser.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    must(
      await waitFor(async () => popup.eval(`Boolean(document.querySelector('[data-action="toggle-recording"]'))`)),
      'the popup offers a Record button',
    );
    // The popup normally opens over the active tab, so put the site back in
    // front before pressing Record.
    await crm.send('Page.bringToFront');
    await popup.eval(`document.querySelector('[data-action="toggle-recording"]').click()`);
    await sleep(600);
    must(
      await waitFor(async () => {
        const state = await popup.eval("chrome.runtime.sendMessage({ type: 'liha/get-state' })");
        return state?.recording !== null && state?.recording !== undefined;
      }),
      'recording starts against the site, not against the popup',
    );

    // Perform the workflow by hand.
    await crm.eval(clickOn('[data-action="add-customer"]'));
    await sleep(250);
    await crm.eval(typeInto('[data-testid="customer-form"] [name="name"]', 'Dana Lopez'));
    await sleep(150);
    await crm.eval(typeInto('[data-testid="customer-form"] [name="email"]', 'dana@example.com'));
    await sleep(150);
    await crm.eval(clickOn('[data-action="create-customer"]'));
    await sleep(500);

    const state = await popup.eval("chrome.runtime.sendMessage({ type: 'liha/get-state' })");
    const actions = state?.recording?.actions ?? [];
    must(actions.length >= 4, 'every interaction was recorded', JSON.stringify(actions.map((a) => a.kind)));
    check(
      actions.map((action) => action.kind).join(',').startsWith('click,fill,fill'),
      'the recorder captured intent, not keystrokes',
      actions.map((action) => action.kind).join(','),
    );
    check(
      actions[0]?.selector === "[data-action='add-customer']",
      'it chose the site\'s own stable hook for the button',
      actions[0]?.selector,
    );
    check(
      actions.every((action) => !action.selector.includes('.')),
      'no selector depends on a class name',
      actions.map((action) => action.selector).join(' | '),
    );
    check(
      actions.every((action) => (action.candidates ?? []).some((candidate) => candidate.matches === 1)),
      'every step has a selector that resolves to exactly one element',
    );
    check(
      actions.find((action) => action.kind === 'fill')?.value === 'Dana Lopez',
      'the value typed into the field was captured for review',
    );

    /* ------------------------------------------------------------ studio -- */
    group('The Studio turns the recording into a valid adapter');
    await crm.send('Page.bringToFront');
    await popup.eval(`document.querySelector('[data-action="toggle-recording"]').click()`);
    const studio = await openExtensionPage(browser, 'studio/studio.html');
    must(Boolean(studio), 'stopping the recording opens the Studio');
    // The extension's language follows the browser unless someone has chosen
    // one. These checks read English labels, so pin it rather than depend on
    // the locale of whichever machine the suite runs on.
    await studio.eval(`chrome.storage.local.set({ 'liha/locale': 'en' }).then(() => location.reload())`);
    await sleep(700);
    must(
      await waitFor(async () => studio.eval(`Boolean(document.querySelector('.node[data-kind]'))`), 20000),
      'the Studio shows the recorded steps',
    );

    const stepKinds = await studio.eval(
      // Read off the flow rather than the open editor: only the selected step
      // has its fields on screen, and the order is the flow's to report.
      `[...document.querySelectorAll('.node[data-kind]')].map((node) => node.dataset.kind)`,
    );
    check(
      stepKinds.slice(0, 3).join(',') === 'click,fill,fill',
      'the steps arrive in the order they were performed',
      stepKinds.join(','),
    );
    const parameterised = await studio.eval(
      `document.querySelectorAll('.node[data-param="1"]').length`,
    );
    check(parameterised >= 2, 'typed values are proposed as tool input, not baked in as literals', String(parameterised));

    check(
      (await studio.eval('document.body.innerText')).includes('not valid yet'),
      'the draft is not valid until the author names and describes the tool',
    );

    await studio.eval(typeInto('input[placeholder="create_customer"]', 'create_customer'));
    await sleep(200);
    await studio.eval(typeInto('textarea', 'Create a customer by filling in the Add Customer form.'));
    await sleep(400);

    const json = await studio.eval(`document.querySelector('pre').textContent`);
    const adapter = JSON.parse(json);
    check(adapter.tools?.[0]?.name === 'create_customer', 'the generated adapter carries the tool name');
    check(adapter.tools?.[0]?.capability === 'WRITE', 'the capability classification is part of the output');
    check(
      JSON.stringify(adapter.tools?.[0]?.inputSchema?.required ?? []) === '["name","email"]',
      'the input schema was derived from the parameterised steps',
      JSON.stringify(adapter.tools?.[0]?.inputSchema),
    );
    check(
      adapter.tools?.[0]?.steps?.[1]?.value === '{{name}}',
      'the recorded value became a placeholder',
      JSON.stringify(adapter.tools?.[0]?.steps?.[1]),
    );
    check(adapter.origins?.[0] === `http://localhost:${PORT}`, 'the adapter is scoped to the origin it was recorded on');

    const allowed = new Set(['click', 'fill', 'select', 'check', 'uncheck', 'submit', 'waitFor', 'assertVisible', 'assertText', 'readText', 'readAttribute', 'readList', 'navigate']);
    check(
      (adapter.tools?.[0]?.steps ?? []).every((step) => allowed.has(step.type)),
      'the Studio can only emit declarative steps',
    );
    check(
      !/function|=>|eval\(|javascript:/i.test(json),
      'nothing executable appears anywhere in the generated adapter',
    );

    check(
      (await studio.eval('document.body.innerText')).includes('valid'),
      'the Studio reports the finished draft as valid',
    );

    /* -------------------------------------------------------------- test -- */
    group('Testing the draft against the live page');
    await studio.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Test selectors')).click()`);
    const banner = await waitFor(async () => {
      const text = await studio.eval('document.body.innerText');
      return text.includes('resolve to exactly one element') ? text : null;
    }, 15000);
    must(Boolean(banner), 'the Studio can check its selectors against the open page');
    const line = (banner ?? '').split('\n').find((entry) => entry.includes('resolve to exactly one element')) ?? '';
    check(/Checked \d+ selector\(s\): [1-9]\d* resolve/.test(line), 'the selectors it generated actually resolve', line);

    /* ------------------------------------------------------------ native -- */
    /*
     * An adapter exists because the site did not implement WebMCP. The Studio's
     * other export is the implementation that makes the adapter unnecessary, so
     * what matters is not that a file downloads — it is that the code in it
     * really registers WebMCP tools when the site runs it.
     */
    group('The Studio exports the implementation that makes the adapter unnecessary');
    downloads = mkdtempSync(join(tmpdir(), 'liha-native-'));
    await studio.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await studio.eval(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Export native WebMCP')).click()`,
    );
    const file = await waitFor(async () => {
      const found = readdirSync(downloads).filter((name) => name.endsWith('.js'));
      return found.length ? join(downloads, found[0]) : null;
    }, 15000);
    must(Boolean(file), 'the Export native WebMCP button writes a JavaScript file');
    const source = readFileSync(file, 'utf8');
    check(source.includes("name: \"create_customer\""), 'it registers the tool that was just recorded');
    check(
      source.includes('registerTool') && source.includes('{ signal: registration.signal }'),
      'it registers through document.modelContext with an AbortSignal',
    );
    check(!/\bthrow new /.test(source), 'it returns MCP errors rather than throwing them');
    check(
      source.includes('Chrome does not check input against inputSchema'),
      'it validates its own input, and says why it has to',
    );

    const { close: stopBare } = await serveStatic(distDir, BARE_PORT);
    stopBareServer = stopBare;
    const bare = await browser.newPage();
    const seen = new Map();
    bare.on((message) => {
      if (message.method === 'WebMCP.toolsAdded') {
        for (const tool of message.params.tools ?? []) seen.set(tool.name, tool);
      }
    });
    await bare.send('WebMCP.enable');
    await bare.goto(`http://localhost:${BARE_PORT}/`);
    await sleep(1200);
    check(seen.size === 0, 'no adapter reaches this origin, so the page starts with no tools', [...seen.keys()].join(','));

    // Evaluated as a classic script, so the `export` keyword — which only
    // matters to whoever imports the file — is dropped. Nothing else changes.
    await bare.eval(`(() => { ${source.replace(/^export /gm, '')} })()`);
    const registered = await waitFor(async () => (seen.has('create_customer') ? seen.get('create_customer') : null), 10000);
    must(Boolean(registered), 'running the exported file registers a real WebMCP tool, with no adapter involved');
    check(
      registered.stackTrace === undefined || !JSON.stringify(registered.stackTrace).includes('chrome-extension://'),
      'and an inspector sees the page as the author, not an injected runtime',
      JSON.stringify(registered.stackTrace ?? {}).slice(0, 120),
    );
    check(
      JSON.stringify(registered.inputSchema?.required ?? []) === JSON.stringify(adapter.tools[0].inputSchema.required ?? []),
      'the tool an agent discovers declares the same input as the adapter did',
      JSON.stringify(registered.inputSchema),
    );

    const responses = [];
    bare.on((message) => {
      if (message.method === 'WebMCP.toolResponded') responses.push(message.params);
    });
    await bare.send('WebMCP.invokeTool', {
      frameId: registered.frameId,
      toolName: 'create_customer',
      input: { name: 'Alice Smith', email: 'alice@example.com' },
    });
    const answered = await waitFor(async () => responses[0] ?? null, 15000);
    must(Boolean(answered), 'an out-of-page agent can invoke it');
    const text = (answered.output?.content ?? []).map((part) => part.text ?? '').join(' ');
    check(
      text.includes('not implemented yet') && answered.output?.isError === true,
      'and gets the honest stub back, as an MCP error rather than a thrown one',
      text.slice(0, 120),
    );
  } finally {
    browser?.close?.();
    await stopServer();
    if (stopBareServer) await stopBareServer();
    if (downloads) rmSync(downloads, { recursive: true, force: true });
  }
}

let failure = null;
try {
  await main();
} catch (error) {
  failure = error;
}

console.log('\nRecorder and Studio acceptance\n' + '='.repeat(70));
let passed = 0;
let total = 0;
for (const item of results) {
  const ok = item.checks.length > 0 && item.checks.every((entry) => entry.ok);
  console.log(`${ok ? ' PASS ' : ' FAIL '} ${item.title}`);
  for (const entry of item.checks) {
    total++;
    if (entry.ok) passed++;
    console.log(`        ${entry.ok ? '✓' : '✗'} ${entry.message}${entry.ok || !entry.detail ? '' : `\n            ${entry.detail}`}`);
  }
}
console.log('='.repeat(70));
console.log(`${passed}/${total} checks passed`);
if (failure) {
  console.error(`\nStopped in "${current?.title}": ${failure.message}`);
  process.exit(1);
}
if (passed < total) process.exit(1);
