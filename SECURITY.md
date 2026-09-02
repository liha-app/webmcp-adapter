# Security model

The realistic worst case for this project is not that an adapter breaks. It is
that **a community adapter becomes browser malware**: something a user installs
because it promises a useful tool, which then quietly uses their authenticated
session to do something else.

Every design decision below exists to make that class of adapter either
impossible to express, or obvious to spot before install.

## 1. Adapters are data, never code

An adapter is JSON. The step vocabulary is a closed set — click, fill, select,
check, uncheck, submit, waitFor, assertVisible, assertText, readText,
readAttribute, readList, navigate — and **no step can carry executable code**.
There is no `eval` step, no `script` step, no expression language, no callback,
no remote script URL.

Enforced in four places:

- the Zod schema is a discriminated union, so an unknown step type fails
  validation rather than being ignored, and unknown properties on a known step
  are stripped before the executor could ever see them;
- the service worker passes adapters across the world boundary as
  `scripting.executeScript` **arguments**, never as source text;
- the Studio can only emit step types from the same union;
- `no-eval`, `no-implied-eval`, `no-new-func` and `no-script-url` are lint errors
  across the repository.

There are tests asserting that adapters carrying `eval`, `script`, `fn` or
handler-shaped steps are rejected, and that the Studio never emits one.

## 2. Origin scoping

Adapters declare **exact** origins — `https://crm.example.com`, no wildcards, no
paths. An adapter is injected only into a page whose `location.origin` matches
exactly, and the check runs twice: in the service worker before injection, and
again in the runtime before registration.

Exact matching specifically defeats the lookalikes that prefix or suffix
matching would admit (`https://crm.example.com.evil.test`). `new URL()` is not
sufficient on its own — it accepts `https://*.example.com` and reports it as its
own origin — so hostnames are additionally checked against what a real host can
be. Every one of those cases has a test.

The `navigate` step resolves against the adapter's origin and refuses anything
that leaves it, including protocol-relative `//host` and `javascript:` URLs.

## 3. Fail closed on ambiguity

If a selector does not match **exactly one** element, the call fails and says
how many it saw. Not "the first match", not "the closest thing".

An adapter that guesses which button to press is a malware primitive. Waiting
does not soften this: an ambiguous selector fails immediately rather than
polling, because ambiguity does not resolve itself.

This is also how adapters address a specific record — narrow with the site's own
search, then act on the single remaining row. If the lookup matches two, the
tool fails instead of deleting the wrong one.

## 4. Capability classification and confirmation

Every tool declares `READ`, `INTERACT`, `WRITE` or `DESTRUCTIVE`, shown in the
registry, in the install prompt, and in the popup.

- **DESTRUCTIVE always asks.** Not configurable.
- **WRITE can be set to ask**, per adapter, in the popup.
- The confirmation window is drawn by the extension, not the page, and shows the
  tool, the site, the capability and the exact values the agent supplied.
- **Anything other than an explicit approval denies** — a timeout, a closed
  window, a rejected promise, a non-boolean answer. A confirmation gate that
  fails open is not a gate, and there are tests for each of those paths.

Capability cannot be inferred mechanically, so the registry also shows a factual
count of what a tool's steps do next to the author's declaration, and leaves the
judgement to the reader — which is the only place it can honestly be made.

## 5. Credentials and payment fields are refused

Adapters may not type into, or read from, password fields, one-time-code fields,
or anything whose name, id, `aria-label` or `autocomplete` marks it as a
credential or payment instrument. This is a hard block, not a permission.

The Recorder applies the same rule while recording: it captures that a field was
filled, without capturing the secret.

## 6. Values are never logged

The execution log records the *shape* of what happened (`fill [name='email']
(17 chars)`), never the values. The debug panel, the tool result and the failure
messages are all built from that redacted trace — an `assertText` failure
reports a length, not the text it was looking for. There are tests asserting
that typed values do not appear in the log.

The confirmation window is the one place a value is displayed, because informed
consent to "delete task 42" requires knowing it is 42. It is passed to that
window and nowhere else — never to storage, never to the log.

## 7. Installing is always a user decision

