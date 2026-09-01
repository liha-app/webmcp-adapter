import type { ModelContext, ModelContextTool, RegisterToolOptions, RegisteredTool } from './webmcp';

/**
 * A stand-in for `document.modelContext` used by the tests.
 *
 * Its behaviour is copied from the real Chrome 152 implementation as measured in
 * docs/webmcp-api.md — duplicate names throw InvalidStateError, aborting the
 * registration signal unregisters, `execute` receives a parsed object and its
 * return value is JSON-serialised, and input is *not* validated against the
 * declared schema. A mock that is kinder than the browser would hide exactly
 * the bugs these tests exist to catch.
 */
export function createMockModelContext(origin = 'http://localhost:5273'): ModelContext & {
  registered: () => string[];
} {
  const tools = new Map<string, ModelContextTool>();

  return {
    registered: () => [...tools.keys()],

    async registerTool(tool: ModelContextTool, options?: RegisterToolOptions): Promise<void> {
      if (options?.signal?.aborted) {
        throw Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' });
      }
      if (tools.has(tool.name)) {
        throw Object.assign(new Error('Duplicate tool name'), { name: 'InvalidStateError' });
      }
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
    },

    async getTools(): Promise<RegisteredTool[]> {
      return [...tools.values()].map((tool) => ({
        name: tool.name,
        title: tool.title ?? '',
        description: tool.description,
        inputSchema: tool.inputSchema,
        origin,
      }));
    },

    async executeTool(tool: RegisteredTool, input: string): Promise<string | null> {
      const target = tools.get(tool.name);
      if (!target) throw Object.assign(new Error('Tool not found'), { name: 'NotFoundError' });
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        throw Object.assign(new Error('Failed to parse input arguments'), { name: 'UnknownError' });
      }
      const result = await target.execute(parsed as Record<string, unknown>);
      return typeof result === 'string' ? result : JSON.stringify(result);
    },
  };
}
