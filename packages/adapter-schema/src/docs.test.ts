import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { capabilitySchema, stepSchema } from './index';

/**
 * The prose is a promise, and prose drifts.
 *
 * The agent-facing document at apps/registry/public/agent-setup/prompt.md is
 * already checked against the schema, because an agent follows it without a
 * human reading over its shoulder. The human-facing one had nothing, which is
 * the wrong way round only if you assume people notice — the format doc is
 * where someone looks up a step at 1am, and a step it does not mention is a
 * step nobody uses.
 *
 * The counts are here for the same reason: the README quoted 463 unit tests and
 * 36 production checks for long enough that both were wrong by 40.
 */
const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const format = read('docs/adapter-format.md');

const STEPS = stepSchema.options
  .map((option) => option.shape.type.value as string)
  .filter((step) => step !== 'object');

describe('docs/adapter-format.md', () => {
  it('documents every step the schema accepts', () => {
    for (const step of STEPS) {
      expect(format, `${step} is missing from the format doc`).toContain(`\`${step}\``);
    }
  });

  it('documents every capability', () => {
    for (const capability of capabilitySchema.options) {
      expect(format, `${capability} is missing from the format doc`).toContain(capability);
    }
  });

  it('still says the thing that makes the format safe', () => {
    // If this sentence ever goes, the format has either changed or the doc has
    // stopped describing it. Both are worth a failing test.
    expect(format).toMatch(/selector/i);
    expect(format).toMatch(/no wildcards|exact origin/i);
  });
});

describe('the README', () => {
  const readme = read('README.md');

  it('counts the tools it actually ships', () => {
    const shipped = readdirSync(join(root, 'adapters'))
      .filter((file) => file.endsWith('.json'))
      .reduce((total, file) => {
        const adapter = JSON.parse(read(join('adapters', file))) as { tools?: unknown[] };
        return total + (adapter.tools?.length ?? 0);
      }, 0);
    expect(readme).toContain(`${shipped} tools across three apps`);
  });

  it('links only to files that exist', () => {
    const links = [...readme.matchAll(/\]\(([^)#h][^)]*)\)/g)].map((match) => match[1]!);
    expect(links.length).toBeGreaterThan(3);
    for (const link of links) {
      expect(() => readFileSync(join(root, link.split('#')[0]!)), link).not.toThrow();
    }
  });

  it('names one production host, and it is the one the config declares', () => {
    // Two spellings of it have been live at different times. The config is the
    // source of truth; the prose has to follow it rather than remember it.
    const origins = JSON.parse(read('packages/config/origins.json')) as {
      sites: Record<string, { production: string }>;
    };
    const host = new URL(origins.sites.registry!.production).host;
    const mentioned = new Set([...readme.matchAll(/webmcp-[a-z]+\.liha\.dev/g)].map((match) => match[0]));
    expect([...mentioned]).toEqual([host]);
  });
});
