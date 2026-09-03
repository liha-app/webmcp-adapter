# Agent marks

The two marks shown in the hero's "onboard your agent" control.

| File | What it is | Where it came from |
|---|---|---|
| `claude.svg` | Anthropic's Claude mark | https://logos.lndev.me/logos/claude.svg — unmodified |
| `codex.svg` | OpenAI's Codex mark | https://logos.lndev.me/logos/codex.svg — sized in pixels rather than `em`, and the inline `flex`/`line-height` style dropped; the artwork is untouched |
| `codex-dark.svg` | The same mark reversed for a dark ground | `codex.svg` with its single ink value changed from `#111` to `#f5f5f7`. Nothing else differs, and a test asserts that. |

Claude's mark is a brand colour that reads on white and on black, so there is
one file for both appearances. Codex's is monochrome, which is exactly the kind
of mark that is meant to be reversed on a dark ground.

**These are other people's trademarks.** They are here to say which agents the
copied prompt works with — a statement of compatibility, not a claim of
endorsement, affiliation or partnership by Anthropic or OpenAI. The collection
they came from states the same thing and grants no rights of its own: "All logos
are trademarks of their respective owners. Provided for convenience — check each
brand's guidelines before use." Whoever deploys this site is the party bound by
those guidelines.

The requirement the control actually describes is narrower than any list of
vendors: an agent that can fetch a URL can follow the prompt.
