import { detectModelContext, errorResult, textResult, type ToolResult } from '@liha/adapter-runtime';
import { validateAdapter, type Capability } from '@liha/adapter-schema';
import { CATALOG, findEntry, searchCatalog } from './catalog';
import { SETUP_STEPS, demoApps } from './demos';

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
  execute: (input: Record<string, unknown>) => ToolResult;
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
            note: demo.note ?? null,
            tools: demo.tools,
          })),
          requirements: SETUP_STEPS.map((step) => (step.code ? `${step.text} (${step.code})` : step.text)),
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
