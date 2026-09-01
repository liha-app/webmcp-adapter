import { describe, expect, it } from 'vitest';
import type { ToolInputSchema } from '@liha/adapter-schema';
import { InputError, buildInputContext, interpolate } from './input';

const schema: ToolInputSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
    score: { type: 'number' },
    active: { type: 'boolean' },
    status: { type: 'string', enum: ['todo', 'done'] },
  },
  required: ['name'],
};

describe('buildInputContext', () => {
  it('coerces declared properties to strings', () => {
    expect(buildInputContext(schema, { name: 'Alice', age: 30, score: 1.5, active: true })).toEqual({
      name: 'Alice',
      age: '30',
      score: '1.5',
      active: 'true',
    });
  });

  it('omits optional properties that were not supplied', () => {
    expect(buildInputContext(schema, { name: 'Alice' })).toEqual({ name: 'Alice' });
  });

  it('rejects missing required properties', () => {
    expect(() => buildInputContext(schema, {})).toThrow(InputError);
    expect(() => buildInputContext(schema, { name: null })).toThrow(/required/);
  });

  it('rejects wrong types rather than coercing them', () => {
    expect(() => buildInputContext(schema, { name: 42 })).toThrow(/must be a string/);
    expect(() => buildInputContext(schema, { name: 'a', age: 1.5 })).toThrow(/must be an integer/);
    expect(() => buildInputContext(schema, { name: 'a', active: 'yes' })).toThrow(/must be a boolean/);
    expect(() => buildInputContext(schema, { name: 'a', score: Number.NaN })).toThrow(/must be a number/);
  });

  it('enforces enum membership', () => {
    expect(buildInputContext(schema, { name: 'a', status: 'done' }).status).toBe('done');
    expect(() => buildInputContext(schema, { name: 'a', status: 'shipped' })).toThrow(/must be one of/);
  });

  it('rejects non-object input', () => {
    expect(() => buildInputContext(schema, 'Alice')).toThrow(/must be a JSON object/);
    expect(() => buildInputContext(schema, ['Alice'])).toThrow(/must be a JSON object/);
    expect(() => buildInputContext(schema, null)).toThrow(/must be a JSON object/);
  });

  // An agent must not be able to reach a placeholder the adapter author never
  // declared, so undeclared keys are dropped before interpolation ever sees them.
  it('drops properties the schema does not declare', () => {
    const context = buildInputContext(schema, { name: 'Alice', injected: 'evil', __proto__: 'evil' });
    expect(context).toEqual({ name: 'Alice' });
    expect('injected' in context).toBe(false);
  });
});

describe('interpolate', () => {
  it('substitutes declared placeholders', () => {
    expect(interpolate('{{name}} <{{email}}>', { name: 'Alice', email: 'a@b.test' })).toBe('Alice <a@b.test>');
    expect(interpolate('{{ name }}', { name: 'Alice' })).toBe('Alice');
  });

  it('leaves text without placeholders untouched', () => {
    expect(interpolate('literal value', {})).toBe('literal value');
  });

  it('throws on a placeholder that is not in the context', () => {
    expect(() => interpolate('{{missing}}', { name: 'Alice' })).toThrow(/unknown placeholder/);
  });

  it('does not recursively expand substituted values', () => {
    expect(interpolate('{{name}}', { name: '{{name}}' })).toBe('{{name}}');
  });
});
