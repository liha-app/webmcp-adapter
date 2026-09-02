/**
 * Acceptance against what is actually deployed.
 *
 * The other three runners prove the system works where it was built. This one
 * proves it works where it is published, which is a different claim: secure
 * contexts, real certificates, real response headers, and the exact origins
 * the published adapters are scoped to.
 *
 * Origins come from packages/config/origins.json, so this cannot drift from
 * what the adapters and the extension manifest were built against.
 *
 *   pnpm acceptance:prod
 *   LIHA_EXTENSION=<unzipped release> pnpm acceptance:prod
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, findChromeBinary, sleep } from './chrome.mjs';

const root = process.cwd();
// Point LIHA_EXTENSION at an unzipped release artifact to check that what
// people download is what was tested, rather than only the local build.
const EXT = process.env.LIHA_EXTENSION ?? join(root, 'apps/extension/dist');
const { sites } = JSON.parse(readFileSync(join(root, 'packages/config/origins.json'), 'utf8'));
const production = (id) => sites[id].production;

let pass = 0;
let fail = 0;
function check(ok, label, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1;
  else fail += 1;
  return Boolean(ok);
}
function group(title) {
  console.log(`\n${title}`);
}

/** The policy docs/deployment.md promises. Deployed, or it is not true. */
const REQUIRED_HEADERS = {
  'content-security-policy': "script-src 'self'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'cross-origin-opener-policy': 'same-origin',
};

async function fetchOrNull(url) {
  try {
    return await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch {
    return null;
  }
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

async function waitFor(probe, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await probe();
    if (value) return value;
    await sleep(200);
  }
  return null;
}

async function invoke(page, watch, toolName, input = {}) {
  const tool = await waitFor(async () => watch.tools.get(toolName));
  if (!tool) throw new Error(`${toolName} was never announced to the agent`);
  const before = watch.events.filter((event) => event.method === 'WebMCP.toolResponded').length;
  await page.send('WebMCP.invokeTool', { frameId: tool.frameId, toolName, input });
  await waitFor(
    async () => watch.events.filter((event) => event.method === 'WebMCP.toolResponded').length > before,
    30000,
  );
  const last = [...watch.events].reverse().find((event) => event.method === 'WebMCP.toolResponded');
  return (last?.params?.output?.content ?? []).map((part) => part.text ?? '').join('\n');
}

async function main() {
  if (!existsSync(join(EXT, 'manifest.json'))) throw new Error('Extension is not built. Run `pnpm build`.');

  group('Every deployed origin serves the policy it documents');
  for (const id of Object.keys(sites)) {
    const url = `${production(id)}/`;
    const response = await fetchOrNull(url);
    if (!check(response?.ok === true, `${id} answers 200 over HTTPS`, response ? String(response.status) : 'no answer')) {
      continue;
    }
    for (const [header, expected] of Object.entries(REQUIRED_HEADERS)) {
      const got = response.headers.get(header) ?? '';
      check(got.includes(expected), `${id} sets ${header}`, got.slice(0, 48));
    }
  }
  // Deep routes exist only in the app, so a 200 here proves the SPA fallback.
  for (const [id, path] of [['registry', '/adapters/demo-project'], ['demo-shop', '/cart']]) {
    const response = await fetchOrNull(production(id) + path);
    check(response?.ok === true, `${id} serves ${path} through the SPA fallback`);
  }

  const browser = new Browser({ binary: findChromeBinary(), extensionPath: EXT }).launch();
  try {
    await browser.ready();
    const page = await browser.firstPage();
    const watch = trackWebMcpTools(page);
    await page.send('WebMCP.enable');

    group('The portal implements WebMCP itself, on its production origin');
    await page.send('Page.navigate', { url: `${production('registry')}/` });
    await sleep(4000);
    check(await page.eval('window.isSecureContext') === true, 'the production origin is a secure context');
    const registered = await waitFor(async () =>
      page.eval(`document.modelContext.getTools().then(t => t.map(x => x.name).sort().join(','))`),
    );
    check(
      registered === 'get_adapter,get_adapter_permissions,get_demo_info,install_adapter,list_adapter_tools,probe_selectors,search_adapters,validate_adapter',
      'the portal registers its eight native tools',
      registered,
    );
    const info = await page.eval(`(async () => {
      const list = await document.modelContext.getTools();
      return await document.modelContext.executeTool(list.find(t => t.name === 'get_demo_info'), '{}');
    })()`);
    const text = (JSON.parse(info ?? 'null')?.content ?? []).map((part) => part.text).join('');
    for (const id of ['demo-crm', 'demo-shop', 'demo-project']) {
      check(text.includes(production(id)), `it points an agent at the deployed ${id}`);
    }

    group('An adapter drives the deployed Acme CRM, which implements nothing');
    await page.send('Page.navigate', { url: `${production('demo-crm')}/` });
    await sleep(3000);
    check(
      await waitFor(async () => (await page.eval('typeof globalThis.__LIHA_WEBMCP_ADAPTER__')) === 'object'),
      'the extension injected the runtime into the deployed page',
      'if this fails the browser probably ignored --load-extension',
    );
    check(
      await waitFor(async () =>
        ['search_customers', 'create_customer', 'update_customer'].every((name) => watch.tools.has(name)),
      ),
      'an out-of-page agent is offered the adapter’s tools',
      [...watch.tools.keys()].join(', '),
    );
    const found = await invoke(page, watch, 'search_customers', { query: 'Jordan' });
    check(found.includes('Jordan Reyes'), 'search_customers returns real records from the deployed app');
    const created = await invoke(page, watch, 'create_customer', { name: 'Alice Smith', email: 'alice@example.com' });
    check(created.includes('Alice Smith'), 'create_customer drove the deployed site’s own form');
    check(/customer_id: c-\d+/.test(created), 'the deployed app assigned the record its own id', created.replace(/\n/g, ' ').slice(0, 80));

    group('The other two adapters register on their own production origins');
    for (const [id, tool, input] of [
      ['demo-project', 'list_tasks', { query: '' }],
      ['demo-shop', 'search_products', { query: 'cable' }],
    ]) {
      await page.send('Page.navigate', { url: `${production(id)}/` });
      await sleep(3000);
      check(await waitFor(async () => watch.tools.has(tool)), `${id} announces ${tool}`);
      const output = await invoke(page, watch, tool, input);
      check(output.trim().length > 0, `${tool} answers from the deployed app`, output.split('\n')[0]);
    }
  } finally {
    browser.close();
  }

  console.log(`\n${'='.repeat(70)}\n${pass}/${pass + fail} checks passed`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nStopped: ${error.message}`);
  process.exitCode = 1;
});
