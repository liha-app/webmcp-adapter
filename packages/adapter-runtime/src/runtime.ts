import {
  validateAdapter,
  type AdapterDefinition,
  type AdapterHealth,
  type Capability,
  type ToolDefinition,
  summarizeEffects,
} from '@liha/adapter-schema';
import { executeSteps, type ExecutorDeps, type StepExecutionError } from './executor';
import { checkAdapterHealth } from './health';
import { buildInputContext, type InputContext } from './input';
import { detectModelContext, errorResult, textResult, type ModelContext, type ToolResult } from './webmcp';

export const RUNTIME_VERSION = '1.0.0';
const LOG_LIMIT = 60;

/**
 * What the user is shown before a guarded tool runs. Values are included
 * because informed consent to "delete task 42" requires knowing it is 42 — but
 * they are passed to the confirmation UI only, never written to the log or to
 * storage.
 */
export interface ConfirmationRequest {
  adapterId: string;
  adapterName: string;
  toolName: string;
  toolDescription: string;
  capability: Capability;
  origin: string;
  preview: Array<{ key: string; value: string }>;
}

export interface RuntimePolicy {
  /** DESTRUCTIVE always confirms. WRITE confirms only when this is on. */
  confirmWrite: boolean;
  /**
   * Confirm anything whose *steps* can change the page, whatever capability it
   * claims to be.
   *
   * Capability is an author's declaration and validation can only check the
   * narrowest invariant about it. An adapter is free to call the click that
   * deletes an account READ, and until this existed that call went through
   * without asking anyone. This looks at what the steps do instead.
   */
  confirmMutating: boolean;
}

/**
 * Where an adapter came from, and therefore how much its own word is worth.
 *
 * Official adapters are in this repository and reviewed here. Verified ones
 * were reviewed by the registry's owners. Community ones are a stranger's JSON,
 * and a stranger does not get to turn confirmations off.
 */
export type AdapterTrust = 'official' | 'verified' | 'community';

export const DEFAULT_POLICY: RuntimePolicy = { confirmWrite: false, confirmMutating: false };

/** The strictest policy the trust level allows, applied to what was asked for. */
export function policyFor(trust: AdapterTrust, requested?: Partial<RuntimePolicy>): RuntimePolicy {
  if (trust === 'community') {
    // Nothing a community adapter asks for can loosen this.
    return { confirmWrite: true, confirmMutating: true };
  }
  const base: RuntimePolicy = trust === 'verified'
    ? { confirmWrite: true, confirmMutating: false }
    : { ...DEFAULT_POLICY };
  return { ...base, ...requested };
}

export interface RuntimeLogEntry {
  at: number;
  tool: string;
  level: 'info' | 'error';
  message: string;
}

export interface ToolStatus {
  name: string;
  capability: Capability;
  description: string;
  registered: boolean;
}

export interface InstalledAdapterStatus {
  id: string;
  name: string;
  version: string;
  tools: ToolStatus[];
  health: AdapterHealth | null;
}

export interface RuntimeStatus {
  runtimeVersion: string;
  webmcp: 'available' | 'unsupported';
  origin: string;
  url: string;
  policy: RuntimePolicy;
  adapters: InstalledAdapterStatus[];
  log: RuntimeLogEntry[];
}

export interface InstallResult {
  ok: boolean;
  adapterId: string;
  registered: string[];
  reason?: string;
}

export interface RuntimeDeps {
  doc: Document;
  location: { origin: string; href: string };
  getModelContext: () => ModelContext | null;
  navigate: (href: string) => void;
  sleep: (ms: number) => Promise<void>;
  settle: () => Promise<void>;
  now: () => number;
  /**
   * Asks the extension — not the page — to confirm a guarded call. Anything
   * other than an explicit `true` denies, so a missing or broken confirmation
   * path fails closed.
   */
  requestConfirmation: (request: ConfirmationRequest) => Promise<boolean>;
}

interface InstalledAdapter {
  definition: AdapterDefinition;
  controller: AbortController;
  tools: ToolStatus[];
  /*
   * Each adapter's own policy.
   *
   * This used to be one variable for the whole page, so the last adapter to
   * install decided how every other adapter on that origin would behave: a
   * careful adapter's WRITE confirmations disappeared the moment a second one
   * installed asking for none. Multiple adapters per origin are allowed, so it
   * was reachable rather than theoretical.
   */
  policy: RuntimePolicy;
  trust: AdapterTrust;
}

