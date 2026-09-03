import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * "Onboard your agent" — the one line that teaches an agent this project.
 *
 * Cloudflare put this on their dashboard and the idea is a good one: rather
 * than a page of instructions a person has to relay, hand them a sentence that
 * points an agent at a document written for agents. The sentence goes to the
 * clipboard; the document is served from this origin at /agent-setup/prompt.md
 * and covers the whole adapter format, the rules that get one rejected, and the
 * portal's own tools for validating a draft.
 *
 * Resolved from `location.origin` rather than hard-coded, so the copy taken
 * from a local build points an agent at the local build.
 */
export const PROMPT_PATH = '/agent-setup/prompt.md';

export function onboardingPrompt(origin: string, task?: string): string {
  const sentence = `Fetch and execute the appropriate instructions to set me up for Liha WebMCP Adapter from ${origin}${PROMPT_PATH}`;
  return task ? `${sentence}\n\n${task}` : sentence;
}

export function AgentOnboard({ label, task }: { label?: string; task?: string } = {}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const origin = typeof location === 'undefined' ? '' : location.origin;
  // On the Studio the same sentence carries the job as well, so what a visitor
  // pastes is one thing rather than two.
  const prompt = onboardingPrompt(origin, task);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // Clipboard refused — an insecure context, or the user said no. Say so
      // rather than showing "Copied" over a clipboard that has not changed.
      setCopied(false);
      window.prompt(t('onboard.fallback'), prompt);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2400);
  }

  return (
    <div className="onboard">
      <button type="button" className="onboard__chip" onClick={copy} data-action="copy-agent-prompt">
        <span className="onboard__label">{label ?? t('onboard.chip')}</span>
        {/*
          * Which agents. The real marks, not drawings of them — the files and
          * where they came from are recorded in public/brand/agents/README.md,
          * along with the one change made to any of them. They say which agents
          * the copied prompt works with; the requirement is narrower than the
          * list, and the tooltip says so.
          */}
        <span className="onboard__agents" title={t('onboard.agentsTitle')}>
          <img className="onboard__agent" src="/brand/agents/claude.svg" width={20} height={20} alt="Claude" />
          <img
            className="onboard__agent onboard__agent--light"
            src="/brand/agents/codex.svg"
            width={20}
            height={20}
            alt="Codex"
          />
          <img
            className="onboard__agent onboard__agent--dark"
            src="/brand/agents/codex-dark.svg"
            width={20}
            height={20}
            alt=""
            aria-hidden="true"
          />
        </span>
        <span className="onboard__icon" aria-hidden="true">
          {copied ? (
            <svg viewBox="0 0 16 16">
              <path
                d="M3.2 8.4l3.1 3.1 6.5-6.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16">
              <rect x="5.4" y="5.4" width="8.1" height="8.1" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10.6 3.9V3.4a1.9 1.9 0 0 0-1.9-1.9H4.4a1.9 1.9 0 0 0-1.9 1.9v4.3a1.9 1.9 0 0 0 1.9 1.9h.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      </button>
      <p className="onboard__status" role="status" data-testid="onboard-status">
        {copied ? t('onboard.copied') : ''}
      </p>
    </div>
  );
}
