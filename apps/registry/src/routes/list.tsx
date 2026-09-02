import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CATALOG, CATEGORIES, findEntry, searchCatalog } from '../lib/catalog';
import { fetchInstalled } from '../lib/extension';
import { CAPABILITY_OPTIONS } from '../lib/webmcp';
import { demoApps } from '../lib/demos';
import { GITHUB_URL, RELEASES_URL } from '../lib/links';
import { AdapterIcon, CapabilityBadge, HealthBadge } from './components';
import { listRoute } from './tree';

/**
 * The store front.
 *
 * apps.apple.com's Discover layout: a 260px sidebar of filters, a 1020px main
 * column inset by 40px, and hairline-separated shelves of 64px lockups. The
 * filters are the sidebar rather than a row of dropdowns because that is where
 * the store puts them, and because it keeps the URL-shareable state visible.
 */
export function AdapterList() {
  const search = useSearch({ from: listRoute.id });
  const navigate = useNavigate({ from: listRoute.id });

  const installed = useQuery({ queryKey: ['installed'], queryFn: fetchInstalled });
  const installedById = new Map((installed.data?.installed ?? []).map((entry) => [entry.id, entry]));

  const activeCategory = search.category ?? 'all';
  const activeCapability = search.capability ?? 'all';

  const results = searchCatalog({ query: search.q ?? '', category: activeCategory, capability: activeCapability });

  const update = (patch: Record<string, string | undefined>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const countFor = (patch: { category?: string; capability?: string }) =>
    searchCatalog({
      query: search.q ?? '',
      category: patch.category ?? activeCategory,
      capability: patch.capability ?? activeCapability,
    }).length;

  const totalTools = CATALOG.reduce((total, entry) => total + entry.toolCount, 0);

  // The demo links resolve against wherever this page is served from.
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  const demos = demoApps(origin);

  return (
    <div className="store">
      <aside className="store__sidebar">
        <input
          className="sidebar__search"
          type="search"
          name="q"
          data-testid="adapter-search"
          placeholder="Search"
          aria-label="Search adapters"
          value={search.q ?? ''}
          onChange={(event) => update({ q: event.target.value || undefined })}
        />

        <div className="sidebar__group">
          <p className="sidebar__label">Category</p>
          <ul className="sidebar__nav" data-testid="category-filter">
            <li>
              <button type="button" aria-current={activeCategory === 'all'} onClick={() => update({ category: undefined })}>
                All adapters
                <span className="sidebar__count">{countFor({ category: 'all' })}</span>
              </button>
            </li>
            {CATEGORIES.map((category) => (
              <li key={category}>
                <button
                  type="button"
                  aria-current={activeCategory === category}
                  onClick={() => update({ category })}
                >
                  {category}
                  <span className="sidebar__count">{countFor({ category })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar__group">
          <p className="sidebar__label">Capability</p>
          <ul className="sidebar__nav" data-testid="capability-filter">
            {CAPABILITY_OPTIONS.map((capability) => (
              <li key={capability}>
                <button
                  type="button"
                  aria-current={activeCapability === capability}
                  onClick={() => update({ capability: capability === 'all' ? undefined : capability })}
                >
                  {capability === 'all' ? 'Any capability' : capability}
                  <span className="sidebar__count">{countFor({ capability })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="store__main">
        <h1 className="store__title">Adapters</h1>
        <p className="store__sub">
          Each one is declarative JSON, scoped to exact origins, with every step and permission open to inspection
          before you install it.
        </p>

        <Link className="featurecard" to="/" hash="live">
          <p className="featurecard__kicker">Official collection</p>
          <h2>
            {CATALOG.length} adapters, {totalTools} tools, and not one line of JavaScript between them.
          </h2>
          <p>
            The step vocabulary has no <code>eval</code> and no expression language, so a community adapter is
            something you can read rather than something you have to trust.
          </p>
        </Link>

        <section className="shelf shelf--first">
          <div className="shelf__head">
            <h2 className="shelf__title">
              {activeCategory === 'all' && activeCapability === 'all' && !search.q
                ? 'All adapters'
                : 'Matching adapters'}
            </h2>
            <span className="shelf__count" data-testid="result-count">
              {results.length} adapter{results.length === 1 ? '' : 's'}
            </span>
          </div>

          <ul className="shelf__body" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }} data-testid="adapter-list">
            {results.map((entry) => {
              const live = installedById.get(entry.adapter.id);
              return (
                <li className="lockup" key={entry.adapter.id} data-adapter-id={entry.adapter.id}>
                  <div className="lockup__inner">
                    <AdapterIcon id={entry.adapter.id} category={entry.adapter.category} />
                    <div className="lockup__text">
                      <Link
                        className="lockup__link"
                        to="/adapters/$adapterId"
                        params={{ adapterId: entry.adapter.id }}
                      >
                        <span className="lockup__title" data-field="name">
                          {entry.adapter.name}
                        </span>
                        <span className="lockup__sub" data-field="description">
                          {entry.adapter.description}
                        </span>
                      </Link>
                      <span className="lockup__meta">
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
                        <span className="chip" data-field="version">
                          v{entry.adapter.version}
                        </span>
                      </span>
                    </div>
                    <Link className="getbutton" to="/adapters/$adapterId" params={{ adapterId: entry.adapter.id }}>
                      {live ? 'Open' : 'View'}
                    </Link>
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
        </section>

        <section className="shelf">
          <div className="shelf__head">
            <h2 className="shelf__title">Sites you can drive right now</h2>
            <Link className="shelf__link" to="/" hash="setup">
              What you need first ›
            </Link>
          </div>
          <ul className="shelf__body" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {demos.map((demo) => {
              const entry = findEntry(demo.adapterId);
              return (
                <li className="lockup" key={demo.id} data-demo-id={demo.id}>
                  <div className="lockup__inner">
                    <AdapterIcon id={demo.adapterId} category={entry?.adapter.category} />
                    <div className="lockup__text">
                      <span className="lockup__title">{demo.name}</span>
                      <span className="lockup__sub">{demo.blurb}</span>
                      <span className="lockup__meta">
                        <span className="chip">no WebMCP code of its own</span>
                        {demo.note && <span className="chip">{demo.note}</span>}
                      </span>
                    </div>
                    <a className="getbutton getbutton--filled" href={demo.url}>
                      Open
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="shelf">
          <div className="shelf__head">
            <h2 className="shelf__title">The extension</h2>
            <a className="shelf__link" href={`${GITHUB_URL}#quick-start`}>
              Build from source ›
            </a>
          </div>
          <ul className="shelf__body" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <li className="lockup">
              <div className="lockup__inner">
                <AdapterIcon id="liha-extension" category="developer-tools" />
                <div className="lockup__text">
                  <span className="lockup__title">Liha WebMCP Adapter for Chrome</span>
                  <span className="lockup__sub">
                    Validates an adapter, then registers its tools in the page. Chrome 151+ with the WebMCP flag on.
                  </span>
                  <span className="lockup__meta">
                    <span className="chip">MIT</span>
                    <span className="chip">Firefox build included</span>
                  </span>
                </div>
                <a className="getbutton" href={RELEASES_URL}>
                  Get
                </a>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
