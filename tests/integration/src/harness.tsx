import type { ComponentType } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { findOfficialAdapter } from '@liha/adapters';
import type { AdapterDefinition } from '@liha/adapter-schema';
import { createRuntime, type LihaRuntime, type RuntimePolicy } from '@liha/adapter-runtime';
import { createMockModelContext } from '@liha/adapter-runtime/testing';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export interface Harness {
  runtime: LihaRuntime;
  modelContext: ReturnType<typeof createMockModelContext>;
  adapter: AdapterDefinition;
  confirmations: Array<{ toolName: string; capability: string }>;
  call(name: string, input?: Record<string, unknown>): Promise<ToolResponse>;
  toolNames(): Promise<string[]>;
  cleanup(): void;
}

export interface ToolResponse {
  content: Array<{ text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  text: string;
}

/**
 * Mounts a real demo app and installs its real published adapter against it.
 *
 * Nothing here is a stand-in except `document.modelContext`, which is mocked to
 * the behaviour measured from Chrome. That means these tests fail if an adapter
 * drifts from the app it targets — which is the failure this project most needs
 * to catch, because an adapter that no longer matches its site is the normal
 * way this whole idea breaks.
 */
export async function mountApp(
  App: ComponentType,
  adapterId: string,
  options: { policy?: Partial<RuntimePolicy>; approveConfirmations?: boolean } = {},
): Promise<Harness> {
  const adapter = findOfficialAdapter(adapterId);
  if (!adapter) throw new Error(`unknown adapter: ${adapterId}`);
  const origin = adapter.origins[0] as string;

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });

  const modelContext = createMockModelContext(origin);
  const confirmations: Harness['confirmations'] = [];

  const runtime = createRuntime({
    doc: document,
    location: { origin, href: `${origin}${window.location.pathname}` },
    getModelContext: () => modelContext,
    // jsdom refuses a pushState to a different origin, so navigate by path;
    // the popstate dispatch is what the demo apps actually listen for.
    navigate: (href) => {
      const url = new URL(href);
      window.history.pushState({}, '', `${url.pathname}${url.search}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
    now: () => Date.now(),
    requestConfirmation: async (request) => {
      confirmations.push({ toolName: request.toolName, capability: request.capability });
      return options.approveConfirmations !== false;
    },
  });

  const install = await runtime.install(adapter, options.policy);
  if (!install.ok) throw new Error(`adapter did not install: ${install.reason}`);

  return {
    runtime,
    modelContext,
    adapter,
    confirmations,
    async toolNames() {
      return (await modelContext.getTools()).map((tool) => tool.name);
    },
    async call(name, input = {}) {
      const tool = (await modelContext.getTools()).find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`tool not registered: ${name}`);
      let raw: string | null = null;
      await act(async () => {
        raw = await modelContext.executeTool(tool, JSON.stringify(input));
      });
      const parsed = JSON.parse(raw ?? 'null') as ToolResponse;
      return { ...parsed, text: parsed.content?.map((part) => part.text).join('\n') ?? '' };
    },
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export const rows = (selector: string): string[] =>
  [...document.querySelectorAll(selector)].map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
