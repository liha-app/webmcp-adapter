import type { AdapterDefinition } from '@liha/adapter-schema';
import type { AdapterTrust, InstallResult, RuntimePolicy, RuntimeStatus } from '@liha/adapter-runtime';
import type { AdapterHealth } from '@liha/adapter-schema';
import type { AdapterSource } from '@liha/shared';
import { ext } from '../platform';

const RUNTIME_FILE = 'main-world/runtime.js';

/*
 * The functions below are serialised by `scripting.executeScript` and evaluated
 * in the page's MAIN world, so they must be self-contained: no imports, no
 * closure variables, and the runtime global spelled out literally.
 *
 * Note what is NOT happening here: no adapter-supplied string is ever passed to
 * eval, new Function, or a <script> src. Adapters cross this boundary strictly
 * as JSON arguments.
 */
type RuntimeHandle = {
  install(
    definition: unknown,
    options?: { policy?: Partial<RuntimePolicy>; trust?: string },
  ): Promise<InstallResult>;
  uninstall(adapterId: string): Promise<boolean>;
  setPolicy(policy: Partial<RuntimePolicy>): RuntimePolicy;
  checkHealth(adapterId?: string): AdapterHealth[];
  status(): RuntimeStatus;
};

function installInMainWorld(definition: unknown, options: unknown): Promise<InstallResult> {
  const runtime = (globalThis as Record<string, unknown>)['__LIHA_WEBMCP_ADAPTER__'] as RuntimeHandle | undefined;
  if (!runtime) {
    return Promise.resolve({ ok: false, adapterId: 'unknown', registered: [], reason: 'runtime-not-loaded' });
  }
  return runtime.install(definition, options as { policy?: Partial<RuntimePolicy>; trust?: string });
}

function uninstallInMainWorld(adapterId: string): Promise<boolean> {
  const runtime = (globalThis as Record<string, unknown>)['__LIHA_WEBMCP_ADAPTER__'] as RuntimeHandle | undefined;
  return runtime ? runtime.uninstall(adapterId) : Promise.resolve(false);
}

function statusFromMainWorld(): RuntimeStatus | null {
  const runtime = (globalThis as Record<string, unknown>)['__LIHA_WEBMCP_ADAPTER__'] as RuntimeHandle | undefined;
  return runtime ? runtime.status() : null;
}

function healthFromMainWorld(): AdapterHealth[] {
  const runtime = (globalThis as Record<string, unknown>)['__LIHA_WEBMCP_ADAPTER__'] as RuntimeHandle | undefined;
  return runtime ? runtime.checkHealth() : [];
}

/*
 * Where an adapter came from decides how much its own settings are worth.
 *
 * Only what ships in this extension is `official`. Anything a user installed —
 * from the Store, from the Studio, from a file — is a stranger's JSON as far as
 * the runtime is concerned, and a stranger does not get to turn confirmations
 * off for the origin it lands on.
 */
export function trustOf(source: AdapterSource): AdapterTrust {
  return source === 'builtin' ? 'official' : 'community';
}

export async function injectAdapter(
  tabId: number,
  frameId: number,
  adapter: AdapterDefinition,
  policy: RuntimePolicy,
  source: AdapterSource = 'installed',
): Promise<InstallResult> {
  await ext.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: 'MAIN',
    files: [RUNTIME_FILE],
  });
  const [result] = await ext.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: 'MAIN',
    func: installInMainWorld,
    args: [adapter, { policy, trust: trustOf(source) }],
  });
  return (
    (result?.result as InstallResult | undefined) ?? {
      ok: false,
      adapterId: adapter.id,
      registered: [],
      reason: 'no-result',
    }
  );
}

export async function uninstallFromTab(tabId: number, adapterId: string): Promise<void> {
  try {
    await ext.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: 'MAIN',
      func: uninstallInMainWorld,
      args: [adapterId],
    });
  } catch (error) {
    console.warn('[liha] uninstall failed', tabId, error);
  }
}

export async function readRuntimeStatus(tabId: number): Promise<RuntimeStatus | null> {
  const [result] = await ext.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: 'MAIN',
    func: statusFromMainWorld,
  });
  return (result?.result as RuntimeStatus | null | undefined) ?? null;
}

export async function readHealth(tabId: number): Promise<AdapterHealth[]> {
  try {
    const [result] = await ext.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: 'MAIN',
      func: healthFromMainWorld,
    });
    return (result?.result as AdapterHealth[] | undefined) ?? [];
  } catch {
    return [];
  }
}
