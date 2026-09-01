# Deployment

## The registry (the public URL)

`apps/registry` is a static Vite build with no backend and no database — the
adapter catalogue is compiled in from `adapters/*.json`.

```bash
pnpm install
pnpm --filter @liha/registry build     # → apps/registry/dist
```

Serve `apps/registry/dist` from any static host. It is a single-page app, so
route every unmatched path to `index.html`.

| Host | Setting |
|---|---|
| Netlify | publish `apps/registry/dist`, redirect `/* → /index.html 200` |
| Vercel | output `apps/registry/dist`, rewrite `/(.*) → /index.html` |
| GitHub Pages | build with a base path, add a `404.html` copy of `index.html` |
| Cloudflare Pages | build `pnpm --filter @liha/registry build`, output `apps/registry/dist` |

**One thing to change when you deploy:** the extension's store bridge is scoped
to `http://localhost:5280` in `apps/extension/manifest.json`. Add your real
origin to both `content_scripts[1].matches` and `host_permissions`, and to
`STATIC_ORIGINS` in `apps/extension/src/background/service-worker.ts`, or the
Install button will do nothing on the deployed site.

The registry registers its own WebMCP tools, which requires a secure context.
`https://` or `http://localhost` both qualify; plain `http://` on a public host
does not.

## The demo apps

Same shape — static builds on fixed ports:

| App | Port | Build |
|---|---|---|
| Acme CRM | 5273 | `pnpm --filter @liha/demo-crm build` |
| Nimbus Supply | 5274 | `pnpm --filter @liha/demo-shop build` |
| Kite Project Manager | 5275 | `pnpm --filter @liha/demo-project build` |

The ports are not cosmetic: each adapter is scoped to an exact origin. Serving
the CRM anywhere other than `http://localhost:5273` means its adapter will not
run there — by design. To host the demos publicly, change the `origins` in
`adapters/*.json` to the deployed origins and rebuild.

`pnpm demo` serves all four locally from their production builds.

## The extension

```bash
pnpm --filter @liha/extension build           # → apps/extension/dist
pnpm --filter @liha/extension build:firefox   # → apps/extension/dist-firefox
```

**Chrome (unpacked, the supported path today):** `chrome://extensions` →
Developer mode → **Load unpacked** → `apps/extension/dist`.

**Chrome Web Store:** zip the contents of `dist`. Publishing is deliberately not
required — an unpacked extension is enough to run and audit everything here.

**Firefox:** `about:debugging` → This Firefox → **Load Temporary Add-on** →
`apps/extension/dist-firefox/manifest.json`. See
[firefox.md](firefox.md) for what does and does not work there.

## Reproducing the verification

```bash
pnpm verify              # typecheck, lint, 192 unit + integration tests, build
pnpm e2e                 # 23 Playwright tests against the demo apps and registry
pnpm acceptance:all      # three real-browser runs through the WebMCP protocol
```

`pnpm acceptance:*` needs a Chromium build that permits `--load-extension`.
Branded Google Chrome refuses that switch, so the runners use Chrome for Testing:
they find a Playwright-cached one automatically, or run `pnpm chrome:install`, or
set `LIHA_CHROME` to your own build. This restriction applies only to automation
— loading the unpacked extension by hand in normal Chrome is unaffected.
