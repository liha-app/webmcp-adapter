import { resolveSameOriginPath, type Step } from '@liha/adapter-schema';
import {
  StepError,
  clickElement,
  countMatches,
  fillElement,
  isVisible,
  readElementAttribute,
  readElementText,
  resolveExactlyOne,
  selectOption,
  setChecked,
  submitForm,
} from './dom';
import { interpolate, type InputContext } from './input';

export interface ExecutorDeps {
  root: ParentNode;
  origin: string;
  navigate: (href: string) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /**
   * Yields once so a framework re-render can land before the next step.
   *
   * This is deliberately not a `setTimeout`: agents routinely drive tabs the
   * user is not looking at, and Chrome clamps timers in background tabs to
   * roughly one per second. A four-step form would take four seconds for no
   * reason.
   */
  settle: () => Promise<void>;
}

export interface StepTraceEntry {
  step: string;
  ok: boolean;
  detail: string;
}

export type OutputValue = string | Array<Record<string, string>>;

export interface ExecutionResult {
  trace: StepTraceEntry[];
  outputs: Record<string, OutputValue>;
}

export interface StepExecutionError extends Error {
  trace: StepTraceEntry[];
}

const DEFAULT_WAIT_MS = 4000;
const POLL_INTERVAL_MS = 50;

async function waitForState(
  selector: string,
  state: 'present' | 'absent',
  timeoutMs: number,
  deps: ExecutorDeps,
): Promise<void> {
  const deadline = deps.now() + timeoutMs;
  for (;;) {
    const matches = countMatches(selector, deps.root);
    if (matches < 0) throw new StepError(`invalid selector: ${selector}`, 'invalid-selector');
    if (state === 'absent') {
      if (matches === 0) return;
    } else {
      // An ambiguous selector will not become unambiguous by waiting, and a
      // step must never pick one of several candidates. Fail immediately.
      if (matches > 1) {
        throw new StepError(
          `selector "${selector}" matched ${matches} elements (expected exactly 1)`,
          'selector-ambiguous',
        );
      }
      if (matches === 1) return;
    }
    if (deps.now() >= deadline) {
      throw new StepError(
        `timed out after ${timeoutMs}ms waiting for "${selector}" to be ${state}`,
        'timeout',
      );
    }
    await deps.sleep(POLL_INTERVAL_MS);
  }
}

function readRow(row: Element, fields: Record<string, { selector?: string; attribute?: string }>): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    let target: Element | null = row;
    if (field.selector) {
      const found = row.querySelectorAll(field.selector);
      target = found.length === 1 ? (found[0] as Element) : null;
    }
    if (!target) {
      record[key] = '';
      continue;
    }
    record[key] = field.attribute ? readElementAttribute(target, field.attribute) : readElementText(target);
  }
  return record;
}

/**
 * Runs a declarative step list. Every step is data; nothing here evaluates a
 * string as code. Trace entries deliberately record *shapes* (selector, value
 * length) and never the interpolated values, which may contain personal data.
 */
export async function executeSteps(
  steps: readonly Step[],
  context: InputContext,
  deps: ExecutorDeps,
): Promise<ExecutionResult> {
  const trace: StepTraceEntry[] = [];
  const outputs: Record<string, OutputValue> = {};
  const one = (selector: string) => resolveExactlyOne(selector, deps.root);

  for (const step of steps) {
    try {
      switch (step.type) {
        case 'click':
          clickElement(one(step.selector));
          trace.push({ step: 'click', ok: true, detail: step.selector });
          await deps.settle();
          break;

        case 'fill': {
          const value = interpolate(step.value, context);
          fillElement(one(step.selector), value);
          trace.push({ step: 'fill', ok: true, detail: `${step.selector} (${value.length} chars)` });
          await deps.settle();
          break;
        }

        case 'select': {
          const value = interpolate(step.value, context);
          selectOption(one(step.selector), value);
          trace.push({ step: 'select', ok: true, detail: `${step.selector} (${value.length} chars)` });
          await deps.settle();
          break;
        }

        case 'check':
        case 'uncheck':
          setChecked(one(step.selector), step.type === 'check');
          trace.push({ step: step.type, ok: true, detail: step.selector });
          await deps.settle();
          break;

        case 'submit':
          submitForm(one(step.selector));
          trace.push({ step: 'submit', ok: true, detail: step.selector });
          await deps.settle();
          break;

        case 'waitFor': {
          const state = step.state ?? 'present';
          await waitForState(step.selector, state, step.timeoutMs ?? DEFAULT_WAIT_MS, deps);
          trace.push({ step: 'waitFor', ok: true, detail: `${step.selector} (${state})` });
          break;
        }

        case 'assertVisible': {
          const element = one(step.selector);
          if (!isVisible(element)) {
            throw new StepError(`"${step.selector}" is present but not visible`, 'assertion-failed');
          }
          trace.push({ step: 'assertVisible', ok: true, detail: step.selector });
          break;
        }

        case 'assertText': {
          const expected = interpolate(step.contains, context);
          const actual = readElementText(one(step.selector));
          if (!actual.includes(expected)) {
            // The expected value can carry tool input, so report lengths only.
            throw new StepError(
              `"${step.selector}" does not contain the expected text (${expected.length} chars)`,
              'assertion-failed',
            );
          }
          trace.push({ step: 'assertText', ok: true, detail: step.selector });
          break;
        }

        case 'readText':
          outputs[step.as] = readElementText(one(step.selector));
          trace.push({ step: 'readText', ok: true, detail: `${step.selector} -> ${step.as}` });
          break;

        case 'readAttribute':
          outputs[step.as] = readElementAttribute(one(step.selector), step.attribute);
          trace.push({ step: 'readAttribute', ok: true, detail: `${step.selector}@${step.attribute} -> ${step.as}` });
          break;

        case 'readList': {
          let rows: Element[];
          try {
            rows = [...deps.root.querySelectorAll(step.selector)];
          } catch {
            throw new StepError(`invalid selector: ${step.selector}`, 'invalid-selector');
          }
          const limited = rows.slice(0, step.limit ?? 25);
          const fields = step.fields ?? {};
          outputs[step.as] = limited.map((row) =>
            Object.keys(fields).length > 0 ? readRow(row, fields) : { text: readElementText(row) },
          );
          trace.push({
            step: 'readList',
            ok: true,
            detail: `${step.selector} -> ${step.as} (${limited.length} of ${rows.length})`,
          });
          break;
        }

        case 'navigate': {
          const path = interpolate(step.path, context);
          const href = resolveSameOriginPath(path, deps.origin);
          if (!href) {
            throw new StepError(`navigate target "${path}" leaves the adapter's origin`, 'cross-origin');
          }
          deps.navigate(href);
          trace.push({ step: 'navigate', ok: true, detail: path });
          await deps.settle();
          break;
        }

        default: {
          const exhaustive: never = step;
          throw new StepError(`unsupported step: ${JSON.stringify(exhaustive)}`, 'unsupported-step');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trace.push({ step: step.type, ok: false, detail: message });
      const failure = new Error(`step "${step.type}" failed: ${message}`) as StepExecutionError;
      failure.trace = trace;
      throw failure;
    }
  }

  return { trace, outputs };
}
