import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const target = process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1] ?? 'chrome';
const outdir = join(root, target === 'firefox' ? 'dist-firefox' : 'dist');

/**
 * Separate bundles because they run in separate places:
 *  - service-worker      : the extension's background context
 *  - content/*           : ISOLATED world content scripts
 *  - main-world/runtime  : the page's MAIN world — must not reference chrome.*
 *  - popup / confirm / studio : extension pages
 */
const bundles = [
  { in: 'src/background/service-worker.ts', out: 'service-worker.js', format: 'esm' },
  { in: 'src/content/bridge.ts', out: 'content/bridge.js', format: 'iife' },
  { in: 'src/content/store-bridge.ts', out: 'content/store-bridge.js', format: 'iife' },
  { in: 'src/main-world/entry.ts', out: 'main-world/runtime.js', format: 'iife' },
  { in: 'src/popup/popup.ts', out: 'popup/popup.js', format: 'iife' },
  { in: 'src/confirm/confirm.ts', out: 'confirm/confirm.js', format: 'iife' },
  { in: 'src/studio/studio.tsx', out: 'studio/studio.js', format: 'iife' },
  { in: 'src/diagnostics/diagnostics.ts', out: 'diagnostics/diagnostics.js', format: 'iife' },
];

const common = {
  bundle: true,
  target: ['chrome111', 'firefox128'],
  platform: 'browser',
  logLevel: 'warning',
  legalComments: 'none',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  // No source maps in a release build: the MAIN-world script is injected into
  // arbitrary pages and should stay as small and boring as possible.
  sourcemap: watch,
  minify: !watch,
};

async function copyStatic() {
  for (const dir of ['popup', 'confirm', 'studio', 'diagnostics']) {
    await mkdir(join(outdir, dir), { recursive: true });
    await cp(join(root, `src/${dir}/${dir}.html`), join(outdir, `${dir}/${dir}.html`));
    await cp(join(root, `src/${dir}/${dir}.css`), join(outdir, `${dir}/${dir}.css`));
  }
  await cp(
    join(root, target === 'firefox' ? 'manifest.firefox.json' : 'manifest.json'),
    join(outdir, 'manifest.json'),
  );
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

if (watch) {
  const contexts = await Promise.all(
    bundles.map((bundle) =>
      context({
        ...common,
        entryPoints: [join(root, bundle.in)],
        outfile: join(outdir, bundle.out),
        format: bundle.format,
      }),
    ),
  );
  await copyStatic();
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('[liha] watching extension sources; static files are copied once at start');
} else {
  await Promise.all(
    bundles.map((bundle) =>
      build({
        ...common,
        entryPoints: [join(root, bundle.in)],
        outfile: join(outdir, bundle.out),
        format: bundle.format,
      }),
    ),
  );
  await copyStatic();
  console.log(`[liha] extension built to apps/extension/${target === 'firefox' ? 'dist-firefox' : 'dist'}`);
}
