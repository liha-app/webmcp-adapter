import { useMemo, useRef, useState } from 'react';
import { highestCapability, summarizeEffects, validateAdapter, type AdapterDefinition } from '@liha/adapter-schema';
import { extensionPresent, requestInstall } from '../lib/extension';
import { useI18n } from '../i18n';
import { onboardingPrompt } from './onboard';

/**
 * Building an adapter by asking for one.
 *
 * The recorder below this is the demonstrable route: press record, use the
 * site, press stop. This is the one that scales — describe what you want to be
 * able to ask for, and let an agent read the page and write the JSON.
 *
 * The step that makes it a loop rather than a hand-off is the third one. The
 * portal's `validate_adapter` is itself a WebMCP tool, so the agent that wrote
 * the draft can check it here without a person in the middle, get the errors
 * back as text, and fix them. This panel is the same validator with a textarea
 * in front of it — the person and the agent are looking at one thing.
 *
 * Nothing here installs anything on its own: the extension asks, in its own
 * window, every time.
 */
type Checked =
  | { state: 'idle' }
  | { state: 'bad'; errors: string[] }
  | { state: 'good'; adapter: AdapterDefinition };

export function AgentBuild() {
  const { t, tx } = useI18n();
  const [draft, setDraft] = useState('');
  const [checked, setChecked] = useState<Checked>({ state: 'idle' });
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const download = useRef<HTMLAnchorElement>(null);

  const origin = typeof location === 'undefined' ? '' : location.origin;
  const starter = useMemo(
    () => `${onboardingPrompt(origin)}\n\n${t('agent.starterTask')}`,
    [origin, t],
  );

  function check() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (error) {
      setChecked({ state: 'bad', errors: [`${t('agent.notJson')} ${(error as Error).message}`] });
      return;
    }
    const result = validateAdapter(parsed);
    setChecked(result.ok && result.adapter ? { state: 'good', adapter: result.adapter } : { state: 'bad', errors: result.errors });
    setInstalled(null);
  }

  async function copyStarter() {
    try {
      await navigator.clipboard.writeText(starter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt(t('onboard.fallback'), starter);
    }
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
     * Ask whether the extension is there before waiting on it.
     *
     * requestInstall waits three minutes, which is the right budget for a
     * confirmation window someone has left open — and the wrong one for a
     * browser with no extension in it, where it means three minutes of
     * "waiting…" and no explanation.
     */
    if (!(await extensionPresent())) {
      setInstalling(false);
      setInstalled({ ok: false, message: t('agent.noExtension') });
      return;
    }
    const outcome = await requestInstall(adapter);
    setInstalling(false);
    setInstalled({
      ok: outcome.ok,
      message: outcome.ok ? t('agent.installed') : outcome.errors.join(' '),
    });
  }

  const effects = checked.state === 'good' ? checked.adapter.tools.map(summarizeEffects) : [];

  return (
    <section className="agentbuild" data-testid="agent-build">
      <h2 className="agentbuild__title">{t('agent.title')}</h2>
      <p className="muted agentbuild__lede">{t('agent.lede')}</p>

      <ol className="agentflow">
        <li>
          <h3>{t('agent.s1')}</h3>
          <p className="muted">{t('agent.s1Body')}</p>
          <ul className="plainlist agentflow__examples">
            <li>{t('agent.example1')}</li>
            <li>{t('agent.example2')}</li>
          </ul>
          <button type="button" className="btn" data-action="copy-starter" onClick={copyStarter}>
            {copied ? t('agent.copied') : t('agent.copyStarter')}
          </button>
        </li>
        <li>
          <h3>{t('agent.s2')}</h3>
          <p className="muted">{t('agent.s2Body')}</p>
        </li>
        <li>
          <h3>{t('agent.s3')}</h3>
          <p className="muted">{t('agent.s3Body')}</p>
        </li>
        <li>
          <h3>{t('agent.s4')}</h3>
          <p className="muted">{t('agent.s4Body')}</p>
        </li>
      </ol>

      <div className="drafter">
        <label className="drafter__label" htmlFor="draft">
          {t('agent.paste')}
        </label>
        <textarea
          id="draft"
          className="drafter__input"
          data-testid="draft-json"
          spellCheck={false}
          rows={8}
          placeholder='{"id":"my-site","name":"My site","version":"1.0.0","origins":["https://app.example.com"],"tools":[…]}'
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="drafter__actions">
          <button
            type="button"
            className="btn btn--primary"
            data-action="validate-draft"
            disabled={draft.trim().length === 0}
            onClick={check}
          >
            {t('agent.validate')}
          </button>
          <button
            type="button"
            className="btn"
            data-action="download-draft"
            disabled={checked.state !== 'good'}
            onClick={() => checked.state === 'good' && save(checked.adapter)}
          >
            {t('agent.download')}
          </button>
          <button
            type="button"
            className="btn"
            data-action="install-draft"
            disabled={checked.state !== 'good' || installing}
            onClick={() => checked.state === 'good' && install(checked.adapter)}
          >
            {installing ? t('agent.installing') : t('agent.install')}
          </button>
          {/* The download's own anchor: a blob URL needs an <a> to click. */}
          <a ref={download} className="hidden-field" aria-hidden="true" tabIndex={-1} href="#">
            {t('agent.download')}
          </a>
        </div>

        {checked.state === 'bad' && (
          <div className="drafter__result problem" data-testid="draft-result">
            <p>{t('agent.rejected')}</p>
            <ul className="plainlist">
              {checked.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {checked.state === 'good' && (
          <div className="drafter__result ok" data-testid="draft-result">
            <p>
              {tx('agent.accepted', [
                checked.adapter.name,
                String(checked.adapter.tools.length),
                highestCapability(checked.adapter.tools.map((tool) => tool.capability)),
              ])}
            </p>
            <p className="muted">{checked.adapter.origins.join('  ')}</p>
            <p className="muted">
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
      </div>
    </section>
  );
}
