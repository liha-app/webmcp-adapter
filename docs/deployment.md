# Deployment

## Origins are configured in one place

Every origin this project runs on is declared in
[`packages/config/origins.json`](../packages/config/origins.json). The adapter
definitions, the extension manifest, the service worker's static-origin list and
the portal's demo links all derive from it.

```json
{
  "registry":     { "port": 5280, "production": "https://webmcp-adopter.liha.dev" },
  "demo-crm":     { "port": 5273, "production": "https://demo-crm.liha.review" },
  "demo-shop":    { "port": 5274, "production": "https://demo-shop.liha.review" },
  "demo-project": { "port": 5275, "production": "https://demo-project.liha.review" }
}
```

The portal is on `liha.dev`; the three demo apps are on `liha.review`, on a
separate domain on purpose — they are deliberately plain sample applications and
do not belong on the product domain. Nothing in the design depends on them
sharing a parent domain: every origin is exact and independent.

Development and production origins are both listed, as **separate exact
origins**. Adapters are scoped to each one individually — there is no wildcard
anywhere, and adding one would defeat the property the whole security model
rests on. A test asserts every published adapter's origins match this file, so
the two cannot drift.

To deploy somewhere else, change this file and rebuild. Nothing else needs
editing.

## The portal and registry

`apps/registry` serves the landing page at `/`, the adapter list at `/adapters`
and each adapter at `/adapters/:id`. It is a static build with no backend — the
catalogue is compiled in from `adapters/*.json`.

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
| Cloudflare Pages | build `pnpm --filter @liha/registry build`, output `apps/registry/dist` |
| GitHub Pages | add a `404.html` copy of `index.html` |

The portal registers its own WebMCP tools, which requires a **secure context**.
`https://` and `http://localhost` both qualify; plain `http://` on a public host
does not, and the tools will silently not register there.

## The demo apps

| App | Port | Production | Build |
|---|---|---|---|
| Acme CRM | 5273 | `demo-crm.liha.review` | `pnpm --filter @liha/demo-crm build` |
| Nimbus Supply | 5274 | `demo-shop.liha.review` | `pnpm --filter @liha/demo-shop build` |
| Kite Project Manager | 5275 | `demo-project.liha.review` | `pnpm --filter @liha/demo-project build` |

Nimbus Supply has a `/cart` route, so it needs the same SPA fallback as the
portal. The other two are single-route but the fallback does no harm.

`pnpm demo` serves all four locally from their production builds.

## What is actually deployed

Cloudflare Pages, four projects in the `Liha` account. Each one is a plain
static upload of a built `dist` — no build step runs on Cloudflare, so what is
served is exactly what `pnpm build` produced locally and what CI tested.

| Project | Directory | Domain |
|---|---|---|
| `webmcp-adopter` | `apps/registry/dist` | `webmcp-adopter.liha.dev` |
| `webmcp-demo-crm` | `apps/demo-crm/dist` | `demo-crm.liha.review` |
| `webmcp-demo-shop` | `apps/demo-shop/dist` | `demo-shop.liha.review` |
| `webmcp-demo-project` | `apps/demo-project/dist` | `demo-project.liha.review` |

```bash
pnpm build
export CLOUDFLARE_ACCOUNT_ID=<the Liha account id>
wrangler pages deploy apps/registry/dist     --project-name=webmcp-adopter      --branch=main
wrangler pages deploy apps/demo-crm/dist     --project-name=webmcp-demo-crm     --branch=main
wrangler pages deploy apps/demo-shop/dist    --project-name=webmcp-demo-shop    --branch=main
wrangler pages deploy apps/demo-project/dist --project-name=webmcp-demo-project --branch=main
```

Each hostname needs a proxied `CNAME` to its project's `*.pages.dev` name:

| Zone | Name | Target |
|---|---|---|
| liha.dev | `webmcp-adopter` | `webmcp-adopter.pages.dev` |
| liha.review | `demo-crm` | `webmcp-demo-crm.pages.dev` |
| liha.review | `demo-shop` | `webmcp-demo-shop.pages.dev` |
| liha.review | `demo-project` | `webmcp-demo-project.pages.dev` |

**Two things on these zones will silently swallow a Pages custom domain.** Both
cost an hour if you do not know about them:

1. *A proxied wildcard DNS record.* Every subdomain already resolves, so
   nothing looks broken — the hostname simply answers as whatever the wildcard
   points at. An explicit record beats the wildcard and fixes it.

