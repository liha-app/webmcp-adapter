import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CATALOG, findEntry } from '../lib/catalog';
import { SETUP_STEPS, demoApps } from '../lib/demos';
import { PROOF } from '../lib/proof';
import { GITHUB_URL, RELEASES_URL } from '../lib/links';
import { CapabilityBadge } from './components';
import { Flow } from './diagram';
import { LiveTools } from './live';

/** The real create_customer steps, trimmed to what fits on a screen. */
function adapterExcerpt(): string {
  const tool = findEntry('demo-crm')?.adapter.tools.find((candidate) => candidate.name === 'create_customer');
  if (!tool) return '';
  return JSON.stringify(
    {
      name: tool.name,
      capability: tool.capability,
      inputSchema: tool.inputSchema,
      steps: tool.steps.slice(0, 5),
    },
    null,
    2,
  );
}

export function Landing() {
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  const demos = demoApps(origin);
  const toolCount = CATALOG.reduce((total, entry) => total + entry.toolCount, 0);

  return (
    <>
      <header className="hero">
        <h1>Make any website agent-ready.</h1>
        <p className="hero__lede">Add WebMCP tools to websites that never implemented WebMCP.</p>
        <p className="hero__sub">
          WebMCP lets a site hand an agent real tools instead of a page to guess at. Today that only happens when the
          site’s own developers implement it. An adapter does it from the outside — declarative, origin-scoped, and
          open to read before you install it.
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
      </header>

      {/* The demonstration comes before the explanation. */}
      <section className="section section--live" id="live">
        <div className="lead">
          <h2>This page has WebMCP tools. Call one.</h2>
          <p>
            The registry implements WebMCP natively — this is what a site looks like when its developers do the work.
            Pick a tool, press run, and the result below is real. The three demo apps implement none of this, and get
            their tools from adapters instead.
          </p>
        </div>
        <LiveTools />
      </section>

      <section className="section" id="problem">
        <div className="lead">
          <h2>WebMCP adoption shouldn’t have to wait for every website owner.</h2>
          <p>
            A site becomes agent-ready when its developers ship <code>registerTool()</code>. That is a good standard and
            a slow one: until it happens, an agent is back to screenshots and guesswork on every site that has not got
            round to it — which is most of them.
          </p>
          <p>
            An adapter moves the work. The capability is defined by whoever needs it, published as readable JSON, and
            installed by the person whose browser it runs in. The site is unchanged and unaware.
          </p>
        </div>
        <div className="twoflow">
          <div>
            <h3>Today</h3>
            <Flow tone="muted" steps={[{ label: 'Website developer' }, { label: 'registerTool()' }, { label: 'Agent' }]} />
          </div>
          <div>
            <h3>With an adapter</h3>
            <Flow
              steps={[
                { label: 'Existing website' },
                { label: 'Community adapter', strong: true },
                { label: 'Extension' },
                { label: 'WebMCP agent' },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="section" id="adapter">
        <div className="lead">
          <h2>An adapter is a JSON file, and that is the whole point.</h2>
          <p>
            The step vocabulary is closed — click, fill, select, waitFor and a handful more. There is no <code>eval</code>{' '}
            step, no expression language and no way to express one, which is what makes a registry of
            community-contributed adapters something you can reason about rather than a malware channel. Here is a real
            one, unedited:
          </p>
        </div>
        <div className="excerpt">
          <pre>{adapterExcerpt()}</pre>
          <div className="excerpt__notes">
            <p>
              <strong>capability</strong> is declared per tool. <code>DESTRUCTIVE</code> always asks the user first;{' '}
              <code>WRITE</code> can be set to.
            </p>
            <p>
              <strong>steps</strong> name one element each. If a selector matches zero or five elements the call fails
              rather than guessing which button to press.
            </p>
            <p>
              <strong>{'{{placeholders}}'}</strong> interpolate into values, never into selectors — a tool argument
              cannot retarget a step.
            </p>
            <p className="muted">
              Read the full format in{' '}
              <a href={`${GITHUB_URL}/blob/main/docs/adapter-format.md`}>docs/adapter-format.md</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="lead">
          <h2>How it reaches the page</h2>
          <p>
            The extension validates the adapter, then injects a small runtime into the page’s own JavaScript world —
            the only place <code>document.modelContext</code> can be reached — and registers each tool there. Your agent
            sees an ordinary WebMCP tool. When it calls one, the adapter’s steps drive the site’s real form, so the
            app’s own logic runs exactly as it would for a person.
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
        <p className="aside">
          This is not browser automation with extra steps. Automation re-derives what to click on every run, is hard to
          audit, and has no notion of permission. The output here is not a click — it is a named capability with a JSON
          input schema, a capability classification, and a workflow written once and reviewable by anyone.
        </p>
      </section>

      <section className="section" id="demos">
        <div className="lead">
          <h2>Three ordinary web apps with zero WebMCP code</h2>
          <p>
            {CATALOG.length} adapters, {toolCount} tools. That the apps implement nothing is asserted against their
            sources, their built bundles and the live page — if someone slipped a <code>registerTool()</code> into one
            of them, CI would fail.
          </p>
        </div>
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
      </section>

      <section className="section" id="setup">
        <div className="lead">
          <h2>Before the demos will do anything</h2>
          <p>WebMCP is behind a flag in Chrome today, so there is one switch to turn on first.</p>
        </div>
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
      </section>

      <section className="section" id="recorder">
        <div className="lead">
          <h2>Teach an agent by using the website yourself.</h2>
          <p>
            The recorder does not let an AI guess at a page and invent an adapter. It watches a workflow a person
            performed and turns it into a declarative capability you review before it becomes a tool — selectors come
            from the site’s own stable attributes, never class names, and the values you typed become inputs rather
            than being baked in.
          </p>
        </div>
        <ol className="recorder">
          {[
            ['Record', 'Press record in the extension popup.'],
            ['Use the website', 'Click and type the way you normally would.'],
            ['Review the steps', 'Each selector is shown with how many elements it matched.'],
            ['Parameterize', 'What you typed becomes tool input, with your text kept as the example.'],
            ['Test selectors', 'Checked against the live page for a single match.'],
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
      </section>

      <section className="section" id="verified">
        <div className="lead">
          <h2>What has actually been checked</h2>
          <p>
            A real agent, outside the page, discovers and invokes these tools through the DevTools WebMCP domain — the
            same surface a Tool Inspector uses. {PROOF.ciNote}
          </p>
        </div>
        <ul className="checked">
          {PROOF.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        <dl className="runs">
          {PROOF.acceptance.map((run) => (
            <div key={run.name}>
              <dt>{run.result}</dt>
              <dd>
                <strong>{run.name}</strong>
                <span className="muted">{run.what}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="aside">
          Backed by {PROOF.unitAndIntegrationTests} unit and integration tests and {PROOF.e2eTests} end-to-end tests.
          The integration layer mounts the real demo apps and runs the real published adapters against them, so an
          adapter that drifts from the site it targets fails there.
        </p>
      </section>

      <section className="section" id="security">
        <div className="lead">
          <h2>Auditable, origin-scoped and permission-aware.</h2>
          <p>
            Not “safe”. The realistic worst case is a community adapter becoming browser malware, so the format is
            built so that is either impossible to express or visible before you install it: no executable JavaScript,
            exact origins with no wildcards, a hard refusal to touch password or card fields, values never written to
            logs, and confirmation required for anything destructive.
          </p>
        </div>
        <div className="limit">
          <h3>The limitation we can’t engineer away</h3>
          <p>
            WebMCP tools have to be registered in the page’s own JavaScript world, so the extension’s runtime lives
            there too. A hostile page can see it, call it, or patch it. It holds no extension privileges — the worst a
            page can do with it is drive its own DOM, which it could already do — but the isolation an extension
            normally gives you does not apply here, and you should weigh that.
          </p>
          <a className="btn btn--small" href={`${GITHUB_URL}/blob/main/SECURITY.md`}>
            Read the full threat model
          </a>
        </div>
      </section>

      <section className="final">
        <h2>Don’t wait for every website to adopt WebMCP.</h2>
        <p>The website never implemented WebMCP. Liha Adapter did.</p>
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
        <p className="final__note">
          Open source, MIT licensed — extension, runtime, DSL, registry, recorder, demo apps and tests.
        </p>
      </section>
    </>
  );
}
