import { isSensitiveField } from '@liha/adapter-runtime/dom';
import type { RecordedAction } from '@liha/shared';
import { bestSelector, buildSelectorCandidates } from './selectors';

/**
 * Watches a person using the page and turns what they did into candidate steps.
 *
 * It records intent, not keystrokes: one `fill` for a field the user typed
 * into, not thirty. Values from credential and payment fields are never
 * captured at all — the action is recorded so the workflow still makes sense,
 * with the value left out.
 */
export type ActionSink = (action: RecordedAction) => void;

function label(element: Element): string {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  return (element.getAttribute('aria-label') ?? text ?? '').slice(0, 80);
}

function describe(element: Element): Pick<RecordedAction, 'selector' | 'candidates' | 'label'> {
  const candidates = buildSelectorCandidates(element);
  const best = bestSelector(candidates);
  return {
    selector: best?.selector ?? '',
    candidates: candidates.slice(0, 6).map((candidate) => ({
      selector: candidate.selector,
      strategy: candidate.strategy,
      matches: candidate.matches,
    })),
    label: label(element),
  };
}

const CLICKABLE = 'button, a, [role="button"], [data-action], input[type="submit"], input[type="button"]';

export function createRecorder(sink: ActionSink): { start(): void; stop(): void } {
  let active = false;

  const onClick = (event: Event) => {
    if (!active) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    // Checkboxes, radios and selects are captured through `change`, which
    // reports the resulting state rather than the fact that a click happened.
    if (target.matches('input[type="checkbox"], input[type="radio"], option, select')) return;
    const actionable = target.closest(CLICKABLE);
    if (!actionable) return;
    sink({ at: Date.now(), kind: 'click', ...describe(actionable) });
  };

  const onChange = (event: Event) => {
    if (!active) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tag = target.tagName.toLowerCase();
    const described = describe(target);

    if (tag === 'select') {
      sink({ at: Date.now(), kind: 'select', ...described, value: (target as HTMLSelectElement).value });
      return;
    }
    if (tag === 'input') {
      const input = target as HTMLInputElement;
      const type = (input.type ?? '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        sink({ at: Date.now(), kind: input.checked ? 'check' : 'uncheck', ...described });
        return;
      }
    }
    if (tag === 'input' || tag === 'textarea') {
      const value = (target as HTMLInputElement).value;
      // The action is still worth recording; the secret is not.
      const safe = isSensitiveField(target) ? undefined : value;
      sink({ at: Date.now(), kind: 'fill', ...described, ...(safe === undefined ? {} : { value: safe }) });
    }
  };

  const onSubmit = (event: Event) => {
    if (!active) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    sink({ at: Date.now(), kind: 'submit', ...describe(target) });
  };

  return {
    start() {
      if (active) return;
      active = true;
      document.addEventListener('click', onClick, true);
      document.addEventListener('change', onChange, true);
      document.addEventListener('submit', onSubmit, true);
    },
    stop() {
      if (!active) return;
      active = false;
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('submit', onSubmit, true);
    },
  };
}
