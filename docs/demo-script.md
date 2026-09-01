# Three-minute demo script

The argument: **WebMCP adoption no longer has to wait for every website owner.**

## Before you start

```bash
pnpm install
pnpm build
pnpm demo          # serves all four apps
```

Enable `chrome://flags/#enable-webmcp-testing`, restart Chrome, and load
`apps/extension/dist` as an unpacked extension. Open the Liha popup once and
disable **Acme CRM** — Scene 2 turns it back on.

Have four tabs ready: the CRM (5273), the Project Manager (5275), the Registry
(5280), and your WebMCP agent or the DevTools WebMCP panel.

---

## Scene 1 — an ordinary website (0:00–0:25)

Open <http://localhost:5273>. An unremarkable CRM.

> "This is a normal web app. Its developers never heard of WebMCP."

Open the console:

```js
await document.modelContext.getTools()   // []
```

> "No tools. Nothing for an agent to use. This is most of the web."

## Scene 2 — install an adapter (0:25–0:55)

Open the Liha popup. Show **Acme CRM**, its origin, and its three tools with
capability badges — `search_customers` READ, `create_customer` WRITE,
`update_customer` WRITE.

> "An adapter adds WebMCP tools from the outside. It's JSON — no code in it —
> scoped to exactly this origin, and every tool declares what it's allowed to do."

Toggle it on. Reload the page.

```js
(await document.modelContext.getTools()).map(t => t.name)
// ["search_customers", "create_customer", "update_customer"]
```

> "The site still implements nothing. The tools are real."

## Scene 3 — an agent uses it (0:55–1:30)

In your agent:

> **"Create a customer named Alice Smith with email alice@example.com."**

Let the audience watch the page: the dialog opens, both fields fill, Create is
clicked, and Alice appears with an id the CRM assigned itself.

Show the popup's execution log — every step, and no typed values in it.

> "That's the real form, driven step by step. Not a screenshot guess."

## Scene 4 — the safety story (1:30–2:00)

Switch to the Project Manager (5275). Ask the agent:

> **"Delete the task about auditing vendor contracts."**

The confirmation window appears: DESTRUCTIVE, the site, the exact values.
**Deny it.** The task is still there.

Ask again and approve. Now it's gone.

> "Destructive always asks. And if a lookup matches two tasks, the tool fails
> rather than deleting the wrong one."

Optional, if there is time: ask it to delete "a" — ambiguous — and show it fail
closed.

## Scene 5 — teach it a new tool (2:00–2:40)

Open the popup on any demo app and press **Record a tool**. Perform the workflow
by hand: click, type, submit.

Press **Stop recording**. The Studio opens with the steps already there, the
selectors chosen from the site's own stable attributes, and the values you typed
proposed as tool inputs.

Name it, describe it, press **Test selectors** — every one resolves to exactly
one element — and **Install locally**. Approve the permission summary.

> "Record, review, parameterize, test. A person who can use a website can teach
> an agent to use it."

## Scene 6 — the registry (2:40–3:00)

Open <http://localhost:5280>. Every adapter, its origins, its capabilities, and
its complete source.

Ask the agent:

> **"Find me a CRM adapter with write access."**

It calls the registry's own `search_adapters` — this page implements WebMCP
natively, which is exactly what a site looks like when its developers do the work.

> "The demo apps implement nothing and got their tools from adapters. This page
> implements WebMCP itself. Both end up somewhere an agent can use."

## Closing line

> The website never implemented WebMCP.
> Liha Adapter did.
>
> **Make any website agent-ready.**

---

## What to say if asked "isn't this just browser automation?"

| Ordinary automation | Liha adapter |
|---|---|
| agent guesses from a screenshot or the DOM | a named capability with a JSON input schema |
| every run re-derives what to click | a deterministic workflow, written once |
| nobody can audit what it will do | the definition is public JSON with no code in it |
| no notion of permission | READ / INTERACT / WRITE / DESTRUCTIVE, confirmed |
| ambiguity resolved by guessing | ambiguity fails closed |
| private to one script | shared, versioned, health-checked in a registry |

The output is not a click. The output is a **WebMCP capability** that any agent
can discover.
