import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { findEntry, toolEffectSummary } from '../lib/catalog';
import { fetchInstalled, requestInstall } from '../lib/extension';
import { CapabilityBadge, HealthBadge } from './components';
import { detailRoute } from './tree';

export function AdapterDetail() {
  const { adapterId } = useParams({ from: detailRoute.id });
  const entry = findEntry(adapterId);
  const queryClient = useQueryClient();
  const [showSource, setShowSource] = useState(false);

  const installed = useQuery({ queryKey: ['installed'], queryFn: fetchInstalled });
  const live = installed.data?.installed.find((candidate) => candidate.id === adapterId);

  const install = useMutation({
    mutationFn: () => requestInstall(entry!.adapter),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installed'] }),
  });

  if (!entry) {
    return (
      <section className="panel">
        <p className="empty">
          No adapter with that id. <Link to="/">Back to the registry</Link>.
        </p>
      </section>
    );
  }

  const { adapter } = entry;
  const destructive = adapter.tools.filter((tool) => tool.capability === 'DESTRUCTIVE');

  return (
    <article className="detail" data-adapter-id={adapter.id}>
      <header className="detail__head">
        <div>
          <p className="crumbs">
            <Link to="/">Adapters</Link> / {adapter.category ?? 'other'}
          </p>
          <h1 data-field="name">{adapter.name}</h1>
          <p className="lede" data-field="description">
            {adapter.description}
          </p>
          <div className="chips">
            <span className="chip">v{adapter.version}</span>
            <span className="chip">{adapter.tools.length} tools</span>
            {live?.health && <HealthBadge status={live.health.status} />}
            <span className="chip">
              {adapter.verifiedAt ? `last verified ${adapter.verifiedAt}` : 'not verified'}
            </span>
          </div>
        </div>
        <div className="install">
          <button
            type="button"
            className="btn btn--primary"
            data-action="install-adapter"
            disabled={install.isPending}
            onClick={() => install.mutate()}
          >
            {install.isPending ? 'Waiting for confirmation…' : live ? 'Reinstall' : 'Install'}
          </button>
          <p className="muted">
            {live ? 'Installed in this browser.' : 'The extension will show you the permissions before installing.'}
          </p>
          {install.data && (
            <p className={install.data.ok ? 'ok' : 'problem'} data-testid="install-result">
              {install.data.ok ? 'Installed. Reload the target site to use the tools.' : install.data.errors.join('; ')}
            </p>
          )}
        </div>
      </header>

      <section className="panel">
        <h2>What it can reach</h2>
        <div className="panel__body">
          <p className="muted">
            This adapter runs only on these exact origins. It cannot run anywhere else, and it cannot navigate off them.
          </p>
          <ul className="origins">
            {adapter.origins.map((origin) => (
              <li key={origin}>
                <code>{origin}</code>
              </li>
            ))}
          </ul>
          {destructive.length > 0 && (
            <p className="warn">
              {destructive.length} destructive tool{destructive.length === 1 ? '' : 's'} (
              {destructive.map((tool) => tool.name).join(', ')}). These always ask you before they run.
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Tools</h2>
        <div className="panel__body">
          {adapter.tools.map((tool) => (
            <div className="tool" key={tool.name} data-tool-name={tool.name}>
              <div className="tool__head">
                <code data-field="tool-name">{tool.name}</code>
                <CapabilityBadge capability={tool.capability} />
                {live?.health?.tools.find((candidate) => candidate.name === tool.name) && (
                  <HealthBadge status={live.health.tools.find((candidate) => candidate.name === tool.name)!.status} />
                )}
              </div>
              <p className="tool__desc">{tool.description}</p>
              <p className="muted">
                Does: {toolEffectSummary(adapter, tool.name)} — {tool.steps.length} declarative steps
              </p>
              <details>
                <summary>Input schema</summary>
                <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
              </details>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Source</h2>
        <div className="panel__body">
          <p className="muted">
            Published at <code>{entry.sourcePath}</code>. An adapter you cannot read is an adapter you should not
            install, so the whole definition is here — there is no hidden code, because the format cannot express any.
          </p>
          <button type="button" className="btn" onClick={() => setShowSource((value) => !value)}>
            {showSource ? 'Hide' : 'Show'} full definition
          </button>
          {showSource && <pre data-testid="adapter-source">{JSON.stringify(adapter, null, 2)}</pre>}
        </div>
      </section>
    </article>
  );
}
