# Firefox status

**Short version: the Firefox build manages adapters and tells you the truth
about what it cannot do. It does not register WebMCP tools, because Firefox
cannot yet get code into a page's MAIN world.**

## Why MAIN world is the whole question

A WebMCP tool has to be registered on `document.modelContext`, which lives in
the page's own JavaScript world. An extension content script runs in an isolated
world by default and cannot see it. Chrome solves this with
`scripting.executeScript({ world: 'MAIN' })`; Firefox's MV3 implementation does
not expose that execution world.

So the Firefox build ships everything except the one capability that depends on
it.

| | Chrome | Firefox |
|---|---|---|
| Install, enable, disable, remove adapters | ✅ | ✅ |
| Adapter validation and origin scoping | ✅ | ✅ |
| Store install flow with permission summary | ✅ | ✅ |
| Recorder and Studio | ✅ | ✅ |
| Compatibility diagnostics | ✅ | ✅ |
| MAIN-world injection | ✅ | ❌ |
| Registering WebMCP tools | ✅ | ❌ (follows from the above) |

## What it will not do

It will not install a home-made `modelContext` object and call Firefox
supported. A fake WebMCP is worse than no WebMCP: an agent would discover tools
that no agent runtime can actually reach, and every failure would look like a
bug in the adapter rather than a missing browser feature.

The extension detects the capability at runtime — `supportsMainWorldInjection()`
in `apps/extension/src/platform/index.ts` — rather than sniffing the user agent,
so the Firefox build starts registering tools the day Firefox ships the
capability, with no code change.

## Nothing about Firefox constrains Chrome

The platform layer exists so that supporting a second browser never costs the
first one anything. The rules were:

- Chrome uses `scripting.executeScript({ world: 'MAIN' })` directly. No lowest
  common denominator, no abstraction that hides it.
- Firefox differences live in one module and one manifest.
- Anything Firefox cannot do is reported, never emulated.

## Building and loading it

```bash
pnpm --filter @liha/extension build:firefox   # → apps/extension/dist-firefox
```

`about:debugging` → This Firefox → **Load Temporary Add-on** → pick
`apps/extension/dist-firefox/manifest.json`.

Differences in `manifest.firefox.json`: an event page (`background.scripts`)
instead of a service worker, a `browser_specific_settings.gecko` id, and no
`minimum_chrome_version`.

Open the popup and choose **Compatibility** to see exactly what this browser
supports.
