# Liha WebMCP Adapter

[![CI](https://github.com/liha-app/webmcp-adapter/actions/workflows/ci.yml/badge.svg)](https://github.com/liha-app/webmcp-adapter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Make any website agent-ready.** → **[webmcp-adopter.liha.dev](https://webmcp-adopter.liha.dev)**

Live demos, none of which contain a line of WebMCP code:
[Acme CRM](https://demo-crm.liha.review) ·
[Nimbus Supply](https://demo-shop.liha.review) ·
[Kite Project Manager](https://demo-project.liha.review)

WebMCP lets a website hand an agent real tools instead of making it guess at the
DOM. The catch is who has to build it: today a site becomes agent-ready only
when its own developers ship `document.modelContext.registerTool()`.

Liha removes that dependency. Adapters written by users and by the community add
WebMCP tools to sites that never implemented WebMCP — declaratively, scoped to
one origin, with their source open to inspection before install.

> **WebMCP adoption no longer has to wait for every website owner.**

This is not browser automation with extra steps:

| Ordinary automation | A Liha adapter |
|---|---|
| the agent guesses from a screenshot or the DOM | a named capability with a JSON input schema |
| every run re-derives what to click | a deterministic workflow, written once |
| nobody can audit what it will do | public JSON with no executable code in it |
| no notion of permission | READ / INTERACT / WRITE / DESTRUCTIVE, confirmed |
| ambiguity resolved by guessing | ambiguity fails closed |
| private to one script | shared, versioned, health-checked in a registry |

The output is not a click. It is a **WebMCP capability any agent can discover.**

---

## It works, and here is the evidence

The project rested on one unproven assumption: *can a Chrome extension register
a WebMCP tool in a page's MAIN world such that a real WebMCP agent discovers and
executes it as an ordinary WebMCP tool?*

**Yes** — verified end to end in a real browser, with tools discovered and
invoked from outside the page over the DevTools `WebMCP` domain, which is the
same surface a Tool Inspector or agent uses.

```
pnpm acceptance            10/10 Phase 0 criteria
pnpm acceptance:full       65/65 checks — three demo adapters, the portal's
                           native WebMCP tools, the destructive confirmation gate,
                           an agent writing and installing an adapter of its own,
                           and a browser with the WebMCP flag off, where the
                           extension has to say so rather than fake it
pnpm acceptance:recorder   36/36 checks — record a workflow, get a valid adapter,
                           and an exported native implementation that really
                           registers WebMCP tools with no adapter involved
pnpm acceptance:icons      6/6 checks — Chrome parses the extension's icons and
                           can resolve every path it was given
pnpm verify                428 unit + integration tests, typecheck, lint, build
pnpm e2e                   45 Playwright tests
```

The demo apps contain no WebMCP code at all — asserted against their sources,
their built bundles, and `'modelContext' in window` at runtime. Everything an
agent can do on them comes from an adapter.

---

## How it works

```
  ┌──────────────────────┐
  │  Adapter (JSON)      │  declarative, origin-scoped, no executable code
  └──────────┬───────────┘
             │  validated (Zod) — storage is not a trust boundary
  ┌──────────▼───────────┐
  │  Service worker      │  decides whether this origin gets this adapter
  └──────────┬───────────┘
             │  scripting.executeScript({ world: 'MAIN' })
             │  the definition crosses as a JSON *argument*, never as source
  ┌──────────▼───────────┐
  │  MAIN-world runtime  │  no chrome.* APIs; validates input; drives the DOM
  └──────────┬───────────┘
             │  document.modelContext.registerTool(...)
  ┌──────────▼───────────┐
  │  WebMCP agent        │  sees an ordinary WebMCP tool on the page
  └──────────────────────┘
```

An ISOLATED-world content script does nothing but tell the service worker that a
page in scope has loaded, and relay confirmation requests to the extension. The
adapter itself never travels through the page, so a hostile page has no channel
to spoof one into being installed.

For what running in the MAIN world costs in isolation — and it does cost
something — see
[SECURITY.md](SECURITY.md#9-the-main-world-trade-off--read-this-one).

---

## Quick start

**Requirements:** Node 20+, pnpm 10+, Chrome 151+.

```bash
pnpm install
pnpm build
pnpm demo        # CRM 5273 · Shop 5274 · Projects 5275 · Registry 5280
```

Enable `chrome://flags/#enable-webmcp-testing` ("WebMCP for testing") and
relaunch Chrome. Then load the extension: `chrome://extensions` → **Developer
mode** → **Load unpacked** → `apps/extension/dist`.

Open <http://localhost:5273> and check the console:

```js
(await document.modelContext.getTools()).map((t) => t.name)
// ["search_customers", "create_customer", "update_customer"]
```

Then ask an agent to *"create a customer named Alice Smith with email
alice@example.com"* and watch the form fill itself in.

`pnpm dev` runs the same thing with hot reload and rebuilds the extension on
change (reload it in `chrome://extensions` to pick changes up).

---

## What is in here

### The extension

Manifest V3. A service worker owns the adapter catalogue and decides what gets
injected where. The MAIN-world runtime registers tools and executes their steps.
Both are available in **English and Japanese**, chosen on the Adapters page and
remembered; the default follows the browser's own language. What is *not*
translated is anything an agent also reads — tool names, tool descriptions and
adapter definitions render exactly as their author wrote them, because a person
auditing a tool has to be reading the sentence the model is acting on. Switches
rather than checkboxes, too: these take effect the moment they change.

The popup answers one question — **what applies to the page in front of you**:
WebMCP availability here, the adapters scoped to this origin with health and
capability badges, their "ask before every WRITE" switch, and a redacted
execution log. It used to list the whole catalogue, which buried that answer
under two adapters for sites the reader was not on. Everything not about the
open page moved to an **Adapters** page (the extension's options page), where a
list belongs: every adapter grouped by where it came from, its exact origins,
and its settings.

It also contains the **Recorder** — press *Record a tool*, use the site by hand,
press *Stop* — and the **Studio**, where the recording becomes an adapter you
name, parameterize, test and install. Selectors come from the site's own stable
attributes; class names are never used, because they churn on every redeploy.

The Studio exports twice, and the second one is the point:

| | |
|---|---|
| **Export JSON** | the adapter — drives the site from outside, today, unchanged |
| **Export native WebMCP** | the same tools as code **the site registers itself**, so the adapter is no longer needed |

An adapter is a stopgap by design. It exists because a site has not implemented
WebMCP, and the honest end state is that the site does. So a recording produces
both halves: the thing that works now, and the implementation to hand the site's
developers — same tool name, same input schema, the recorded workflow written
out as the steps to replace with a real call, and the three API facts this
project had to measure the hard way built in (the browser does not validate
input, a thrown error loses its reason, an AbortSignal is the only way to
unregister).

**Don't wait for adoption. Prototype the capability today, ship it natively
tomorrow.** `pnpm acceptance:recorder` proves the export is not a nice-looking
file: it runs the exported code on an origin no adapter is scoped to, then
discovers and invokes the resulting tool from outside the page.

### The adapter runtime

A closed vocabulary of thirteen declarative steps. Fail-closed selector
resolution, input validation the browser does not do for you, capability
confirmation, credential-field refusal, redacted tracing, and adapter health
checks. See [docs/adapter-format.md](docs/adapter-format.md).

### Three demo apps, zero WebMCP

**Acme CRM**, **Nimbus Supply** and **Kite Project Manager** are ordinary React
apps. They exist to prove the runtime is general rather than a hack aimed at one
page — fourteen tools across three apps, all from adapters.

### The Adapter Registry

A public catalogue with search, categories, per-adapter origins, tools, input
schemas, capability classification, health, last-verified date, and the complete
source of every definition.

The registry **implements WebMCP natively** — `search_adapters`, `get_adapter`,
`list_adapter_tools`, `get_adapter_permissions`, `get_demo_info`,
`validate_adapter`, `probe_selectors`, `install_adapter`. Ask an agent to *"find
a CRM adapter with write access"* and it calls the page's own tool. That contrast
is the point: this is what a site looks like when its developers do the work, and
the demo apps show what happens when they never do.

### An agent can write the adapter

The last three tools are a loop rather than a list. Given a site nobody has
adapted, an agent can:

1. **`probe_selectors`** — count what each CSS selector it is considering
   matches on an open page at that origin. `1` is usable, `0` is wrong, more
   than one is ambiguous and the runtime will refuse to act on it. Counts are
   all that comes back: never text, never attributes, never the page. Enough to
   stop guessing, not enough to read the page with.
2. **`validate_adapter`** — check the definition against the published schema
   and get every problem back, one per line, until it is right.
3. **`install_adapter`** — hand the definition over. The extension re-validates
   it and then **asks the person at the keyboard** to approve the exact origins
   and capabilities. An agent asking is a request, not an install; an
   unapproved one does not happen.

Then reloading the site registers the tool the agent wrote, and calling it
drives the real UI. No recording, no human authoring the JSON.
`pnpm acceptance:full` walks exactly that, including the refusals: a wildcard
origin is rejected before anyone is troubled, and the confirmation window is
shown to be unavoidable.

The landing page is not a description of that — it runs the tools. Pick one,
press run, and the panel reports whether the call went through
`document.modelContext` or fell back to calling the same function directly,
because a demo that fakes the mechanism it is demonstrating is worse than none.

**Appearance and language.** The nav carries two segmented controls. Appearance
is *Auto / Light / Dark*: `auto` leaves the root element alone so the page
follows the operating system, and the two explicit values pin `color-scheme`,
which is the entire switch — every token is declared once with `light-dark()`,
so there is no second palette to keep in sync. An inline script in
`index.html` applies the stored choice before first paint, so an explicit
choice never flashes the system one first.

The interface is English and Japanese. `apps/registry/src/i18n/ja.ts` is typed
as a complete record of `en.ts`'s keys, so a string added in one language and
forgotten in the other fails the build rather than shipping half-translated; a
unit test additionally checks that both languages interpolate the same values.
Two things are deliberately *not* translated: the WebMCP tool descriptions,
which are read by models and asserted by the acceptance suite, and the text an
adapter supplies about itself — its name, description and tool descriptions are
the published definition an agent receives and a reader audits, so translating
them in the interface would show you something other than what you are about to
install. Japanese also gets its own typographic rules, measured off apple.com/jp:
tracking returns to normal, and `word-break: auto-phrase` breaks lines at phrase
boundaries instead of splitting 「ツール」 in half.

**The mark.** The Liha jellyfish, drawn as an A for Adapter — a sibling to the
C, S and R of the other Liha products. `tools/brand/` holds the master drawing
and derives the favicon, the app icon and the monochrome version from it.

**On the visual design.** The marketing pages follow Apple's App Store product
page conventions and the catalogue follows the App Store's own store layout —
the 980px column and 18px tiles, the 260px sidebar, the 64px lockups and the
pill buttons. Layout conventions, spacing scales and type ladders are not
protected expression, and this project deliberately borrows them because the
patterns are good at the job. Nothing of Apple's is reproduced: no marks, no
artwork, no copy, no fonts. The icons are generated here, the words are ours,
and the site says plainly in its footer that it has nothing to do with Apple.

---

## Security in one screen

The realistic worst case is a community adapter becoming browser malware. The
format is built so that is either impossible to express or obvious before
install:

- **Adapters are data.** No `eval`, no script step, no expression language, no
  remote code — and no way to express one. Enforced by the schema, the injection
  boundary, the Studio, and lint.
- **Exact origins only.** No wildcards. `navigate` cannot leave the origin.
- **Fails closed.** A selector that does not match exactly one element fails the
  call rather than guessing which button to press.
- **Capabilities are classified and confirmed.** DESTRUCTIVE always asks; WRITE
  can be set to. Anything but an explicit approval denies.
- **Credentials are refused.** Password, one-time-code and card fields cannot be
  read or written, at all — including by the Recorder.
- **Values are never logged.** Traces record shapes, not contents.
- **Installing is a user decision**, with the origins and capabilities shown,
  whoever asked.
- **Minimal permissions.** No `<all_urls>`, no `tabs`. Other origins go through
  optional host permissions requested at install time.

Full model, including the MAIN-world limitation this cannot engineer away:
[SECURITY.md](SECURITY.md).

---

## Verifying it yourself

```bash
pnpm verify           # typecheck, lint, 428 unit + integration tests, build
pnpm e2e              # 45 Playwright tests against the portal and the demo apps
pnpm acceptance:all   # four real-browser runs through the WebMCP protocol
pnpm acceptance:prod  # 36 checks against the deployed sites, not a local build
                      # LIHA_EXTENSION=<unzipped release> to check the artifact
```

Four layers, each answering a different question:

| Layer | Question |
|---|---|
| Unit | Does each rule hold in isolation — fail-closed selectors, origin matching, redaction, confirmation, input validation? |
| Integration | Does the **published adapter** still work against the **real app component**? These mount the actual React apps and run the actual adapters, so an adapter that drifts from its site fails here. |
| E2E (Playwright) | Do the demo apps and the registry work as ordinary websites? |
| Acceptance (CDP) | Does a real out-of-page agent discover and execute these tools in a real browser? |

The unit tests mock `document.modelContext` with behaviour copied from the real
implementation — duplicate names throw, aborting the signal unregisters,
`execute` receives a parsed object, and input is *not* validated for you. A mock
kinder than the browser would hide the bugs the tests exist to catch. What no
mock can prove is that an agent really sees the tool, which is what the
acceptance runners and [the manual test](docs/manual-acceptance.md) are for.

All four layers run in CI on every push, including the real-browser acceptance
runs — the WebMCP pipeline is reproduced from a clean machine, not just on the
author's laptop.

`pnpm acceptance:*` needs a Chromium build that permits `--load-extension`.
Branded Google Chrome refuses that switch, so the runners use Chrome for Testing:
they find a Playwright-cached one automatically, or run `pnpm chrome:install`, or
set `LIHA_CHROME`. This affects automation only — loading the unpacked extension
by hand in normal Chrome is unaffected.

---

## Repository layout

```
apps/
  extension/       MV3 extension: service worker, bridges, MAIN-world runtime,
                   popup, Adapters page, confirmation window, Recorder,
                   Studio, diagnostics
  registry/        the public portal and Adapter Store — React, TanStack
                   Router/Query, Zod, WebMCP-native, en/ja under src/i18n
  demo-crm/        ordinary React apps with no WebMCP code whatsoever
  demo-shop/
  demo-project/
packages/
  adapter-schema/  the format: Zod schema, capabilities, origins, health types
  adapter-runtime/ MAIN-world runtime: DOM, executor, validation, WebMCP binding
  shared/          types crossing the extension/registry boundary
adapters/          the published adapter definitions, as plain JSON
tests/
  integration/     real adapters against real app components
  e2e/             Playwright
tools/acceptance/  real-browser runs, driven over the DevTools protocol
docs/
```

---

## Documentation

| | |
|---|---|
| [docs/adapter-format.md](docs/adapter-format.md) | The DSL: every step, every rule, and what you deliberately cannot write |
| [docs/webmcp-api.md](docs/webmcp-api.md) | The WebMCP API as actually implemented in Chrome, measured rather than assumed — including the part where the browser does not validate tool input for you |
| [docs/manual-acceptance.md](docs/manual-acceptance.md) | The by-hand test in your own Chrome |
| [docs/demo-script.md](docs/demo-script.md) | The three-minute demo, scene by scene |
| [docs/deployment.md](docs/deployment.md) | Hosting the registry and the demos |
| [docs/firefox.md](docs/firefox.md) | What works there, what does not, and why nothing is faked |
| [docs/phase-0-report.md](docs/phase-0-report.md) | The original feasibility spike |
| [SECURITY.md](SECURITY.md) | Threat model and the honest limits |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, and the rules for contributing an adapter |

---

## Status and limits

Chrome is the primary target, against a flagged API that may still change; the
API surface is isolated in one small module. The Firefox build ships adapter
management and honest diagnostics but cannot register tools, because Firefox has
no MAIN-world injection — and Liha will not fake a `modelContext` to hide that.
Adapters are single-frame and single-origin; iframes and cross-origin flows are
out of scope. The registry is a static catalogue: publishing a community adapter
means opening a pull request, and a hosted submission flow is future work.

## License

MIT — see [LICENSE](LICENSE). Adapter definitions are published alongside the
code so anyone can audit what they are installing. An adapter you cannot read is
an adapter you should not install.
