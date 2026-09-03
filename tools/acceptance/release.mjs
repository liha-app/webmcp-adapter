#!/usr/bin/env node
/**
 * What a published build asks for, checked in the browser that will run it.
 *
 * `pnpm build` keeps `localhost` in `host_permissions` so development and every
 * other acceptance suite work. A published build must not: an install carrying
 * it would hold standing access to whatever the user serves on their own
 * machine, and the builtin adapters — which run at `official` trust, so their
 * writes are not confirmed — would be scoped to it.
 *
 * Both halves of that are checked here, and the second is the reason this suite
 * loads a browser at all: the manifest is a file anyone can read, but which
 * origins a builtin ends up claiming is a decision the service worker makes at
 * runtime. This asks it.
 *
 * The release build is made into a directory of its own so `apps/extension/dist`
 * stays the development build the rest of the suites need.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findChromeBinary, findExtensionId } from './chrome.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/;

let passed = 0;
let failed = 0;
const ok = (label, detail = '') => {
  passed += 1;
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
};
const bad = (label, detail = '') => {
  failed += 1;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};
const check = (condition, label, detail) => (condition ? ok(label, detail) : bad(label, detail));

async function main() {
  const out = mkdtempSync(join(tmpdir(), 'liha-release-'));
  console.log('Building the release output…');
  execFileSync('node', ['build.mjs', '--release', `--outdir=${out}`], {
    cwd: join(root, 'apps', 'extension'),
    stdio: 'inherit',
  });
  if (!existsSync(join(out, 'manifest.json'))) throw new Error(`no manifest in ${out}`);

  const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  const expected = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

  console.log('\nThe manifest');
  check(manifest.version === expected, 'ships the version in package.json', `${manifest.version}`);
  const required = manifest.host_permissions ?? [];
  const local = required.filter((pattern) => LOCAL.test(pattern));
  check(local.length === 0, 'asks for no development origin', `${required.length} host permission(s)`);
  const scripts = (manifest.content_scripts ?? []).flatMap((entry) => entry.matches ?? []);
  check(
    scripts.every((pattern) => !LOCAL.test(pattern)),
    'declares no content script for one either',
    `${scripts.length} match pattern(s)`,
  );

  console.log('\nThe catalogue the service worker actually builds');
  const browser = new Browser({ binary: findChromeBinary(), extensionPath: out }).launch();
  try {
    await browser.ready();
    const id = await findExtensionId(browser);
    if (!id) throw new Error('the extension did not register a service worker');
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${id}/manage/manage.html`);
    const adapters = await page.eval(
      `new Promise((resolve) => chrome.runtime.sendMessage({ type: 'liha/list-adapters' }, resolve))`,
    );
    const builtins = (adapters?.installed ?? []).filter((record) => record.source === 'builtin');
    check(builtins.length > 0, 'still ships the builtin adapters', `${builtins.length} builtin(s)`);
    for (const record of builtins) {
      const origins = record.origins ?? [];
      const claimed = origins.filter((origin) => LOCAL.test(origin));
      check(
        origins.length > 0 && claimed.length === 0,
        `${record.id} is scoped to the deployed origins only`,
        origins.join(' '),
      );
    }
    page.close();
  } finally {
    browser.close();
    rmSync(out, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
