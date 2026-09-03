import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { stepSchema } from '@liha/adapter-schema';
import { CATALOG, findEntry } from '../lib/catalog';
import { SETUP_STEPS, demoApps } from '../lib/demos';
import { PROOF } from '../lib/proof';
import { GITHUB_URL, RELEASES_URL } from '../lib/links';
import { REGISTRY_TOOLS } from '../lib/webmcp';
import { useI18n, type MessageKey } from '../i18n';
import { AdapterIcon, CapabilityBadge } from './components';
import { ParticleField } from './particlefield';
import { Flow } from './diagram';
import { LiveTools } from './live';

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

const RECORDER_STEPS: Array<[MessageKey, MessageKey]> = [
  ['recorder.step1Title', 'recorder.step1'],
  ['recorder.step2Title', 'recorder.step2'],
  ['recorder.step3Title', 'recorder.step3'],
  ['recorder.step4Title', 'recorder.step4'],
  ['recorder.step5Title', 'recorder.step5'],
  ['recorder.step6Title', 'recorder.step6'],
];

const SECURITY_POINTS: MessageKey[] = [
  'security.point1',
  'security.point2',
  'security.point3',
  'security.point4',
  'security.point5',
];

export function Landing() {
  const { t, tx } = useI18n();
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  const demos = demoApps(origin);
  const toolCount = CATALOG.reduce((total, entry) => total + entry.toolCount, 0);

  return (
    <>
      {/* ─────────────────────────────────────────────────────────── hero ── */}
      <section className="hero hero--field">
        <ParticleField />
        <div className="section-content">
          <p className="t-eyebrow-super">{t('hero.eyebrow')}</p>
          <h1 className="t-headline-super">{t('hero.headline')}</h1>
          <p className="t-callout hero__copy">{t('hero.copy')}</p>
          <div className="hero__cta">
            <a className="button" href={demos[0]?.url ?? '#demos'}>
              {t('hero.tryDemo')}
            </a>
            <a className="more" href="#setup">
              {t('hero.install')}
            </a>
            <a className="more" href={GITHUB_URL}>
              {t('hero.github')}
            </a>
          </div>
          <p className="hero__note">{t('hero.note')}</p>
        </div>
      </section>

      {/* ──────────────────────────────────────────── the demonstration ── */}
      {/* Before any explanation: the visitor runs this page's own tools. */}
      <section className="section section--tiles" id="live">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('live.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">{tx('live.copy', [<code key="mc">document.modelContext</code>])}</p>
              </div>
              <LiveTools />
            </div>

            <div className="tile tile--blue fact">
              <p className="t-tiles-headline fact__figure">
                {t('live.factRegisteredFigure', [REGISTRY_TOOLS.length])}
              </p>
              <p className="fact__label">{t('live.factRegisteredLabel')}</p>
            </div>

            <div className="tile fact">
              <p className="t-tiles-headline fact__figure">{t('live.factZeroFigure')}</p>
              <p className="fact__label">
                {t('live.factZeroLabel')}{' '}
                <Link className="more more--small" to="/adapters">
                  {t('live.browseAdapters')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────── the problem ── */}
      <section className="section section--tiles" id="problem">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('problem.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy">
                <p className="t-body">{tx('problem.p1', [<code key="rt">registerTool()</code>])}</p>
                <p className="t-body">{t('problem.p2')}</p>
              </div>
              <div className="excerpt" style={{ marginTop: 40 }}>
                <div>
                  <h3 className="t-caption" style={{ marginBottom: 12, fontWeight: 600 }}>
                    {t('problem.today')}
                  </h3>
                  <Flow
                    tone="muted"
                    stack
                    steps={[
                      { label: t('flow.websiteDeveloper') },
                      { label: t('flow.registerTool') },
                      { label: t('flow.agent') },
                    ]}
                  />
                </div>
                <div>
                  <h3 className="t-caption" style={{ marginBottom: 12, fontWeight: 600 }}>
                    {t('problem.withAdapter')}
                  </h3>
                  <Flow
                    stack
                    steps={[
                      { label: t('flow.existingWebsite') },
                      { label: t('flow.communityAdapter'), strong: true },
                      { label: t('flow.extension') },
                      { label: t('flow.webmcpAgent') },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="tile tile--dark fact">
              <p className="t-tiles-headline fact__figure">{t('problem.factNoChangeFigure')}</p>
              <p className="fact__label">{t('problem.factNoChangeLabel')}</p>
            </div>

            <div className="tile fact">
              <p className="t-tiles-headline fact__figure">{t('problem.factYourCallFigure')}</p>
              <p className="fact__label">{t('problem.factYourCallLabel')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── the adapter ── */}
      <section className="section section--tiles" id="adapter">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('adapter.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">
                  {tx('adapter.copy', [<code key="eval">eval</code>, String(EXCERPT_STEPS)])}
                </p>
              </div>
              <div className="excerpt">
                <pre>{adapterExcerpt()}</pre>
                <div className="excerpt__notes">
                  <p>
                    <strong>{t('adapter.noteCapabilityLabel')}</strong> {t('adapter.noteCapability')}
                  </p>
                  <p>
                    <strong>{t('adapter.noteStepsLabel')}</strong> {t('adapter.noteSteps')}
                  </p>
                  <p>
                    <strong>{t('adapter.notePlaceholdersLabel')}</strong> {t('adapter.notePlaceholders')}
                  </p>
                  <p>
                    <strong>{t('adapter.noteRestLabel')}</strong>{' '}
                    {t('adapter.noteRest', [(CRM_TOOL?.steps.length ?? 0) - EXCERPT_STEPS])}
                  </p>
                  <p>
                    <Link className="more more--small" to="/adapters/$adapterId" params={{ adapterId: 'demo-crm' }}>
                      {t('adapter.seeWhole')}
                    </Link>
                  </p>
                  <p>
                    <a className="more more--small" href={`${GITHUB_URL}/blob/main/docs/adapter-format.md`}>
                      {t('adapter.readFormat')}
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
          <h2 className="t-tiles-headline section-headline">{t('how.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">{tx('how.copy', [<code key="mc">document.modelContext</code>])}</p>
              </div>
              <Flow
                animate
                steps={[
                  { label: t('how.stepAdapterJson'), detail: t('how.stepAdapterJsonDetail') },
                  { label: t('how.stepExtension'), detail: t('how.stepExtensionDetail') },
                  { label: t('how.stepMainWorld'), detail: t('how.stepMainWorldDetail') },
                  { label: t('how.stepRegister'), detail: t('how.stepRegisterDetail'), strong: true },
                  { label: t('how.stepAgent'), detail: t('how.stepAgentDetail') },
                ]}
              />
            </div>

            <div className="tile">
              <div className="tile__copy">
                <h3 className="t-headline-sm">{t('how.notAutomationTitle')}</h3>
                <p className="t-body">{t('how.notAutomationCopy')}</p>
              </div>
            </div>

            <div className="tile tile--blue fact">
              <p className="t-tiles-headline fact__figure">{t('how.factStepsFigure', [STEP_TYPES.length])}</p>
              <p className="fact__label">
                {t('how.factStepsLabel', [STEP_TYPES.slice(0, 4).join(', '), STEP_TYPES.length - 4])}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── demos ── */}
      <section className="section section--tiles" id="demos">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('demos.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 26 }}>
                <p className="t-body">
                  {tx('demos.copy', [
                    String(CATALOG.length),
                    String(toolCount),
                    <code key="rt">registerTool()</code>,
                  ])}
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
                          <span className="lockup__sub">{t(demo.blurbKey)}</span>
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
                            {demo.noteKey && <span style={{ fontSize: 12 }}>{t(demo.noteKey)}</span>}
                          </span>
                        </div>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Link
                            className="getbutton"
                            to="/adapters/$adapterId"
                            params={{ adapterId: demo.adapterId }}
                          >
                            {t('demos.adapter')}
                          </Link>
                          <a className="getbutton getbutton--filled" href={demo.url}>
                            {t('demos.open', [demo.name])}
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
          <h2 className="t-tiles-headline section-headline">{t('setup.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 30 }}>
                <p className="t-body">{t('setup.copy')}</p>
              </div>
              <ol className="steps" data-testid="setup-steps">
                {SETUP_STEPS.map((step, index) => (
                  <li key={step.key}>
                    <div className="steps__body">
                      <p className="t-body">
                        {t(step.key)}
                        {step.code && <code>{step.code}</code>}
                      </p>
                      {index === 2 && (
                        <p className="steps__links">
                          <a className="button button--small" href={RELEASES_URL}>
                            {t('setup.download')}
                          </a>
                          <a className="more more--small" href={`${GITHUB_URL}#quick-start`}>
                            {t('setup.buildFromSource')}
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
          <h2 className="t-tiles-headline section-headline">{t('recorder.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 30 }}>
                <p className="t-body">{t('recorder.copy')}</p>
              </div>
              <ol className="steps" data-testid="recorder-steps">
                {RECORDER_STEPS.map(([titleKey, detailKey], index) => (
                  <li key={titleKey} className="rise" style={{ animationDelay: `${index * 60}ms` }}>
                    <div className="steps__body">
                      <p className="t-body">
                        <strong style={{ fontWeight: 600 }}>{t(titleKey)}</strong> — {t(detailKey)}
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
          <h2 className="t-tiles-headline section-headline">{t('verified.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 30 }}>
                <p className="t-body">{t('verified.copy', [t(PROOF.ciNoteKey)])}</p>
              </div>
              <ul className="checklist">
                {PROOF.factKeys.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
              <dl className="facts" style={{ marginBottom: 0 }}>
                {PROOF.acceptance.map((run) => (
                  <div key={run.nameKey}>
                    <dt>{t(run.nameKey)}</dt>
                    <dd>
                      <span>{run.result}</span>
                      <small>{t(run.whatKey)}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="tile tile--dark fact">
              <p className="t-tiles-headline fact__figure">{PROOF.unitAndIntegrationTests}</p>
              <p className="fact__label">{t('verified.factUnitLabel')}</p>
            </div>

            <div className="tile tile--blue fact">
              <p className="t-tiles-headline fact__figure">{PROOF.e2eTests}</p>
              <p className="fact__label">{t('verified.factE2eLabel')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── security ── */}
      <section className="section section--tiles" id="security">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('security.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 26 }}>
                <p className="t-body">{t('security.copy')}</p>
              </div>
              <ul className="checklist">
                {SECURITY_POINTS.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </div>

            <div className="tile tile--dark tile--full">
              <div className="tile__copy">
                <h3 className="t-headline-sm">{t('security.limitTitle')}</h3>
                <p className="t-body">{t('security.limitCopy')}</p>
              </div>
              <p className="tile__cta">
                <a className="more more--elevated" href={`${GITHUB_URL}/blob/main/SECURITY.md`}>
                  {t('security.threatModel')}
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── close ── */}
      <section className="section hero">
        <div className="section-content">
          <h2 className="t-tiles-headline">{t('close.headline')}</h2>
          <p className="t-callout hero__copy">{t('close.copy')}</p>
          <div className="hero__cta">
            <a className="button" href={demos[0]?.url ?? '#demos'}>
              {t('hero.tryDemo')}
            </a>
            <a className="more" href="#setup">
              {t('hero.install')}
            </a>
            <a className="more" href={GITHUB_URL}>
              {t('hero.github')}
            </a>
          </div>
          <p className="hero__note">{t('close.note')}</p>
        </div>
      </section>
    </>
  );
}
