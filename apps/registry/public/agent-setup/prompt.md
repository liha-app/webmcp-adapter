# Onboard your agent to Liha WebMCP Adapter

You have been asked to help someone give an ordinary website WebMCP tools it
never implemented. You do that by writing an **adapter**: a JSON document that
maps tool calls onto the site's own controls. No code runs from an adapter —
the format has no way to express one.

Read this whole file before you write anything. Then do the work in the order
at the bottom.

---

## 1. What an adapter is

A browser extension holds a runtime. When a page loads on an origin an
installed adapter declares, the runtime registers that adapter's tools through
`document.modelContext.registerTool`, and an agent driving the browser sees them
as if the site had implemented WebMCP itself. Calling a tool replays a fixed
list of steps against the page's own DOM.

The site is never modified and never asked. The adapter is a description of the
site's interface, written by someone who looked at it.

## 2. The shape

```json
{
  "id": "acme-crm",
  "name": "Acme CRM",
  "version": "1.0.0",
  "description": "Search and create customer records.",
  "category": "crm",
  "origins": ["https://crm.example.com"],
  "tools": [
    {
      "name": "search_customers",
      "title": "Search customers",
      "description": "Search the customer list by name or email and return what matches.",
      "capability": "READ",
      "inputSchema": {
        "type": "object",
        "properties": { "query": { "type": "string", "description": "What to search for" } },
        "required": ["query"]
      },
      "steps": [
        { "type": "fill", "selector": "[data-testid='customer-search']", "value": "{{query}}" },
        { "type": "waitFor", "selector": "[data-testid='customer-list']" },
        { "type": "readList", "selector": "[data-testid='customer-list'] li", "as": "customers", "limit": 20 }
      ]
    }
  ]
}
```

| Field | Rule |
|---|---|
| `id` | kebab-case, 1–64 chars |
| `name` | 1–120 chars |
| `version` | semver, `1.0.0` |
| `description` | optional, ≤1000 chars |
| `category` | optional: `crm`, `commerce`, `productivity`, `developer-tools`, `registry`, `other` |
| `author`, `homepage`, `verifiedAt` | optional; `verifiedAt` is `YYYY-MM-DD` |
| `origins` | 1–4 **exact** origins |
| `tools` | 1–50 |

Per tool:

| Field | Rule |
|---|---|
| `name` | snake_case, unique within the adapter |
| `title` | optional, ≤120 chars |
| `description` | required — this is what the agent reads to decide whether to call it |
| `capability` | `READ`, `INTERACT`, `WRITE` or `DESTRUCTIVE` |
| `inputSchema` | `{"type":"object","properties":{…},"required":[…]}`; property types are `string`, `number`, `integer`, `boolean`, with optional `description`, `format`, `enum` |
| `probeSelectors` | optional; selectors that should exist while the page is at rest, used for health checks |
| `appliesWhen` | optional; selectors that must all resolve for this tool to apply to the open page. Declare it on any tool that belongs to one part of a site — without it, a tool for a product page reports itself as broken on a search page and drags the adapter's health down with it |
| `i18n` | optional; display text per locale, as `{"ja": {"description": "…"}}`. What a person is shown. An agent is always handed `description`, so do not translate that |
| `steps` | 1–50, from the closed set below |

## 3. The step vocabulary

This is the whole list. There is no `script`, `eval`, `fn`, `expression` or
`onBefore` step, and no step carries executable code. If a task needs
JavaScript, the answer is that this format cannot express it — say so rather
than inventing a step.

| Step | Fields |
|---|---|
| `click` | `selector` |
| `fill` | `selector`, `value` |
| `select` | `selector`, `value` — matches an `<option>` by value or by its visible text |
| `check` / `uncheck` | `selector` |
| `submit` | `selector` |
| `waitFor` | `selector`, `state` (`present` \| `absent`), `timeoutMs` (≤30000) |
| `assertVisible` | `selector` |
| `assertText` | `selector`, `contains` |
| `readText` | `selector`, `as` |
| `readAttribute` | `selector`, `attribute`, `as` |
| `readList` | `selector`, `as`, `limit` (≤100), `fields` |
| `navigate` | `path` — same-origin path only, e.g. `/customers` |

