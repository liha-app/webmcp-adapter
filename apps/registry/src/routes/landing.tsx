import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CATALOG, findEntry } from '../lib/catalog';
import { SETUP_STEPS, demoApps } from '../lib/demos';
import { PROOF } from '../lib/proof';
import { GITHUB_URL, RELEASES_URL } from '../lib/links';
import { AdapterIcon, CapabilityBadge } from './components';
import { Flow } from './diagram';
import { LiveTools } from './live';
import { REGISTRY_TOOLS } from '../lib/webmcp';
import { stepSchema } from '@liha/adapter-schema';

/**
 * Read off the schema rather than typed out, so the claim about the size of
 * the vocabulary cannot drift from the vocabulary.
 */
const STEP_TYPES: string[] = stepSchema.options.map((option) => option.shape.type.value);

const CRM_TOOL = findEntry('demo-crm')?.adapter.tools.find((tool) => tool.name === 'create_customer');
/** The write half of a real tool, unedited. The rest is on its product page. */
const EXCERPT_STEPS = 6;

function adapterExcerpt(): string {
  if (!CRM_TOOL) return '';
  return JSON.stringify(
    { name: CRM_TOOL.name, capability: CRM_TOOL.capability, steps: CRM_TOOL.steps.slice(0, EXCERPT_STEPS) },
    null,
    2,
  );
}

const RECORDER_STEPS: Array<[string, string]> = [
  ['Record', 'Press record in the extension popup.'],
  ['Use the website', 'Click and type the way you normally would.'],
  ['Review the steps', 'Each selector is shown with how many elements it matched.'],
  ['Parameterize', 'What you typed becomes tool input, with your text kept as the example.'],
  ['Test selectors', 'Checked against the live page for a single match.'],
  ['Install', 'It becomes a WebMCP tool, after you approve what it can reach.'],
];

