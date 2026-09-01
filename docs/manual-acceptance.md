# Manual acceptance test

The automated runners (`pnpm acceptance:all`) prove the pipeline in Chrome for
Testing, observing tools through the DevTools WebMCP domain. This document is
the human version, in your own Chrome, because "it passed in automation" is not
the same claim as "an agent can use it".

Branded Google Chrome refuses `--load-extension` on the command line
(`--load-extension is not allowed in Google Chrome, ignoring`), which is why
automation uses Chrome for Testing. Loading an unpacked extension through
`chrome://extensions` is unaffected — that is the path below.

**Requirements:** Chrome 151 or newer, Node 20+, pnpm 10+.

---

## Setup

1. Enable the API: open `chrome://flags/#enable-webmcp-testing` ("WebMCP for
   testing"), set it to **Enabled**, and relaunch Chrome.
   Optionally also enable `chrome://flags/#devtools-webmcp-support` for the
   DevTools WebMCP panel.

2. Build and serve:

   ```bash
   pnpm install
   pnpm build
   pnpm demo
   ```

   | | |
   |---|---|
   | Acme CRM | <http://localhost:5273> |
   | Nimbus Supply | <http://localhost:5274> |
   | Kite Project Manager | <http://localhost:5275> |
   | Adapter Registry | <http://localhost:5280> |

   The ports matter: adapters are scoped to those exact origins.

3. Load the extension: `chrome://extensions` → **Developer mode** → **Load
   unpacked** → `apps/extension/dist`.

---

## Part 1 — the core claim (the Phase 0 criteria)

### 1. The demo apps implement no WebMCP

Search `apps/demo-crm`, `apps/demo-shop`, `apps/demo-project`: there is no
`modelContext` anywhere. `pnpm acceptance` asserts this against both the sources
and the built bundles, and the Playwright suite asserts `'modelContext' in
window` is `false` in all three.

### 2. Without the extension, no tool exists

Disable the Liha extension, reload <http://localhost:5273>, and in DevTools:

```js
await document.modelContext.getTools()   // []
```

If `document.modelContext` is `undefined`, the flag in step 1 is not active.

### 3–4. Enabling it registers the tools

Re-enable the extension and reload:

```js
typeof globalThis.__LIHA_WEBMCP_ADAPTER__                    // "object"
(await document.modelContext.getTools()).map((t) => t.name)
// ["search_customers", "create_customer", "update_customer"]
```

The Liha popup should show **WebMCP: available**, the adapter marked **healthy**,
and each tool **registered with WebMCP** with its capability badge.

### 5. An out-of-page inspector sees them

Open the DevTools WebMCP panel, or any agent that speaks WebMCP, and confirm the
tools appear with their descriptions and input schemas.

> If your build has no WebMCP panel, enable
> `chrome://flags/#devtools-webmcp-support` and reopen DevTools. Failing that,
> `pnpm acceptance` performs the identical check over the DevTools protocol,
> which is the channel the panel uses.

### 6–8. Executing it drives the real UI

Call `create_customer` with `{ "name": "Alice Smith", "email": "alice@example.com" }`,
or ask an agent in words:

> *"Create a customer named Alice Smith with email alice@example.com."*

Watch the page: the dialog opens, both fields fill, Create is clicked, and Alice
appears with an id the CRM assigned itself (`c-1004`) — which is how you know the
app's own submit handler ran rather than a row being pushed into the DOM.

The popup's execution log shows each step, with the typed values deliberately
absent.

### 9. Disabling removes the tools

Toggle the adapter off in the popup. Without reloading:

```js
await document.modelContext.getTools()   // []
```

### 10. A reload re-registers them

Toggle back on, reload, repeat step 4.

---

## Part 2 — the rest of the system

### The other two demo apps

**Nimbus Supply** (5274): ask for *"search for lighting products"*, then
*"add the Aurora Desk Lamp to my cart"*, then *"apply coupon SAVE10"*. Ask for
*"what's in my cart"* — `view_cart` navigates to `/cart` client-side and reads it
back, without the tool call dying mid-navigation.

Then ask to add *"lighting"* to the cart. Two products match, so the tool fails
closed rather than picking one. The cart is unchanged.

**Kite Project Manager** (5275): create a task, reassign it, change its status.

### The destructive confirmation gate

Ask the agent to *"delete the task about auditing vendor contracts"*.

A confirmation window appears showing DESTRUCTIVE, the site, and the exact
values. **Deny it** — the task is still there. Ask again and approve — now it is
gone.

Then ask to delete a task called *"a"*. Several match, so it fails without
deleting anything.

Turn on **Ask before every WRITE** in the popup and repeat a create — it should
now ask too.

### The registry

Open <http://localhost:5280>. The status line should say the registry implements
WebMCP itself. Ask an agent:

> *"Find me a CRM adapter with write access."*

It calls this page's own `search_adapters` — no adapter is involved, this site
implements WebMCP natively. Also try `get_adapter_permissions` on `demo-project`
and confirm it discloses `delete_task` as DESTRUCTIVE.

Open an adapter, press **Show full definition**, and read it. Press **Install** —
the extension shows the origins, every tool and every capability, and names the
page that asked, before anything is installed.

### The Recorder and Studio

1. Open the popup on any demo app and press **Record a tool**.
2. Perform the workflow by hand.
3. Press **Stop recording** — the Studio opens with your steps.
4. Check the selectors: they should be the site's own `data-*` hooks, `name`
   attributes or ids, never class names.
5. Values you typed are proposed as tool inputs, with the recorded text shown as
   an example.
6. Name and describe the tool, choose its capability.
7. Press **Test selectors** — each should resolve to exactly one element.
8. **Export JSON** or **Install locally** and approve the permission summary.
9. Reload the target site; the new tool is registered.

### Compatibility

Popup → **Compatibility**. In Chrome with the flag on, everything reads YES and
the verdict is "Fully supported". In Firefox
(`apps/extension/dist-firefox` via `about:debugging`), MAIN-world injection reads
NO and the page says so plainly instead of pretending — see
[firefox.md](firefox.md).

---

## If something does not work

| Symptom | Cause |
|---|---|
| `document.modelContext` is `undefined` | The flag is off, Chrome was not relaunched, or the page is `about:blank` (the API is not exposed there). |
| Popup says "runtime not loaded on this page" | The page origin is not one the adapter declares. Adapters are origin-scoped by design. |
| Tools never appear | Check the service worker log via `chrome://extensions` → **service worker**. |
| A step fails with "matched 0 elements" | The demo build is stale, or the app changed. Adapters fail closed rather than guess. |
| A step fails with "matched 2 elements" | The lookup was ambiguous. That is the safety property working. |
| Install button does nothing | The extension is not installed, or the registry is served from an origin the extension does not know. See [deployment.md](deployment.md). |
