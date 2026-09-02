import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { findEntry, toolEffectSummary } from '../lib/catalog';
import { fetchInstalled, requestInstall } from '../lib/extension';
import { AdapterIcon, CapabilityBadge, HealthBadge } from './components';
import { detailRoute } from './tree';

/**
 * The product page.
 *
 * App Store's layout: a 128px icon beside the name, an install pill, then the
 * hairline stat strip and the sections below it. The stats are the things you
 * would actually want to know before installing — how many tools, how strong a
 * capability, which origins — in the slots where the store puts age rating and
 * file size.
 */
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
      <div className="product">
        <div className="product__inner">
          <p className="empty">
            No adapter with that id. <Link to="/adapters">Back to the registry</Link>.
          </p>
        </div>
      </div>
    );
  }

  const { adapter } = entry;
  const destructive = adapter.tools.filter((tool) => tool.capability === 'DESTRUCTIVE');

  return (
    <div className="product">
      <article className="product__inner" data-adapter-id={adapter.id}>
        <p className="crumbs">
          <Link to="/adapters">Adapters</Link> <span aria-hidden="true">›</span> {adapter.category ?? 'other'}
        </p>

        <header className="product__head">
          <AdapterIcon id={adapter.id} category={adapter.category} size={128} />
          <div>
            <h1 className="product__title" data-field="name">
              {adapter.name}
            </h1>
            <p className="product__sub" data-field="description">
              {adapter.description}
            </p>
            <div className="product__actions">
              <button
                type="button"
                className="getbutton getbutton--filled getbutton--large"
                data-action="install-adapter"
                disabled={install.isPending}
                onClick={() => install.mutate()}
              >
                {install.isPending ? 'Waiting for confirmation…' : live ? 'Reinstall' : 'Install'}
              </button>
              <p className="product__hint">
                {live ? 'Installed in this browser.' : 'The extension will show you the permissions before installing.'}
              </p>
            </div>
            {install.data && (
              <p className={install.data.ok ? 'ok' : 'problem'} data-testid="install-result">
                {install.data.ok
                  ? 'Installed. Reload the target site to use the tools.'
                  : install.data.errors.join('; ')}
              </p>
            )}
          </div>
        </header>

        <dl className="facts">
          <div>
            <dt>Tools</dt>
            <dd>{adapter.tools.length}</dd>
          </div>
          <div>
            <dt>Highest capability</dt>
            <dd>{entry.maxCapability}</dd>
          </div>
          <div>
            <dt>Origins</dt>
            <dd>
              {adapter.origins.length}
              <small>exact, no wildcards</small>
            </dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>v{adapter.version}</dd>
          </div>
          <div>
            <dt>Last verified</dt>
            <dd>
              {adapter.verifiedAt ?? 'not verified'}
              {live?.health && <small>{live.health.status} in this browser</small>}
            </dd>
          </div>
        </dl>

        <section className="storesection">
          <h2>What it can reach</h2>
          <p>
            This adapter runs only on these exact origins. It cannot run anywhere else, and it cannot navigate off
            them.
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
        </section>

        <section className="storesection">
          <h2>Tools</h2>
          {adapter.tools.map((tool) => {
            const health = live?.health?.tools.find((candidate) => candidate.name === tool.name);
            return (
              <div className="tool" key={tool.name} data-tool-name={tool.name}>
                <div className="tool__head">
                  <code data-field="tool-name">{tool.name}</code>
                  <CapabilityBadge capability={tool.capability} />
                  {health && <HealthBadge status={health.status} />}
                </div>
                <p className="tool__desc">{tool.description}</p>
                <p>
                  Does: {toolEffectSummary(adapter, tool.name)} — {tool.steps.length} declarative steps
                </p>
                <details>
                  <summary>Input schema</summary>
                  <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </section>

        <section className="storesection">
          <h2>Source</h2>
          <p>
            Published at <code>{entry.sourcePath}</code>. An adapter you cannot read is an adapter you should not
            install, so the whole definition is here — there is no hidden code, because the format cannot express any.
          </p>
          <p style={{ marginTop: 14 }}>
            <button type="button" className="getbutton" onClick={() => setShowSource((value) => !value)}>
              {showSource ? 'Hide' : 'Show'} full definition
            </button>
          </p>
          {showSource && (
            <pre data-testid="adapter-source" style={{ marginTop: 14 }}>
              {JSON.stringify(adapter, null, 2)}
            </pre>
          )}
        </section>
      </article>
    </div>
  );
}
