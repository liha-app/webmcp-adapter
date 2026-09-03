import type { MessageKey } from '../i18n';

/**
 * Schema errors, said to a person.
 *
 * `validateAdapter` reports `tools.0.name: String must contain at least 1
 * character(s)`, which is the right thing for the format's own consumers — a
 * JSON author needs the path, and the Store needs a stable string. It is the
 * wrong thing for the Studio, where the reader has a form in front of them and
 * an error that names an array index they never see.
 *
 * So the paths are translated here rather than upstream: the schema keeps
 * saying what it says, and this says it in the language of the screen, and
 * points at the field the reader has to change.
 *
 * This maps to message keys rather than to sentences. It keeps the module free
 * of the extension APIs the message loader pulls in, which is what lets it be
 * tested for what it actually decides.
 */
export type ProblemField =
  | 'toolName'
  | 'toolDescription'
  | 'adapterId'
  | 'adapterName'
  | 'version'
  | 'origin';

export interface Problem {
  /** The input to show it under, where the error belongs to one. */
  field?: ProblemField;
  key: MessageKey;
  params: Array<string | number>;
}

/** `path: message`, as validateAdapter writes it. */
function split(error: string): { path: string; message: string } {
  const at = error.indexOf(': ');
  return at === -1 ? { path: '', message: error } : { path: error.slice(0, at), message: error.slice(at + 2) };
}

const SIMPLE: Array<[RegExp, ProblemField, MessageKey]> = [
  [/^tools\.\d+\.description$/, 'toolDescription', 'studio.problemToolDescription'],
  [/^id$/, 'adapterId', 'studio.problemAdapterId'],
  [/^name$/, 'adapterName', 'studio.problemAdapterName'],
  [/^version$/, 'version', 'studio.problemVersion'],
  [/^origins(\.\d+)?$/, 'origin', 'studio.problemOrigin'],
];

export function explainProblem(error: string): Problem {
  const { path, message } = split(error);

  if (/^tools\.\d+\.name$/.test(path)) {
    // Two different repairs wear the same path: nothing typed, or something
    // typed that the format will not take.
    const shape = /snake_case|Invalid|match/i.test(message);
    return { field: 'toolName', key: shape ? 'studio.problemToolNameCase' : 'studio.problemToolName', params: [] };
  }

  for (const [pattern, field, key] of SIMPLE) {
    if (pattern.test(path)) return { field, key, params: [] };
  }

  const step = /^tools\.\d+\.steps\.(\d+)/.exec(path);
  if (step) return { key: 'studio.problemStep', params: [Number(step[1]) + 1, message] };

  // Anything the mapping does not know: the message, without the path. A reader
  // cannot act on `tools.0.inputSchema.properties`, and showing it only makes
  // the sentence harder to read.
  return { key: 'studio.problemRaw', params: [message || error] };
}

export function explainProblems(errors: readonly string[]): Problem[] {
  return errors.map(explainProblem);
}
