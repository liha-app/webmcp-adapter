import { useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { GITHUB_URL } from '../lib/links';
import { registerRegistryTools, type WebMcpStatus } from '../lib/webmcp';
import { useI18n } from '../i18n';
import { LanguageControl, ThemeControl } from './controls';

export function Root() {
  const [status, setStatus] = useState<WebMcpStatus | null>(null);
  const onLanding = useRouterState({ select: (state) => state.location.pathname === '/' });
  const { t } = useI18n();

  useEffect(() => {
    // Aborting the signal unregisters every tool — the same mechanism the
    // adapter runtime uses, because it is the only one WebMCP offers.
    const controller = new AbortController();
    registerRegistryTools(controller.signal)
      .then(setStatus)
      .catch(() => setStatus({ supported: false, registered: [] }));
    return () => controller.abort();
  }, []);

  return (
    <>
      <header className="globalnav">
        <nav className="globalnav__inner" aria-label="Global">
          <Link to="/" className="globalnav__brand">
            <svg className="globalnav__mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" className="globalnav__markbg" />
              <path
                d="M11 8v16M11 24h8"
                stroke="#f5f5f7"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="23" cy="10" r="3" fill="#0071e3" />
            </svg>
            <span className="globalnav__brandname">
              <strong>Liha</strong> WebMCP Adapter
            </span>
          </Link>
          <div className="globalnav__links">
            <Link to="/adapters" activeProps={{ className: 'active' }}>
              {t('nav.adapters')}
            </Link>
            <a data-secondary="" href={onLanding ? '#how' : '/#how'}>
              {t('nav.how')}
            </a>
            <a data-secondary="" href={onLanding ? '#security' : '/#security'}>
              {t('nav.trust')}
            </a>
            <a data-secondary="" href={GITHUB_URL}>
              {t('nav.github')}
            </a>
            <LanguageControl />
            <ThemeControl />
          </div>
        </nav>
      </header>

      <div className="statusband">
        <p className="statusband__inner" role="status">
          {status === null && <span className="dot dot--idle" />}
          {status?.supported === true && <span className="dot dot--on" />}
          {status?.supported === false && <span className="dot dot--off" />}
          {status === null
            ? t('status.checking')
            : status.supported
              ? t('status.supported', [status.registered.length, status.registered.join(', ')])
              : t('status.unsupported')}
        </p>
      </div>

      <main>
        <Outlet />
      </main>

      <footer className="globalfooter">
        <div className="globalfooter__inner">
          <p>{t('footer.readable')}</p>
          <p>{t('footer.mainWorld')}</p>
          <div className="globalfooter__rule" />
          <div className="globalfooter__links">
            <span>{t('footer.mit')}</span>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={GITHUB_URL}>{t('footer.source')}</a>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={`${GITHUB_URL}/blob/main/SECURITY.md`}>{t('footer.security')}</a>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={`${GITHUB_URL}/blob/main/docs/adapter-format.md`}>{t('footer.format')}</a>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={`${GITHUB_URL}/blob/main/docs/webmcp-api.md`}>{t('footer.apiNotes')}</a>
          </div>
          <p style={{ marginTop: 14 }}>{t('footer.disclaimer')}</p>
        </div>
      </footer>
    </>
  );
}
