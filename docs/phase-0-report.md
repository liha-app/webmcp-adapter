# Phase 0 report — the feasibility spike

> **Historical record.** This documents the original proof that the idea works
> at all, before the runtime, the demo apps, the registry and the Recorder
> existed. It is kept because the hypothesis it tested is the reason the project
> exists. For the system as it stands, start at the [README](../README.md).

**Result: the hypothesis holds.** A Chrome extension can register a WebMCP tool
in a page's MAIN world, and a real out-of-page WebMCP agent discovers and
executes it as an ordinary WebMCP tool. Phase 1 is unblocked.

## What was built

- **`apps/demo-crm`** — React + Vite + TypeScript CRM with an Add Customer
  dialog. It contains no WebMCP code; that is asserted against both the sources
  and the built bundle.
- **`apps/extension`** — MV3 extension. An ISOLATED-world content script
  announces in-scope page loads; the service worker validates the adapter and
  injects a MAIN-world runtime via `chrome.scripting.executeScript`; the runtime
  registers tools on `document.modelContext`. A popup shows WebMCP availability,
  the matched adapter, its tools with capability badges, an enable toggle, and a
  redacted execution log.
- **`apps/extension/adapters/demo-crm.json`** — the `create_customer` adapter as
  plain declarative JSON.
- **`tools/acceptance`** — a runner that walks the ten Phase 0 criteria in a
  real browser, observing tools through the DevTools `WebMCP` domain.

## Verified WebMCP behaviour

Measured against Chrome 152 and Chrome for Testing 151 — details and probe
results in [webmcp-api.md](webmcp-api.md). Two findings shaped the code:

1. **The browser does not validate tool input against `inputSchema`.** A tool
   declaring required properties is still invoked without them. The runtime
   validates before touching the page.
2. **Unregistration is by `AbortSignal` only.** There is no `unregisterTool`, so
   each adapter install holds an `AbortController` and disabling aborts it.

## Tests

`pnpm verify` — typecheck, lint, 89 unit tests, production build. All clean.

| Area | Covered |
|---|---|
| Adapter schema | valid adapters, bad capabilities, non-snake_case names, duplicate tools, steps carrying executable code |
| Origin matching | exact match only; lookalike, subdomain, scheme and port variants all rejected |
| Input validation | required/optional, type mismatches, undeclared keys dropped |
| Interpolation | substitution, unknown placeholders, no recursive expansion |
| Selectors | exactly-one resolution, 0 and n>1 both fail closed, malformed selectors |
| Sensitive fields | password/OTP/card fields refused for both write and read |
| Step executor | real DOM manipulation, redacted traces, timeouts, partial-failure traces |
| Runtime | registration, idempotent re-install, rollback on partial failure, origin refusal, unsupported-WebMCP path, MCP error results |

The WebMCP mock mirrors the real implementation's behaviour (duplicate names
throw, abort unregisters, `execute` receives a parsed object) so the tests
cannot pass against a friendlier fiction than the browser.

## Manual verification

Two independent paths, both real:

- **Automated, in a real browser:** `pnpm acceptance` — 10/10, stable across
  repeated runs. Tools are discovered via `WebMCP.toolsAdded` and invoked via
  `WebMCP.invokeTool`, which is the out-of-page surface an inspector uses. The
  created row carries an id the CRM assigned itself, proving the app's own
  submit handler ran.
- **By hand, in your own Chrome:** [manual-acceptance.md](manual-acceptance.md).

## Known issues at the time (most since resolved)

- **Automation needs Chrome for Testing.** Branded Google Chrome ignores
  `--load-extension`. Manual loading through `chrome://extensions` is unaffected.
- **WebMCP is behind a flag** (`chrome://flags/#enable-webmcp-testing`) and its
  shape may change. The API surface is isolated in `src/main-world/webmcp.ts`.
- **MAIN-world exposure is inherent.** The host page can see and tamper with the
  runtime. Mitigations and the honest limits are in
  [SECURITY.md](../SECURITY.md#the-main-world-trade-off--read-this-one).
- **Zod ships inside the MAIN-world bundle** (~67 KB) so validation has a single
  source of truth. Phase 2 should extract a dependency-free validator once the
  schema package exists.
- **Capability classification is displayed but not enforced.** `DESTRUCTIVE`
  confirmation and configurable `WRITE` confirmation are Phase 1.
- **Single frame, single origin.** No iframes, no cross-origin adapters, no SPA
  route re-registration.
- **Adapter health** (healthy/degraded/broken/unknown) is not implemented.

## What happened next

Everything listed above as deferred was built: the full thirteen-step DSL,
capability confirmation, adapter health, the monorepo split, three demo apps,
the Adapter Registry, the Recorder and Studio, and the Firefox compatibility
shell. Two limitations noted here proved to be genuinely inherent rather than
temporary, and are documented rather than worked around:

- **Automation needs Chrome for Testing.** Branded Chrome ignores
  `--load-extension`; manual loading is unaffected.
- **MAIN-world exposure.** See
  [SECURITY.md](../SECURITY.md#9-the-main-world-trade-off--read-this-one).

The Zod bundle-size note was resolved differently than expected: the schema now
lives in its own package shared by every surface, so there is one validator
rather than a duplicated one, and it is still the single source of truth.
