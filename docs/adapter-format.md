# The adapter format

An adapter is a JSON file that gives a website WebMCP tools it never implemented.

The format has one governing rule: **an adapter is data, never code.** There is
no `eval` step, no expression language, no callback, no remote script, and no
way to express one. Everything below follows from that.

## Shape

```json
{
  "id": "demo-crm",
  "name": "Acme CRM",
  "version": "1.2.0",
  "description": "What this adapter does, in a sentence.",
  "category": "crm",
  "author": "Who published it",
  "verifiedAt": "2026-09-01",
  "origins": ["http://localhost:5273"],
  "tools": [ /* … */ ]
}
```

| Field | Rules |
|---|---|
| `id` | kebab-case, unique |
| `version` | semver |
| `origins` | 1–4 **exact** origins. No wildcards, no paths, no trailing slash. Multiple entries exist to cover equivalent hosts of the same app (`localhost` and `127.0.0.1`), never to span services. |
| `category` | `crm`, `commerce`, `productivity`, `developer-tools`, `registry`, `other` |
| `verifiedAt` | when the author last checked the definition against the live site |

## Tools

```json
{
  "name": "create_customer",
  "title": "Create customer",
  "description": "Create a customer by filling in the real Add Customer form.",
  "capability": "WRITE",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Full name" },
      "email": { "type": "string", "format": "email", "description": "Contact email" }
    },
    "required": ["name", "email"]
  },
  "probeSelectors": ["[data-action='add-customer']"],
  "appliesWhen": ["[data-testid='customer-list']"],
  "steps": [ /* … */ ]
}
```

`name` is snake_case. `description` is what an agent reads to decide whether to
use the tool, so write it for that reader.

`inputSchema` is a JSON Schema subset: an object whose properties are `string`,
`number`, `integer` or `boolean`, optionally with `enum` and `format`.
**The runtime validates input against it before touching the page** — the
browser does not (see [webmcp-api.md](webmcp-api.md)).

`probeSelectors` are elements expected to exist while the page is idle, used for
health checks. Omitted, the first step's selector is used.

`appliesWhen` says which pages the tool is for: every selector must resolve for
the tool to be health-checked at all, and where they do not it reports
`not-applicable` instead of `broken` and is left out of the adapter's own
verdict.

Declare it on any tool that belongs to one part of a site. An adapter usually
covers several kinds of page, and a tool that reads a product's price finds
nothing on a search page — which is not a fault, but without this the check
cannot tell that from a selector that has gone stale, and it must assume the
worse of the two. One undeclared tool for another page is enough to report a
working adapter as `degraded` everywhere else.

## Display text in another language

`i18n` carries what a *reader* is shown, per locale, on the adapter and on each
tool:

```json
"i18n": { "ja": { "name": "…", "description": "…" } }
```

It is display text and nothing else. **An agent is always handed
`tool.description`**, in the language its author wrote it in, because that is an
instruction to a model rather than a caption on a screen. Tool names, capability
names and this format's own field names are not translated either — they are
what a person types, searches for, and matches against what the tool announces.

Locale keys look like `ja` or `pt-BR`; `ja-JP` finds an entry written as `ja`.
An adapter with no entry for the reader's language falls back to the canonical
text, which is why this is optional: an untranslated sentence beats a missing
one.

## Capabilities

| | Meaning | Confirmation |
|---|---|---|
| `READ` | Returns information. May type in a search box; may not submit or navigate. | never |
| `INTERACT` | Moves around the app without changing data. | never |
| `WRITE` | Creates or changes data. | configurable per adapter |
| `DESTRUCTIVE` | Deletes data. | **always**, not configurable |

Capability cannot be derived mechanically — typing into a search box is a read,
and clicking a button might open a panel or delete an account. It is an author
declaration that a reviewer checks against the steps, which is why the Store
shows both the declared capability and a factual count of what the steps do.

The one mechanical rule that *is* enforced: a `READ` tool may not `submit` or
`navigate`.

## Steps

Every step names exactly one element (except `navigate`) and fails if the
selector does not match **exactly one**.

