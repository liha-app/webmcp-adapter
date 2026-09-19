import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { findEntry } from '../lib/catalog';
import {
  adapterDescription,
  adapterName,
  categoryLabel,
  localizedInputSchema,
  toolDescription,
  toolEffectSummary,
  verifiedDate,
} from '../lib/catalog-copy';
import { extensionPresent, fetchInstalled, installProblemText, requestInstall } from '../lib/extension';
import { RELEASES_URL } from '../lib/links';
import { useI18n } from '../i18n';
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
  const { locale, t, tx } = useI18n();
  const { adapterId } = useParams({ from: detailRoute.id });
  const entry = findEntry(adapterId);
  const queryClient = useQueryClient();
  const [showSource, setShowSource] = useState(false);

  const extension = useQuery({
    queryKey: ['extension-present'],
    queryFn: extensionPresent,
    retry: false,
  });
  const installed = useQuery({
    queryKey: ['installed'],
    queryFn: fetchInstalled,
    enabled: extension.data === true,
  });
  const live = installed.data?.installed.find((candidate) => candidate.id === adapterId);
  // A newer version in the Store than the one on this machine is the one case
  // where there is still something to press.
  const upgrade = Boolean(live && live.version !== entry?.adapter.version);

  const install = useMutation({
    mutationFn: () => requestInstall(entry!.adapter),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installed'] }),
  });

  if (!entry) {
    return (
      <div className="product">
        <div className="product__inner">
          <p className="empty">
            {t('detail.notFound')} <Link to="/adapters">{t('detail.back')}</Link>
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
          <Link to="/adapters">{t('store.title')}</Link> <span aria-hidden="true">›</span>{' '}
          {categoryLabel(adapter.category, locale)}
        </p>

        <header className="product__head">
          <AdapterIcon id={adapter.id} category={adapter.category} size={128} />
          <div>
            <h1 className="product__title" data-field="name">
              {adapterName(adapter, locale)}
            </h1>
            <p className="product__sub" data-field="description">
              {adapterDescription(adapter, locale)}
            </p>
            <p className="product__badges">
              <span className={`chip chip--${entry.status}`}>
                {t(`store.badge${entry.status === 'official' ? 'Official' : 'Community'}`)}
              </span>
              {entry.verified && <span className="chip chip--verified">{t('store.badgeVerified')}</span>}
            </p>
            <div className="product__actions">
              {extension.data === false ? (
                <a className="getbutton getbutton--filled getbutton--large" href={RELEASES_URL}>
                  {t('hero.install')}
                </a>
              ) : (
                /*
                 * What is already done is not an action.
                 *
                 * Straight after a successful install the main button read
                 * "Reinstall", which to a first-time reader says the install
                 * did not take. Installed is a state, so it is shown as one.
                 * The only thing left worth pressing is an update, and only
                 * where there is a newer version to move to.
                 *
                 * Putting an adapter back is a repair — for a community adapter
                 * whose site moved under it — so it stays reachable. As a
                 * repair, though: it sat in the action row at the same size as
                 * the button beside it, which made a finished install look like
                 * it still had a step left. It lives on the status line now.
                 */
                <button
                  type="button"
                  className="getbutton getbutton--filled getbutton--large"
                  data-action={live && !upgrade ? undefined : 'install-adapter'}
                  disabled={extension.data !== true || install.isPending || (Boolean(live) && !upgrade)}
                  onClick={() => install.mutate()}
                >
                  {install.isPending
                    ? t('detail.installing')
                    : upgrade
                      ? t('detail.update', [entry.adapter.version])
                      : live
                        ? t('detail.installedNow')
                        : t('detail.install')}
                </button>
              )}
              <p className="product__hint">
                {extension.data === false
                  ? t('agent.noExtension')
                  : live
                    ? t('detail.installedHere')
                    : t('detail.willShowPermissions')}
                {live && !upgrade && extension.data === true && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="linkbutton"
                      data-action="install-adapter"
                      disabled={install.isPending}
                      onClick={() => install.mutate()}
                      title={t('detail.reinstallWhy')}
                    >
                      {t('detail.reinstall')}
                    </button>
                  </>
                )}
              </p>
            </div>
            {install.data && (
              <p className={install.data.ok ? 'ok' : 'problem'} data-testid="install-result">
                {install.data.ok ? t('detail.installOk') : installProblemText(install.data, t)}
              </p>
            )}
            {/*
              * Where to go next. An install that ends in a confirmation and
              * nothing else leaves the reader on the page they were already on,
              * with no idea whether anything happened. The extension's own
              * pages cannot be linked to from here — a chrome-extension:// URL
              * does not open from a web page — so that half is said rather
              * than linked.
              */}
            {install.data?.ok && entry.adapter.origins[0] && (
              <p className="product__hint" data-testid="install-next">
                <a href={entry.adapter.origins[0]} target="_blank" rel="noreferrer">
                  {t('detail.nextOpen', [new URL(entry.adapter.origins[0]).hostname])}
                </a>
                {' · '}
                {t('detail.nextManage')}
              </p>
            )}
          </div>
        </header>

        <dl className="facts">
          <div>
            <dt>{t('detail.factTools')}</dt>
            <dd>{adapter.tools.length}</dd>
          </div>
          <div>
            <dt>{t('detail.factCapability')}</dt>
            <dd>{entry.maxCapability}</dd>
          </div>
          <div>
            <dt>{t('detail.factOrigins')}</dt>
            <dd>
              {adapter.origins.length}
              <small>{t('detail.factOriginsNote')}</small>
            </dd>
          </div>
          <div>
            <dt>{t('detail.factVersion')}</dt>
            <dd>v{adapter.version}</dd>
          </div>
          <div>
            <dt>{t('detail.factVerified')}</dt>
            <dd>
              {verifiedDate(adapter.verifiedAt, locale, t('detail.notVerified'))}
              {live?.health && <small>{t('detail.healthInBrowser', [live.health.status])}</small>}
            </dd>
          </div>
        </dl>

        <section className="storesection">
          <h2>{t('detail.reachTitle')}</h2>
          <p>{t('detail.reachCopy')}</p>
          <ul className="origins">
            {adapter.origins.map((origin) => (
              <li key={origin}>
                <code>{origin}</code>
              </li>
            ))}
          </ul>
          {destructive.length > 0 && (
            <p className="warn">
              {t(destructive.length === 1 ? 'detail.destructiveWarnOne' : 'detail.destructiveWarn', [
                destructive.length,
                destructive.map((tool) => tool.name).join(', '),
              ])}
            </p>
          )}
        </section>

        <section className="storesection">
          <h2>{t('detail.toolsTitle')}</h2>
          {adapter.tools.map((tool) => {
            const health = live?.health?.tools.find((candidate) => candidate.name === tool.name);
            return (
              <div className="tool" key={tool.name} data-tool-name={tool.name}>
                <div className="tool__head">
                  <code data-field="tool-name">{tool.name}</code>
                  <CapabilityBadge capability={tool.capability} />
                  {health && <HealthBadge status={health.status} />}
                </div>
                <p className="tool__desc">
                  {toolDescription(adapter.id, tool, locale)}
                </p>
                <p>{t('detail.does', [toolEffectSummary(adapter, tool.name, locale), tool.steps.length])}</p>
                <details>
                  <summary>{t('detail.inputSchema')}</summary>
                  <pre>{JSON.stringify(localizedInputSchema(adapter.id, tool.name, tool.inputSchema, locale), null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </section>

        <section className="storesection">
          <h2>{t('detail.sourceTitle')}</h2>
          <p>
            {tx('detail.sourceCopy', [
              <a key="path" href={entry.sourceUrl}>
                <code>{entry.sourcePath}</code>
              </a>,
            ])}
          </p>
          <p style={{ marginTop: 14 }}>
            <button type="button" className="getbutton" onClick={() => setShowSource((value) => !value)}>
              {showSource ? t('detail.hideSource') : t('detail.showSource')}
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
