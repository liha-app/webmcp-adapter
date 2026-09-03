import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CATALOG, findEntry } from '../lib/catalog';
import { demoApps } from '../lib/demos';
import { PROOF } from '../lib/proof';
import { GITHUB_URL } from '../lib/links';
import { useI18n, type MessageKey } from '../i18n';
import { AdapterIcon, CapabilityBadge } from './components';
import { AgentOnboard } from './onboard';
import { ParticleField } from './particlefield';
import { Flow } from './diagram';

const SAFETY_POINTS: MessageKey[] = [
  'security.point1',
  'security.point2',
  'security.point3',
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
      <section className="hero hero--field">
        <ParticleField />
        <div className="section-content">
          <AgentOnboard />
          <p className="t-eyebrow-super">{t('hero.eyebrow')}</p>
          <h1 className="t-headline-super">{t('hero.headline')}</h1>
          <p className="t-callout hero__copy">{t('hero.copy')}</p>
          <div className="hero__cta">
            <Link className="button" to="/adapters/$adapterId" params={{ adapterId: 'demo-crm' }}>
              {t('hero.tryDemo')}
            </Link>
            <Link className="more" to="/create">
              {t('nav.create')}
            </Link>
            <a className="more" href={GITHUB_URL}>
              {t('hero.github')}
            </a>
          </div>
          <p className="hero__note">{t('hero.note')}</p>
        </div>
      </section>

      <section className="section section--tiles section--compact" id="how">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('problem.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">{tx('problem.p1', [<code key="rt">registerTool()</code>])}</p>
                <p className="t-body">{t('problem.p2')}</p>
              </div>
              <Flow
                animate
                steps={[
                  { label: t('flow.existingWebsite') },
                  { label: t('flow.communityAdapter'), detail: t('how.stepAdapterJsonDetail'), strong: true },
                  { label: t('flow.extension'), detail: t('how.stepExtensionDetail') },
                  { label: t('flow.webmcpAgent'), detail: t('how.stepAgentDetail') },
                ]}
              />
            </div>

            <div className="tile tile--dark fact fact--compact">
              <p className="t-tiles-headline fact__figure">{t('problem.factNoChangeFigure')}</p>
              <p className="fact__label">{t('problem.factNoChangeLabel')}</p>
            </div>

            <div className="tile fact fact--compact">
              <p className="t-tiles-headline fact__figure">{t('problem.factYourCallFigure')}</p>
              <p className="fact__label">{t('problem.factYourCallLabel')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tiles section--compact" id="demos">
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

      <section className="section section--tiles section--compact" id="create">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('recorder.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 32 }}>
                <p className="t-body">{t('recorder.copy')}</p>
              </div>
              <Flow
                steps={[
                  { label: t('recorder.step2Title'), detail: t('recorder.step2') },
                  { label: t('recorder.step3Title'), detail: t('recorder.step3') },
                  { label: t('recorder.step6Title'), detail: t('recorder.step6'), strong: true },
                ]}
              />
              <p className="tile__cta">
                <Link className="more more--small" to="/create">
                  {t('nav.create')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tiles section--compact" id="security">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('security.headline')}</h2>
          <div className="grid">
            <div className="tile tile--full">
              <div className="tile__copy" style={{ marginBottom: 26 }}>
                <p className="t-body">{t('security.summary')}</p>
              </div>
              <ul className="checklist checklist--columns">
                {SAFETY_POINTS.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
              <p className="security-note">{t('security.limitShort')}</p>
              <p className="tile__cta">
                <a className="more more--small" href={`${GITHUB_URL}/blob/main/SECURITY.md`}>
                  {t('security.threatModel')}
                </a>
              </p>
            </div>

            <div className="tile tile--dark tile--full">
              <div className="tile__copy" style={{ marginBottom: 24 }}>
                <h3 className="t-headline-sm">{t('verified.headline')}</h3>
                <p className="t-body">{t('verified.summary')}</p>
              </div>
              <dl className="proof-grid">
                <div>
                  <dt>{t('verified.factAdapters')}</dt>
                  <dd>{CATALOG.length}</dd>
                </div>
                <div>
                  <dt>{t('verified.factTools')}</dt>
                  <dd>{toolCount}</dd>
                </div>
                <div>
                  <dt>{t('verified.factUnitShort')}</dt>
                  <dd>{PROOF.unitAndIntegrationTests}</dd>
                </div>
                <div>
                  <dt>{t('verified.factE2eShort')}</dt>
                  <dd>{PROOF.e2eTests}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="section hero">
        <div className="section-content">
          <h2 className="t-tiles-headline">{t('close.headline')}</h2>
          <p className="t-callout hero__copy">{t('close.copy')}</p>
          <div className="hero__cta">
            <Link className="button" to="/adapters/$adapterId" params={{ adapterId: 'demo-crm' }}>
              {t('hero.tryDemo')}
            </Link>
            <Link className="more" to="/create">
              {t('nav.create')}
            </Link>
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
