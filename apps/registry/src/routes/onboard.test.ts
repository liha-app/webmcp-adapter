import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { capabilitySchema, stepSchema } from '@liha/adapter-schema';
import { onboardingPrompt, PROMPT_PATH } from './onboard';

const root = join(import.meta.dirname, '../../../..');
const doc = readFileSync(join(root, 'apps/registry/public', PROMPT_PATH), 'utf8');

describe('the sentence that goes to the clipboard', () => {
  it('points an agent at this origin, not at a hard-coded one', () => {
    expect(onboardingPrompt('http://localhost:5280')).toContain('http://localhost:5280/agent-setup/prompt.md');
    expect(onboardingPrompt('https://webmcp-adapter.liha.dev')).toContain(
      'https://webmcp-adapter.liha.dev/agent-setup/prompt.md',
    );
  });

  it('carries the job as well, when the page has one', () => {
    // The Studio hands over setup and task together, so a visitor pastes one
    // thing into an agent rather than two.
    const withTask = onboardingPrompt('https://x.test', 'Then build me an adapter.');
    expect(withTask).toContain('https://x.test/agent-setup/prompt.md');
    expect(withTask).toContain('Then build me an adapter.');
    expect(withTask.split('\n\n')).toHaveLength(2);
    expect(onboardingPrompt('https://x.test')).not.toContain('\n');
  });

  it('reads as an instruction rather than as a link', () => {
    // Pasted into an agent it has to be a thing to do, not a URL to look at.
    expect(onboardingPrompt('https://x.test')).toMatch(/^Fetch and execute /);
  });
});

describe('the document an agent fetches', () => {
  /*
   * The whole point of this file is that an agent will follow it without a
   * human checking. A step it does not know about is a step it will not use; a
   * step it invents is one that fails validation after the agent has told
   * someone the adapter is ready. So the vocabulary here is checked against the
   * schema rather than trusted to stay in step by hand.
   */
  const steps = stepSchema.options.map((option) => option.shape.type.value as string);
  const capabilities = capabilitySchema.options;

  it('documents every step the schema accepts', () => {
    for (const step of steps) {
      expect(doc, `${step} is missing from the prompt`).toContain(`\`${step}\``);
    }
  });

  it('documents every capability', () => {
    for (const capability of capabilities) {
      expect(doc, `${capability} is missing from the prompt`).toContain(capability);
    }
  });

  it('names no step the schema does not have', () => {
    // The table's first column, which is where an agent will look for the list.
    const table = doc.slice(doc.indexOf('| Step | Fields |'), doc.indexOf('`as` names a key'));
    const named = [...table.matchAll(/^\| `([a-zA-Z]+)`/gm)].map((match) => match[1]!);
    const listed = new Set(named.flatMap((entry) => entry.split(' / ')));
    for (const entry of listed) expect(steps, `the prompt invents a step "${entry}"`).toContain(entry);
  });

  it('says the things that stop an adapter being dangerous', () => {
    // Each of these is a real property of the runtime, and an agent that does
    // not know it will write an adapter that is rejected — or worse, one that
    // a reviewer waves through.
    expect(doc).toContain('It is never applied to a `selector`');
    expect(doc).toMatch(/no way to express one|no step carries executable code/);
    expect(doc).toContain('wildcard origin');
    expect(doc).toMatch(/password fields, card fields/);
    expect(doc).toMatch(/you cannot install anything on your own/i);
  });

  it('tells an agent what the browser needs before any of it works', () => {
    expect(doc).toContain('chrome://flags/#enable-webmcp-testing');
  });
});
