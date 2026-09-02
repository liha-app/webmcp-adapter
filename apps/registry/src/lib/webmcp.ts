import { detectModelContext, errorResult, textResult, type ToolResult } from '@liha/adapter-runtime';
import { validateAdapter, type Capability } from '@liha/adapter-schema';
import { extensionPresent, requestInstall, requestProbe } from './extension';
import { CATALOG, findEntry, searchCatalog } from './catalog';
import { SETUP_STEPS, demoApps } from './demos';
// Tool output is read by models and asserted by the acceptance suite, so it
// stays in one language regardless of what the visitor picked for the UI.
import { en } from '../i18n/en';

/*
 * Checked before either tool waits on the extension. requestInstall gives a
 * person three minutes to answer a dialog, which is right when there is a
 * dialog and useless when there is no extension to show one — an agent would
 * sit there with nothing to read.
 */
const MISSING_EXTENSION =
  'The Liha extension is not installed in this browser, so there is nothing to install into. ' +
  'It is at https://github.com/liha-app/webmcp-adapter/releases/latest.';

/**
 * The registry practises what it sells: it implements WebMCP itself, natively,
 * with `document.modelContext.registerTool`. No adapter is involved here — this
 * is what a site does when its own developers ship WebMCP, and it is the
 * contrast the whole project is arguing about.
 */
function summary(id: string) {
  const entry = findEntry(id);
  if (!entry) return null;
  return {
    id: entry.adapter.id,
    name: entry.adapter.name,
    version: entry.adapter.version,
    description: entry.adapter.description ?? '',
    category: entry.adapter.category ?? 'other',
    origins: entry.adapter.origins,
    verifiedAt: entry.adapter.verifiedAt ?? null,
    toolCount: entry.toolCount,
    capabilities: entry.capabilities,
    maxCapability: entry.maxCapability,
    source: entry.sourcePath,
  };
}

export interface WebMcpStatus {
  supported: boolean;
  registered: string[];
}

export interface RegistryTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Async because two of these wait on the extension, and one on a person. */
  execute: (input: Record<string, unknown>) => ToolResult | Promise<ToolResult>;
  /** Prefilled so a visitor can run it once without typing anything. */
  example: Record<string, string>;
}

/**
 * The tools this page provides.
 *
 * Exported rather than built inside the registration call so the page can run
 * exactly the same functions a visitor's agent would — the "call it yourself"
 * panel is not a re-implementation that could drift from what agents get.
 */
