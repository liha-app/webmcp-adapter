import type { StoreStateResponse } from '@liha/shared';

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
      origins: entry.origins ?? [],
      tools: (entry.tools ?? []).map((tool) => ({
        name: tool.name,
        capability: tool.capability,
        required: tool.required ?? [],
      })),
    }));
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