`as` names a key in the tool's structured result. `readList` with `fields` reads
one value per row: `{"name": {"selector": "[data-field='name']"}}`.

## 4. Where input can and cannot go

`{{placeholder}}` interpolation applies to **`value`, `contains` and `path`**.
It is never applied to a `selector`.

That is deliberate and it is the property the whole runtime rests on: a tool
argument can never widen or retarget the element a step acts on. If you find
yourself wanting `"selector": "[data-id='{{id}}']"`, the answer is to use the
page's own control — a `<select>`, a search box, a filter — and let the site
resolve the argument. Every adapter in the official catalogue does it that way.

Every placeholder you write must be declared in that tool's `inputSchema`.
Validation rejects one that is not.

## 5. Capabilities

| Capability | Means |
|---|---|
| `READ` | Reads the page as it stands. **May not use `submit` or `navigate`** — both are app-level transitions. Validation enforces this. |
| `INTERACT` | Moves around the app: opens a panel, changes a route, expands a row. |
| `WRITE` | Changes data the user would expect to persist. |
| `DESTRUCTIVE` | Deletes or cannot be undone. The runtime asks the user to confirm, in a real window, every call. |

Capability is your declaration, not something inferred from the steps — typing
into a search box is a read, and clicking a button may delete an account. Get it
right; a reviewer will check it against the visible steps before installing.

## 6. What will be rejected

- a wildcard origin (`https://*.example.com`) or an origin with a path
- more than four origins, or origins spanning different services — one adapter
  is one site
- a placeholder no property declares
- a `READ` tool that submits or navigates
- duplicate tool names
- anything trying to smuggle in code

The runtime also refuses, at call time and regardless of what the adapter says,
to read or write password fields, card fields and anything marked sensitive.
Do not design around that. If a flow needs a card number, the adapter stops
before it.

## 7. Selectors

Prefer, in order: `data-testid`, other `data-*` attributes, a stable `name` or
`id`, an ARIA role with an accessible name. Avoid classes that look generated
(`css-1x2y3z`, `sc-fzXfNJ`) and avoid `:nth-child` unless the position is the
meaning.

A selector must resolve to exactly one element. If two match, the runtime fails
the call rather than guessing, which is the behaviour you want — but you should
find that out while writing, not later. The Studio counts matches for you; the
Store deliberately does not, because a page that can ask the extension to count
elements on another origin can read that origin one character at a time.

## 8. How to check your work

If you are driving a browser that has the extension installed and WebMCP turned
on, the portal at `/` exposes its own tools and you can use them directly:

| Tool | Use |
|---|---|
| `validate_adapter` | Parse and validate a draft. Returns the exact errors. |
| `search_adapters`, `get_adapter`, `list_adapter_tools` | Read the official catalogue for worked examples. |
| `get_adapter_permissions` | See what an adapter is asking for, before installing it. |
| `install_adapter` | Ask to install a draft. **The user confirms in a real window; you cannot install anything on your own.** |
| `get_demo_info` | Three demo sites to practise on, and what the browser needs first. |

Without a browser, validate against the schema in
`packages/adapter-schema/src/adapter.ts` in the repository, and check your work
against the adapters in `adapters/*.json`.

## 9. Requirements

- Chrome 151+ with `chrome://flags/#enable-webmcp-testing` enabled
- the Liha WebMCP Adapter extension installed
- the adapter's origins are `https://` or `http://localhost` — WebMCP does not
  register on a plain `http://` public host

## 10. Do this

1. Ask which site, and what the person wants to be able to ask an agent to do
   on it. Do not guess a tool list.
2. Open the site. Find the controls those tasks actually go through, and the
   selectors that identify them. Check each in the Studio, which counts matches as you type.
3. Write the adapter. One tool per task, described the way a person would ask
   for it.
4. Declare each capability honestly.
5. Validate. Fix what comes back. Validate again.
6. Hand it to the user to install, and tell them plainly which origins it will
   run on and what the highest capability in it is.
7. Test each tool against the real page, and say which ones you actually ran.

Do not install anything without the person's confirmation, do not widen an
origin to make a selector work, and do not report a tool as working because the
adapter parsed.
