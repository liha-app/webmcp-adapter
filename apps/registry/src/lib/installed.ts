import type { AdapterSource, StoreStateResponse } from '@liha/shared';

export type Installed = StoreStateResponse['installed'][number];

/**
 * Reading the extension's answer without assuming its version.
 *
 * This page and the extension ship separately, and someone visiting with last
 * month's build gets last month's payload — which is exactly what happened:
 * `installed` used to carry only an id, a version, an enabled flag and health,
 * and code here read `.tools[0]` off it and took the whole page down.
 *
 * So nothing is assumed to be there. An older extension is a browser that
 * cannot answer the question, not a broken one, and the difference has to be
 * visible: `reportsDetail` is how the page knows to say so instead of showing
 * an empty result as though it were the truth.
 */
export interface BuiltAdapter {
  id: string;
  name: string;
  version: string;
  source: AdapterSource;
  origins: string[];
  tools: Array<{ name: string; capability: string; required: string[] }>;
}

/** True when the extension is new enough to say where an adapter came from. */
export function reportsDetail(installed: readonly Installed[]): boolean {
  return installed.length === 0 || installed.every((entry) => typeof entry.source === 'string');
}

/**
 * The adapters this person put there — installed from the Store or built in
 * the Studio, as opposed to the ones the extension shipped with.
 *
 * An entry whose source is missing is not counted. Guessing "not builtin" from
 * an absent field would have reported all three bundled adapters as the user's
 * own work.
 */
export function builtHere(installed: readonly Installed[]): BuiltAdapter[] {
  return installed
    .filter((entry) => typeof entry.source === 'string' && entry.source !== 'builtin')
    .map((entry) => ({
      id: entry.id,
      name: entry.name ?? entry.id,
      version: entry.version ?? '',
      source: entry.source,
      origins: entry.origins ?? [],
      tools: (entry.tools ?? []).map((tool) => ({
        name: tool.name,
        capability: tool.capability,
        required: tool.required ?? [],
      })),
    }));
}

/**
 * What was already installed when the walkthrough started, as id → version.
 *
 * The guided build has one question to answer — did the adapter you are
 * building right now arrive? — and it used to answer it by taking the last
 * non-bundled adapter in the list. Anyone who had ever installed a community
 * adapter therefore reached the page with step 6 already ticked and step 7
 * offering them a snippet for somebody else's adapter.
 *
 * A baseline is the missing half of that question. It is taken once, from the
 * first trustworthy answer the extension gives, and everything measured
 * afterwards is measured against it. The version is part of it so that
 * re-recording an adapter and reinstalling it under the same id still reads as
 * work done here rather than as something that was already lying around.
 */
export type Baseline = Readonly<Record<string, string>>;

export function baselineOf(installed: readonly Installed[]): Baseline {
  const baseline: Record<string, string> = {};
  for (const entry of installed) baseline[entry.id] = entry.version ?? '';
  return baseline;
}

export interface FlowState {
  /** The adapter this walkthrough watched appear, if it watched one appear. */
  made: BuiltAdapter | undefined;
  /** Everything else the visitor had put there, which this flow did not make. */
  existing: BuiltAdapter[];
}

/**
 * Split what the extension reports into "this run of the walkthrough made that"
 * and "that was already here".
 *
 * With no baseline — a first visit that arrives after the building is done, an
 * extension too old to say where an adapter came from, a browser that will not
 * keep session storage — nothing is claimed. Everything the visitor installed
 * is listed as already installed, which is true, and the steps stay open, which
 * is honest: the page cannot see what it did not watch happen.
 */
export function flowState(installed: readonly Installed[], baseline: Baseline | null): FlowState {
  const mine = builtHere(installed);
  if (!baseline) return { made: undefined, existing: mine };
  // Installing from the Store is not building one. Only the Studio's own
  // output is what these steps are walking someone through.
  const fresh = mine.filter((entry) => entry.source === 'studio' && baseline[entry.id] !== entry.version);
  /*
   * The extension details exactly one Studio build — the newest — because an
   * inventory of everything on the machine is not a web page's business. That
   * one is the adapter just built, and it is the only one step 7 can write a
   * call for, so it is the one to show.
   */
  const made = [...fresh].reverse().find((entry) => entry.tools.length > 0) ?? fresh[fresh.length - 1];
  if (!made) return { made: undefined, existing: mine };
  return { made, existing: mine.filter((entry) => entry.id !== made.id) };
}

/** The snippet that calls a tool, in the form `executeTool` actually wants. */
export function callSnippet(tool: BuiltAdapter['tools'][number] | undefined): string {
  if (!tool) return '';
  const args =
    tool.required.length > 0
      ? tool.required.map((name) => `  ${name}: 'cable',`)
      : ['  // this tool takes no arguments'];
  return [
    'const tools = await document.modelContext.getTools();',
    `const tool = tools.find((t) => t.name === ${JSON.stringify(tool.name)});`,
    '// executeTool takes its input as a JSON string, not an object.',
    'await document.modelContext.executeTool(tool, JSON.stringify({',
    ...args,
    '}));',
  ].join('\n');
}