export const REGISTRY_TOOLS: RegistryTool[] = [
    {
      name: 'search_adapters',
      example: { capability: 'WRITE' },
      description:
        'Search the Liha adapter registry. Filter by free text, by category, or by the capability its tools declare (READ, INTERACT, WRITE, DESTRUCTIVE).',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free text matched against name, description, tools and origins' },
          category: { type: 'string', description: 'crm, commerce, productivity, developer-tools, registry or other' },
          capability: { type: 'string', description: 'READ, INTERACT, WRITE or DESTRUCTIVE' },
        },
      },
      execute: (input) => {
        const results = searchCatalog({
          query: typeof input.query === 'string' ? input.query : '',
          category: typeof input.category === 'string' ? input.category : 'all',
          capability: typeof input.capability === 'string' ? input.capability.toUpperCase() : 'all',
        }).map((entry) => summary(entry.adapter.id));
        return textResult(
          results.length === 0 ? 'No adapters matched.' : `${results.length} adapter(s):\n${JSON.stringify(results, null, 2)}`,
          { adapters: results },
        );
      },
    },
    {
      name: 'get_adapter',
      example: { id: 'demo-crm' },
      description: 'Get the full published definition of one adapter, including every step it would run.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The adapter id, for example demo-crm' } },
        required: ['id'],
      },
      execute: (input) => {
        const entry = findEntry(String(input.id ?? ''));
        if (!entry) return errorResult(`No adapter with id "${String(input.id)}".`);
        return textResult(JSON.stringify(entry.adapter, null, 2), { adapter: entry.adapter });
      },
    },
    {
      name: 'list_adapter_tools',
      example: { id: 'demo-shop' },
      description: 'List the tools an adapter provides, with their capability classification and input schema.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The adapter id' } },
        required: ['id'],
      },
      execute: (input) => {
        const entry = findEntry(String(input.id ?? ''));
        if (!entry) return errorResult(`No adapter with id "${String(input.id)}".`);
        const tools = entry.adapter.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          capability: tool.capability,
          inputSchema: tool.inputSchema,
          stepCount: tool.steps.length,
        }));
        return textResult(JSON.stringify(tools, null, 2), { tools });
      },
    },
    {
      name: 'get_adapter_permissions',
      example: { id: 'demo-project' },
      description:
        'Explain exactly what an adapter is allowed to do: the origins it is scoped to and the capability of each tool.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The adapter id' } },
        required: ['id'],
      },
      execute: (input) => {
        const entry = findEntry(String(input.id ?? ''));
        if (!entry) return errorResult(`No adapter with id "${String(input.id)}".`);
        const permissions = {
          id: entry.adapter.id,
          origins: entry.adapter.origins,
          maxCapability: entry.maxCapability,
          tools: entry.adapter.tools.map((tool) => ({ name: tool.name, capability: tool.capability })),
          destructiveTools: entry.adapter.tools
            .filter((tool) => tool.capability === 'DESTRUCTIVE')
            .map((tool) => tool.name),
          notes: [
            'Adapters run only on the exact origins listed above.',
            'DESTRUCTIVE tools always ask the user before running.',
            'Adapters cannot contain JavaScript; every step is declarative data.',
          ],
        };
        return textResult(JSON.stringify(permissions, null, 2), permissions as unknown as Record<string, unknown>);
      },
    },
    {
      // Added for the portal: an agent arriving here should be able to find out
      // what it can try and what has to be switched on first, without a person
      // reading the page to it.
      name: 'get_demo_info',
      example: {},
      description:
        'Describe the demo websites this project provides, the tools each adapter adds to them, and what a browser needs before the tools will work.',
      inputSchema: {
        type: 'object',
        properties: {
          demo: { type: 'string', description: 'Optional demo id: demo-crm, demo-shop or demo-project' },
        },
      },
      execute: (input) => {
        const wanted = typeof input.demo === 'string' ? input.demo : '';
        const origin = typeof location !== 'undefined' ? location.origin : undefined;
        const all = demoApps(origin);
        const demos = wanted ? all.filter((demo) => demo.id === wanted) : all;
        if (demos.length === 0) {
          return errorResult(`No demo with id "${wanted}". Known demos: ${all.map((demo) => demo.id).join(', ')}.`);
        }
        const payload = {
          demos: demos.map((demo) => ({
            id: demo.id,
            name: demo.name,
            url: demo.url,
            adapter: demo.adapterId,
            note: demo.noteKey ? en[demo.noteKey] : null,
            tools: demo.tools,
          })),
          requirements: SETUP_STEPS.map((step) =>
            step.code ? `${en[step.key]} (${step.code})` : en[step.key],
          ),
          note: 'These sites implement no WebMCP themselves. Their tools come from adapters installed in the browser.',
        };
        return textResult(JSON.stringify(payload, null, 2), payload as unknown as Record<string, unknown>);
      },
    },
    {
      name: 'validate_adapter',
      example: {
        adapter:
          '{"id":"my-site","name":"My site","version":"1.0.0","origins":["https://*.example.com"],"tools":[]}',
      },
      description:
        'Validate an adapter definition against the published schema and report every problem. Accepts the adapter as a JSON string.',
      inputSchema: {
        type: 'object',
        properties: { adapter: { type: 'string', description: 'The adapter definition as JSON text' } },
        required: ['adapter'],
      },
      execute: (input) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(input.adapter ?? ''));
        } catch (error) {
          return errorResult(`That is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        const result = validateAdapter(parsed);
        return textResult(
          result.ok
            ? 'Valid. This adapter would be accepted by the runtime.'
            : `Not valid:\n${result.errors.map((error) => `- ${error}`).join('\n')}`,
          { valid: result.ok, errors: result.errors },
        );
      },
    },
    {
      name: 'probe_selectors',
      example: {
        origin: 'https://demo-shop.liha.review',
        selectors: "[data-testid='product-search']\n[data-action='add-to-cart']",
      },
      description:
        'Count how many elements each CSS selector matches on an open page at the given origin. One selector per line. ' +
        'Only counts come back — never text, never attributes, never the page itself. A count of 1 is usable; 0 means the ' +
        'selector is wrong; more than 1 means it is ambiguous and the adapter runtime will refuse to act on it. Use this to ' +
        'check the selectors you intend to put in an adapter instead of guessing at them. Requires a tab open on that origin ' +
        'and the Liha extension installed.',
      inputSchema: {
        type: 'object',
        properties: {
          origin: { type: 'string', description: 'Exact origin, such as https://demo-shop.liha.review' },
          selectors: { type: 'string', description: 'CSS selectors to count, one per line' },
        },
        required: ['origin', 'selectors'],
      },
      execute: async (input) => {
        const origin = String(input.origin ?? '').trim();
        const selectors = String(input.selectors ?? '')
          .split('\n')
          .map((selector) => selector.trim())
          .filter(Boolean);
        if (!origin) return errorResult('An origin is required, such as https://demo-shop.liha.review');
        if (selectors.length === 0) return errorResult('Give at least one CSS selector, one per line.');
        if (selectors.length > 25) return errorResult('At most 25 selectors at a time.');

        if (!(await extensionPresent())) return errorResult(MISSING_EXTENSION);
        const outcome = await requestProbe(origin, selectors);
        if (outcome.error) return errorResult(outcome.error);
        const counts = outcome.probe ?? {};
        const verdict = (count: number) =>
          count === 1 ? 'usable' : count === 0 ? 'no match' : `ambiguous (${count} matches)`;
        const lines = selectors.map((selector) => `- ${selector} → ${verdict(counts[selector] ?? 0)}`);
        const usable = selectors.filter((selector) => counts[selector] === 1).length;
        return textResult(
          `${usable} of ${selectors.length} selector(s) resolve to exactly one element on ${origin}:\n${lines.join('\n')}`,
          { origin, counts, usable },
        );
      },
    },
    {
      name: 'install_adapter',
      example: {
        adapter: JSON.stringify({
          id: 'nimbus-search',
          name: 'Nimbus Supply search',
          version: '1.0.0',
          description: 'Search the Nimbus Supply demo catalogue by keyword.',
          origins: ['https://demo-shop.liha.review'],
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
        }),
      },
      description:
        'Hand an adapter definition to the Liha extension for installation. Accepts the adapter as a JSON string. ' +
        'This tool cannot install anything by itself: the extension re-validates the definition and then asks the person at ' +
        'the keyboard to approve the exact origins and capabilities being granted, and an install that is not approved does ' +
        'not happen. Validate with validate_adapter first — an invalid definition is rejected here without troubling anyone.',
      inputSchema: {
        type: 'object',
        properties: { adapter: { type: 'string', description: 'The adapter definition as JSON text' } },
        required: ['adapter'],
      },
      execute: async (input) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(input.adapter ?? ''));
        } catch (error) {
          return errorResult(`That is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Checked here as well as in the extension, so a definition with an
        // obvious problem is answered rather than turned into a dialog someone
        // has to read and decline.
        const validation = validateAdapter(parsed);
        if (!validation.ok || !validation.adapter) {
          return errorResult(
            `Not installed — the definition is not valid:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`,
          );
        }

        if (!(await extensionPresent())) return errorResult(MISSING_EXTENSION);
        const outcome = await requestInstall(validation.adapter);
        if (outcome.ok) {
          const tools = validation.adapter.tools.map((tool) => tool.name).join(', ');
          return textResult(
            `Installed ${validation.adapter.name} (${validation.adapter.id}). It is scoped to ` +
              `${validation.adapter.origins.join(', ')} and registers: ${tools}. Reload a page on one of those origins and ` +
              'the tools will be there.',
            { installed: true, id: validation.adapter.id, origins: validation.adapter.origins },
          );
        }
        return errorResult(
          `Not installed: ${outcome.errors.join('; ') || 'the person at the keyboard did not approve it.'}`,
        );
      },
    },
];

export async function registerRegistryTools(signal: AbortSignal): Promise<WebMcpStatus> {
  const modelContext = detectModelContext(document);
  if (!modelContext) return { supported: false, registered: [] };

  const registered: string[] = [];
  for (const tool of REGISTRY_TOOLS) {
    await modelContext.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: (input) => tool.execute(input),
      },
      { signal },
    );
    registered.push(tool.name);
  }
  return { supported: true, registered };
}

export const CAPABILITY_OPTIONS: Array<Capability | 'all'> = ['all', 'READ', 'INTERACT', 'WRITE', 'DESTRUCTIVE'];
export const ADAPTER_COUNT = CATALOG.length;