export function Landing() {
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  const demos = demoApps(origin);
  const toolCount = CATALOG.reduce((total, entry) => total + entry.toolCount, 0);

  return (
    <>
      {/* ─────────────────────────────────────────────────────────── hero ── */}
      <section className="hero">
        <div className="section-content">
          <p className="t-eyebrow-super">Liha WebMCP Adapter</p>
          <h1 className="t-headline-super">Make any website agent-ready.</h1>
          <p className="t-callout hero__copy">Add WebMCP tools to websites that never implemented WebMCP.</p>
          <div className="hero__cta">
            <a className="button" href={demos[0]?.url ?? '#demos'}>
              Try the demo
            </a>
            <a className="more" href="#setup">
              Install the extension
            </a>
            <a className="more" href={GITHUB_URL}>
              View on GitHub
            </a>
          </div>
          <p className="hero__note">
            Chrome 151+ with the WebMCP flag on. Open source, MIT licensed, and every adapter is readable before you
            install it.
          </p>
        </div>
      </section>

      {/* ──────────────────────────────────────────── the demonstration ── */}
      {/* Before any explanation: the visitor runs this page's own tools. */}
      <section className="section section--tiles" id="live">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">This page has WebMCP tools. Call one.</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">
                  The registry implements WebMCP natively — this is what a site looks like when its own developers do
                  the work. Pick a tool, press run, and the answer below comes from the real catalogue. When your
                  browser has the API, the call really goes through <code>document.modelContext</code>; when it does
                  not, the panel says so rather than pretending.
                </p>
              </div>
              <LiveTools />
            </div>

            <div className="tile tile--blue fact">
              <p className="t-tiles-headline fact__figure">{REGISTRY_TOOLS.length} tools</p>
              <p className="fact__label">
                registered by this page on load, discoverable by any WebMCP agent — with their input schemas.
              </p>
            </div>

            <div className="tile fact">
              <p className="t-tiles-headline fact__figure">0 tools</p>
              <p className="fact__label">
                registered by the three demo apps. They contain no WebMCP code at all; their tools arrive from
                adapters, from outside.{' '}
                <Link className="more more--small" to="/adapters">
                  Browse the adapters
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────── the problem ── */}
      <section className="section section--tiles" id="problem">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">
            WebMCP adoption shouldn’t have to wait for every website owner.
          </h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy">
                <p className="t-body">
                  A site becomes agent-ready when its developers ship <code>registerTool()</code>. That is a good
                  standard and a slow one: until it happens, an agent is back to screenshots and guesswork on every
                  site that has not got round to it — which is most of them.
                </p>
                <p className="t-body">
                  An adapter moves the work. The capability is defined by whoever needs it, published as readable JSON,
                  and installed by the person whose browser it runs in. The site is unchanged and unaware.
                </p>
              </div>
              <div className="excerpt" style={{ marginTop: 40 }}>
                <div>
                  <h3 className="t-caption" style={{ marginBottom: 12, fontWeight: 600 }}>
                    Today
                  </h3>
                  <Flow
                    tone="muted"
                    stack
                    steps={[{ label: 'Website developer' }, { label: 'registerTool()' }, { label: 'Agent' }]}
                  />
                </div>
                <div>
                  <h3 className="t-caption" style={{ marginBottom: 12, fontWeight: 600 }}>
                    With an adapter
                  </h3>
                  <Flow
                    stack
                    steps={[
                      { label: 'Existing website' },
                      { label: 'Community adapter', strong: true },
                      { label: 'Extension' },
                      { label: 'WebMCP agent' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="tile tile--dark fact">
              <p className="t-tiles-headline fact__figure">No change</p>
              <p className="fact__label">
                to the target website. No SDK, no script tag, no cooperation from its owner, no account.
              </p>
            </div>

            <div className="tile fact">
              <p className="t-tiles-headline fact__figure">Your call</p>
              <p className="fact__label">
                An adapter runs because you installed it, on the origins it names, after the extension showed you what
                it can reach.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── the adapter ── */}
      <section className="section section--tiles" id="adapter">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">An adapter is a JSON file, and that is the whole point.</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">
                  The step vocabulary is closed — click, fill, select, waitFor and a handful more. There is no{' '}
                  <code>eval</code> step, no expression language and no way to express one, which is what makes a
                  registry of community-contributed adapters something you can reason about rather than a malware
                  channel. These are the first {EXCERPT_STEPS} steps of a real tool, unedited:
                </p>
              </div>
              <div className="excerpt">
                <pre>{adapterExcerpt()}</pre>
                <div className="excerpt__notes">
                  <p>
                    <strong>capability</strong> is declared per tool. <code>DESTRUCTIVE</code> always asks the user
                    first; <code>WRITE</code> can be set to.
                  </p>
                  <p>
                    <strong>steps</strong> name one element each. If a selector matches zero or five elements the call
                    fails rather than guessing which button to press.
                  </p>
                  <p>
                    <strong>{'{{placeholders}}'}</strong> interpolate into values, never into selectors — a tool
                    argument cannot retarget a step.
                  </p>
                  <p>
                    <strong>The rest</strong> of this tool is {(CRM_TOOL?.steps.length ?? 0) - EXCERPT_STEPS} read
                    steps that look up the customer it just created, so the tool can report what it actually made
                    rather than assuming it worked.
                  </p>
                  <p>
                    <Link className="more more--small" to="/adapters/$adapterId" params={{ adapterId: 'demo-crm' }}>
                      See the whole adapter
                    </Link>
                  </p>
                  <p>
                    <a className="more more--small" href={`${GITHUB_URL}/blob/main/docs/adapter-format.md`}>
                      Read the full format
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────── how it works ── */}
      <section className="section section--tiles" id="how">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">How it reaches the page</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">
                  The extension validates the adapter, then injects a small runtime into the page’s own JavaScript
                  world — the only place <code>document.modelContext</code> can be reached — and registers each tool
                  there. Your agent sees an ordinary WebMCP tool. When it calls one, the adapter’s steps drive the
                  site’s real form, so the app’s own logic runs exactly as it would for a person.
                </p>
              </div>
              <Flow
                animate
                steps={[
                  { label: 'Adapter JSON', detail: 'declarative, origin-scoped' },
                  { label: 'Chrome extension', detail: 'validates, then injects' },
                  { label: 'MAIN world', detail: "the page's own JavaScript world" },
                  { label: 'registerTool()', detail: 'document.modelContext', strong: true },
                  { label: 'Agent', detail: 'discovers named capabilities' },
                ]}
              />
            </div>

            <div className="tile">
              <div className="tile__copy">
                <h3 className="t-headline-sm">This is not browser automation with extra steps.</h3>
                <p className="t-body">
                  Automation re-derives what to click on every run, is hard to audit, and has no notion of permission.
                  The output here is not a click — it is a named capability with a JSON input schema, a capability
                  classification, and a workflow written once and reviewable by anyone.
                </p>
              </div>
            </div>

            <div className="tile tile--blue fact">
              <p className="t-tiles-headline fact__figure">{STEP_TYPES.length} steps</p>
              <p className="fact__label">
                is the entire vocabulary — {STEP_TYPES.slice(0, 4).join(', ')} and {STEP_TYPES.length - 4} more. Nothing
                in it can execute code, so there is no version of an adapter that runs a script you did not read.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── demos ── */}
      <section className="section section--tiles" id="demos">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">Three ordinary web apps with zero WebMCP code.</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 26 }}>
                <p className="t-body">
                  {CATALOG.length} adapters, {toolCount} tools. That the apps implement nothing is asserted against
                  their sources, their built bundles and the live page — if someone slipped a <code>registerTool()</code>{' '}
                  into one of them, CI would fail.
                </p>
              </div>
              <ul className="demolist" data-testid="demo-list">
                {demos.map((demo) => {
                  const entry = findEntry(demo.adapterId);
                  return (
                    <li className="lockup" key={demo.id} data-demo-id={demo.id}>
                      <div className="lockup__inner">
                        <AdapterIcon id={demo.adapterId} category={entry?.adapter.category} />
                        <div className="lockup__text">
                          <span className="lockup__title" style={{ fontWeight: 600 }}>
                            {demo.name}
                          </span>
                          <span className="lockup__sub">{demo.blurb}</span>
                          <span className="lockup__meta">
                            {demo.tools.slice(0, 3).map((tool) => (
                              <code key={tool.name} style={{ fontSize: 12 }}>
                                {tool.name}
                              </code>
                            ))}
                            {demo.tools.length > 3 && (
                              <span style={{ fontSize: 12, opacity: 0.6 }}>+{demo.tools.length - 3}</span>
                            )}
                            <CapabilityBadge
                              capability={
                                demo.tools.find((tool) => tool.capability === 'DESTRUCTIVE')?.capability ??
                                demo.tools[0]?.capability ??
                                'READ'
                              }
                            />
                            {demo.note && <span style={{ fontSize: 12 }}>{demo.note}</span>}
                          </span>
                        </div>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Link
                            className="getbutton"
                            to="/adapters/$adapterId"
                            params={{ adapterId: demo.adapterId }}
                          >
                            Adapter
                          </Link>
                          <a className="getbutton getbutton--filled" href={demo.url}>
                            Open {demo.name}
                          </a>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── setup ── */}
      <section className="section section--tiles" id="setup">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">Before the demos will do anything.</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 30 }}>
                <p className="t-body">WebMCP is behind a flag in Chrome today, so there is one switch to turn on first.</p>
              </div>
              <ol className="steps" data-testid="setup-steps">
                {SETUP_STEPS.map((step, index) => (
                  <li key={step.text}>
                    <div className="steps__body">
                      <p className="t-body">
                        {step.text}
                        {step.code && <code>{step.code}</code>}
                      </p>
                      {index === 2 && (
                        <p className="steps__links">
                          <a className="button button--small" href={RELEASES_URL}>
                            Download extension
                          </a>
                          <a className="more more--small" href={`${GITHUB_URL}#quick-start`}>
                            Or build from source
                          </a>
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── recorder ── */}
      <section className="section section--tiles" id="recorder">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">Teach an agent by using the website yourself.</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 30 }}>
                <p className="t-body">
                  The recorder does not let an AI guess at a page and invent an adapter. It watches a workflow a person
                  performed and turns it into a declarative capability you review before it becomes a tool — selectors
                  come from the site’s own stable attributes, never class names, and the values you typed become inputs
                  rather than being baked in.
                </p>
              </div>
              <ol className="steps" data-testid="recorder-steps">
                {RECORDER_STEPS.map(([title, detail], index) => (
                  <li key={title} className="rise" style={{ animationDelay: `${index * 60}ms` }}>
                    <div className="steps__body">
                      <p className="t-body">
                        <strong style={{ fontWeight: 600 }}>{title}</strong> — {detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── verified ── */}
      <section className="section section--tiles" id="verified">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">What has actually been checked.</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 30 }}>
                <p className="t-body">
                  A real agent, outside the page, discovers and invokes these tools through the DevTools WebMCP domain —
                  the same surface a Tool Inspector uses. {PROOF.ciNote}
                </p>
              </div>
              <ul className="checklist">
                {PROOF.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
              <dl className="facts" style={{ marginBottom: 0 }}>
                {PROOF.acceptance.map((run) => (
                  <div key={run.name}>
                    <dt>{run.name}</dt>
                    <dd>
                      <span>{run.result}</span>
                      <small>{run.what}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="tile tile--dark fact">
              <p className="t-tiles-headline fact__figure">{PROOF.unitAndIntegrationTests}</p>
              <p className="fact__label">
                unit and integration tests. The integration layer mounts the real demo apps and runs the real published
                adapters against them, so an adapter that drifts from the site it targets fails there.
              </p>
            </div>

            <div className="tile tile--blue fact">
              <p className="t-tiles-headline fact__figure">{PROOF.e2eTests}</p>
              <p className="fact__label">
                end-to-end tests in a real browser, plus three acceptance runs that drive Chrome over the DevTools
                protocol.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── security ── */}
      <section className="section section--tiles" id="security">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">Auditable, origin-scoped and permission-aware.</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 26 }}>
                <p className="t-body">
                  Not “safe”. The realistic worst case is a community adapter becoming browser malware, so the format is
                  built so that is either impossible to express or visible before you install it.
                </p>
              </div>
              <ul className="checklist">
                <li>No executable JavaScript anywhere in the format — the DSL cannot express it.</li>
                <li>Exact origins only. A wildcard is rejected at validation, not warned about.</li>
                <li>A hard refusal to touch password, card or other sensitive fields.</li>
                <li>Values are never written to logs or traces.</li>
                <li>Anything destructive asks you first, every time.</li>
              </ul>
            </div>

            <div className="tile tile--dark tile--full">
              <div className="tile__copy">
                <h3 className="t-headline-sm">The limitation we can’t engineer away.</h3>
                <p className="t-body">
                  WebMCP tools have to be registered in the page’s own JavaScript world, so the extension’s runtime
                  lives there too. A hostile page can see it, call it, or patch it. It holds no extension privileges —
                  the worst a page can do with it is drive its own DOM, which it could already do — but the isolation an
                  extension normally gives you does not apply here, and you should weigh that.
                </p>
              </div>
              <p className="tile__cta">
                <a className="more more--elevated" href={`${GITHUB_URL}/blob/main/SECURITY.md`}>
                  Read the full threat model
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── close ── */}
      <section className="section hero">
        <div className="section-content">
          <h2 className="t-tiles-headline">Don’t wait for every website to adopt WebMCP.</h2>
          <p className="t-callout hero__copy">The website never implemented WebMCP. Liha Adapter did.</p>
          <div className="hero__cta">
            <a className="button" href={demos[0]?.url ?? '#demos'}>
              Try the demo
            </a>
            <a className="more" href="#setup">
              Install the extension
            </a>
            <a className="more" href={GITHUB_URL}>
              View on GitHub
            </a>
          </div>
          <p className="hero__note">
            Open source, MIT licensed — extension, runtime, DSL, registry, recorder, demo apps and tests.
          </p>
        </div>
      </section>
    </>
  );
}
