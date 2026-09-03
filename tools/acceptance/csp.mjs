#!/usr/bin/env node
/**
 * Loads every built site under the exact Content-Security-Policy Cloudflare
 * will send, and fails on any violation.
 *
 * The `_headers` files say the policy is "verified against the built site
 * before every deploy". It was, by hand — this is that claim as something
 * runnable. A policy nobody has run against the app it protects is a guess,
 * and the way it breaks is quiet: the page still renders, minus whatever the
 * browser refused.
 *
 * Run with:  pnpm build && pnpm acceptance:csp
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { Browser, findChromeBinary, sleep } from '../acceptance/chrome.mjs';

/** Serves a built site under the exact headers Cloudflare will send. */
function serveWithHeaders(dir, port) {
  const policy = readFileSync(join(dir, '_headers'), 'utf8')
    .split('\n')
    .find((line) => line.trim().toLowerCase().startsWith('content-security-policy:'));
  const csp = policy.split(':').slice(1).join(':').trim();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  const server = createServer((request, response) => {
    const path = request.url.split('?')[0];
    let file = join(dir, path === '/' ? 'index.html' : path);
    let body;
    try {
      body = readFileSync(file);
    } catch {
      file = join(dir, 'index.html');
      body = readFileSync(file);
    }
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'content-security-policy': csp,
    });
    response.end(body);
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ csp, close: () => server.close() })));
}

let failures = 0;
const SITES = [
  ['demo-crm', 5273, ['/']],
  ['demo-shop', 5274, ['/', '/cart']],
  ['demo-project', 5275, ['/']],
  ['registry', 5280, ['/', '/create', '/adapters', '/adapters/demo-crm']],
];

for (const [id, port, routes] of SITES) {
  const { close } = await serveWithHeaders(`${process.cwd()}/apps/${id}/dist`, port);
  const browser = new Browser({ binary: findChromeBinary(), headless: true }).launch();
  await browser.ready();
  const page = await browser.firstPage();
  const violations = [];
  page.on((message) => {
    if (message.method === 'Log.entryAdded' && /Content Security Policy/i.test(message.params.entry.text)) {
      violations.push(message.params.entry.text);
    }
  });
  await page.send('Log.enable');
  for (const route of routes) {
    await page.goto(`http://localhost:${port}${route}`);
    await sleep(900);
  }
  // Every site offers the appearance switch, and applying it before paint is
  // script — exactly what a strict policy refuses when it is written inline.
  const themed = await page.eval(`Boolean(document.querySelector('[data-theme-option]'))`);
  const ok = violations.length === 0 && themed;
  console.log(
    `  ${ok ? '✓' : '✗'} ${id} — ${routes.length} route(s), ${violations.length} violation(s), ` +
      `appearance control ${themed ? 'present' : 'MISSING'}`,
  );
  for (const violation of violations) console.log('     ', violation.slice(0, 160));
  if (!ok) failures++;
  browser.close();
  close();
}
console.log(
  failures === 0
    ? `\n${SITES.length}/${SITES.length} sites load cleanly under the policy they ship`
    : `\n${failures} of ${SITES.length} sites failed`,
);
process.exit(failures ? 1 : 0);
