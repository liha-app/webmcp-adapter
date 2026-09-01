import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CATEGORIES, searchCatalog } from '../lib/catalog';
import { fetchInstalled } from '../lib/extension';
import { CAPABILITY_OPTIONS } from '../lib/webmcp';
import { CapabilityBadge, HealthBadge } from './components';
import { listRoute } from './tree';

export function AdapterList() {
  const search = useSearch({ from: listRoute.id });
  const navigate = useNavigate({ from: listRoute.id });

  const installed = useQuery({ queryKey: ['installed'], queryFn: fetchInstalled });
  const installedById = new Map((installed.data?.installed ?? []).map((entry) => [entry.id, entry]));

  const results = searchCatalog({
    query: search.q ?? '',
    category: search.category ?? 'all',
    capability: search.capability ?? 'all',
  });

  const update = (patch: Record<string, string | undefined>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  return (
    <>
      <section className="hero">
        <h1>Make any website agent-ready.</h1>
        <p>
          Adapters add WebMCP tools to sites that never implemented WebMCP. Each one is declarative JSON, scoped to a
          single origin, with every step and permission open to inspection before you install it.
        </p>
      </section>

      <section className="filters">
        <input
          type="search"
          name="q"
          data-testid="adapter-search"
          placeholder="Search adapters, tools or origins"
          aria-label="Search adapters"
          value={search.q ?? ''}
          onChange={(event) => update({ q: event.target.value || undefined })}
        />
        <select
          aria-label="Category"
          data-testid="category-filter"
          value={search.category ?? 'all'}
          onChange={(event) => update({ category: event.target.value === 'all' ? undefined : event.target.value })}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          aria-label="Capability"
          data-testid="capability-filter"
          value={search.capability ?? 'all'}
          onChange={(event) => update({ capability: event.target.value === 'all' ? undefined : event.target.value })}
        >
          {CAPABILITY_OPTIONS.map((capability) => (
            <option key={capability} value={capability}>
              {capability === 'all' ? 'Any capability' : capability}
            </option>
          ))}
        </select>
      </section>

      <p className="resultcount" data-testid="result-count">
        {results.length} adapter{results.length === 1 ? '' : 's'}
      </p>

      <ul className="cards" data-testid="adapter-list">
        {results.map((entry) => {
          const live = installedById.get(entry.adapter.id);
          return (
            <li key={entry.adapter.id} className="card" data-adapter-id={entry.adapter.id}>
              <div className="card__head">
                <h2 data-field="name">
                  <Link to="/adapter/$adapterId" params={{ adapterId: entry.adapter.id }}>
                    {entry.adapter.name}
                  </Link>
                </h2>
                <span className="version" data-field="version">
                  v{entry.adapter.version}
                </span>
              </div>
              <p className="card__desc" data-field="description">
                {entry.adapter.description}
              </p>
              <div className="chips">
                <span className="chip" data-field="category">
                  {entry.adapter.category ?? 'other'}
                </span>
                <span className="chip">{entry.toolCount} tools</span>
                {entry.capabilities.map((capability) => (
                  <CapabilityBadge key={capability} capability={capability} />
                ))}
                {live?.health && <HealthBadge status={live.health.status} />}
                {live && (
                  <span className="chip chip--on" data-field="installed">
                    installed
                  </span>
                )}
              </div>
              <div className="card__foot">
                <code>{entry.adapter.origins[0]}</code>
                <span className="muted">
                  {entry.adapter.verifiedAt ? `last verified ${entry.adapter.verifiedAt}` : 'not verified'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {results.length === 0 && (
        <p className="empty" data-testid="no-results">
          No adapters match that search.
        </p>
      )}
    </>
  );
}