export interface InstallOptions {
  policy?: Partial<RuntimePolicy>;
  /** Defaults to the strictest, because an unlabelled adapter is a stranger's. */
  trust?: AdapterTrust;
}

export interface LihaRuntime {
  readonly version: string;
  install(definition: unknown, options?: InstallOptions | Partial<RuntimePolicy>): Promise<InstallResult>;
  uninstall(adapterId: string): Promise<boolean>;
  setPolicy(policy: Partial<RuntimePolicy>): RuntimePolicy;
  checkHealth(adapterId?: string): AdapterHealth[];
  status(): RuntimeStatus;
}

export function needsConfirmation(
  capability: Capability,
  policy: RuntimePolicy,
  /** True when no step in the tool can change anything on the page. */
  readOnlySteps = true,
): boolean {
  if (capability === 'DESTRUCTIVE') return true;
  if (capability === 'WRITE') return policy.confirmWrite;
  return policy.confirmMutating && !readOnlySteps;
}

export function createRuntime(deps: RuntimeDeps): LihaRuntime {
  const installed = new Map<string, InstalledAdapter>();
  const log: RuntimeLogEntry[] = [];
  let policy: RuntimePolicy = { ...DEFAULT_POLICY };

  function record(tool: string, level: RuntimeLogEntry['level'], message: string): void {
    log.push({ at: deps.now(), tool, level, message });
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  }

  function executorDeps(): ExecutorDeps {
    return {
      root: deps.doc,
      origin: deps.location.origin,
      navigate: deps.navigate,
      sleep: deps.sleep,
      settle: deps.settle,
      now: deps.now,
    };
  }

  function previewOf(tool: ToolDefinition, context: InputContext): ConfirmationRequest['preview'] {
    return Object.keys(tool.inputSchema.properties)
      .filter((key) => key in context)
      .map((key) => ({ key, value: (context[key] ?? '').slice(0, 120) }));
  }

  function buildExecute(definition: AdapterDefinition, tool: ToolDefinition, toolPolicy: RuntimePolicy) {
    return async (rawInput: Record<string, unknown>): Promise<ToolResult> => {
      record(tool.name, 'info', `invoked (${tool.capability})`);
      try {
        const context = buildInputContext(tool.inputSchema, rawInput);

        if (needsConfirmation(tool.capability, toolPolicy, summarizeEffects(tool).readOnly)) {
          record(tool.name, 'info', `awaiting user confirmation (${tool.capability})`);
          const approved = await deps.requestConfirmation({
            adapterId: definition.id,
            adapterName: definition.name,
            toolName: tool.name,
            toolDescription: tool.description,
            capability: tool.capability,
            origin: deps.location.origin,
            preview: previewOf(tool, context),
          });
          if (approved !== true) {
            record(tool.name, 'error', 'denied by user');
            return errorResult(`${tool.name} was not run: the user declined the ${tool.capability} confirmation.`);
          }
          record(tool.name, 'info', 'confirmed by user');
        }

        const { trace, outputs } = await executeSteps(tool.steps, context, executorDeps());
        for (const entry of trace) record(tool.name, 'info', `${entry.ok ? 'OK' : 'FAIL'} ${entry.step} ${entry.detail}`);
        record(tool.name, 'info', 'completed');

        const summary = `${tool.name} completed (${trace.length} steps).`;
        const lines = Object.entries(outputs).map(([key, value]) =>
          typeof value === 'string' ? `${key}: ${value}` : `${key}: ${JSON.stringify(value)}`,
        );
        return textResult(lines.length > 0 ? `${summary}\n${lines.join('\n')}` : summary, outputs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const trace = (error as StepExecutionError).trace;
        if (Array.isArray(trace)) {
          for (const entry of trace) {
            if (!entry.ok) record(tool.name, 'error', `FAIL ${entry.step} ${entry.detail}`);
          }
        }
        record(tool.name, 'error', message);
        // Returning an MCP error result rather than throwing keeps the reason
        // visible to the agent; a thrown error is flattened by the browser into
        // an opaque "invocation failed".
        return errorResult(`${tool.name} failed: ${message}`);
      }
    };
  }

  async function uninstall(adapterId: string): Promise<boolean> {
    const entry = installed.get(adapterId);
    if (!entry) return false;
    entry.controller.abort();
    installed.delete(adapterId);
    record(adapterId, 'info', 'adapter uninstalled; tools unregistered');
    return true;
  }

  async function install(
    input: unknown,
    options?: InstallOptions | Partial<RuntimePolicy>,
  ): Promise<InstallResult> {
    /* The old signature took a bare policy. Both shapes are accepted so a
     * caller that has not been updated still installs — at the stricter of the
     * two, because an install with no stated provenance is a stranger's. */
    const asOptions: InstallOptions =
      options && ('policy' in options || 'trust' in options)
        ? (options as InstallOptions)
        : { policy: options as Partial<RuntimePolicy> | undefined };
    const trust: AdapterTrust = asOptions.trust ?? 'community';
    const adapterPolicy = policyFor(trust, asOptions.policy);

    const validation = validateAdapter(input);
    if (!validation.ok || !validation.adapter) {
      return { ok: false, adapterId: 'unknown', registered: [], reason: `invalid adapter: ${validation.errors.join('; ')}` };
    }
    const definition = validation.adapter;

    // Defence in depth: the service worker already checked the origin, but the
    // runtime lives in the page's own world where anything can call install().
    if (!definition.origins.includes(deps.location.origin)) {
      return {
        ok: false,
        adapterId: definition.id,
        registered: [],
        reason: `origin ${deps.location.origin} is not in the adapter's origin list`,
      };
    }

    const modelContext = deps.getModelContext();
    if (!modelContext) {
      return { ok: false, adapterId: definition.id, registered: [], reason: 'webmcp-unsupported' };
    }

    // Re-installing (page reload, toggle off/on) must be idempotent: WebMCP
    // rejects a duplicate tool name with InvalidStateError.
    await uninstall(definition.id);

    const controller = new AbortController();
    const tools: ToolStatus[] = [];
    const registered: string[] = [];
    try {
      for (const tool of definition.tools) {
        await modelContext.registerTool(
          {
            name: tool.name,
            ...(tool.title ? { title: tool.title } : {}),
            description: tool.description,
            inputSchema: tool.inputSchema,
            execute: buildExecute(definition, tool, adapterPolicy),
          },
          { signal: controller.signal },
        );
        registered.push(tool.name);
        tools.push({ name: tool.name, capability: tool.capability, description: tool.description, registered: true });
      }
    } catch (error) {
      // Partial registration is not a valid state: roll the whole adapter back.
      controller.abort();
      const message = error instanceof Error ? error.message : String(error);
      record(definition.id, 'error', `registration failed: ${message}`);
      return { ok: false, adapterId: definition.id, registered: [], reason: message };
    }

    installed.set(definition.id, { definition, controller, tools, policy: adapterPolicy, trust });
    record(definition.id, 'info', `registered ${registered.length} tool(s): ${registered.join(', ')}`);
    return { ok: true, adapterId: definition.id, registered };
  }

  function checkHealth(adapterId?: string): AdapterHealth[] {
    return [...installed.values()]
      .filter((entry) => !adapterId || entry.definition.id === adapterId)
      .map((entry) => checkAdapterHealth(entry.definition, deps.doc, deps.now));
  }

  function status(): RuntimeStatus {
    return {
      runtimeVersion: RUNTIME_VERSION,
      webmcp: deps.getModelContext() ? 'available' : 'unsupported',
      origin: deps.location.origin,
      url: deps.location.href,
      policy: { ...policy },
      adapters: [...installed.values()].map((entry) => ({
        id: entry.definition.id,
        name: entry.definition.name,
        version: entry.definition.version,
        tools: entry.tools,
        health: checkAdapterHealth(entry.definition, deps.doc, deps.now),
      })),
      log: [...log],
    };
  }

  return {
    version: RUNTIME_VERSION,
    install,
    uninstall,
    setPolicy: (next) => (policy = { ...policy, ...next }),
    checkHealth,
    status,
  };
}

/**
 * A macrotask that browsers do not clamp in background tabs, unlike
 * `setTimeout`. Keeps tool calls fast when an agent drives a tab the user is
 * not currently looking at.
 */
export function macrotask(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(undefined);
  });
}

export function createBrowserRuntime(
  requestConfirmation: RuntimeDeps['requestConfirmation'],
): LihaRuntime {
  return createRuntime({
    doc: document,
    location: { origin: location.origin, href: location.href },
    getModelContext: () => detectModelContext(document),
    navigate: (href) => {
      location.assign(href);
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    settle: macrotask,
    now: () => Date.now(),
    requestConfirmation,
  });
}