| Step | Fields | Notes |
|---|---|---|
| `click` | `selector` | |
| `fill` | `selector`, `value` | Uses the native value setter and dispatches `input`/`change`, so frameworks see it as typing. |
| `select` | `selector`, `value` | Matches an option by value, then by visible label. Fails if neither matches. |
| `check` / `uncheck` | `selector` | No-op if already in that state. |
| `submit` | `selector` | `requestSubmit()`, so validation and submit handlers run. |
| `waitFor` | `selector`, `state?`, `timeoutMs?` | `state` is `present` (default) or `absent`. |
| `assertVisible` | `selector` | |
| `assertText` | `selector`, `contains` | |
| `readText` | `selector`, `as` | |
| `readAttribute` | `selector`, `attribute`, `as` | |
| `readList` | `selector`, `as`, `limit?`, `fields?` | The only step that may match many elements. |
| `navigate` | `path` | Same-origin path only. Client-side (History API) so the tool call survives it. |

`readList` fields:

```json
{
  "type": "readList",
  "selector": "[data-testid='customer-list'] li",
  "as": "customers",
  "limit": 25,
  "fields": {
    "id": { "attribute": "data-customer-id" },
    "name": { "selector": "[data-field='name']" }
  }
}
```

Whatever a `read*` step binds becomes `structuredContent` on the tool result.

## Placeholders

`{{name}}` in a step **value** is replaced with that tool input.

- Placeholders work in `fill`, `select`, `assertText` and `navigate` values.
- **Never in selectors.** A tool argument cannot retarget a step.
- Only properties declared in `inputSchema` are available; undeclared input keys
  are dropped before interpolation sees them.
- Substituted text is not re-scanned, so a value containing `{{x}}` stays literal.
- A placeholder no property can fill is a validation error, not a runtime surprise.

## Identifying one record

Adapters cannot interpolate selectors, so "act on record X" is expressed by
using the site's own search to narrow the list, then acting on the single
remaining row:

```json
[
  { "type": "fill", "selector": "[data-testid='task-search']", "value": "{{title}}" },
  { "type": "waitFor", "selector": "[data-testid='task-list'] li" },
  { "type": "click", "selector": "[data-testid='task-list'] li [data-action='delete-task']" }
]
```

The `waitFor` is the safety property: it requires **exactly one** row. If the
title matched two tasks, the tool fails instead of deleting the wrong one.

For the same reason, a tool that creates something should verify it by looking
it up rather than reading "the last row" — an earlier call may have left a
filter active, and reading the wrong row reports a confident wrong answer.

## What you cannot write

These are unrepresentable, not discouraged:

- executable code in any form — no `eval`, `script`, `fn`, or handler steps
- remote script URLs
- wildcard or multi-service origins
- selector interpolation
- typing into or reading from password, one-time-code, or card fields
- navigation off the adapter's origin

Validation rejects the first four; the runtime refuses the last two at call time.

## Validating

```bash
# in the Studio, or against the registry's own WebMCP tool
validate_adapter({ adapter: "<the JSON>" })
```

Or in code:

```ts
import { validateAdapter } from '@liha/adapter-schema';
const result = validateAdapter(JSON.parse(text));
```

## Writing one as an agent

The portal registers two tools that make this a loop rather than a guess. Both
are ordinary WebMCP tools on `https://webmcp-adapter.liha.dev`, so any agent
that can reach that page can use them.

```
validate_adapter({ adapter: "<the JSON>" })
  → Valid. This adapter would be accepted by the runtime.

install_adapter({ adapter: "<the JSON>" })
  → a confirmation window opens; a person approves the origins and capabilities
```

Counting selector matches is the Studio's job rather than the portal's, and
that is deliberate. A count is not nothing: ask `[data-token^="a"]`, then
`[data-token^="b"]`, and you read an attribute a character at a time on an
origin you cannot see. A tool on a web page that can ask the extension to do
that turns the extension's host permissions into the page's, the moment anything
gets injected into it. The Studio is a page the extension owns, opened by the
person using it, so the same capability lives there instead.

`install_adapter` cannot install anything on its own. It hands the definition to
the extension, which re-validates it and shows the same confirmation the Store's
own install button shows, naming the origins, the capabilities and the page that
asked. An agent asking is a request.