An adapter can be installed from the Store, from the Studio, or from a file.
Every path goes through the same gate: schema validation, then a confirmation
window listing the exact origins, every tool, and every capability, plus who
asked.

A web page requesting an install is only *requesting*. The page cannot approve
its own request, and it cannot see the answer other than as an outcome.

**An agent requesting one is the same request.** The portal registers
`install_adapter` as a WebMCP tool so an agent can hand over a definition it
wrote, and that tool reaches the extension through the identical path the Store's
own install button uses — the same validation, the same confirmation window, the
same naming of origins, capabilities and the page that asked. It adds no
privilege: an agent that can call it can ask, and a person still decides. An
invalid definition is refused before a window is ever opened, so an agent cannot
use it to generate dialogs.

`probe_selectors` is the other tool an agent needs, and it is deliberately
narrow. It reports **how many elements each selector matches** on an open page at
a given origin, and nothing else: no text, no attribute values, no markup. That
is enough to tell a usable selector from a wrong or an ambiguous one — which is
what writing an adapter requires — and it is not a way to read a page the agent
cannot otherwise see. It still needs the extension to hold host permission for
that origin, so it reaches nowhere the extension was not already allowed.

## 8. Extension permissions

Shipped permissions are `scripting`, `storage`, and host permissions for the
demo and registry origins. There is deliberately **no `<all_urls>` and no `tabs`
permission** — the service worker enumerates tabs with `tabs.query({})` and
relies on `tab.url` only being populated for origins already granted, so the set
of tabs it can act on is exactly the set the user permitted.

Adapters for other origins use `optional_host_permissions`: access is requested
at install time, from the click in the confirmation window, one origin set at a
time. Content scripts for those origins are registered dynamically and only
while the permission is held, so revoking access stops the adapter reaching the
site.

The MAIN-world runtime is injected by the extension rather than fetched by the
page, so it is **not** listed in `web_accessible_resources` and is not reachable
by URL.

## 9. The MAIN world trade-off — read this one

WebMCP tools must be registered on `document.modelContext`, which lives in the
page's own JavaScript world. An extension therefore has to run its registration
code in the **MAIN world**, alongside the page's own scripts.

That has consequences that cannot be engineered away:

- **The host page can see the runtime.** `__LIHA_WEBMCP_ADAPTER__` is a global in
  the page's world. A page can detect it, read it, call it, monkey-patch its
  methods, or replace `document.modelContext` before the runtime finds it.
- **A hostile page can register its own tools** with the same names, or shadow
  the DOM APIs the executor depends on.
- **Isolation guarantees do not apply.** Anything in the MAIN world is inside the
  page's trust boundary, not the extension's.

What this codebase does about it:

- the MAIN-world bundle touches **no** `chrome.*` API, so page access to it
  grants no extension privilege — the worst a page can do with the runtime is
  drive its own DOM, which it could already do;
- the adapter definition is delivered as an `executeScript` argument rather than
  through a page-visible channel, so a page cannot spoof an adapter into being
  installed;
- the runtime re-validates the definition and re-checks the origin, so a page
  calling `install()` with its own JSON cannot widen the adapter's scope;
- credential blocking and value redaction live in the runtime, so they still
  apply to a page-initiated call;
- confirmation requests are relayed to the extension and answered in an
  extension window. The request is dispatched as a DOM event, which a page can
  see and could answer first — but forging an approval gains a page nothing it
  did not already have, since it can drive its own DOM directly. The gate exists
  to protect the user from a **malicious adapter**, and an adapter is data that
  cannot forge anything.

What it does **not** do: pretend a page cannot interfere with code running in its
own world. If you are evaluating this project for anything sensitive, that is the
limitation to weigh.

## 10. What is deliberately absent

No credential vault, no password manager, no autonomous scraping, no payment or
checkout flows, no third-party service adapters. The demo apps are first-party
and written for this repository, so nothing here depends on another service's
terms or markup staying still.

## Reporting a vulnerability

Open a GitHub issue for anything already public. For an unreported
vulnerability, please contact the maintainers privately rather than filing a
public issue, and allow time for a fix before disclosure.
