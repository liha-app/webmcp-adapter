#!/usr/bin/env node
/**
 * Full-system acceptance run.
 *
 * Everything is observed through the DevTools `WebMCP` domain — the same
 * out-of-page surface a WebMCP agent or Tool Inspector uses. A tool that only
 * exists "internally" fails here, which is the entire point.
 *
 * Covers: all three demo adapters end to end, the registry's own native WebMCP
 * tools, and the confirmation gate for destructive calls.
 *
 * Run with:  pnpm build && pnpm acceptance:full
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, Session, findChromeBinary, findExtensionId, sleep } from './chrome.mjs';
import { serveStatic } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXT_DIST = join(root, 'apps/extension/dist');

const SITES = [
  { id: 'demo-crm', port: 5273, dist: 'apps/demo-crm/dist', marker: 'Acme CRM' },
  { id: 'demo-shop', port: 5274, dist: 'apps/demo-shop/dist', marker: 'Nimbus Supply' },
  { id: 'demo-project', port: 5275, dist: 'apps/demo-project/dist', marker: 'Kite Project Manager' },
  { id: 'registry', port: 5280, dist: 'apps/registry/dist', marker: 'Liha Adapter Registry' },
];

const results = [];
let current = null;

function group(title) {
  current = { title, checks: [] };
  results.push(current);
}

function check(ok, message, detail = '') {
  current.checks.push({ ok: Boolean(ok), message, detail: String(detail) });
  return Boolean(ok);
}

function must(ok, message, detail = '') {
  if (!check(ok, message, detail)) throw new Error(`${message}${detail ? ` — ${detail}` : ''}`);
}

function trackWebMcpTools(session) {
  const tools = new Map();
  const events = [];
  session.on((message) => {
    if (!message.method?.startsWith('WebMCP')) return;
    events.push({ method: message.method, params: message.params });
    if (message.method === 'WebMCP.toolsAdded') {
      for (const tool of message.params.tools ?? []) tools.set(tool.name, tool);
    } else if (message.method === 'WebMCP.toolsRemoved') {
      for (const name of message.params.names ?? []) tools.delete(name);
    }
  });
  return { tools, events };
}

async function waitFor(probe, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await probe();
    if (value) return value;
    await sleep(150);
  }
  return null;
}

async function invoke(page, watch, toolName, input = {}) {
  const tool = await waitFor(async () => watch.tools.get(toolName));
  if (!tool) throw new Error(`tool ${toolName} was never announced to the agent`);
  const before = watch.events.filter((event) => event.method === 'WebMCP.toolResponded').length;
  await page.send('WebMCP.invokeTool', { frameId: tool.frameId, toolName, input });
  const responded = await waitFor(
    async () => watch.events.filter((event) => event.method === 'WebMCP.toolResponded').length > before,
    25000,
  );
  if (!responded) throw new Error(`${toolName} never responded`);
  const last = [...watch.events].reverse().find((event) => event.method === 'WebMCP.toolResponded');
  return last?.params?.output ?? null;
}

function outputText(output) {
  if (!output) return '';
  const content = output.content ?? [];
  return content.map((part) => part.text ?? '').join('\n');
}

/**
 * Runs an action that is expected to raise the extension's confirmation window,
 * then answers it. This is the gate that protects a user from a destructive
 * tool, so the test drives the real window rather than stubbing it out.
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
  // Selected by what the button decides, not by what it says. Matching the
  // English label worked until the window could render in another language,
  // and then the allow click silently missed and the next group inherited a
  // dialog that was still open.
  await session.eval(
    `(() => {
       const target = document.querySelector('button[data-decision="${decision}"]');
       if (target) target.click();
       return Boolean(target);
     })()`,
  );
  session.close();
  return { shown: true, summary };
}

/** Writes the extension's language preference before anything renders. */
async function setExtensionLocale(browser, locale) {
  const id = await findExtensionId(browser);
  if (!id) return;
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${id}/manage/manage.html`);
  await page.eval(`chrome.storage.local.set({ 'liha/locale': ${JSON.stringify(locale)} })`);
  page.close();
}

async function main() {
  for (const site of SITES) {
    if (!existsSync(join(root, site.dist))) throw new Error(`Missing build for ${site.id}. Run \`pnpm build\` first.`);
  }
  if (!existsSync(join(EXT_DIST, 'manifest.json'))) throw new Error('Extension is not built. Run `pnpm build`.');

  const binary = findChromeBinary();
  const servers = [];
  for (const site of SITES) {
    try {
      servers.push(await serveStatic(join(root, site.dist), site.port));
    } catch (error) {
      throw new Error(`Could not serve ${site.id} on port ${site.port} (${error.code ?? error.message}).`);
    }
    const html = await fetch(`http://localhost:${site.port}/`).then((response) => response.text());
    if (!html.includes(site.marker) && !html.includes('<div id="root">')) {
      throw new Error(`Port ${site.port} is not serving ${site.id}.`);
    }
  }

  const browser = new Browser({ binary, extensionPath: EXT_DIST }).launch();
  try {
    await browser.ready();
    // These checks read English copy, so the extension's language is pinned
    // rather than inherited from whatever locale this machine's browser is in.
    await setExtensionLocale(browser, 'en');
    const page = await browser.firstPage();
    const watch = trackWebMcpTools(page);
    await page.send('WebMCP.enable');

    /* ------------------------------------------------------------- CRM --- */
    group('Demo CRM adapter, driven by an out-of-page agent');
    await page.goto('http://localhost:5273/');
    must(
      await waitFor(async () => (await page.eval('typeof globalThis.__LIHA_WEBMCP_ADAPTER__')) === 'object'),
      'the adapter runtime is injected into the page MAIN world',
      'if this fails the browser probably ignored --load-extension (branded Google Chrome does)',
    );
    must(
      await waitFor(async () => ['search_customers', 'create_customer', 'update_customer'].every((n) => watch.tools.has(n))),
      'all three CRM tools are announced to the agent',
      [...watch.tools.keys()].join(', '),
    );
    const searchOut = await invoke(page, watch, 'search_customers', { query: 'Jordan' });
    check(outputText(searchOut).includes('Jordan Reyes'), 'search_customers returns matching records');
    // An earlier search left a filter on the list, which is exactly the state
    // in which a create tool that reads "the last row" reports the wrong record.
    const createOut = await invoke(page, watch, 'create_customer', {
      name: 'Alice Smith',
      email: 'alice@example.com',
    });
    check(
      outputText(createOut).includes('Alice Smith'),
      'create_customer reports the record it created, not whatever row was last',
      outputText(createOut),
    );
    check(
      /customer_id: c-\d+/.test(outputText(createOut)),
      'the CRM assigned the new record its own id',
      outputText(createOut),
    );
    const foundAlice = await invoke(page, watch, 'search_customers', { query: 'alice@example.com' });
    check(outputText(foundAlice).includes('Alice Smith'), 'the created record is findable afterwards');
    const updateOut = await invoke(page, watch, 'update_customer', {
      email: 'alice@example.com',
      name: 'Alice Chen',
    });
    check(outputText(updateOut).includes('Alice Chen'), 'update_customer renamed the record it located by email');

    /* ------------------------------------------------------------ Shop --- */
    group('Demo Shop adapter (search, cart, coupon, same-origin navigation)');
    watch.tools.clear();
    await page.goto('http://localhost:5274/');
    must(
      await waitFor(async () => ['search_products', 'add_to_cart', 'apply_coupon', 'view_cart'].every((n) => watch.tools.has(n))),
      'all four shop tools are announced to the agent',
      [...watch.tools.keys()].join(', '),
    );
    const products = await invoke(page, watch, 'search_products', { query: 'lighting' });
    check(outputText(products).includes('Aurora Desk Lamp'), 'search_products finds products by category');
    await invoke(page, watch, 'add_to_cart', { product: 'Nimbus Standing Desk' });
    check(
      (await page.eval('document.querySelector("[data-testid=\\"cart-count\\"]").textContent')) === '1',
      'add_to_cart put exactly one item in the cart',
    );
    const ambiguous = await invoke(page, watch, 'add_to_cart', { product: 'lighting' });
    check(
      outputText(ambiguous).includes('failed') || ambiguous?.isError === true,
      'add_to_cart refuses an ambiguous product instead of guessing',
      outputText(ambiguous),
    );
    check(
      (await page.eval('document.querySelector("[data-testid=\\"cart-count\\"]").textContent')) === '1',
      'the refused call changed nothing',
    );
    const coupon = await invoke(page, watch, 'apply_coupon', { code: 'SAVE10' });
    check(outputText(coupon).includes('SAVE10 applied'), 'apply_coupon applied the discount', outputText(coupon));
    check(
      (await page.eval('location.pathname')) === '/cart',
      'the navigate step moved to the cart route without losing the tool call',
    );

    /* --------------------------------------------------------- Project --- */
    group('Demo Project adapter and the destructive confirmation gate');
    watch.tools.clear();
    await page.goto('http://localhost:5275/');
    must(
      await waitFor(async () => watch.tools.has('delete_task') && watch.tools.has('create_task')),
      'the project tools are announced to the agent',
      [...watch.tools.keys()].join(', '),
    );
    await invoke(page, watch, 'create_task', { title: 'Ship the adapter', assignee: 'Priya Nair' });
    check(
      (await page.eval('document.body.innerText')).includes('Ship the adapter'),
      'create_task submitted the real form',
    );
    await invoke(page, watch, 'assign_task', { title: 'Migrate billing', assignee: 'Priya Nair' });
    const assigned = await page.eval(
      `document.querySelector('[data-task-id="t-202"] select[data-action="assign"]').value`,
    );
    check(assigned === 'Priya Nair', 'assign_task changed the assignee through the real select', assigned);
    await invoke(page, watch, 'change_task_status', { title: 'Draft launch', status: 'done' });
    check(
      (await page.eval(`document.querySelector('[data-task-id="t-201"]').getAttribute('data-status')`)) === 'done',
      'change_task_status moved the task',
    );

    // A destructive call must not proceed on the agent's say-so alone.
    const deniedTool = await waitFor(async () => watch.tools.get('delete_task'));
    const deniedInvocation = page.send('WebMCP.invokeTool', {
      frameId: deniedTool.frameId,
      toolName: 'delete_task',
      input: { title: 'Audit vendor' },
    });
    const denial = await answerConfirmation(browser, 'deny');
    must(denial.shown, 'a confirmation window appears before a DESTRUCTIVE tool runs');
    check(
      /DESTRUCTIVE|deletes data/i.test(denial.summary ?? ''),
      'the confirmation names the capability and what it will do',
      (denial.summary ?? '').split('\n').slice(0, 3).join(' | '),
    );
    check(
      (denial.summary ?? '').includes('Audit vendor'),
      'the confirmation shows the values the agent supplied',
    );
    await deniedInvocation.catch(() => undefined);
    await sleep(800);
    // Verified through the app's own read tool rather than the visible DOM,
    // which an earlier call may have left filtered.
    const stillThere = await invoke(page, watch, 'list_tasks', { query: 'Audit vendor' });
    check(
      outputText(stillThere).includes('Audit vendor contracts'),
      'declining the confirmation leaves the task untouched',
      outputText(stillThere),
    );

    const allowTool = await waitFor(async () => watch.tools.get('delete_task'));
    const allowedInvocation = page.send('WebMCP.invokeTool', {
      frameId: allowTool.frameId,
      toolName: 'delete_task',
      input: { title: 'Audit vendor' },
    });
    const approval = await answerConfirmation(browser, 'allow');
    must(approval.shown, 'the confirmation window appears again for the second attempt');
    await allowedInvocation.catch(() => undefined);
    const gone = await waitFor(async () => {
      const listed = await invoke(page, watch, 'list_tasks', { query: 'Audit vendor' });
      return !outputText(listed).includes('Audit vendor contracts');
    }, 20000);
    check(Boolean(gone), 'approving the confirmation lets the deletion through');

    /* -------------------------------------------------------- Registry --- */
    group('The portal implements WebMCP itself, with no adapter involved');
    watch.tools.clear();
    await page.goto('http://localhost:5280/');
    const registryTools = [
      'search_adapters',
      'get_adapter',
      'list_adapter_tools',
      'get_adapter_permissions',
      'validate_adapter',
      'get_demo_info',
      'probe_selectors',
      'install_adapter',
    ];
    must(
      await waitFor(async () => registryTools.every((name) => watch.tools.has(name))),
      `the registry registers its own ${registryTools.length} tools`,
      [...watch.tools.keys()].join(', '),
    );
    check(
      (await page.eval('typeof globalThis.__LIHA_WEBMCP_ADAPTER__')) === 'undefined',
      'no adapter runtime is present — these are native WebMCP tools',
    );
    const found = await invoke(page, watch, 'search_adapters', { category: 'crm', capability: 'WRITE' });
    check(outputText(found).includes('demo-crm'), 'search_adapters answers "a CRM adapter with write access"');
    const permissions = await invoke(page, watch, 'get_adapter_permissions', { id: 'demo-project' });
    check(
      outputText(permissions).includes('delete_task') && outputText(permissions).includes('DESTRUCTIVE'),
      'get_adapter_permissions discloses the destructive tool',
    );
    const bad = await invoke(page, watch, 'validate_adapter', {
      adapter: JSON.stringify({ id: 'x', name: 'x', version: '1.0.0', origins: ['*://*/*'], tools: [] }),
    });
    check(outputText(bad).includes('Not valid'), 'validate_adapter rejects a wildcard origin', outputText(bad));
    const listed = await invoke(page, watch, 'list_adapter_tools', { id: 'demo-shop' });
    check(outputText(listed).includes('apply_coupon'), 'list_adapter_tools returns the tool list with schemas');
    const demoInfo = await invoke(page, watch, 'get_demo_info', {});
    check(
      outputText(demoInfo).includes('enable-webmcp-testing') && outputText(demoInfo).includes('demo-project'),
      'get_demo_info tells an agent what to try and what must be switched on first',
      outputText(demoInfo).slice(0, 160),
    );
    check(
      outputText(demoInfo).includes('localhost:5273'),
      'get_demo_info resolves demo URLs for wherever the portal is served from',
    );

    /* --------------------------------------------- agent-authored adapter -- */
    /*
     * The loop this project is actually arguing for: an agent writes an adapter
     * for a site nobody has adapted, checks its own selectors rather than
     * guessing at them, hands the definition over, and a person — not the agent
     * — decides whether it is installed.
     *
     * The site used here has no adapter of its own in this run: the tool is
     * being taught from scratch, and the only thing that makes it exist
     * afterwards is the JSON the agent wrote.
     */
    group('An agent can write an adapter, check it, and ask for it to be installed');
    const shopTab = await browser.newPage();
    await shopTab.goto('http://localhost:5274/');
    await sleep(600);

    const probed = await invoke(page, watch, 'probe_selectors', {
      origin: 'http://localhost:5274',
      selectors: "[data-testid='product-search']\n[data-action='view-products']\n[data-testid='nope']\nli",
    });
    const probeText = outputText(probed);
    check(probeText.includes("[data-testid='product-search'] → usable"), 'probe_selectors confirms a good selector', probeText.replace(/\n/g, ' | ').slice(0, 200));
    check(probeText.includes("[data-testid='nope'] → no match"), 'and reports one that matches nothing');
    check(/li → ambiguous \(\d+ matches\)/.test(probeText), 'and one that is ambiguous, which the runtime would refuse');
    check(
      !/Wireless|Keyboard|\$|USD/i.test(probeText),
      'it returns counts and no page content — an agent cannot read the page with it',
      probeText.replace(/\n/g, ' | ').slice(0, 200),
    );

    // Written the way an agent would: only selectors it just checked.
    const authored = {
      id: 'agent-authored-shop',
      name: 'Nimbus Supply search',
      version: '1.0.0',
      description: 'Search the Nimbus Supply catalogue by keyword.',
      origins: ['http://localhost:5274'],
      tools: [
        {
          name: 'find_products',
          description: 'Search the catalogue by keyword and return the matching product names.',
          capability: 'READ',
          inputSchema: {
            type: 'object',
            properties: { keyword: { type: 'string', description: 'Search text' } },
            required: ['keyword'],
          },
          steps: [
            { type: 'click', selector: "[data-action='view-products']" },
            { type: 'fill', selector: "[data-testid='product-search']", value: '{{keyword}}' },
            { type: 'waitFor', selector: "[data-testid='product-list']" },
            { type: 'readList', selector: "[data-testid='product-list'] [data-field='name']", as: 'products' },
          ],
        },
      ],
    };

    const rejected = await invoke(page, watch, 'install_adapter', {
      adapter: JSON.stringify({ ...authored, origins: ['https://*.example.com'] }),
    });
    check(
      outputText(rejected).includes('not valid') && outputText(rejected).includes('wildcard'),
      'install_adapter refuses a wildcard origin without troubling anyone',
      outputText(rejected).replace(/\n/g, ' | ').slice(0, 160),
    );

    const askedFor = page.send('WebMCP.invokeTool', {
      frameId: watch.tools.get('install_adapter').frameId,
      toolName: 'install_adapter',
      input: { adapter: JSON.stringify(authored) },
    });
    const agentPrompt = await answerConfirmation(browser, 'allow');
    must(agentPrompt.shown, 'an agent cannot install an adapter without user confirmation either');
    check(
      (agentPrompt.summary ?? '').includes('localhost:5274'),
      'the confirmation names the origin the agent asked for',
      (agentPrompt.summary ?? '').split('\n').slice(0, 3).join(' | '),
    );
    await askedFor.catch(() => undefined);
    const installedText = await waitFor(async () => {
      const last = [...watch.events].reverse().find((event) => event.method === 'WebMCP.toolResponded');
      const text = outputText(last?.params?.output);
      return text.includes('Installed') ? text : null;
    }, 20000);
    must(Boolean(installedText), 'approving it installs the adapter the agent wrote');

    // The real question: does the tool the agent invented actually work?
    watch.tools.clear();
    await shopTab.close?.();
    await page.goto('http://localhost:5274/');
    const authoredTool = await waitFor(async () => watch.tools.get('find_products'), 20000);
    must(Boolean(authoredTool), 'reloading the site registers the tool the agent wrote, with no recording involved');
    const answer = await invoke(page, watch, 'find_products', { keyword: 'cable' });
    check(
      outputText(answer).toLowerCase().includes('cable'),
      'and calling it drives the site and answers from the real catalogue',
      outputText(answer).slice(0, 160),
    );

    /* ----------------------------------------------------- Store install -- */
    group('Installing from the Store shows the permission summary first');
    await page.goto('http://localhost:5280/adapters/demo-project');
    must(
      await waitFor(async () => page.eval(`Boolean(document.querySelector('[data-action="install-adapter"]'))`)),
      'the adapter detail page rendered',
    );
    await page.eval(`document.querySelector('[data-action="install-adapter"]').click()`);
    const installPrompt = await answerConfirmation(browser, 'deny');
    must(installPrompt.shown, 'a web page cannot install an adapter without user confirmation');
    const summary = installPrompt.summary ?? '';
    check(summary.includes('localhost:5275'), 'the install prompt names the exact origins', summary.slice(0, 120));
    check(summary.includes('DESTRUCTIVE'), 'the install prompt lists the capabilities being granted');
    check(summary.includes('Requested by http://localhost:5280'), 'the install prompt names the page that asked');

    /* ----------------------------------------------------- diagnostics ---- */
    group('Compatibility diagnostics report what this browser can really do');
    const extensionId = await findExtensionId(browser);
    must(Boolean(extensionId), 'the extension service worker is running');
    await page.goto('http://localhost:5273/');
    const diag = await browser.newPage();
    await diag.goto(`chrome-extension://${extensionId}/diagnostics/diagnostics.html`);
    const diagText = await waitFor(async () => {
      const text = await diag.eval('document.body.innerText');
      return /capabilities/i.test(text) ? text : null;
    }, 15000);
    must(Boolean(diagText), 'the diagnostics page renders');
    check(/Detected browser engine: chrome/.test(diagText), 'it identifies the engine', diagText.split('\n')[1]);
    check(diagText.includes('Fully supported'), 'it reports Chrome as fully supported', diagText.split('\n')[2]);
    check(
      !/\bNO\b/.test(diagText),
      'no capability is reported as missing in this browser',
      diagText.replace(/\n+/g, ' | ').slice(0, 240),
    );
    check(
      /WebMCP in this browser[\s\S]*?YES/.test(diagText),
      'it answers the browser-level question, which needs no page at all',
      diagText.replace(/\n+/g, ' | ').slice(0, 240),
    );
    check(
      diagText.includes('localhost:5273'),
      'it names the page it actually probed rather than guessing',
      diagText.replace(/\n+/g, ' | ').slice(0, 240),
    );
    diag.close();
  } finally {
    browser?.close?.();
  }

  /* ------------------------------------------- the same browser, no API --- */
  /*
   * Everything above runs in a browser that has WebMCP. What someone actually
   * installing this hits first is the browser that does not: in branded Chrome
   * `document.modelContext` is undefined until chrome://flags/#enable-webmcp-testing
   * is switched on, and the extension's whole promise is that it says so rather
   * than shimming a fake modelContext an agent could never reach.
   *
   * That claim went untested until someone hit it for real. It could not have
   * been tested before, either: `webmcp: false` did not disable anything.
   */
  const degraded = new Browser({ binary, extensionPath: EXT_DIST, webmcp: false }).launch();
  try {
    await degraded.ready();
    // A separate browser with a separate profile, so it needs the same pin.
    await setExtensionLocale(degraded, 'en');
    group('Without the browser flag, the extension says so instead of faking it');
    const degradedId = await findExtensionId(degraded);
    must(Boolean(degradedId), 'the extension still loads without WebMCP');

    const site = await degraded.newPage();
    await site.goto('http://localhost:5273/');
    check(
      (await site.eval('typeof document.modelContext')) === 'undefined',
      'the browser really has no WebMCP to find',
    );
    check(
      (await site.eval("typeof document.modelContext === 'object'")) === false,
      'and the injected runtime did not install one of its own',
    );

    const diag = await degraded.newPage();
    await diag.goto(`chrome-extension://${degradedId}/diagnostics/diagnostics.html`);
    const text = await waitFor(async () => {
      const body = await diag.eval('document.body.innerText');
      return /capabilities/i.test(body) ? body : null;
    }, 15000);
    must(Boolean(text), 'the diagnostics page renders');
    check(text.includes('WebMCP is not switched on'), 'it names the cause', text.split('\n')[2]);
    check(
      text.includes('chrome://flags/#enable-webmcp-testing'),
      'and tells the reader the one thing that fixes it',
    );
    check(
      !text.includes('Fully supported'),
      'it does not call the browser supported when tools cannot register',
    );
    check(
      /MAIN world injection[\s\S]*?YES/.test(text),
      'while still reporting the parts that do work, so the reader can tell them apart',
    );
    diag.close();

    /*
     * And the popup, with no adapter page open at all — which is the state the
     * bug lived in. The background only reads the injected runtime where an
     * installed adapter matches the origin, so anywhere else the popup had no
     * runtime to ask, said "unknown (runtime not loaded on this page)" and
     * never mentioned the flag. The browser-level answer does not need a tab.
     */
    const popup = await degraded.newPage();
    await popup.goto(`chrome-extension://${degradedId}/popup/popup.html`);
    const popupText = await waitFor(async () => {
      // Waits on the element the status list renders into, not on a word: the
      // header contains "WebMCP" while the panel still says "Loading…", and
      // matching a label meant this broke the moment one was reworded.
      const ready = await popup.eval(`Boolean(document.querySelector('.kv'))`);
      return ready ? await popup.eval('document.body.innerText') : null;
    }, 15000);
    must(Boolean(popupText), 'the popup renders');
    check(
      popupText.includes('not available in this browser'),
      'the popup names the cause with no adapter page open',
      popupText.replace(/\n+/g, ' | ').slice(0, 160),
    );
    check(
      popupText.includes('chrome://flags/#enable-webmcp-testing'),
      'and hands over the flag, which cannot be a link from an extension page',
    );
    popup.close();
  } finally {
    degraded?.close?.();
    for (const server of servers) await server.close();
  }
}

let failure = null;
try {
  await main();
} catch (error) {
  failure = error;
}

console.log('\nFull system acceptance\n' + '='.repeat(70));
let passedChecks = 0;
let totalChecks = 0;
for (const item of results) {
  const ok = item.checks.length > 0 && item.checks.every((entry) => entry.ok);
  console.log(`${ok ? ' PASS ' : ' FAIL '} ${item.title}`);
  for (const entry of item.checks) {
    totalChecks++;
    if (entry.ok) passedChecks++;
    console.log(`        ${entry.ok ? '✓' : '✗'} ${entry.message}${entry.ok || !entry.detail ? '' : `\n            ${entry.detail}`}`);
  }
}
console.log('='.repeat(70));
console.log(`${passedChecks}/${totalChecks} checks passed`);
if (failure) {
  console.error(`\nStopped in "${current?.title}": ${failure.message}`);
  process.exit(1);
}
if (passedChecks < totalChecks) process.exit(1);
