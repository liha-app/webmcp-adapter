import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectModelContext } from '@liha/adapter-runtime';
import { extensionPresent, fetchInstalled } from '../lib/extension';
import { builtHere, callSnippet, reportsDetail, type Installed } from '../lib/installed';
import { demoApps } from '../lib/demos';
import { RELEASES_URL } from '../lib/links';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';
import { AgentBuild } from './agentbuild';
import { AgentOnboard } from './onboard';

const FLAG_URL = 'chrome://flags/#enable-webmcp-testing';

/**
 * The guided build.
 *
 * Everything on this page already existed — the recorder, the Studio, the
 * install gate — and nobody could find the path through them. So this is a
 * walkthrough that watches: each step that can be detected ticks itself, which
 * is the difference between a page telling you what to do and a page that knows
 * where you got to.
 *
 * The two it cannot watch are the ones happening in another tab and in the
 * extension's own windows. It says so rather than pretending, and picks the
 * thread back up at the end — when the adapter you built appears in the
 * extension, this page notices and writes you the snippet that runs it.
 */
function useEnvironment() {
  const [webmcp, setWebmcp] = useState<boolean | null>(null);
  const [extension, setExtension] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState<Installed[]>([]);

  const poll = useCallback(async () => {
    setWebmcp(detectModelContext(document) !== null);
    const present = await extensionPresent();
    setExtension(present);
    if (!present) {
      setInstalled([]);
      return;
    }
    const state = await fetchInstalled();
    setInstalled(state.installed);
  }, []);

  useEffect(() => {
    void poll();
    // The interesting events happen in other tabs and in extension windows,
    // none of which can tell this page anything. Asking again is the only way
    // to notice, and every question is local.
    const timer = setInterval(() => void poll(), 2000);
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [poll]);

  return { webmcp, extension, installed, refresh: poll };
}

function Copy({ text, label }: { text: string; label: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className="btn btn--quiet"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(
          () => setState('ok'),
          () => setState('fail'),
        );
      }}
    >
      {state === 'ok' ? t('create.copied') : state === 'fail' ? t('create.copyFailed') : t('create.copy')}
    </button>
  );
}

function Step({
  index,
  title,
  done,
  waiting,
  children,
}: {
  index: number;
  title: string;
  done?: boolean | undefined;
  waiting?: boolean | undefined;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <li className={`build ${done ? 'build--done' : ''}`}>
      <div className="build__mark" aria-hidden="true">
        {done ? '✓' : index}
      </div>
      <div className="build__body">
        <h3 className="build__title">
          {title}
          {done && <span className="build__state build__state--done">{t('create.done')}</span>}
          {!done && waiting && <span className="build__state">{t('create.watching')}</span>}
        </h3>
        {children}
      </div>
    </li>
  );
}

export function Create() {
  const { t, tx } = useI18n();
  const { webmcp, extension, installed } = useEnvironment();
  const shop = useMemo(() => demoApps(window.location.origin).find((app) => app.id === 'demo-shop'), []);

  // Read without assuming the extension is as new as this page. An older one
  // answers with fewer fields, which is a browser that cannot report rather
  // than a broken one — and reading `.tools[0]` off it took this page down.
  const built = builtHere(installed);
  const newest = built[built.length - 1];
  const firstTool = newest?.tools[0];
  const staleExtension = extension === true && !reportsDetail(installed);
  const snippet = callSnippet(firstTool);

  return (
    <main className="page">
      <section className="section section--tight">
        <div className="section-content">
          <p className="eyebrow">{t('create.eyebrow')}</p>
          <h1 className="headline">{t('create.headline')}</h1>
          <p className="lede lede--narrow">{t('create.lede')}</p>

          {/* The same sentence the landing hands out, carrying this page's job
            * with it — so what a visitor pastes into an agent is one thing. */}
          <AgentOnboard label={t('create.onboardChip')} task={t('agent.starterTask')} />

          {/* The route that scales, before the one that demonstrates. */}
          <AgentBuild />

          <h2 className="secondroute">{t('create.recorderTitle')}</h2>
          <p className="muted secondroute__lede">{t('create.recorderLede')}</p>

          <ol className="buildlist">
            <Step index={1} title={t('create.step1')} done={webmcp === true} waiting={webmcp === false}>
              <p className="muted">{t('create.step1Body')}</p>
              {webmcp === false && (
                <div className="codeline">
                  <code>{FLAG_URL}</code>
                  <Copy text={FLAG_URL} label={t('create.copyFlag')} />
                </div>
              )}
            </Step>

            <Step index={2} title={t('create.step2')} done={extension === true} waiting={extension === false}>
              <p className="muted">{t('create.step2Body')}</p>
              {extension === false && (
                <p>
                  <a className="btn btn--primary" href={RELEASES_URL}>
                    {t('create.getExtension')}
                  </a>
                </p>
              )}
            </Step>

            <Step index={3} title={t('create.step3')}>
              <p className="muted">{t('create.step3Body')}</p>
              {shop && (
                <p>
                  <a className="btn" href={shop.url} target="_blank" rel="noreferrer">
                    {t('create.openDemo', [shop.name])}
                  </a>
                </p>
              )}
            </Step>

            <Step index={4} title={t('create.step4')}>
              <p className="muted">{t('create.step4Body')}</p>
              <ul className="plainlist">
                {(['create.step4a', 'create.step4b', 'create.step4c'] as MessageKey[]).map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </Step>

            <Step index={5} title={t('create.step5')}>
              <p className="muted">{t('create.step5Body')}</p>
              <ul className="plainlist">
                {(['create.step5a', 'create.step5b', 'create.step5c', 'create.step5d'] as MessageKey[]).map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </Step>

            <Step
              index={6}
              title={t('create.step6')}
              done={built.length > 0}
              waiting={extension === true && !staleExtension}
            >
              <p className="muted">{t('create.step6Body')}</p>
              {staleExtension && <p className="notice">{t('create.staleExtension')}</p>}
              {newest && (
                <div className="built">
                  <strong>{newest.name}</strong> <code>{newest.id}</code>
                  <div className="origins">{newest.origins.join('  ')}</div>
                  <div className="built__tools">
                    {newest.tools.map((tool) => (
                      <span key={tool.name} className="built__tool">
                        <code>{tool.name}</code> <span className={`cap cap--${tool.capability}`}>{tool.capability}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Step>

            <Step index={7} title={t('create.step7')} done={false}>
              {firstTool ? (
                <>
                  <p className="muted">{tx('create.step7Body', [newest?.origins[0] ?? ''])}</p>
                  <div className="codeblock">
                    <pre>{snippet}</pre>
                    <Copy text={snippet} label={t('create.copySnippet')} />
                  </div>
                </>
              ) : (
                <p className="muted">{staleExtension ? t('create.staleExtension') : t('create.step7Waiting')}</p>
              )}
            </Step>
          </ol>

          <p className="muted buildfoot">{t('create.footnote')}</p>
        </div>
      </section>
    </main>
  );
}
