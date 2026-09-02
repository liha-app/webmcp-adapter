import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { summarizeEffects, validateAdapter, type Capability } from '@liha/adapter-schema';
import type { RecordingState } from '@liha/shared';
import { ext } from '../platform';
import {
  READ_STEPS,
  STEP_KINDS,
  VALUE_STEPS,
  draftFromRecording,
  draftToAdapter,
  emptyStep,
  parametersOf,
  type Draft,
  type DraftStep,
  type StepKind,
} from './draft';
import { nativeWebMcpSource } from './native';

const CAPABILITIES: Capability[] = ['READ', 'INTERACT', 'WRITE', 'DESTRUCTIVE'];

type Probe = Record<string, number>;

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function MatchBadge({ count }: { count: number | undefined }) {
  if (count === undefined) return null;
  const kind = count === 1 ? 'one' : count === 0 ? 'none' : 'many';
  const text = count === 1 ? '1 match' : count === 0 ? 'no match' : `${count} matches`;
  return <span className={`matches matches--${kind}`}>{text}</span>;
}

function StepEditor(props: {
  step: DraftStep;
  index: number;
  probe: Probe;
  onChange: (step: DraftStep) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const { step, index, probe } = props;
  const set = (patch: Partial<DraftStep>) => props.onChange({ ...step, ...patch });

  return (
    <div className="step">
      <div className="step__head">
        <span className="step__index">{index + 1}</span>
        <select
          className="type"
          value={step.kind}
          onChange={(event) => set({ kind: event.target.value as StepKind })}
          aria-label={`Step ${index + 1} type`}
        >
          {STEP_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <MatchBadge count={probe[step.selector]} />
        <span className="spacer" />
        <button type="button" className="iconbtn" onClick={() => props.onMove(-1)} aria-label="Move up">
          ↑
        </button>
        <button type="button" className="iconbtn" onClick={() => props.onMove(1)} aria-label="Move down">
          ↓
        </button>
        <button type="button" className="iconbtn" onClick={props.onRemove} aria-label="Remove step">
          ✕
        </button>
      </div>

      {step.kind !== 'navigate' && (
        <>
          <input
            className="sel"
            value={step.selector}
            placeholder="CSS selector"
            aria-label={`Step ${index + 1} selector`}
            onChange={(event) => set({ selector: event.target.value })}
          />
          {step.candidates.length > 1 && (
            <select
              style={{ marginTop: 6 }}
              value=""
              aria-label={`Alternative selectors for step ${index + 1}`}
              onChange={(event) => event.target.value && set({ selector: event.target.value })}
            >
              <option value="">Other recorded selectors…</option>
              {step.candidates.map((candidate) => (
                <option key={candidate.selector} value={candidate.selector}>
                  {candidate.strategy} · {candidate.matches} match{candidate.matches === 1 ? '' : 'es'} ·{' '}
                  {candidate.selector}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {VALUE_STEPS.has(step.kind) && (
        <div className="row" style={{ marginTop: 8 }}>
          <select
            style={{ width: 'auto' }}
            value={step.parameterized ? 'parameter' : 'literal'}
            onChange={(event) => set({ parameterized: event.target.value === 'parameter' })}
            aria-label={`Step ${index + 1} value source`}
          >
            <option value="literal">fixed value</option>
            <option value="parameter">tool input</option>
          </select>
          {step.parameterized ? (
            <input
              style={{ flex: 1 }}
              value={step.parameter}
              placeholder="parameter name"
              aria-label={`Step ${index + 1} parameter name`}
              onChange={(event) => set({ parameter: event.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
            />
          ) : (
            <input
              style={{ flex: 1 }}
              value={step.value}
              placeholder={step.kind === 'navigate' ? '/path' : 'value'}
              aria-label={`Step ${index + 1} value`}
              onChange={(event) => set({ value: event.target.value })}
            />
          )}
        </div>
      )}
      {step.parameterized && step.value && (
        <p className="muted" style={{ marginTop: 4 }}>
          recorded example: {step.value}
        </p>
      )}

      {step.kind === 'waitFor' && (
        <select
          style={{ marginTop: 8, width: 'auto' }}
          value={step.waitState}
          onChange={(event) => set({ waitState: event.target.value as 'present' | 'absent' })}
          aria-label={`Step ${index + 1} wait state`}
        >
          <option value="present">until present</option>
          <option value="absent">until gone</option>
        </select>
      )}

      {READ_STEPS.has(step.kind) && (
        <div className="two" style={{ marginTop: 8 }}>
          <input
            value={step.binding}
            placeholder="output name"
            aria-label={`Step ${index + 1} output name`}
            onChange={(event) => set({ binding: event.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
          />
          {step.kind === 'readAttribute' && (
            <input
              value={step.attribute}
              placeholder="attribute"
              aria-label={`Step ${index + 1} attribute`}
              onChange={(event) => set({ attribute: event.target.value })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Studio() {
  const [recording, setRecording] = useState<RecordingState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [probe, setProbe] = useState<Probe>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void ext.runtime
      .sendMessage({ type: 'liha/get-recording' })
      .then((response: { recording: RecordingState | null } | undefined) => {
        const take = response?.recording ?? null;
        setRecording(take);
        if (take) setDraft(draftFromRecording(take.actions, take.origin));
      })
      .catch(() => undefined);
  }, []);

  const adapterJson = useMemo(() => (draft ? draftToAdapter(draft, descriptions) : null), [draft, descriptions]);
  const validation = useMemo(() => (adapterJson ? validateAdapter(adapterJson) : null), [adapterJson]);
  const parameters = draft ? parametersOf(draft) : [];
  const effects = validation?.adapter?.tools[0] ? summarizeEffects(validation.adapter.tools[0]) : null;

  const runProbe = useCallback(() => {
    if (!draft) return;
    const selectors = [...new Set(draft.steps.map((step) => step.selector).filter(Boolean))];
    setStatus('Checking selectors against the page…');
    void ext.runtime
      .sendMessage({ type: 'liha/probe-selectors', origin: draft.origin, selectors })
      .then((response: { probe?: Probe; error?: string } | undefined) => {
        if (response?.error) {
          setStatus(response.error);
          return;
        }
        setProbe(response?.probe ?? {});
        const unique = Object.values(response?.probe ?? {}).filter((count) => count === 1).length;
        setStatus(`Checked ${selectors.length} selector(s): ${unique} resolve to exactly one element.`);
      })
      .catch((error: unknown) => setStatus(`Could not reach the page: ${String(error)}`));
  }, [draft]);

  function updateStep(id: string, next: DraftStep) {
    setDraft((current) =>
      current ? { ...current, steps: current.steps.map((step) => (step.id === id ? next : step)) } : current,
    );
  }

  function moveStep(index: number, delta: number) {
    setDraft((current) => {
      if (!current) return current;
      const target = index + delta;
      if (target < 0 || target >= current.steps.length) return current;
      const steps = [...current.steps];
      const [moved] = steps.splice(index, 1);
      if (moved) steps.splice(target, 0, moved);
      return { ...current, steps };
    });
  }

  function save(name: string, contents: string, type: string) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function download() {
    if (!adapterJson || !draft) return;
    save(`${draft.adapterId || 'adapter'}.json`, JSON.stringify(adapterJson, null, 2), 'application/json');
  }

  /*
   * The other export, and the one that says what this tool is for.
   *
   * An adapter exists because the site has not implemented WebMCP; the honest
   * end state is that it does, and then the adapter is not needed. This hands
   * the site's developers that implementation — same name, same schema, the
   * recorded workflow written out as what to replace — so a recording is both
   * a stopgap and a migration path rather than only a stopgap.
   */
  function downloadNative() {
    if (!validation?.adapter || !draft) return;
    save(`${draft.adapterId || 'adapter'}-webmcp.js`, nativeWebMcpSource(validation.adapter), 'text/javascript');
    setStatus('Exported a native WebMCP implementation for the site to ship itself.');
  }

  function install() {
    if (!adapterJson) return;
    setStatus('Waiting for the install confirmation…');
    void ext.runtime
      .sendMessage({ type: 'liha/install-adapter', adapter: adapterJson, source: 'studio' })
      .then((outcome: { ok: boolean; errors: string[] } | undefined) => {
        setStatus(
          outcome?.ok
            ? 'Installed. Reload the target page and the tool will be registered with WebMCP.'
            : `Not installed: ${outcome?.errors.join('; ') ?? 'unknown error'}`,
        );
      })
      .catch((error: unknown) => setStatus(String(error)));
  }

  if (!draft) {
    return (
      <div className="shell">
        <header className="top">
          <div>
            <h1>Adapter Studio</h1>
            <p className="lede">Turn a recorded workflow into a WebMCP tool.</p>
          </div>
        </header>
        <div className="panel">
          <p className="empty">
            No recording yet. Open the Liha popup on the site you want to teach, press <strong>Record a tool</strong>,
            perform the workflow by hand, then press <strong>Stop recording</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Adapter Studio</h1>
          <p className="lede">
            {recording?.actions.length ?? 0} recorded action(s) from <code>{draft.origin}</code>
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={runProbe}>
            Test selectors
          </button>
          <button type="button" className="btn" onClick={download} disabled={!validation?.ok}>
            Export JSON
          </button>
          <button
            type="button"
            className="btn"
            onClick={downloadNative}
            disabled={!validation?.ok}
            title="The same tools, as code the site can register itself — no adapter, no extension"
          >
            Export native WebMCP
          </button>
          <button type="button" className="btn btn--primary" onClick={install} disabled={!validation?.ok}>
            Install locally
          </button>
        </div>
      </header>

      <div className="steps-flow">
        {['Record', 'Review', 'Parameterize', 'Test', 'Install'].map((label, index) => (
          <span key={label} className={`flowstep ${index === 0 ? 'flowstep--on' : ''}`}>
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {status && <div className="banner">{status}</div>}

      <div className="grid">
        <div>
          <section className="panel">
            <div className="panel__head">
              <h2>Tool</h2>
              {effects && (
                <span className="muted">
                  {effects.clicks} click · {effects.inputs} input · {effects.submits} submit · {effects.reads} read
                </span>
              )}
            </div>
            <div className="panel__body">
              <Field label="Tool name (snake_case)">
                <input
                  value={draft.toolName}
                  placeholder="create_customer"
                  onChange={(event) =>
                    setDraft({ ...draft, toolName: event.target.value.replace(/[^a-z0-9_]/g, '') })
                  }
                />
              </Field>
              <Field label="Description — this is what the agent reads to decide when to use the tool">
                <textarea
                  value={draft.toolDescription}
                  placeholder="Create a customer by filling in the Add Customer form."
                  onChange={(event) => setDraft({ ...draft, toolDescription: event.target.value })}
                />
              </Field>
              <div className="two">
                <Field label="Capability">
                  <select
                    value={draft.capability}
                    onChange={(event) => setDraft({ ...draft, capability: event.target.value as Capability })}
                  >
                    {CAPABILITIES.map((capability) => (
                      <option key={capability} value={capability}>
                        {capability}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Target origin">
                  <input value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} />
                </Field>
              </div>
              {draft.capability === 'DESTRUCTIVE' && (
                <p className="muted">Destructive tools always ask the user before they run.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Adapter</h2>
            </div>
            <div className="panel__body">
              <div className="two">
                <Field label="Adapter id (kebab-case)">
                  <input
                    value={draft.adapterId}
                    onChange={(event) =>
                      setDraft({ ...draft, adapterId: event.target.value.replace(/[^a-z0-9-]/g, '') })
                    }
                  />
                </Field>
                <Field label="Version">
                  <input value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} />
                </Field>
              </div>
              <Field label="Adapter name">
                <input
                  value={draft.adapterName}
                  onChange={(event) => setDraft({ ...draft, adapterName: event.target.value })}
                />
              </Field>
            </div>
          </section>

          {parameters.length > 0 && (
            <section className="panel">
              <div className="panel__head">
                <h2>Tool input</h2>
              </div>
              <div className="panel__body">
                {parameters.map((parameter) => (
                  <Field key={parameter.name} label={`${parameter.name} (string, required)`}>
                    <input
                      value={descriptions[parameter.name] ?? ''}
                      placeholder="What should the agent put here?"
                      onChange={(event) =>
                        setDescriptions({ ...descriptions, [parameter.name]: event.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="panel">
            <div className="panel__head">
              <h2>Steps</h2>
              <button
                type="button"
                className="iconbtn"
                onClick={() => setDraft({ ...draft, steps: [...draft.steps, emptyStep()] })}
              >
                + step
              </button>
            </div>
            <div className="panel__body">
              {draft.steps.map((step, index) => (
                <StepEditor
                  key={step.id}
                  step={step}
                  index={index}
                  probe={probe}
                  onChange={(next) => updateStep(step.id, next)}
                  onMove={(delta) => moveStep(index, delta)}
                  onRemove={() =>
                    setDraft({ ...draft, steps: draft.steps.filter((candidate) => candidate.id !== step.id) })
                  }
                />
              ))}
              {draft.steps.length === 0 && <p className="muted">No steps yet.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Adapter JSON</h2>
              {validation?.ok ? <span className="ok">valid</span> : <span className="problem">not valid yet</span>}
            </div>
            {validation && !validation.ok && (
              <div className="panel__body">
                {validation.errors.map((error) => (
                  <p key={error} className="problem">
                    {error}
                  </p>
                ))}
              </div>
            )}
            <pre>{JSON.stringify(adapterJson, null, 2)}</pre>
          </section>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Studio />
    </StrictMode>,
  );
}
