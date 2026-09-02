import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { findEntry, toolEffectSummary } from '../lib/catalog';
import { fetchInstalled, requestInstall } from '../lib/extension';
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
  const { t, tx } = useI18n();
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
          {adapter.category ?? 'other'}
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
                {install.isPending
                  ? t('detail.installing')
                  : live
                    ? t('detail.reinstall')
                    : t('detail.install')}
              </button>
              <p className="product__hint">
                {live ? t('detail.installedHere') : t('detail.willShowPermissions')}
              </p>
            </div>
            {install.data && (
              <p className={install.data.ok ? 'ok' : 'problem'} data-testid="install-result">
                {install.data.ok ? t('detail.installOk') : install.data.errors.join('; ')}
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
              {adapter.verifiedAt ?? t('detail.notVerified')}
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
                <p className="tool__desc">{tool.description}</p>
                <p>{t('detail.does', [toolEffectSummary(adapter, tool.name), tool.steps.length])}</p>
                <details>
                  <summary>{t('detail.inputSchema')}</summary>
                  <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </section>

        <section className="storesection">
          <h2>{t('detail.sourceTitle')}</h2>
          <p>{tx('detail.sourceCopy', [<code key="path">{entry.sourcePath}</code>])}</p>
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
