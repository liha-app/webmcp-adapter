import { z } from 'zod';
import { isExactOrigin } from './origin';

/**
 * Capability classification. Surfaced in the UI before install so a user can
 * see what an adapter is allowed to do with their authenticated session, and
 * used at call time to decide whether to ask for confirmation.
 */
export const capabilitySchema = z.enum(['READ', 'INTERACT', 'WRITE', 'DESTRUCTIVE']);
export type Capability = z.infer<typeof capabilitySchema>;

export const CAPABILITY_ORDER: Record<Capability, number> = {
  READ: 0,
  INTERACT: 1,
  WRITE: 2,
  DESTRUCTIVE: 3,
};

export function highestCapability(capabilities: readonly Capability[]): Capability {
  return capabilities.reduce<Capability>(
    (highest, candidate) => (CAPABILITY_ORDER[candidate] > CAPABILITY_ORDER[highest] ? candidate : highest),
    'READ',
  );
}

/**
 * A CSS selector. Selectors are *never* interpolated with tool input: a tool
 * argument can never widen or retarget the element a step acts on.
 */
const selectorSchema = z.string().min(1).max(500);
const templateSchema = z.string().max(2000);
const bindingSchema = z.string().min(1).max(64);

/**
 * The step vocabulary is a closed set of plain data.
 *
 * There is deliberately no `script`, `eval`, `fn`, `expression` or `onBefore`
 * step, and no step may carry executable code. An adapter that wants to run
 * arbitrary JavaScript has no way to say so. This is the single most important
 * property of the format and it is enforced by this union.
 */
export const stepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), selector: selectorSchema }),
  z.object({ type: z.literal('fill'), selector: selectorSchema, value: templateSchema }),
  z.object({ type: z.literal('select'), selector: selectorSchema, value: templateSchema }),
  z.object({ type: z.literal('check'), selector: selectorSchema }),
  z.object({ type: z.literal('uncheck'), selector: selectorSchema }),
  z.object({ type: z.literal('submit'), selector: selectorSchema }),
  z.object({
    type: z.literal('waitFor'),
    selector: selectorSchema,
    /** `absent` waits for the element to go away — a closing dialog, a spinner. */
    state: z.enum(['present', 'absent']).optional(),
    timeoutMs: z.number().int().min(0).max(30_000).optional(),
  }),
  z.object({ type: z.literal('assertVisible'), selector: selectorSchema }),
  z.object({ type: z.literal('assertText'), selector: selectorSchema, contains: templateSchema }),
  z.object({ type: z.literal('readText'), selector: selectorSchema, as: bindingSchema }),
  z.object({
    type: z.literal('readAttribute'),
    selector: selectorSchema,
    attribute: z.string().min(1).max(64),
    as: bindingSchema,
  }),
  z.object({
    type: z.literal('readList'),
    selector: selectorSchema,
    as: bindingSchema,
    limit: z.number().int().min(1).max(100).optional(),
    fields: z
      .record(
        z.object({
          selector: selectorSchema.optional(),
          attribute: z.string().min(1).max(64).optional(),
        }),
      )
      .optional(),
  }),
  /**
   * Same-origin path navigation only. Absolute URLs are not representable, so
   * an adapter cannot navigate a user off the origin they approved.
   */
  z.object({ type: z.literal('navigate'), path: z.string().min(1).max(500) }),
]);
export type Step = z.infer<typeof stepSchema>;

export type SelectorStep = Extract<Step, { selector: string }>;

export function stepSelector(step: Step): string | null {
  return 'selector' in step ? step.selector : null;
}

/** The JSON Schema subset the runtime validates tool input against. */
export const inputSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(
    z.object({
      type: z.enum(['string', 'number', 'integer', 'boolean']),
      description: z.string().max(500).optional(),
      format: z.string().max(64).optional(),
      enum: z.array(z.string()).min(1).max(50).optional(),
    }),
  ),
  required: z.array(z.string()).optional(),
});
export type ToolInputSchema = z.infer<typeof inputSchemaSchema>;

export const toolSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'tool names must be snake_case'),
  title: z.string().max(120).optional(),
  description: z.string().min(1).max(1000),
  capability: capabilitySchema,
  inputSchema: inputSchemaSchema,
  /**
   * Selectors expected to exist while the page is at rest. Used for health
   * checks; defaults to the first step's selector when omitted.
   */
  probeSelectors: z.array(selectorSchema).max(10).optional(),
  /**
   * Where on the site this tool applies. Every selector must resolve for the
   * tool to be checked at all.
   *
   * An adapter usually covers more than one kind of page. A tool that reads a
   * package's version list belongs on a package page and finds nothing on the
   * registry's front page — which is not a fault, but was reported as one, and
   * dragged the whole adapter to `degraded` on the site's most-visited page.
   * Declaring this is how a tool says "not here" instead of "broken".
   */
  appliesWhen: z.array(selectorSchema).max(10).optional(),
  steps: z.array(stepSchema).min(1).max(50),
});
export type ToolDefinition = z.infer<typeof toolSchema>;

