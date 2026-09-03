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

/*
 * A target exists before the page behind it does.
 *
 * `waitForTarget` returns as soon as the window is there, which is a moment
 * before the extension page has an extension API to talk to — and the first
 * thing this suite does with the Studio is read `chrome.storage` to pin the
 * language. That raced, rarely and only on a loaded machine, and reported
 * itself as a TypeError in the middle of a passing run. Wait for the API, not
 * for the window.
 */
/**
 * Answers the confirmation window the runtime raises before a stranger's
 * adapter writes to a page. Driven rather than stubbed: it is the gate, so the
 * test goes through it the way a person does.
 */
async function answerConfirmation(browser, decision) {
  const target = await browser.waitForTarget(
    (candidate) => candidate.type === 'page' && candidate.url.includes('confirm/confirm.html'),
    20000,
  );
  if (!target) return { shown: false };
  const session = await new Session(target.webSocketDebuggerUrl).open();
  await waitFor(async () => session.eval('Boolean(document.querySelector("button"))').catch(() => false));
  const summary = await session.eval('document.body.innerText');
  await session.eval(
    `(() => { const target = document.querySelector('button[data-decision="${decision}"]'); if (target) target.click(); return Boolean(target); })()`,
  );
  return { shown: true, summary };
}

async function openExtensionPage(browser, url) {
  const target = await browser.waitForTarget((candidate) => candidate.type === 'page' && candidate.url.includes(url));
  if (!target) return null;
  const session = await new Session(target.webSocketDebuggerUrl).open();
  const ready = await waitFor(async () =>
    session.eval('Boolean(globalThis.chrome && chrome.storage && chrome.storage.local)').catch(() => false),
  );
  return ready ? session : null;
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

    /*
     * The page says it is being recorded.
     *
     * The popup closes the moment you click into the page — which is the moment
     * the demonstration starts — so without this there is nothing on screen for
     * the whole of the part that matters.
     */
    check(
      await waitFor(async () => crm.eval(`Boolean(document.getElementById('liha-recording-indicator'))`)),
      'the page being recorded says so, on the page',
    );
    check(
      (await crm.eval(`(document.getElementById('liha-recording-indicator') || {}).shadowRoot`)) === null,
      'and it is out of the page\'s reach, in a closed shadow root',
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
    /*
     * Four steps, not five.
     *
     * Pressing Create raises a click and then the form's submit, and recording
     * both produced a tool that clicked Create — which closed the dialog — and
     * then looked for the same form to submit, by which point it was gone. The
     * two events are one action and are recorded as one.
     */
    check(
      actions.map((action) => action.kind).join(',') === 'click,fill,fill,submit',
      'a click on a submit button and the submit it causes are one step, not two',
      actions.map((action) => action.kind).join(','),
    );
    check(
      actions.at(-1)?.selector === "[data-testid='customer-form']",
      'and the step that survives is the submit, which still resolves after the click has landed',
      actions.at(-1)?.selector,
    );
    /*
     * The popup was open through all of that. It used to keep the count it was
     * rendered with and read "Stop recording (0)" over a take with actions in
     * it, which looks exactly like a recorder that is not working.
     */
    check(
      ((await popup.eval(`(document.querySelector('[data-action="toggle-recording"]') || {}).textContent`)) ?? '').includes(
        String(actions.length),
      ),
      'a popup left open through the take shows the count it has now',
      await popup.eval(`(document.querySelector('[data-action="toggle-recording"]') || {}).textContent`),
    );
    /*
     * Still on screen, and where it said it would be. The host element itself
     * has no size — everything it draws is fixed-position inside its shadow —
     * so what is asked here is what a person would see: is that the thing at
     * the bottom left corner.
     */
    check(
      (await crm.eval(
        `document.elementFromPoint(40, innerHeight - 30) === document.getElementById('liha-recording-indicator')`,
      )) === true,
      'and the indicator is still on the page, in the corner, out of the way',
    );
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
    // Waits for the reloaded app rather than sleeping at it: under load the
    // fixed pause was sometimes shorter than the reload, and the run then
    // failed looking for a Studio that was still mounting.
    must(
      await waitFor(async () => studio.eval(`document.querySelector('h1')?.textContent === 'Adapter Studio'`), 20000),
      'the Studio comes back after the language is pinned',
    );
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

    /*
     * A recording is a valid adapter the moment it is taken.
     *
     * The name and the description used to be placeholders — grey text that
     * looks exactly like a filled-in field — with "the tool name is empty"
     * underneath, so the reader could see the answer and the complaint at the
     * same time. They are real suggested values now, derived from what was
     * recorded, and the author edits them.
     */
    const suggested = await studio.eval(`document.querySelector('.panel__body input').value`);
    check(suggested === 'add_customer', 'the draft opens with a tool name taken from the workflow', suggested);
    check(
      ((await studio.eval(`document.querySelector('.panel__body textarea').value`)) ?? '').includes('Add customer'),
      'and with a description of what was recorded, not an example of one',
    );
    check(
      !(await studio.eval('document.body.innerText')).includes('not valid yet'),
      'so it is valid without the author having to retype the suggestion',
    );

    // Renaming it is still the author's call, and this is the name the rest of
    // the group is written against.
    await studio.eval(typeInto('.panel__body input', 'create_customer'));
    await sleep(200);
    await studio.eval(typeInto('.panel__body textarea', 'Create a customer by filling in the Add Customer form.'));
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
      return text.includes('resolved to exactly one element') ? text : null;
    }, 15000);
    must(Boolean(banner), 'the Studio can check its selectors against the open page');
    /*
     * Only what this page can be expected to have.
     *
     * The customer list has the Add Customer button and nothing else from the
     * workflow: the dialog's fields do not exist until it is pressed. Checking
     * all four selectors at once reported three of them as missing, on a
     * recording that had just been made successfully.
     */
    check(
      banner.includes('1 step') || banner.includes('1 ステップ'),
      'and it checks the one step this page can be expected to have, not all four',
      (banner.split('\n').find((line) => line.includes('resolved')) ?? '').slice(0, 120),
    );
    check(
      (await studio.eval(
        `[...document.querySelectorAll('.matches')].filter((badge) => badge.className.includes('matches--none')).length`,
      )) === 0,
      'so nothing on a working recording is reported as missing',
    );
    check(
      (await studio.eval(
        `[...document.querySelectorAll('.matches--later')].length`,
      )) >= 3,
      'the steps behind the dialog say they have not been reached yet',
    );
    const line = (banner ?? '').split('\n').find((entry) => entry.includes('resolved to exactly one element')) ?? '';
    check(/[1-9]\d* resolved to exactly one element/.test(line), 'the selectors it generated actually resolve', line);


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


    /*
     * Recording on a site with no adapter is reached through `activeTab`, which
     * Chrome grants only on a real click of the toolbar icon — not something a
     * headless run can produce. That path is checked by hand. Driving the
     * refusal from in here was tried and left the suite hanging on a page this
     * profile has no access to, so it is not left in: a check that stalls the
     * run is worse than one that is not there, and the behaviour it was after
     * is that `setRecording` returns an outcome rather than failing quietly,
     * which the popup now shows.
     */


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

    /* ------------------------------------------------- install and drive -- */
    /*
     * The rest of what a person does, in the order they do it.
     *
     * Everything above ends with a file. This is the other half of the loop:
     * the adapter goes into the extension, the site is reloaded, the tool shows
     * up in WebMCP, an agent outside the page calls it, and the site's own UI
     * moves. Then it is switched off and the tool goes away again. Each of
     * those was verified by hand and by nothing else.
     */
    group('The recorded adapter installs, registers, runs, and can be switched off');
    /*
     * A name of its own.
     *
     * This site already ships with a builtin adapter that has a
     * `create_customer`, and an earlier version of this group installed the
     * recorded one under the same name and then watched the builtin do the
     * work — it passed the parts about registering and driving the page, and
     * failed the one about a stranger's adapter asking before it writes,
     * because the tool that ran was not a stranger's.
     */
    await studio.eval(typeInto('.panel__body input', 'record_customer'));
    await sleep(400);
    await studio.eval(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Install locally')).click()`,
    );
    /*
     * The Studio is not a licence to skip the gate. Building an adapter and
     * installing one are different acts, and the second asks — with the origins
     * it wants and what each tool's steps actually do.
     */
    const installPrompt = await answerConfirmation(browser, 'allow');
    check(installPrompt.shown, 'installing it asks first, even from the Studio that built it');
    check(
      (installPrompt.summary ?? '').includes(`localhost:${PORT}`),
      'and the confirmation names the origin the adapter would reach',
      (installPrompt.summary ?? '').replace(/\s+/g, ' ').slice(0, 140),
    );
    must(
      await waitFor(async () => (await studio.eval('document.body.innerText')).includes('Installed')),
      'the Studio installs the adapter it just built',
    );

    const live = await browser.newPage();
    const announced = new Map();
    live.on((message) => {
      if (message.method === 'WebMCP.toolsAdded') {
        for (const tool of message.params.tools ?? []) announced.set(tool.name, tool);
      }
    });
    await live.send('WebMCP.enable');
    await live.goto(`http://localhost:${PORT}/`);
    const registeredTool = await waitFor(async () => announced.get('record_customer') ?? null, 20000);
    must(Boolean(registeredTool), 'reloading the site registers the recorded tool with WebMCP');

    const answers = [];
    live.on((message) => {
      if (message.method === 'WebMCP.toolResponded') answers.push(message.params);
    });
    const call = live.send('WebMCP.invokeTool', {
      frameId: registeredTool.frameId,
      toolName: 'record_customer',
      input: { name: 'Priya Raman', email: 'priya@example.com' },
    });
    /*
     * A recording is a stranger's adapter as far as the runtime is concerned —
     * the Studio is not a licence to skip the gate — so a WRITE asks first.
     */
    const prompt = await answerConfirmation(browser, 'allow');
    check(prompt.shown, 'and a WRITE built here still asks before it writes');
    check(
      (prompt.summary ?? '').includes('record_customer') && (prompt.summary ?? '').includes('Priya Raman'),
      'the confirmation names the tool and the values the agent supplied',
      (prompt.summary ?? '').replace(/\s+/g, ' ').slice(0, 140),
    );
    await call;
    must(Boolean(await waitFor(async () => answers[0] ?? null, 20000)), 'the call comes back');
    check(
      (await live.eval(`document.body.innerText.includes('priya@example.com')`)) === true,
      'and the site\'s own list has the customer in it — the UI was driven, not simulated',
    );

    const manage = await browser.newPage();
    await manage.goto(`chrome-extension://${extensionId}/manage/manage.html`);
    await waitFor(async () => manage.eval(`Boolean(document.querySelector('.card'))`));
    const switched = await manage.eval(
      `(() => {
         const card = [...document.querySelectorAll('.card')].find((c) => c.textContent.includes('localhost adapter'));
         const box = card && card.querySelector('input[type="checkbox"]');
         if (!box || !box.checked) return false;
         box.click();
         return true;
       })()`,
    );
    must(switched === true, 'the Adapters page offers the switch that turns it off');
    await sleep(600);
    announced.clear();
    await live.goto(`http://localhost:${PORT}/`);
    await sleep(2500);
    check(
      !announced.has('record_customer'),
      'and with it off, the tool is gone from the page an agent can see',
      [...announced.keys()].join(','),
    );
    /*
     * And gone for good. Switching off is reversible and removing is not, so
     * they are different questions: does the tool stop being offered, and does
     * the adapter stop existing.
     */
    const removed = await manage.eval(
      `(() => {
         const card = [...document.querySelectorAll('.card')].find((c) => c.textContent.includes('localhost adapter'));
         const button = card && [...card.querySelectorAll('button')].find((b) => /remove/i.test(b.textContent));
         if (!button) return false;
         button.click();
         return true;
       })()`,
    );
    check(removed === true, 'and an adapter installed here can be removed, which a builtin cannot');
    await sleep(800);
    check(
      (await manage.eval(
        `[...document.querySelectorAll('.card')].some((c) => c.textContent.includes('localhost adapter'))`,
      )) === false,
      'after which it is not in the list any more',
    );
    manage.close();
    live.close();

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
