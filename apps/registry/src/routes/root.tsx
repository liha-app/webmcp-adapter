import { useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { GITHUB_URL } from '../lib/links';
import { registerRegistryTools, type WebMcpStatus } from '../lib/webmcp';

export function Root() {
  const [status, setStatus] = useState<WebMcpStatus | null>(null);
  const onLanding = useRouterState({ select: (state) => state.location.pathname === '/' });

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
            <span>
              <strong>Liha</strong> WebMCP Adapter
            </span>
          </Link>
          <div className="globalnav__links">
            <Link to="/adapters" activeProps={{ className: 'active' }}>
              Adapters
            </Link>
            <a data-secondary="" href={onLanding ? '#how' : '/#how'}>
              How it works
            </a>
            <a data-secondary="" href={onLanding ? '#security' : '/#security'}>
              Trust model
            </a>
            <a href={GITHUB_URL}>GitHub</a>
          </div>
        </nav>
      </header>

      <div className="statusband">
        <p className="statusband__inner" role="status">
          {status === null && <span className="dot dot--idle" />}
          {status?.supported === true && <span className="dot dot--on" />}
          {status?.supported === false && <span className="dot dot--off" />}
          {status === null
            ? 'Checking for WebMCP…'
            : status.supported
              ? `This site implements WebMCP itself — ${status.registered.length} tools registered: ${status.registered.join(', ')}`
              : 'WebMCP is not available in this browser. Enable chrome://flags/#enable-webmcp-testing to let an agent use this page directly.'}
        </p>
      </div>

      <main>
        <Outlet />
      </main>

      <footer className="globalfooter">
        <div className="globalfooter__inner">
          <p>
            Every adapter here is a JSON file in the repository. Adapters contain no JavaScript — read one before you
            install it.
          </p>
          <p>
            The runtime that registers these tools lives in the page’s own JavaScript world, which is the only place
            WebMCP can be reached. A hostile page can see it. That trade-off is documented rather than hidden.
          </p>
          <div className="globalfooter__rule" />
          <div className="globalfooter__links">
            <span>MIT licensed</span>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={GITHUB_URL}>Source</a>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={`${GITHUB_URL}/blob/main/SECURITY.md`}>Security</a>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={`${GITHUB_URL}/blob/main/docs/adapter-format.md`}>Adapter format</a>
            <span className="globalfooter__sep" aria-hidden="true">
              |
            </span>
            <a href={`${GITHUB_URL}/blob/main/docs/webmcp-api.md`}>WebMCP API notes</a>
          </div>
          <p style={{ marginTop: 14 }}>
            Not affiliated with, endorsed by or connected to Apple Inc. or the App Store. The layout follows Apple’s
            public design conventions; all names, artwork and copy here are this project’s own.
          </p>
        </div>
      </footer>
    </>
  );
}
