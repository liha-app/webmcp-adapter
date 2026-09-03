import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CATALOG } from '../lib/catalog';
import { demoApps } from '../lib/demos';
import { PROOF } from '../lib/proof';
import { GITHUB_URL } from '../lib/links';
import { useI18n, type MessageKey } from '../i18n';
import { AgentOnboard } from './onboard';
import { ParticleField } from './particlefield';
import { DriveSequence } from './sequence';

const SAFETY_POINTS: MessageKey[] = [
  'security.point1',
  'security.point2',
  'security.point3',
  'security.point5',
];

export function Landing() {
  const { t } = useI18n();
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
          </div>
          <p className="hero__note">{t('hero.note')}</p>
        </div>
      </section>

      {/* Its own section rather than the hero's: the particle field is sized to
        * the hero, and a picture inside it stretches the field over the picture. */}
      <section className="section section--openshot">
        <figure className="shot shot--hero">
          <img src="/shots/crm.jpg" width={1600} height={1000} alt={t('hero.alt')} />
        </figure>
      </section>

      <section className="section section--shot" id="how">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('drive.headline')}</h2>
          <p className="t-callout section-lede">{t('drive.copy')}</p>
          <DriveSequence />
        </div>
      </section>

      <section className="section section--shot" id="demos">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('demos.headline')}</h2>
          <p className="t-callout section-lede">{t('demos.lede')}</p>
          <ul className="gallery">
            {demos.map((demo) => (
              <li key={demo.id}>
                <a href={demo.url}>
                  <img
                    src={`/shots/${demo.id.replace('demo-', '')}.jpg`}
                    width={1600}
                    height={1000}
                    alt={demo.name}
                    loading="lazy"
                  />
                  <span className="gallery__name">{demo.name}</span>
                  <span className="gallery__meta">{t('demos.toolCount', [String(demo.tools.length)])}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--shot" id="create">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('studio.headline')}</h2>
          <p className="t-callout section-lede">{t('studio.copy')}</p>
          <figure className="shot">
            <img src="/shots/studio.jpg" width={1600} height={1000} alt={t('studio.alt')} loading="lazy" />
          </figure>
          <Link className="more section-more" to="/create">
            {t('nav.create')}
          </Link>
        </div>
      </section>

      <section className="section section--tiles section--compact" id="security">
        <div className="section-content">
          <h2 className="t-tiles-headline section-headline">{t('security.headline')}</h2>
          <ul className="safety">
            {SAFETY_POINTS.map((point) => (
              <li key={point}>{t(point)}</li>
            ))}
          </ul>
          <p className="security-note">{t('security.limitShort')}</p>
          <a className="more section-more" href={`${GITHUB_URL}/blob/main/SECURITY.md`}>
            {t('security.threatModel')}
          </a>
          <dl className="proof">
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
