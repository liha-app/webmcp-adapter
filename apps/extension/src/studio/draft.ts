import type { Capability, Step } from '@liha/adapter-schema';
import type { RecordedAction } from '@liha/shared';

export type StepKind = Step['type'];

export const STEP_KINDS: StepKind[] = [
  'click',
  'fill',
  'select',
  'check',
  'uncheck',
  'submit',
  'waitFor',
  'assertVisible',
  'assertText',
  'readText',
  'readAttribute',
  'readList',
  'navigate',
];

export const VALUE_STEPS = new Set<StepKind>(['fill', 'select', 'assertText', 'navigate']);
export const READ_STEPS = new Set<StepKind>(['readText', 'readAttribute', 'readList']);

export interface DraftStep {
  id: string;
  kind: StepKind;
  selector: string;
  candidates: RecordedAction['candidates'];
  /** Literal text, or the parameter name when `parameterized` is true. */
  value: string;
  parameterized: boolean;
  parameter: string;
  attribute: string;
  binding: string;
  waitState: 'present' | 'absent';
}

export interface DraftParameter {
  name: string;
  description: string;
  required: boolean;
}

export interface Draft {
  adapterId: string;
  adapterName: string;
  version: string;
  description: string;
  origin: string;
  toolName: string;
  toolTitle: string;
  toolDescription: string;
  capability: Capability;
  steps: DraftStep[];
}

let counter = 0;
const nextId = () => `s${++counter}`;

function suggestParameterName(action: RecordedAction, index: number): string {
  const match = /\[name='([^']+)'\]/.exec(action.selector);
  if (match?.[1]) return match[1].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const label = (action.label ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return label && label.length <= 24 ? label : `value_${index + 1}`;
}

/**
 * Turns a recording into an editable draft.
 *
 * Values the user typed are pre-filled as *parameters* rather than literals,
 * because a recorded demonstration is almost always an example of the workflow
 * rather than the exact call an agent should make. The Studio still shows the
 * recorded text so the author can switch any of them back to a fixed value.
 */
export function draftFromRecording(actions: readonly RecordedAction[], origin: string): Draft {
  const steps: DraftStep[] = actions.map((action, index) => {
    // Navigation is page structure discovered during the demonstration, not a
    // value supplied by the eventual tool caller. Keep its same-origin path as
    // a literal; only values a person typed become proposed parameters.
    const recordedValue = action.kind === 'navigate' ? (action.path ?? '') : (action.value ?? '');
    const parameterized =
      action.kind !== 'navigate' && action.value !== undefined && VALUE_STEPS.has(action.kind as StepKind);
    return {
      id: nextId(),
      kind: action.kind as StepKind,
      selector: action.selector,
      candidates: action.candidates,
      value: recordedValue,
      parameterized,
      parameter: parameterized ? suggestParameterName(action, index) : '',
      attribute: '',
      binding: '',
      waitState: 'present',
    };
  });

  const host = (() => {
    try {
      return new URL(origin).hostname.replace(/^www\./, '');
    } catch {
      return 'site';
    }
  })();
  const slug = host.split('.')[0]?.replace(/[^a-z0-9-]/g, '') || 'site';

  return {
    adapterId: `${slug}-adapter`,
    adapterName: `${host} adapter`,
    version: '0.1.0',
    description: '',
    origin,
    toolName: '',
    toolTitle: '',
    toolDescription: '',
    capability: 'WRITE',
    steps,
  };
}

export function emptyStep(kind: StepKind = 'click'): DraftStep {
  return {
    id: nextId(),
    kind,
    selector: '',
    candidates: [],
    value: '',
    parameterized: false,
    parameter: '',
    attribute: '',
    binding: '',
    waitState: 'present',
  };
}

export function parametersOf(draft: Draft): DraftParameter[] {
  const seen = new Map<string, DraftParameter>();
  for (const step of draft.steps) {
    if (!step.parameterized || !step.parameter) continue;
    if (seen.has(step.parameter)) continue;
    seen.set(step.parameter, { name: step.parameter, description: '', required: true });
  }
  return [...seen.values()];
}

function stepToJson(step: DraftStep): Record<string, unknown> | null {
  const selector = step.selector.trim();
  const value = step.parameterized ? `{{${step.parameter}}}` : step.value;
  switch (step.kind) {
    case 'click':
    case 'check':
    case 'uncheck':
    case 'submit':
    case 'assertVisible':
      return selector ? { type: step.kind, selector } : null;
    case 'fill':
    case 'select':
      return selector ? { type: step.kind, selector, value } : null;
    case 'assertText':
      return selector ? { type: 'assertText', selector, contains: value } : null;
    case 'waitFor':
      return selector
        ? { type: 'waitFor', selector, ...(step.waitState === 'absent' ? { state: 'absent' } : {}) }
        : null;
    case 'readText':
      return selector && step.binding ? { type: 'readText', selector, as: step.binding } : null;
    case 'readAttribute':
      return selector && step.binding && step.attribute
        ? { type: 'readAttribute', selector, attribute: step.attribute, as: step.binding }
        : null;
    case 'readList':
      return selector && step.binding ? { type: 'readList', selector, as: step.binding } : null;
    case 'navigate':
      return value ? { type: 'navigate', path: value } : null;
    default:
      return null;
  }
}

/** Builds the adapter JSON exactly as it would be published or installed. */
export function draftToAdapter(draft: Draft, descriptions: Record<string, string> = {}): Record<string, unknown> {
  const parameters = parametersOf(draft);
  const properties: Record<string, unknown> = {};
  for (const parameter of parameters) {
    properties[parameter.name] = {
      type: 'string',
      ...(descriptions[parameter.name] ? { description: descriptions[parameter.name] } : {}),
    };
  }

  return {
    id: draft.adapterId.trim(),
    name: draft.adapterName.trim(),
    version: draft.version.trim(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    origins: [draft.origin],
    tools: [
      {
        name: draft.toolName.trim(),
        ...(draft.toolTitle.trim() ? { title: draft.toolTitle.trim() } : {}),
        description: draft.toolDescription.trim(),
        capability: draft.capability,
        inputSchema: {
          type: 'object',
          properties,
          ...(parameters.length > 0 ? { required: parameters.map((parameter) => parameter.name) } : {}),
        },
        steps: draft.steps.map(stepToJson).filter((step): step is Record<string, unknown> => step !== null),
      },
    ],
  };
}