const originSchema = z
  .string()
  .min(1)
  .refine(isExactOrigin, 'must be an exact origin such as "https://crm.example.com" (no wildcards, no path)');

export const adapterCategorySchema = z.enum([
  'crm',
  'commerce',
  'productivity',
  'developer-tools',
  'registry',
  'other',
]);
export type AdapterCategory = z.infer<typeof adapterCategorySchema>;

export const adapterSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'adapter ids must be kebab-case'),
  name: z.string().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'must be semver'),
  description: z.string().max(1000).optional(),
  category: adapterCategorySchema.optional(),
  author: z.string().max(120).optional(),
  homepage: z.string().max(300).optional(),
  /** When the adapter author last confirmed this definition against the site. */
  verifiedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /**
   * A single adapter is scoped to one site. Multiple entries exist only to
   * cover equivalent hosts for the same app (localhost and 127.0.0.1), never to
   * span different services.
   */
  origins: z.array(originSchema).min(1).max(4),
  tools: z.array(toolSchema).min(1).max(50),
});
export type AdapterDefinition = z.infer<typeof adapterSchema>;

export interface AdapterValidationResult {
  ok: boolean;
  adapter?: AdapterDefinition;
  errors: string[];
}

/**
 * Adapter definitions are untrusted input regardless of where they came from —
 * bundled, downloaded from the registry, or hand-written in the Studio.
 * Nothing is installed unvalidated.
 */
export function validateAdapter(input: unknown): AdapterValidationResult {
  const parsed = adapterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    };
  }
  const errors: string[] = [];
  const names = parsed.data.tools.map((tool) => tool.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) errors.push(`duplicate tool names: ${[...new Set(duplicates)].join(', ')}`);

  for (const tool of parsed.data.tools) {
    const declared = new Set(Object.keys(tool.inputSchema.properties));
    for (const key of tool.inputSchema.required ?? []) {
      if (!declared.has(key)) errors.push(`${tool.name}: required property "${key}" is not declared`);
    }
    // A placeholder that no property can ever fill is a broken tool, and it is
    // better to reject it at validation time than to fail at call time.
    for (const step of tool.steps) {
      for (const template of templatesOf(step)) {
        for (const placeholder of placeholdersIn(template)) {
          if (!declared.has(placeholder)) {
            errors.push(`${tool.name}: step references undeclared placeholder "{{${placeholder}}}"`);
          }
        }
      }
    }
    // Capability cannot be derived mechanically — typing into a search box is a
    // read, clicking a button may be a delete — so it stays an author
    // declaration that reviewers check against the visible steps. The one
    // invariant worth enforcing is narrow and unambiguous: a READ tool may not
    // submit a form or navigate, because both are app-level transitions.
    if (tool.capability === 'READ') {
      const transition = tool.steps.find((step) => TRANSITION_STEPS.has(step.type));
      if (transition) {
        errors.push(`${tool.name}: declared READ but uses the transition step "${transition.type}"`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, adapter: parsed.data, errors: [] };
}

const TRANSITION_STEPS = new Set(['submit', 'navigate']);

/**
 * A factual summary of what a tool's steps do.
 *
 * Deliberately *not* an inferred capability. Typing into a search box is a
 * read; clicking a button may open a panel or delete an account. No static
 * analysis can tell those apart, so rather than pretend to, the Store and
 * Studio show the counts next to the author's declared capability and let a
 * human make the judgement — which is the only place it can honestly be made.
 */
export interface ToolEffects {
  clicks: number;
  inputs: number;
  submits: number;
  navigations: number;
  reads: number;
  waits: number;
  asserts: number;
  /** No step in this tool can change anything on the page. */
  readOnly: boolean;
}

const INPUT_STEPS = new Set(['fill', 'select', 'check', 'uncheck']);
const READ_STEPS = new Set(['readText', 'readAttribute', 'readList']);
const ASSERT_STEPS = new Set(['assertVisible', 'assertText']);

export function summarizeEffects(tool: ToolDefinition): ToolEffects {
  const effects: ToolEffects = {
    clicks: 0,
    inputs: 0,
    submits: 0,
    navigations: 0,
    reads: 0,
    waits: 0,
    asserts: 0,
    readOnly: true,
  };
  for (const step of tool.steps) {
    if (step.type === 'click') effects.clicks++;
    else if (INPUT_STEPS.has(step.type)) effects.inputs++;
    else if (step.type === 'submit') effects.submits++;
    else if (step.type === 'navigate') effects.navigations++;
    else if (READ_STEPS.has(step.type)) effects.reads++;
    else if (step.type === 'waitFor') effects.waits++;
    else if (ASSERT_STEPS.has(step.type)) effects.asserts++;
  }
  effects.readOnly =
    effects.clicks === 0 && effects.inputs === 0 && effects.submits === 0 && effects.navigations === 0;
  return effects;
}

function templatesOf(step: Step): string[] {
  const out: string[] = [];
  if ('value' in step && typeof step.value === 'string') out.push(step.value);
  if ('contains' in step && typeof step.contains === 'string') out.push(step.contains);
  if (step.type === 'navigate') out.push(step.path);
  return out;
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function placeholdersIn(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1] as string);
}
