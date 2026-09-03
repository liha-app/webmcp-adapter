import { OFFICIAL_ADAPTERS } from '@liha/adapters';
import { ALL_MATCH_PATTERNS } from '@liha/config';
import { validateAdapter } from '@liha/adapter-schema';
import { DEFAULT_POLICY, type RuntimePolicy } from '@liha/adapter-runtime';
import type { AdapterRecord, AdapterSource } from '@liha/shared';
import { ext } from '../platform';

const STORAGE_KEY = 'liha:adapters';

interface StoredRecord {
  adapter: unknown;
  source: AdapterSource;
  enabled: boolean;
  installedAt: number;
  policy: RuntimePolicy;
}

/**
 * The installed-adapter catalogue: the definitions shipped with the extension
 * plus anything the user installed from the Store or built in the Studio.
 *
 * Stored adapters are re-validated on every read. Storage is not a trust
 * boundary — a definition that was valid when installed still has to be valid
 * now, and anything that fails is dropped rather than repaired.
 */
export async function readCatalogue(): Promise<AdapterRecord[]> {
  const stored = await ext.storage.local.get(STORAGE_KEY);
  const records = (stored[STORAGE_KEY] ?? {}) as Record<string, StoredRecord>;

  const catalogue: AdapterRecord[] = [];
  for (const builtin of OFFICIAL_ADAPTERS) {
    const saved = records[builtin.id];
    catalogue.push({
      adapter: builtin,
      source: 'builtin',
      enabled: saved?.enabled ?? true,
      installedAt: saved?.installedAt ?? 0,
      policy: saved?.policy ?? { ...DEFAULT_POLICY },
    });
  }
  for (const [id, record] of Object.entries(records)) {
    if (catalogue.some((entry) => entry.adapter.id === id)) continue;
    const validation = validateAdapter(record.adapter);
    if (!validation.ok || !validation.adapter) {
      console.warn('[liha] dropping stored adapter that no longer validates', id, validation.errors);
      continue;
    }
    catalogue.push({
      adapter: validation.adapter,
      source: record.source ?? 'installed',
      enabled: record.enabled ?? true,
      installedAt: record.installedAt ?? 0,
      policy: record.policy ?? { ...DEFAULT_POLICY },
    });
  }
  return catalogue;
}

/*
 * One writer at a time.
 *
 * Every mutation here is read-modify-write against one storage key, and two of
 * them in flight — a quick pair of toggles, two installs approved together —
 * both read the same "before" and the second one's write erases the first. The
 * queue is a promise chain rather than a lock because a service worker has one
 * thread and this only needs the turns kept in order.
 */
let writeQueue: Promise<void> = Promise.resolve();

async function writeRecords(mutate: (records: Record<string, StoredRecord>) => void): Promise<void> {
  const run = writeQueue.then(async () => {
    const stored = await ext.storage.local.get(STORAGE_KEY);
    const records = (stored[STORAGE_KEY] ?? {}) as Record<string, StoredRecord>;
    mutate(records);
    await ext.storage.local.set({ [STORAGE_KEY]: records });
  });
  // The chain must survive a failed turn, or one rejection stops every write
  // that comes after it.
  writeQueue = run.catch(() => undefined);
  return run;
}

export async function setEnabled(adapterId: string, enabled: boolean): Promise<void> {
  const catalogue = await readCatalogue();
  const entry = catalogue.find((candidate) => candidate.adapter.id === adapterId);
  if (!entry) return;
  await writeRecords((records) => {
    const existing = records[adapterId];
    records[adapterId] = {
      adapter: existing?.adapter ?? entry.adapter,
      source: entry.source,
      installedAt: existing?.installedAt ?? entry.installedAt,
      policy: existing?.policy ?? entry.policy,
      enabled,
    };
  });
}

export async function setPolicy(adapterId: string, policy: Partial<RuntimePolicy>): Promise<void> {
  const catalogue = await readCatalogue();
  const entry = catalogue.find((candidate) => candidate.adapter.id === adapterId);
  if (!entry) return;
  await writeRecords((records) => {
    const existing = records[adapterId];
    records[adapterId] = {
      adapter: existing?.adapter ?? entry.adapter,
      source: entry.source,
      installedAt: existing?.installedAt ?? entry.installedAt,
      enabled: existing?.enabled ?? entry.enabled,
      policy: { ...(existing?.policy ?? entry.policy), ...policy },
    };
  });
}

export interface InstallOutcome {
  ok: boolean;
  adapterId?: string;
  errors: string[];
}

export async function installAdapter(
  candidate: unknown,
  source: AdapterSource,
  policy: RuntimePolicy = { ...DEFAULT_POLICY },
): Promise<InstallOutcome> {
  const validation = validateAdapter(candidate);
  if (!validation.ok || !validation.adapter) return { ok: false, errors: validation.errors };
  const adapter = validation.adapter;
  await writeRecords((records) => {
    records[adapter.id] = { adapter, source, enabled: true, installedAt: Date.now(), policy };
  });
  return { ok: true, adapterId: adapter.id, errors: [] };
}

export async function removeAdapter(adapterId: string): Promise<void> {
  const before = await readCatalogue();
  const going = before.find((entry) => entry.adapter.id === adapterId);
  await writeRecords((records) => {
    delete records[adapterId];
  });

  /*
   * Give back the host access this adapter was the reason for.
   *
   * Optional permissions granted at install used to outlive the adapter, so
   * uninstalling left the extension holding standing access to an origin
   * nothing was using any more. Chrome's own guidance is to remove what is no
   * longer needed — and only what is: an origin another installed adapter still
   * declares has to stay.
   */
  if (!going) return;
  const stillWanted = new Set(
    (await readCatalogue()).flatMap((entry) => entry.adapter.origins.map((origin) => `${origin}/*`)),
  );
  const orphaned = going.adapter.origins
    .map((origin) => `${origin}/*`)
    .filter((pattern) => !stillWanted.has(pattern) && !ALL_MATCH_PATTERNS.includes(pattern));
  if (orphaned.length === 0) return;
  try {
    await ext.permissions.remove({ origins: orphaned });
  } catch (error) {
    console.warn('[liha] could not release host access for', orphaned, error);
  }
}

export { findAllForUrl, findEnabledForUrl } from './match';
