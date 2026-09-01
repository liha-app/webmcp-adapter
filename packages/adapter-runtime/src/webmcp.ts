/**
 * Minimal typings for the WebMCP imperative API as shipped in Chrome 152
 * (`chrome://flags/#enable-webmcp-testing`).
 *
 * Verified against the browser rather than transcribed from a proposal — see
 * `docs/webmcp-api.md` for the probe results these types are based on.
 */
export interface ModelContextTool {
  name: string;
  description: string;
  title?: string;
  inputSchema?: unknown;
  /** Receives the *parsed* input object; the return value is JSON-serialised by the browser. */
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

export interface RegisterToolOptions {
  /** Aborting the signal unregisters the tool. This is the only removal path. */
  signal?: AbortSignal;
}

export interface RegisteredTool {
  name: string;
  title: string;
  description: string;
  inputSchema: unknown;
  origin: string;
}

export interface ModelContext {
  registerTool(tool: ModelContextTool, options?: RegisterToolOptions): Promise<void>;
  getTools(): Promise<RegisteredTool[]>;
  executeTool(tool: RegisteredTool, input: string): Promise<string | null>;
}

/**
 * WebMCP is only exposed on real documents in supporting browsers. Everything
 * else — Firefox today, Chrome without the flag, `about:blank` — must degrade
 * to an explicit "unsupported", never to a home-grown shim pretending to be
 * WebMCP.
 */
export function detectModelContext(doc: Document): ModelContext | null {
  const candidate = (doc as Document & { modelContext?: unknown }).modelContext;
  if (!candidate || typeof candidate !== 'object') return null;
  const maybe = candidate as Partial<ModelContext>;
  return typeof maybe.registerTool === 'function' && typeof maybe.getTools === 'function'
    ? (candidate as ModelContext)
    : null;
}

/** MCP-shaped tool results. The browser JSON-serialises whatever we return. */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function textResult(text: string, structured?: Record<string, unknown>): ToolResult {
  return structured ? { content: [{ type: 'text', text }], structuredContent: structured } : { content: [{ type: 'text', text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}
