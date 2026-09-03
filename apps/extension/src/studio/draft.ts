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
  /**
   * For a click: the form pressing it submits. Carried from the recording so
   * the draft can still tell that a click and a submit are the same gesture
   * after someone has added one of them back by hand.
   */
  submitsForm?: string;
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

const slug = (text: string, max = 40) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max)
    .replace(/_+$/, '');

/**
 * A name and a description the draft opens with, rather than greyed-out
 * examples of one.
 *
 * These used to be placeholders, which look exactly like filled-in fields and
 * are not: the Studio showed `create_customer` and a sentence describing the
 * workflow, and under them three errors saying the name was empty, was not
 * snake_case, and the description was empty. A suggestion the author can
 * correct is more useful than an example they have to retype, and it means a
 * recording is a valid adapter the moment it is taken.
 */
export function suggestToolName(actions: readonly RecordedAction[]): string {
  const opener = actions.find((action) => action.kind === 'click' && (action.label ?? '').trim());
  const named = slug(opener?.label ?? '', 48);
  if (named && /^[a-z]/.test(named)) return named;
  const ends = actions[actions.length - 1]?.kind;
  return ends === 'submit' ? 'submit_form' : 'run_workflow';
}

export function suggestToolDescription(actions: readonly RecordedAction[], origin: string): string {
  const opener = (actions.find((action) => action.kind === 'click')?.label ?? '').trim();
  const fields = actions
    .filter((action) => action.kind === 'fill' || action.kind === 'select')
    .map((action, index) => suggestParameterName(action, index));
  const host = (() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return origin;
    }
  })();
  const what = opener ? `the "${opener}" workflow` : 'a recorded workflow';
  const filling = fields.length > 0 ? `, filling in ${fields.join(', ')}` : '';
  const ending = actions[actions.length - 1]?.kind === 'submit' ? ', and submits the form' : '';
  return `Runs ${what} on ${host}${filling}${ending}. Recorded from the site's own controls; edit this to say when an agent should use it.`;
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
    const parameterized = action.value !== undefined && VALUE_STEPS.has(action.kind as StepKind);
    return {
      id: nextId(),
      kind: action.kind as StepKind,
      selector: action.selector,
      candidates: action.candidates,
      value: action.value ?? '',
      parameterized,
      parameter: parameterized ? suggestParameterName(action, index) : '',
      attribute: '',
      binding: '',
      waitState: 'present',
      ...(action.submitsForm ? { submitsForm: action.submitsForm } : {}),
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
    toolName: suggestToolName(actions),
    toolTitle: '',
    toolDescription: suggestToolDescription(actions, origin),
    capability: 'WRITE',
    steps,
  };
}

/**
 * The steps a check can expect to find on the page as it stands.
 *
 * A workflow is a sequence, and most of it does not exist yet. The fields of a
 * dialog appear when something opens it, so counting every step's selector
 * against the page at rest reported a healthy dynamic flow as broken: on the
 * customer list, "Add Customer" resolves and everything after it is zero.
 *
 * The prefix ends at the first step that changes what is on screen — that step
 * included, since it is there to be clicked. Everything after it has not been
 * reached, which is a different fact from not being found, and the two are
 * worth telling apart before someone goes looking for a selector that was
 * never wrong.
 */
export const CHANGES_THE_PAGE = new Set<StepKind>([
  'click',
  'submit',
  'navigate',
  'check',
  'uncheck',
  'select',
]);

export function reachableNow(steps: readonly DraftStep[]): number {
  const at = steps.findIndex((step) => CHANGES_THE_PAGE.has(step.kind));
  return at === -1 ? steps.length : at + 1;
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

/**
 * A click on a submit button, followed by a submit of the form it belongs to.
 *
 * The recorder no longer produces this pair, but a draft can still hold one:
 * someone adds the click back by hand, or an agent writes the JSON from a
 * description of the workflow. Running both is the failure this warns about —
 * the click submits the form and closes what it was in, and the submit then
 * matches nothing.
 */
export function duplicateSubmits(draft: Draft): DraftStep[] {
  const doubled: DraftStep[] = [];
  draft.steps.forEach((step, index) => {
    if (step.kind !== 'click' || !step.submitsForm) return;
    const next = draft.steps[index + 1];
    if (next?.kind === 'submit' && next.selector === step.submitsForm) doubled.push(step);
  });
  return doubled;
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
