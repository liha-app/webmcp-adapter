import type { AdapterDefinition } from '@liha/adapter-schema';

/**
 * A builtin adapter, narrowed to the origins this build actually asks for.
 *
 * The shipped definitions carry their development origins so the demos work
 * while you are building them. A published build does not ask for `localhost`,
 * and a builtin — which runs at `official` trust, so its writes are not
 * confirmed — that stayed scoped to it would act on whatever else the user
 * happens to serve on that port if they ever grant the optional permission.
 *
 * Reading the list off the manifest rather than keeping a second copy means the
 * two cannot drift apart. An adapter left with nowhere to run is dropped.
 */
export function scopeToManifest(
  adapter: AdapterDefinition,
  declared: readonly string[],
): AdapterDefinition | undefined {
  const origins = adapter.origins.filter((origin) => declared.includes(`${origin}/*`));
  if (origins.length === 0) return undefined;
  if (origins.length === adapter.origins.length) return adapter;
  return { ...adapter, origins };
}