2. *A wildcard Worker route.* `liha.review` has `*.liha.review/*` bound to
   another service, and **Cloudflare matches Worker routes before Pages custom
   domains** — so correct DNS is not enough, and the Pages domain will report
   itself `active` while the Worker keeps answering. The fix is a more specific
   route with **no Worker attached** for each hostname:

   ```
   demo-crm.liha.review/*       → (no worker)
   demo-shop.liha.review/*      → (no worker)
   demo-project.liha.review/*   → (no worker)
   ```

   More specific patterns win, so this affects only those three hostnames and
   leaves the wildcard route serving everything else.

## Verifying a deploy

```bash
pnpm acceptance:prod
```

Reads the production origins from `origins.json`, then checks them the way a
user and an agent actually meet them: HTTPS and the documented response headers
on every origin, the SPA fallback on a deep route, the portal's six native
tools registered on its real origin, and — with the extension loaded — an
out-of-page agent driving the deployed Acme CRM through its adapter and
reading back the id the deployed app assigned.

A build passing locally says nothing about certificates, secure contexts,
response headers or whether a Worker route is eating your traffic.

To check a published release rather than the local build — that what people
download is what was tested — unzip the artifact and point the runner at it:

```bash
gh release download v1.0.3 --pattern '*chrome*.zip' && unzip -q liha-webmcp-adapter-chrome-*.zip
LIHA_EXTENSION=./liha-webmcp-adapter-chrome pnpm acceptance:prod
LIHA_EXTENSION=./liha-webmcp-adapter-chrome pnpm acceptance:icons
```

## Releases

The portal's "Download extension" button points at `/releases/latest`, so a
release has to exist for it to resolve. Build, package each browser's output as
a folder a user can hand to *Load unpacked*, and publish the checksums:

```bash
pnpm build
cp -R apps/extension/dist         liha-webmcp-adapter-chrome
cp -R apps/extension/dist-firefox liha-webmcp-adapter-firefox
zip -qr liha-webmcp-adapter-chrome-vX.Y.Z.zip  liha-webmcp-adapter-chrome
zip -qr liha-webmcp-adapter-firefox-vX.Y.Z.zip liha-webmcp-adapter-firefox
shasum -a 256 *.zip > SHA256SUMS.txt
gh release create vX.Y.Z *.zip SHA256SUMS.txt --title '...' --notes-file NOTES.md --latest
```

## Recommended response headers

These ship as `_headers` in each app's `public/` directory, which Cloudflare
Pages reads from the build output. `tools/` verifies them against the built
sites before a deploy — a policy that has never been run against the app it
protects is a guess. Nothing in the build needs an inline
script or an external origin, so a strict policy holds:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
```

`style-src` needs `'unsafe-inline'` because React sets a couple of inline
`style` attributes for animation delays. No CORS headers are required: the
portal makes no cross-origin requests, and it talks to the extension through DOM
events rather than the network.

## The extension

```bash
pnpm --filter @liha/extension build           # → apps/extension/dist
pnpm --filter @liha/extension build:firefox   # → apps/extension/dist-firefox
```

The manifest is generated at build time from the origin config, so the
production hosts are already in `content_scripts[].matches` and
`host_permissions` — there is nothing to edit by hand, and no chance of the
manifest and the adapters disagreeing.

**Chrome (unpacked, the supported path today):** `chrome://extensions` →
Developer mode → **Load unpacked** → `apps/extension/dist`.

**Distributing it:** zip the contents of `dist` and attach it to a GitHub
release; the portal's "Download extension" button points at
`releases/latest`. Chrome Web Store publication is deliberately not required.

**Firefox:** `about:debugging` → This Firefox → **Load Temporary Add-on** →
`apps/extension/dist-firefox/manifest.json`. See [firefox.md](firefox.md) for
what does and does not work there.

## Reproducing the verification

```bash
pnpm verify              # typecheck, lint, 463 unit + integration tests, build
pnpm e2e                 # 50 Playwright tests against the portal and demo apps
pnpm acceptance:all      # four real-browser runs through the WebMCP protocol
```

All of it also runs in CI on every push, including the real-browser runs.

`pnpm acceptance:*` needs a Chromium build that permits `--load-extension`.
Branded Google Chrome refuses that switch, so the runners use Chrome for Testing:
they find a Playwright-cached one automatically, or run `pnpm chrome:install`, or
set `LIHA_CHROME` to your own build. This restriction applies only to automation
— loading the unpacked extension by hand in normal Chrome is unaffected.
