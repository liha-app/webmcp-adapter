import { useEffect, useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { registerRegistryTools, type WebMcpStatus } from '../lib/webmcp';

export function Root() {
  const [status, setStatus] = useState<WebMcpStatus | null>(null);

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
    <div className="page">
      <header className="masthead">
        <Link to="/" className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <span>
            <strong>Liha</strong> Adapter Registry
          </span>
        </Link>
        <nav className="masthead__nav">
          <Link to="/" activeProps={{ className: 'active' }} activeOptions={{ exact: true }}>
            Adapters
          </Link>
          <Link to="/about" activeProps={{ className: 'active' }}>
            How it works
          </Link>
        </nav>
      </header>

      <div className="selfhost" role="status">
        {status === null && <span className="dot dot--idle" />}
        {status?.supported === true && <span className="dot dot--on" />}
        {status?.supported === false && <span className="dot dot--off" />}
        {status === null
          ? 'Checking for WebMCP…'
          : status.supported
            ? `This registry implements WebMCP itself — ${status.registered.length} tools registered: ${status.registered.join(', ')}`
            : 'WebMCP is not available in this browser. Enable chrome://flags/#enable-webmcp-testing to let an agent search this registry directly.'}
      </div>

      <main className="main">
        <Outlet />
      </main>

      <footer className="foot">
        <p>
          Every adapter here is a JSON file in the repository. Adapters contain no JavaScript — read one before you
          install it.
        </p>
        <p className="muted">MIT licensed · adapter definitions published alongside the code</p>
      </footer>
    </div>
  );
}
