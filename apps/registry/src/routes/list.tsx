import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CATALOG, CATEGORIES, findEntry, searchCatalog } from '../lib/catalog';
import { fetchInstalled } from '../lib/extension';
import { CAPABILITY_OPTIONS } from '../lib/webmcp';
import { useI18n } from '../i18n';
import { demoApps } from '../lib/demos';
import { adapterDescription, catalogSearchText, categoryLabel } from '../lib/catalog-copy';
import { GITHUB_URL, RELEASES_URL } from '../lib/links';
import { AdapterIcon, BrandIcon, CapabilityBadge, HealthBadge } from './components';
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
  const { locale, t, tx } = useI18n();
  const search = useSearch({ from: listRoute.id });
  const navigate = useNavigate({ from: listRoute.id });

  const installed = useQuery({ queryKey: ['installed'], queryFn: fetchInstalled });
  const installedById = new Map((installed.data?.installed ?? []).map((entry) => [entry.id, entry]));

  const activeCategory = search.category ?? 'all';
  const activeCapability = search.capability ?? 'all';

  const localizedText = (entry: (typeof CATALOG)[number]) => catalogSearchText(entry, locale);
  const results = searchCatalog(
    { query: search.q ?? '', category: activeCategory, capability: activeCapability },
    localizedText,
  );

  const update = (patch: Record<string, string | undefined>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const countFor = (patch: { category?: string; capability?: string }) =>
    searchCatalog(
      {
        query: search.q ?? '',
        category: patch.category ?? activeCategory,
        capability: patch.capability ?? activeCapability,
      },
      localizedText,
    ).length;

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
          placeholder={t('store.search')}
          aria-label={t('store.searchLabel')}
          value={search.q ?? ''}
          onChange={(event) => update({ q: event.target.value || undefined })}
        />

        <div className="sidebar__group">
          <p className="sidebar__label">{t('store.category')}</p>
          <ul className="sidebar__nav" data-testid="category-filter">
            <li>
              <button type="button" aria-current={activeCategory === 'all'} onClick={() => update({ category: undefined })}>
                {t('store.allAdapters')}
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
                  {categoryLabel(category, locale)}
                  <span className="sidebar__count">{countFor({ category })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar__group">
          <p className="sidebar__label">{t('store.capability')}</p>
          <ul className="sidebar__nav" data-testid="capability-filter">
            {CAPABILITY_OPTIONS.map((capability) => (
              <li key={capability}>
                <button
                  type="button"
                  aria-current={activeCapability === capability}
                  onClick={() => update({ capability: capability === 'all' ? undefined : capability })}
                >
                  {capability === 'all' ? t('store.anyCapability') : capability}
                  <span className="sidebar__count">{countFor({ capability })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="store__main">
        <h1 className="store__title">{t('store.title')}</h1>
        <p className="store__sub">{t('store.sub')}</p>

        <Link className="featurecard" to="/" hash="how">
          <p className="featurecard__kicker">{t('store.featureKicker')}</p>
          <h2>{t('store.featureHeadline', [CATALOG.length, totalTools])}</h2>
          <p>{tx('store.featureCopy', [<code key="eval">eval</code>])}</p>
        </Link>

        <section className="shelf shelf--first">
          <div className="shelf__head">
            <h2 className="shelf__title">
              {activeCategory === 'all' && activeCapability === 'all' && !search.q
                ? t('store.allAdapters')
                : t('store.shelfMatching')}
            </h2>
            <span className="shelf__count" data-testid="result-count">
              {results.length === 1 ? t('store.countOne') : t('store.count', [results.length])}
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
                          {adapterDescription(entry.adapter, locale)}
                        </span>
                      </Link>
                      <span className="lockup__meta">
                        <span className="chip" data-field="category">
                          {categoryLabel(entry.adapter.category, locale)}
                        </span>
                        <span className="chip">{t('store.toolCount', [entry.toolCount])}</span>
                        {entry.capabilities.map((capability) => (
                          <CapabilityBadge key={capability} capability={capability} />
                        ))}
                        {live?.health && <HealthBadge status={live.health.status} />}
                        {live && (
                          <span className="chip chip--on" data-field="installed">
                            {t('store.installed')}
                          </span>
                        )}
                        <span className="chip" data-field="version">
                          v{entry.adapter.version}
                        </span>
                      </span>
                    </div>
                    <Link className="getbutton" to="/adapters/$adapterId" params={{ adapterId: entry.adapter.id }}>
                      {live ? t('store.open') : t('store.view')}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          {results.length === 0 && (
            <p className="empty" data-testid="no-results">
              {t('store.noResults')}
            </p>
          )}
        </section>

        <section className="shelf">
          <div className="shelf__head">
            <h2 className="shelf__title">{t('store.demoShelf')}</h2>
            <Link className="shelf__link" to="/create">
              {t('store.demoShelfLink')} ›
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
                      <span className="lockup__sub">{t(demo.blurbKey)}</span>
                      <span className="lockup__meta">
                        <span className="chip">{t('store.noOwnWebmcp')}</span>
                        {demo.noteKey && <span className="chip">{t(demo.noteKey)}</span>}
                      </span>
                    </div>
                    <a className="getbutton getbutton--filled" href={demo.url}>
                      {t('store.open')}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="shelf">
          <div className="shelf__head">
            <h2 className="shelf__title">{t('store.extShelf')}</h2>
            <a className="shelf__link" href={`${GITHUB_URL}#quick-start`}>
              {t('store.extBuild')} ›
            </a>
          </div>
          <ul className="shelf__body" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <li className="lockup">
              <div className="lockup__inner">
                <BrandIcon size={64} />
                <div className="lockup__text">
                  <span className="lockup__title">{t('store.extName')}</span>
                  <span className="lockup__sub">{t('store.extSub')}</span>
                  <span className="lockup__meta">
                    <span className="chip">{t('footer.mit')}</span>
                    <span className="chip">{t('store.extFirefox')}</span>
                  </span>
                </div>
                <a className="getbutton" href={RELEASES_URL}>
                  {t('store.get')}
                </a>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
