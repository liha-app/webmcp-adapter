import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const target = process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1] ?? 'chrome';
/*
 * A release build asks for the deployed origins and nothing else.
 *
 * `localhost` in host_permissions is a development convenience, and shipping it
 * means every install carries standing access to whatever the person happens to
 * run on their own machine. `--release` drops it; the default keeps it so
 * `pnpm dev` and the acceptance runners still work against the local sites.
 */
const release = process.argv.includes('--release');
// `--outdir` lets a check build somewhere else rather than replacing the
// development output the other acceptance suites are about to run against.
const requested = process.argv.find((arg) => arg.startsWith('--outdir='))?.slice('--outdir='.length);
const outdir = requested ?? join(root, target === 'firefox' ? 'dist-firefox' : 'dist');

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
  { in: 'src/manage/manage.ts', out: 'manage/manage.js', format: 'iife' },
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

/**
 * Builds the manifest from the base file plus the shared origin config.
 *
 * The set of sites this extension may touch is security-relevant, so it is
 * declared once — in packages/config/origins.json — and derived here rather
 * than restated in a manifest, a service worker constant and an adapter file
 * that can quietly fall out of step.
 */
async function writeManifest() {
  const [base, origins] = await Promise.all([
    readFile(join(root, 'manifest.base.json'), 'utf8').then(JSON.parse),
    readFile(join(root, '../../packages/config/origins.json'), 'utf8').then(JSON.parse),
  ]);
  delete base.$comment;

  const patternsFor = (site) => [
    ...(release ? [] : origins.sites[site].development.map((origin) => `${origin}/*`)),
    `${origins.sites[site].production}/*`,
  ];
  const demoSites = Object.keys(origins.sites).filter((site) => site !== 'registry');
  const demoPatterns = demoSites.flatMap(patternsFor);
  const registryPatterns = patternsFor('registry');

  const manifest = {
    ...base,
    content_scripts: [
      {
        matches: demoPatterns,
        js: ['content/bridge.js'],
        run_at: 'document_start',
        world: 'ISOLATED',
        all_frames: false,
      },
      {
        matches: registryPatterns,
        js: ['content/store-bridge.js'],
        run_at: 'document_idle',
        world: 'ISOLATED',
        all_frames: false,
      },
    ],
    host_permissions: [...demoPatterns, ...registryPatterns],
  };

  if (target === 'firefox') {
    manifest.name = 'Liha WebMCP Adapter (Firefox)';
    // Firefox MV3 uses an event page rather than a service worker.
    manifest.background = { scripts: ['service-worker.js'], type: 'module' };
    delete manifest.minimum_chrome_version;
    manifest.browser_specific_settings = {
      gecko: { id: 'liha-webmcp-adapter@liha.dev', strict_min_version: '128.0' },
    };
  }

  await writeFile(join(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function copyStatic() {
  for (const dir of ['popup', 'confirm', 'studio', 'diagnostics', 'manage']) {
    await mkdir(join(outdir, dir), { recursive: true });
    await cp(join(root, `src/${dir}/${dir}.html`), join(outdir, `${dir}/${dir}.html`));
    await cp(join(root, `src/${dir}/${dir}.css`), join(outdir, `${dir}/${dir}.css`));
  }
  // The adapter card's styling, shared by the popup and the Adapters page the
  // same way ui/adapters.ts is shared by their scripts.
  await mkdir(join(outdir, 'ui'), { recursive: true });
  await cp(join(root, 'src/ui/cards.css'), join(outdir, 'ui/cards.css'));
  // The toolbar and extensions-page icons. Generated from the brand master by
  // tools/brand/icons.mjs and committed, so packaging needs no browser.
  await cp(join(root, 'icons'), join(outdir, 'icons'), { recursive: true });
  await writeManifest();
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
  const shown = relative(process.cwd(), outdir);
  console.log(`[liha] extension built to ${shown && !shown.startsWith('..') ? shown : outdir}`);
}
