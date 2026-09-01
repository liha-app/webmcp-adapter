# The WebMCP API, as actually implemented in Chrome

Everything below was measured against a real browser, not transcribed from a
proposal. The probes ran on **Chrome 152.0.7977.65** and **Chrome for Testing
151.0.7922.34** (macOS, arm64) by driving a page over the DevTools protocol and
inspecting what the browser did.

This matters because several details differ from what the explainers imply, and
two of them have direct security consequences for this project.

## Enabling it

| | |
|---|---|
| Flag | `chrome://flags/#enable-webmcp-testing` — listed as **"WebMCP for testing"**, described as "Enables the WebMCP API." |
| Command line | `--enable-blink-features=WebMCPTesting` (or `--enable-features=WebMCPTesting`) |
| DevTools domain | `--enable-blink-features=DevToolsWebMCPSupport` |

Without the flag, `document.modelContext` is `undefined`.

`document.modelContext` is also `undefined` on `about:blank`; it is only exposed
on a real document. Probing for the API on a blank tab reports a false negative.

## Interface

```
interface ModelContext {
  registerTool(tool, options?) : Promise<undefined>
  getTools()                   : Promise<RegisteredTool[]>
  executeTool(tool, inputJson) : Promise<string | null>
  ontoolchange                 : EventHandler   // fires WebMCPEvent
}
```

`ModelContextTool` requires `name`, `description` and `execute`. `inputSchema`
and `title` are optional (`title` defaults to `""`).

`RegisteredTool` — what `getTools()` returns — is a plain object with
`{ name, title, description, inputSchema, origin, window }`. `origin` is the
**page's** origin even when the tool was registered by an extension, which is
what makes the adapter approach work at all.

## Behaviour worth knowing

**`registerTool` is async and returns `undefined`.** There is no handle to hold
on to; awaiting it is required.

**Unregistration is by `AbortSignal`, and only by `AbortSignal`.** There is no
`unregisterTool`. Pass `{ signal }` to `registerTool` and abort it later:

```js
const controller = new AbortController();
await document.modelContext.registerTool(tool, { signal: controller.signal });
controller.abort();            // the tool is gone from getTools()
```

Registering with an already-aborted signal rejects with `AbortError`.

**Duplicate names are rejected** with `InvalidStateError: Duplicate tool name`.
Anything that may register twice — a page reload, a re-enable toggle — has to be
idempotent.

**`execute` receives the parsed input object**, not a JSON string, and its
return value is JSON-serialised by the browser. Returning a string passes it
through unchanged; returning an object yields its JSON text.

**Throwing from `execute` loses the reason.** The caller sees
`UnknownError: Tool was executed but the invocation failed. For example, the
script function threw an error`. To tell an agent *why* something failed, return
an MCP-style error result instead of throwing:

```js
return { content: [{ type: 'text', text: 'reason' }], isError: true };
```

**The browser does not validate input against `inputSchema`.** ⚠️ This is the
important one. A tool declaring `required: ["name", "email"]` is still called
with `{}` if that is what the agent sent. Validation is the tool's job. This
runtime validates before it touches the page — see `src/main-world/input.ts`.

**Malformed JSON input** is rejected by the browser before `execute` runs, with
`UnknownError: Failed to parse input arguments`.

## The DevTools WebMCP domain

With `DevToolsWebMCPSupport` enabled, the DevTools protocol exposes a `WebMCP`
domain. This is the out-of-page surface a Tool Inspector or agent uses, and it
is what the acceptance runner speaks:

| Method / event | Shape |
|---|---|
| `WebMCP.enable` | `{}` |
| `WebMCP.toolsAdded` | `{ tools: [{ name, description, inputSchema, frameId, stackTrace }] }` |
| `WebMCP.toolsRemoved` | fired when a registration signal is aborted |
| `WebMCP.invokeTool` | `{ frameId, toolName, input }` → `{ invocationId }` |
| `WebMCP.toolInvoked` / `WebMCP.toolResponded` | `{ invocationId, status, output }` |

`input` must be an **object**, not a JSON string.

The `stackTrace` on `toolsAdded` reports where the tool was registered from. For
a Liha adapter it reads `chrome-extension://<id>/main-world/runtime.js`, so an
inspector can tell page-authored tools from injected ones. That provenance
signal is a feature, and later phases should surface it in the UI.

## Reproducing these results

`tools/acceptance/run.mjs` exercises the whole contract end to end. To poke at
the API by hand, launch a browser with the flags above and a remote debugging
port, then drive `Runtime.evaluate` against a page on `http://localhost`.
