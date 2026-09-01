import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CATALOG } from '../lib/catalog';
import { SETUP_STEPS, demoApps } from '../lib/demos';
import { PROOF } from '../lib/proof';
import { GITHUB_URL, RELEASES_URL } from '../lib/links';
import { CapabilityBadge } from './components';
import { AgentConsole } from './console';
import { Flow } from './diagram';

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section" id={id}>
      <div className="section__head">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {lede && <p className="section__lede">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

export function Landing() {
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  const demos = demoApps(origin);
  const toolCount = CATALOG.reduce((total, entry) => total + entry.toolCount, 0);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <header className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__copy">
          <p className="hero__kicker">WebMCP capability portability</p>
          <h1>
            Make any website <br />
            agent-ready.
          </h1>
          <p className="hero__lede">
            Add WebMCP tools to websites that never implemented WebMCP.
          </p>
          <p className="hero__sub">
            WebMCP normally requires a site’s own developers to implement it. Liha adds auditable WebMCP tools from
            the outside — declarative, origin-scoped and open source.
          </p>
          <div className="cta">
            <a className="btn btn--primary" href={demos[0]?.url ?? '#demos'}>
              Try the demo
            </a>
            <a className="btn" href="#setup">
              Install the extension
            </a>
            <a className="btn btn--ghost" href={GITHUB_URL}>
              View on GitHub
            </a>
          </div>
          <p className="hero__meta">
            MIT licensed · {CATALOG.length} adapters · {toolCount} tools · Chrome 151+ with the WebMCP flag
          </p>
        </div>
        <div className="hero__figure">
          <AgentConsole />
        </div>
      </header>

      {/* --------------------------------------------------------- problem */}
      <Section
        id="problem"
        eyebrow="The problem"
        title="WebMCP adoption shouldn’t have to wait for every website owner."
        lede="A site becomes agent-ready when its developers ship registerTool(). Until then, an agent is back to guessing at the DOM — however good the standard is."
      >
        <div className="split">
          <article className="panel panel--quiet">
            <h3>WebMCP today</h3>
            <Flow
              tone="muted"
              steps={[
                { label: 'Website developer' },
                { label: 'registerTool()' },
                { label: 'Agent' },
              ]}
            />
            <p className="muted">
              Works well, and only for sites whose owners have done the work. Everything else stays opaque.
            </p>
          </article>
          <article className="panel">
            <h3>With an adapter</h3>
            <Flow
              steps={[
                { label: 'Existing website' },
                { label: 'Community adapter', strong: true },
                { label: 'Extension' },
                { label: 'WebMCP agent' },
              ]}
            />
            <p className="muted">
              The capability is defined by whoever needs it, published as readable JSON, and installed by the person
              whose browser it runs in.
            </p>
          </article>
        </div>
      </Section>

      {/* ------------------------------------------------------ live proof */}
      <Section
        id="proof"
        eyebrow="Live proof"
        title="This is running, not proposed."
        lede="A real agent, outside the page, discovers and invokes these tools through the DevTools WebMCP domain — the same surface a Tool Inspector uses."
      >
        <ul className="facts">
          {PROOF.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        <div className="proof">
          <div className="proof__runs">
            {PROOF.acceptance.map((run) => (
              <div className="proof__run" key={run.name}>
                <span className="proof__result">{run.result}</span>
                <span className="proof__name">{run.name}</span>
                <span className="muted">{run.what}</span>
              </div>
            ))}
          </div>
          <p className="proof__counts">
            Backed by {PROOF.unitAndIntegrationTests} unit and integration tests and {PROOF.e2eTests} end-to-end tests.{' '}
            {PROOF.ciNote}
          </p>
        </div>
      </Section>

      {/* ----------------------------------------------------- how it works */}
      <Section id="how" eyebrow="How it works" title="Four steps, no magic.">
        <div className="steps">
          {[
            { n: 1, t: 'Install an adapter', d: 'From the registry or one you built yourself. You see its origins and every capability before anything is installed.' },
            { n: 2, t: 'The extension injects the tools', d: 'A runtime is placed in the page’s own JavaScript world and registers each tool on document.modelContext.' },
            { n: 3, t: 'Your agent discovers named capabilities', d: 'Not a screenshot to interpret — a tool name, a JSON input schema and a capability classification.' },
            { n: 4, t: 'The real UI is operated', d: 'The adapter’s declarative steps drive the site’s own form. The app’s own logic runs, exactly as it would for a person.' },
          ].map((step) => (
            <article className="step" key={step.n}>
              <span className="step__n">{step.n}</span>
              <h3>{step.t}</h3>
              <p className="muted">{step.d}</p>
            </article>
          ))}
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
      </Section>

      {/* ----------------------------------------------------------- compare */}
      <Section
        id="compare"
        eyebrow="Not automation"
        title="The output is not a click. It is a reusable WebMCP capability."
      >
        <div className="compare">
          <article className="panel panel--quiet">
            <h3>Browser automation</h3>
            <ul className="ticks ticks--no">
              <li>screenshots and DOM guessing</li>
              <li>re-discovers the UI on every run</li>
              <li>difficult to audit</li>
              <li>no explicit permissions</li>
              <li>ambiguity resolved by guessing, sometimes wrongly</li>
              <li>private to whoever wrote the script</li>
            </ul>
          </article>
          <article className="panel">
            <h3>Liha adapter</h3>
            <ul className="ticks ticks--yes">
              <li>a named capability</li>
              <li>a JSON input schema</li>
              <li>a deterministic, written-once workflow</li>
              <li>the definition is open and readable</li>
              <li>explicit READ / INTERACT / WRITE / DESTRUCTIVE</li>
              <li>ambiguity fails closed instead of guessing</li>
            </ul>
          </article>
        </div>
      </Section>

      {/* ------------------------------------------------------------ demos */}
      <Section
        id="demos"
        eyebrow="Demo apps"
        title="Three ordinary web apps with zero WebMCP code."
        lede="Everything an agent can do on them comes from an adapter. That the apps implement nothing is asserted against their sources, their built bundles and the live page."
      >
        <div className="demos">
          {demos.map((demo) => (
            <article className="demo" key={demo.id}>
              <div className="demo__head">
                <h3>{demo.name}</h3>
                <Link to="/adapters/$adapterId" params={{ adapterId: demo.adapterId }} className="demo__adapter">
                  adapter
                </Link>
              </div>
              <p className="muted">{demo.blurb}</p>
              <ul className="toollist">
                {demo.tools.slice(0, 4).map((tool) => (
                  <li key={tool.name}>
                    <code>{tool.name}</code>
                    <CapabilityBadge capability={tool.capability} />
                  </li>
                ))}
                {demo.tools.length > 4 && <li className="muted">and {demo.tools.length - 4} more</li>}
              </ul>
              {demo.note && <p className="demo__note">{demo.note}</p>}
              <a className="btn btn--block" href={demo.url}>
                Open {demo.name}
              </a>
            </article>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ setup */}
      <Section
        id="setup"
        eyebrow="Before you try it"
        title="Six steps, about two minutes."
        lede="WebMCP is behind a flag in Chrome today, so there is one switch to turn on first."
      >
        <ol className="setup">
          {SETUP_STEPS.map((step, index) => (
            <li key={step.text}>
              <span className="setup__n">{index + 1}</span>
              <div>
                <span>{step.text}</span>
                {step.code && <code className="setup__code">{step.code}</code>}
                {index === 2 && (
                  <span className="setup__links">
                    <a className="btn btn--small" href={RELEASES_URL}>
                      Download extension
                    </a>
                    <a className="btn btn--small btn--ghost" href={`${GITHUB_URL}#quick-start`}>
                      Or build from source
                    </a>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* --------------------------------------------------------- recorder */}
      <Section
        id="recorder"
        eyebrow="Adapter Recorder"
        title="Teach an agent by using the website yourself."
        lede="The recorder does not let an AI guess at a page and invent an adapter. It turns a workflow a person performed into an auditable, declarative capability — and you review every step before it becomes a tool."
      >
        <ol className="recorder">
          {[
            ['Record', 'Press record in the extension popup.'],
            ['Use the website', 'Click and type the way you normally would.'],
            ['Review the steps', 'Selectors come from the site’s own stable attributes — never class names.'],
            ['Parameterize', 'The values you typed become tool inputs, with what you typed kept as the example.'],
            ['Test selectors', 'Each one is checked against the live page for a single match.'],
            ['Install', 'It becomes a WebMCP tool, after you approve what it can reach.'],
          ].map(([title, detail], index) => (
            <li key={title} className="recorder__step" style={{ animationDelay: `${index * 70}ms` }}>
              <span className="recorder__n">{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <span className="muted">{detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* --------------------------------------------------------- registry */}
      <Section
        id="registry"
        eyebrow="Adapter Registry"
        title="A registry of capabilities, not scripts."
        lede="Every adapter is published as JSON you can read in full before installing it. There is no hidden code, because the format cannot express any."
      >
        <div className="split">
          <div className="panel">
            <h3>What each listing shows</h3>
            <ul className="ticks ticks--yes">
              <li>the exact origins it runs on</li>
              <li>every tool, with its input schema</li>
              <li>capability classification per tool</li>
              <li>the complete adapter source</li>
              <li>version and last-verified date</li>
              <li>health, checked against the live site by your extension</li>
            </ul>
            <Link to="/adapters" className="btn">
              Browse the registry
            </Link>
          </div>
          <div className="panel panel--quiet">
            <h3>The registry implements WebMCP itself</h3>
            <p className="muted">
              No adapter is involved on this site — it registers its own tools natively, which is what a page looks
              like when its developers do the work. Ask an agent to <em>“find a CRM adapter with write access”</em> and
              it calls <code>search_adapters</code> right here.
            </p>
            <ul className="toollist toollist--plain">
              {['search_adapters', 'get_adapter', 'list_adapter_tools', 'get_adapter_permissions', 'validate_adapter', 'get_demo_info'].map(
                (tool) => (
                  <li key={tool}>
                    <code>{tool}</code>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------- security */}
      <Section
        id="security"
        eyebrow="Trust model"
        title="Auditable, origin-scoped and permission-aware."
        lede="Not “safe”. The realistic worst case is a community adapter becoming browser malware, and the format is built so that is either impossible to express or visible before you install it."
      >
        <div className="split">
          <ul className="ticks ticks--yes">
            <li>Adapters contain no executable JavaScript, and no way to express any</li>
            <li>Exact origin scope — no wildcards, and navigation cannot leave it</li>
            <li>Fails closed when a selector is ambiguous, instead of guessing</li>
            <li>Every tool is READ, INTERACT, WRITE or DESTRUCTIVE</li>
            <li>DESTRUCTIVE always asks; WRITE can be set to ask</li>
            <li>Password, one-time-code and card fields are refused outright</li>
            <li>Typed values are never written to logs</li>
            <li>The adapter source is visible before install</li>
          </ul>
          <div className="panel panel--warn">
            <h3>The limitation we can’t engineer away</h3>
            <p className="muted">
              WebMCP tools have to be registered in the page’s own JavaScript world, so the extension’s runtime lives
              there too. A hostile page can see it, call it, or patch it. It holds no extension privileges — the worst
              a page can do with it is drive its own DOM, which it could already do — but the isolation an extension
              normally gives you does not apply here.
            </p>
            <a className="btn btn--small" href={`${GITHUB_URL}/blob/main/SECURITY.md`}>
              Read the full threat model
            </a>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------ open source */}
      <Section id="oss" eyebrow="Open source" title="MIT licensed. All of it." lede="Adapter definitions are published alongside the code, because an adapter you cannot read is an adapter you should not install.">
        <ul className="oss">
          {[
            ['Extension', 'Manifest V3, Chrome and Firefox'],
            ['Adapter runtime', 'the step executor and its safety rules'],
            ['Adapter DSL', 'the schema and its validation'],
            ['Registry', 'this site'],
            ['Recorder / Studio', 'record, review, parameterize, test'],
            ['Demo apps', 'all three, with no WebMCP code'],
            ['Tests', 'unit, integration, end-to-end and real-browser'],
          ].map(([name, detail]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span className="muted">{detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* -------------------------------------------------------- final cta */}
      <section className="final">
        <p className="hero__kicker">Open source · MIT</p>
        <h2>Don’t wait for every website to adopt WebMCP.</h2>
        <p className="muted">The website never implemented WebMCP. Liha Adapter did.</p>
        <div className="cta">
          <a className="btn btn--primary" href={demos[0]?.url ?? '#demos'}>
            Try the demo
          </a>
          <a className="btn" href="#setup">
            Install the extension
          </a>
          <a className="btn btn--ghost" href={GITHUB_URL}>
            View on GitHub
          </a>
        </div>
        <p className="muted final__note">
          Running the demos needs Chrome 151+ with <code>chrome://flags/#enable-webmcp-testing</code> enabled.
        </p>
      </section>
    </>
  );
}
