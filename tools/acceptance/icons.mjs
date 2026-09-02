#!/usr/bin/env node
/**
 * Does Chrome actually show the extension's icon?
 *
 * For a whole release it did not: the manifest declared none and the toolbar
 * wore Chrome's grey placeholder letter. `icons.test.ts` reads the PNGs and
 * the base manifest, which would have caught that — but only a browser can say
 * whether Chrome parsed the manifest it was given and can resolve the paths in
 * it. An icon declared at a path that does not exist is still a valid-looking
 * manifest.
 *
 * So this asks the extension itself, from inside its own service worker, and
 * `chrome.runtime.getManifest()` is Chrome's parsed copy rather than the file
 * on disk.
 *
 * Run with:  pnpm build && pnpm acceptance:icons
 *
 * Point LIHA_EXTENSION at an unzipped release artifact to check the icons in
 * the thing people actually download, the way acceptance:prod does.
 */
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, Session, findChromeBinary, sleep } from './chrome.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SIZES = [16, 32, 48, 128];

const checks = [];
const assert = (ok, message, detail = '') => checks.push({ ok: Boolean(ok), message, detail: String(detail) });

const extension = process.env.LIHA_EXTENSION ?? join(root, 'apps/extension/dist');

// Checked before launching, because the symptom otherwise is the same silence
// as a missing icon file: the Firefox build declares an event page rather than
// a service worker, so Chrome starts nothing and there is no target to ask.
const declared = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
if (!declared.background?.service_worker) {
  console.error(`${extension} is not a Chrome build — point LIHA_EXTENSION at the chrome artifact`);
  process.exit(1);
}

const browser = new Browser({
  binary: findChromeBinary(),
  extensionPath: extension,
  headless: true,
}).launch();

try {
  await browser.ready();
  const target = await browser.waitForTarget(
    (candidate) => candidate.type === 'service_worker' && candidate.url.endsWith('/service-worker.js'),
  );
  // Worth knowing: an icon declared at a path that is not there does not merely
  // look wrong. Chrome refuses to load the extension at all, and the only sign
  // is that nothing ever starts — which is what this branch is.
  if (!target) {
    throw new Error(
      'the extension never started — Chrome refuses to load one whose manifest ' +
        'declares an icon at a path that is not there, so check every entry in icons/default_icon',
    );
  }
  const worker = await new Session(target.webSocketDebuggerUrl).open();

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await worker.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) {
      const detail = exceptionDetails.exception?.description ?? exceptionDetails.text ?? 'evaluation failed';
      throw new Error(`${detail}
  while evaluating: ${expression.slice(0, 120)}`);
    }
    return result.value;
  };

  /*
   * A service worker can be paused at its first statement when a debugger
   * attaches, and until it runs, the extension bindings are not installed —
   * `chrome` is genuinely undefined and every question asked of it fails with
   * a ReferenceError that reads like the extension is broken. Let it run, then
   * wait for the binding to exist before asking anything.
   */
  await worker.send('Runtime.runIfWaitingForDebugger').catch(() => undefined);
  const bound = await (async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const typed = await evaluate('typeof chrome').catch(() => 'undefined');
      if (typed === 'object') return true;
      await sleep(100);
    }
    return false;
  })();
  if (!bound) throw new Error('the extension service worker never received its chrome bindings');

  const manifest = await evaluate('chrome.runtime.getManifest()');
  const expected = Object.fromEntries(SIZES.map((size) => [String(size), `icons/icon-${size}.png`]));

  assert(
    JSON.stringify(manifest.icons) === JSON.stringify(expected),
    'Chrome parsed an icon set out of the manifest',
    Object.values(manifest.icons ?? {}).join(' ') || 'none — the toolbar falls back to a grey letter',
  );
  assert(
    JSON.stringify(manifest.action?.default_icon) === JSON.stringify(expected),
    'and a toolbar icon for the action',
    Object.values(manifest.action?.default_icon ?? {}).join(' ') || 'none',
  );

  // Declared is not the same as present. Fetched from inside the extension,
  // which is the origin that has to be able to read them.
  const fetched = await evaluate(`Promise.all(${JSON.stringify(Object.values(expected))}.map(async (path) => {
    const response = await fetch(chrome.runtime.getURL(path));
    const bytes = await response.arrayBuffer();
    return { path, status: response.status, type: response.headers.get('content-type'), bytes: bytes.byteLength };
  }))`);

  for (const file of fetched) {
    assert(
      file.status === 200 && file.type === 'image/png' && file.bytes > 300,
      `${file.path} resolves inside the extension`,
      `${file.status} · ${file.type} · ${file.bytes} bytes`,
    );
  }
} finally {
  browser.close();
}

for (const check of checks) console.log(`  ${check.ok ? '✓' : '✗'} ${check.message}${check.detail ? ` — ${check.detail}` : ''}`);
const failed = checks.filter((check) => !check.ok).length;
console.log(`\n${checks.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
