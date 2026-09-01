# Contributing

Thanks for looking. The most useful contributions here are adapters and the
security review of adapters — that is the part of the project that decides
whether the whole idea is safe.

## Getting set up

```bash
pnpm install
pnpm build
pnpm verify        # typecheck, lint, unit + integration tests, build
```

Requirements: Node 20+, pnpm 10+, and Chrome 151+ for anything WebMCP-related.
Enable `chrome://flags/#enable-webmcp-testing` and restart Chrome.

```bash
pnpm dev           # demo apps on 5273/5274/5275, registry on 5280, extension rebuilt on change
```

Load `apps/extension/dist` at `chrome://extensions` → Developer mode → Load unpacked.

## Before you open a pull request

```bash
pnpm verify
pnpm e2e
pnpm acceptance:all
```

CI runs all four layers on every push and pull request, acceptance included, so
a pull request that breaks the WebMCP pipeline goes red before review.

`acceptance:all` drives a real browser and observes tools through the DevTools
WebMCP domain. If you changed anything on the path from the service worker to
`document.modelContext`, that run is the evidence that it still works — a green
unit suite is not.

Do not skip a failing test to get a green run. If a test is wrong, fix the test
and say why in the message; if the code is wrong, fix the code.

## Contributing an adapter

1. Write it as JSON in `adapters/`, or record it in the Studio and export.
2. Add it to `adapters/index.ts`.
3. Run `pnpm test` — `adapters/adapters.test.ts` checks every published adapter.
4. Add an integration test in `tests/integration/` if it targets a demo app.

Adapters must:

- be scoped to **exact** origins, no wildcards
- classify every tool honestly as READ / INTERACT / WRITE / DESTRUCTIVE
- describe every tool and every input property well enough for an agent to choose correctly
- identify records through the site's own search rather than guessing, so an
  ambiguous lookup fails instead of acting on the wrong row
- carry a `verifiedAt` date you actually checked

Adapters must not:

- target a third-party service. This repository ships adapters only for its own
  demo apps. An adapter that drives someone else's site raises terms-of-service
  and stability questions this project is not the right place to answer, and the
  demos exist so the technology can be judged without them.
- read or write credential, one-time-code or payment fields. The runtime blocks
  this, and an adapter that tries is a bug report about the adapter.

## Changing the DSL

New step types need, in one pull request:

1. the Zod schema in `packages/adapter-schema/src/adapter.ts`
2. the executor case in `packages/adapter-runtime/src/executor.ts`
3. unit tests covering the success path **and** what happens when it fails
4. Studio support in `apps/extension/src/studio/draft.ts`
5. a row in `docs/adapter-format.md`

A step that can execute a string as code will not be merged, in any form. That
is not a style preference — it is the property that makes a public registry of
community adapters something a person can reasonably trust.

## Code conventions

- TypeScript strict, no `any` unless genuinely unavoidable
- Zod for anything crossing a trust boundary
- The MAIN-world runtime must never reference a `chrome.*` API
- Never log a value a user or agent supplied; log shapes instead
- Comments explain *why*, not *what*

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please do not open a public issue for an
unreported vulnerability.
