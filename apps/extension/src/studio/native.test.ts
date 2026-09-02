// @vitest-environment node
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_ADAPTERS } from '@liha/adapters';
import type { AdapterDefinition } from '@liha/adapter-schema';
import { describeStep, nativeWebMcpSource, outputBindings } from './native';

/**
 * The generated file is handed to a stranger to paste into their own site, so
 * the bar is higher than "it looks about right": it has to parse, it has to
 * survive whatever selectors the adapter happens to contain, and it has to say
 * true things about the API — the three facts it asserts are the ones this
 * project measured and got wrong first.
 */
const shipped = OFFICIAL_ADAPTERS;

/** esbuild throws on a syntax error, which is the whole point of asking it. */
const parses = (source: string) => {
  transformSync(source, { loader: 'js', format: 'esm' });
  return true;
};

describe.each(shipped)('the native snippet for $name', (adapter) => {
  const source = nativeWebMcpSource(adapter);

  it('is valid JavaScript', () => {
    expect(parses(source)).toBe(true);
  });

  it('registers every tool the adapter declares, by name and description', () => {
    for (const tool of adapter.tools) {
      expect(source).toContain(`name: ${JSON.stringify(tool.name)}`);
      expect(source).toContain(`description: ${JSON.stringify(tool.description)}`);
    }
    const registrations = source.match(/registerTool\(/g) ?? [];
    expect(registrations).toHaveLength(adapter.tools.length);
  });

  it('carries the input schema across unchanged', () => {
    for (const tool of adapter.tools) {
      // Whitespace differs; the meaning must not.
      const emitted = source.slice(source.indexOf(`name: ${JSON.stringify(tool.name)}`));
      const schema = emitted.slice(emitted.indexOf('inputSchema: ') + 'inputSchema: '.length);
      const parsed = JSON.parse(schema.slice(0, schema.indexOf('\n      },') + '\n      }'.length));
      expect(parsed).toEqual(tool.inputSchema);
    }
  });

  it('validates its own input, because the browser will not', () => {
    for (const tool of adapter.tools) {
      for (const name of tool.inputSchema.required ?? []) {
        expect(source).toContain(`const ${name} = input?.${name};`);
        expect(source).toContain(`return failed(${JSON.stringify(`${name} is required and must be a string`)})`);
      }
    }
  });

  it('writes out the workflow the adapter performed, in order', () => {
    for (const tool of adapter.tools) {
      const steps = tool.steps.map((step) => describeStep(step));
      let at = source.indexOf(`name: ${JSON.stringify(tool.name)}`);
      for (const step of steps) {
        const found = source.indexOf(step, at);
        expect(found, `${tool.name}: ${step}`).toBeGreaterThan(at);
        at = found;
      }
    }
  });

  it('returns errors rather than throwing them', () => {
    // A thrown error reaches the agent as UnknownError with no reason attached.
    expect(source).toContain('isError: true');
    expect(source).not.toMatch(/\bthrow new /);
  });

  it('takes an AbortSignal, the only way a tool can be removed', () => {
    expect(source).toContain('new AbortController()');
    expect(source).toContain('{ signal: registration.signal }');
  });

  it('leaves a browser without WebMCP exactly as it was', () => {
    expect(source).toContain('if (!document.modelContext) return false;');
  });

  it('names the structured output the tool produces', () => {
    for (const tool of adapter.tools) {
      for (const binding of outputBindings(tool)) expect(source).toContain(`${binding}: /* ... */ null`);
    }
  });
});

describe('hostile input', () => {
  /** A selector is copied into a block comment; one containing */ /* would end it early. */
  const adapter = {
    id: 'x',
    name: 'X */ still a comment',
    version: '1.0.0',
    origins: ['https://x.example.com'],
    tools: [
      {
        name: 't',
        description: 'd',
        capability: 'READ',
        inputSchema: { type: 'object', properties: {} },
        steps: [{ type: 'click', selector: "[data-x='*/ eval(1) /*']" }],
      },
    ],
  } as unknown as AdapterDefinition;

  it('cannot be made to close the comment it is written into', () => {
    const source = nativeWebMcpSource(adapter);
    expect(parses(source)).toBe(true);
    expect(source).not.toContain('*/ eval(1)');
  });
});
