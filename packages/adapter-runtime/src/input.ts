import type { ToolInputSchema } from '@liha/adapter-schema';

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

export type InputContext = Record<string, string>;

/**
 * Chrome does **not** validate tool input against the declared `inputSchema`
 * before calling `execute` — verified empirically, see docs/webmcp-api.md.
 * A tool that trusts its arguments is therefore trusting whatever an agent
 * happened to send, so the runtime validates before touching the page.
 *
 * The returned context contains *only* properties declared in the schema.
 * Undeclared input keys are dropped, so a caller cannot smuggle extra values
 * into a `{{placeholder}}` the adapter author never declared.
 */
export function buildInputContext(schema: ToolInputSchema, raw: unknown): InputContext {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InputError('tool input must be a JSON object');
  }
  const input = raw as Record<string, unknown>;
  const required = new Set(schema.required ?? []);
  const context: InputContext = {};

  for (const [key, property] of Object.entries(schema.properties)) {
    const value = input[key];
    if (value === undefined || value === null) {
      if (required.has(key)) throw new InputError(`missing required property "${key}"`);
      continue;
    }
    switch (property.type) {
      case 'string': {
        if (typeof value !== 'string') throw new InputError(`property "${key}" must be a string`);
        if (property.enum && !property.enum.includes(value)) {
          throw new InputError(`property "${key}" must be one of: ${property.enum.join(', ')}`);
        }
        context[key] = value;
        break;
      }
      case 'number':
      case 'integer': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new InputError(`property "${key}" must be a number`);
        }
        if (property.type === 'integer' && !Number.isInteger(value)) {
          throw new InputError(`property "${key}" must be an integer`);
        }
        context[key] = String(value);
        break;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') throw new InputError(`property "${key}" must be a boolean`);
        context[key] = value ? 'true' : 'false';
        break;
      }
    }
  }

  for (const key of required) {
    if (!(key in context)) throw new InputError(`missing required property "${key}"`);
  }
  return context;
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Substitutes `{{name}}` placeholders. Interpolation is applied to step
 * *values* only, never to selectors, so tool input cannot retarget a step.
 * Substituted text is not re-scanned, so a value containing `{{x}}` stays
 * literal rather than expanding.
 */
export function interpolate(template: string, context: InputContext): string {
  return template.replace(PLACEHOLDER, (_match, key: string) => {
    if (!(key in context)) throw new InputError(`step references unknown placeholder "{{${key}}}"`);
    return context[key] ?? '';
  });
}
