import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A release build asks for the deployed origins and nothing else.
 *
 * `localhost` in host_permissions is a development convenience. Shipping it
 * means every install carries standing access to whatever the person happens to
 * be running on their own machine, which is not something a store listing
 * should quietly include.
 */
const root = join(import.meta.dirname, '../../apps/extension');

function manifest(...args: string[]) {
  execFileSync('node', [join(root, 'build.mjs'), ...args], { cwd: root, stdio: 'ignore' });
  return JSON.parse(readFileSync(join(root, 'dist/manifest.json'), 'utf8')) as {
    permissions: string[];
    host_permissions: string[];
    content_scripts: Array<{ matches: string[] }>;
  };
}

describe('the release manifest', () => {
  it('asks for no local origin, in permissions or in content scripts', () => {
    const release = manifest('--release');
    const everything = [...release.host_permissions, ...release.content_scripts.flatMap((entry) => entry.matches)];
    expect(everything.length).toBeGreaterThan(0);
    for (const pattern of everything) {
      expect(pattern, pattern).not.toMatch(/localhost|127\.0\.0\.1/);
      expect(pattern, pattern).toMatch(/^https:\/\//);
    }
  });

  it('keeps them in the default build, which is what development runs on', () => {
    const dev = manifest();
    expect(dev.host_permissions.some((pattern) => pattern.includes('localhost'))).toBe(true);
  });

  it('uses temporary active-tab access to record a site before it has an adapter', () => {
    const release = manifest('--release');
    expect(release.permissions).toContain('activeTab');
  });
});
