import { useEffect, useRef, useState } from 'react';
import {
  highestCapability,
  summarizeEffects,
  validateAdapter,
  type AdapterDefinition,
  type Capability,
} from '@liha/adapter-schema';
import { detectModelContext } from '@liha/adapter-runtime';
import { extensionPresent, requestInstall } from '../lib/extension';
import { useI18n } from '../i18n';

/**
 * The Studio: a bench rather than a page about a bench.
 *
 * The recorder below demonstrates; this is the route that scales — describe
 * what you want to be able to ask for, let an agent read the page and write
 * the JSON, and check it here. `validate_adapter` is one of this page's own
 * WebMCP tools, so the agent that wrote a draft can call it and fix what comes
 * back without a person in the middle. This panel is that same validator with
 * a gutter and a cursor in front of it, so the person and the agent are looking
 * at one thing.
 *
 * It reads as an instrument: the rail says what the browser can actually do,
 * the pipeline says where you are, and the draft is checked as you type rather
 * than when you ask. Nothing here installs anything on its own — the extension
 * asks, in its own window, every time.
 */
type Checked =
  | { state: 'empty' }
  | { state: 'bad'; errors: string[] }
  | { state: 'good'; adapter: AdapterDefinition };

const DEBOUNCE_MS = 350;

/** What the browser can do, polled rather than assumed. */
function useBench() {
  const [webmcp, setWebmcp] = useState<boolean | null>(null);
  const [extension, setExtension] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const look = async () => {
      const present = await extensionPresent();
      if (!alive) return;
      setWebmcp(detectModelContext(document) !== null);
      setExtension(present);
    };
    void look();
    const timer = setInterval(look, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return { webmcp, extension };
}

function Lamp({ on, label }: { on: boolean | null; label: string }) {
  const state = on === null ? 'unknown' : on ? 'on' : 'off';
  return (
    <span className="lamp" data-state={state} data-testid={`lamp-${state}`}>
      <span className="lamp__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function AgentBuild() {
  const { t, tx } = useI18n();
  const { webmcp, extension } = useBench();
  const [draft, setDraft] = useState('');
  const [checked, setChecked] = useState<Checked>({ state: 'empty' });
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState<{ ok: boolean; message: string } | null>(null);
  const download = useRef<HTMLAnchorElement>(null);
  const gutter = useRef<HTMLDivElement>(null);

  /* Checked as you type. A validator you have to ask is a form; one that
   * answers while you work is an instrument. */
  useEffect(() => {
    if (draft.trim().length === 0) {
      setChecked({ state: 'empty' });
      return;
    }
    const timer = setTimeout(() => setChecked(check(draft)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  function check(source: string): Checked {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      return { state: 'bad', errors: [`${t('agent.notJson')} ${(error as Error).message}`] };
    }
    const result = validateAdapter(parsed);
    return result.ok && result.adapter
      ? { state: 'good', adapter: result.adapter }
      : { state: 'bad', errors: result.errors };
  }

  function save(adapter: AdapterDefinition) {
    const blob = new Blob([`${JSON.stringify(adapter, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = download.current;
    if (!link) return;
    link.href = url;
    link.download = `${adapter.id}.json`;
    link.click();
    // Revoked on the next turn of the loop: Chrome needs the URL to survive the
    // click that started the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function install(adapter: AdapterDefinition) {
    setInstalling(true);
    /*
     * Ask whether the extension is there before waiting on it. requestInstall
     * waits three minutes, which is the right budget for a confirmation window
     * someone has left open and the wrong one for a browser with no extension
     * in it, where it means three minutes of "waiting…" and no explanation.
     */
    if (!(await extensionPresent())) {
      setInstalling(false);
      setInstalled({ ok: false, message: t('agent.noExtension') });
      return;
    }
    const outcome = await requestInstall(adapter);
    setInstalling(false);
    setInstalled({ ok: outcome.ok, message: outcome.ok ? t('agent.installed') : outcome.errors.join(' ') });
  }

  /* Which stage is live, derived from the bench rather than from a click: the
   * pipeline reports where the work actually is. */
  const stage = installed?.ok ? 3 : checked.state === 'good' ? 3 : checked.state === 'bad' ? 2 : draft ? 2 : 0;
  const lines = Math.max(draft.split('\n').length, 8);
  // Grows with the draft and stops: a fixed box is mostly empty for a short
  // adapter and a keyhole for a long one. 19.5px is the line box at 13/1.5.
  const editorHeight = Math.min(320, Math.max(150, lines * 19.5 + 24));
  const good = checked.state === 'good';
  const effects = good ? checked.adapter.tools.map(summarizeEffects) : [];

  return (
    <section className="bench" data-testid="agent-build">
      <header className="bench__head">
        <div className="rail" data-testid="bench-rail">
          <Lamp on={webmcp} label={t('agent.railWebmcp')} />
          <Lamp on={extension} label={t('agent.railExtension')} />
        </div>
      </header>

      <ol className="agentflow" data-stage={stage}>
        {(['agent.s1', 'agent.s2', 'agent.s3', 'agent.s4'] as const).map((key, index) => (
          <li key={key} data-active={index === stage ? 'true' : 'false'} data-done={index < stage ? 'true' : 'false'}>
            <span className="agentflow__pip" aria-hidden="true" />
            <h3>{t(key)}</h3>
          </li>
        ))}
      </ol>
      <p className="agentflow__hint" key={stage}>
        {t(`${(['agent.s1', 'agent.s2', 'agent.s3', 'agent.s4'] as const)[stage]}Body` as 'agent.s1Body')}
      </p>

      <div className="editor" data-state={checked.state}>
        <div className="editor__bar">
          <span className="editor__name">draft.json</span>
          <span className="editor__pill" data-testid="draft-state">
            {checked.state === 'empty'
              ? t('agent.paste')
              : checked.state === 'good'
                ? t('agent.pillValid')
                : tx('agent.pillProblems', [String(checked.errors.length)])}
          </span>
        </div>
        <div className="editor__body" style={{ height: `${editorHeight}px` }}>
          <div className="editor__gutter" ref={gutter} aria-hidden="true">
            {Array.from({ length: lines }, (_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
          <textarea
            className="editor__input"
            data-testid="draft-json"
            aria-label={t('agent.paste')}
            spellCheck={false}
            value={draft}
            rows={lines}
            onScroll={(event) => {
              if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
            }}
            onChange={(event) => {
              setDraft(event.target.value);
              setInstalled(null);
            }}
          />
        </div>

        <div className="editor__foot">
          <button
            type="button"
            className="btn"
            data-action="validate-draft"
            disabled={draft.trim().length === 0}
            onClick={() => setChecked(check(draft))}
          >
            {t('agent.validate')}
          </button>
          <button
            type="button"
            className="btn"
            data-action="download-draft"
            disabled={!good}
            onClick={() => good && save(checked.adapter)}
          >
            {t('agent.download')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            data-action="install-draft"
            disabled={!good || installing}
            onClick={() => good && install(checked.adapter)}
          >
            {installing ? t('agent.installing') : t('agent.install')}
          </button>
          <a ref={download} className="offscreen" aria-hidden="true" tabIndex={-1} href="#">
            {t('agent.download')}
          </a>
        </div>
      </div>

      {checked.state === 'bad' && (
        <ul className="problems" data-testid="draft-result">
          {checked.errors.map((error, index) => (
            <li key={error} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
              <span className="problems__at">{error.split(':')[0]}</span>
              <span>{error.slice(error.indexOf(':') + 1).trim()}</span>
            </li>
          ))}
        </ul>
      )}

      {good && (
        <div className="verdict" data-testid="draft-result">
          <div className="verdict__head">
            <strong>{checked.adapter.name}</strong>
            <span className="verdict__origins">{checked.adapter.origins.join('  ')}</span>
            <span className={`cap cap--${highestCapability(checked.adapter.tools.map((tool) => tool.capability))}`}>
              {highestCapability(checked.adapter.tools.map((tool) => tool.capability))}
            </span>
          </div>
          <ul className="toolcards">
            {checked.adapter.tools.map((tool, index) => (
              <li key={tool.name} style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}>
                <span className="toolcards__name">{tool.name}</span>
                <span className={`cap cap--${tool.capability}`}>{tool.capability as Capability}</span>
                <span className="toolcards__steps">{tx('agent.stepCount', [String(tool.steps.length)])}</span>
              </li>
            ))}
          </ul>
          <p className="muted verdict__effects">
            {tx('agent.effects', [
              String(effects.reduce((total, effect) => total + effect.clicks, 0)),
              String(effects.reduce((total, effect) => total + effect.inputs, 0)),
              String(effects.reduce((total, effect) => total + effect.reads, 0)),
            ])}
          </p>
        </div>
      )}

      {installed && (
        <p className={installed.ok ? 'ok' : 'problem'} data-testid="draft-install-result">
          {installed.message}
        </p>
      )}
    </section>
  );
}
