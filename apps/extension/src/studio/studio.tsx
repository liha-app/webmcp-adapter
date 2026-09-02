import { Fragment, StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
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
import { applyDocumentLanguage, loadLocale, t } from '../i18n';
import type { MessageKey } from '../i18n/en';

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

const KIND_LABEL: Record<StepKind, MessageKey> = {
  click: 'studio.kindClick',
  fill: 'studio.kindFill',
  select: 'studio.kindSelect',
  check: 'studio.kindCheck',
  uncheck: 'studio.kindUncheck',
  submit: 'studio.kindSubmit',
  waitFor: 'studio.kindWaitFor',
  assertVisible: 'studio.kindAssertVisible',
  assertText: 'studio.kindAssertText',
  readText: 'studio.kindReadText',
  readAttribute: 'studio.kindReadAttribute',
  readList: 'studio.kindReadList',
  navigate: 'studio.kindNavigate',
};

/**
 * What a node says without being opened.
 *
 * A flow is only readable if each node answers "what does this do" from the
 * outside; the selector is the answer for most steps, and for the ones that
 * carry a value it is the value that matters.
 */
function summarize(step: DraftStep): { title: MessageKey; detail: string } {
  if (step.kind === 'navigate') return { title: KIND_LABEL[step.kind], detail: step.value || '/' };
  return { title: KIND_LABEL[step.kind], detail: step.selector };
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
        <select
          className="type"
          value={step.kind}
          onChange={(event) => set({ kind: event.target.value as StepKind })}
          aria-label={t('studio.ariaType', [index + 1])}
        >
          {STEP_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <MatchBadge count={probe[step.selector]} />
        <span className="spacer" />
        <button type="button" className="iconbtn" onClick={() => props.onMove(-1)} aria-label={t('studio.moveUp')}>
          ↑
        </button>
        <button type="button" className="iconbtn" onClick={() => props.onMove(1)} aria-label={t('studio.moveDown')}>
          ↓
        </button>
        <button type="button" className="iconbtn" onClick={props.onRemove} aria-label={t('studio.removeStep')}>
          ✕
        </button>
      </div>

      {step.kind !== 'navigate' && (
        <>
          <input
            className="sel"
            value={step.selector}
            placeholder={t('studio.cssSelector')}
            aria-label={t('studio.ariaSelector', [index + 1])}
            onChange={(event) => set({ selector: event.target.value })}
          />
          {step.candidates.length > 1 && (
            <select
              style={{ marginTop: 6 }}
              value=""
              aria-label={t('studio.ariaAlternatives', [index + 1])}
              onChange={(event) => event.target.value && set({ selector: event.target.value })}
            >
              <option value="">{t('studio.otherSelectors')}</option>
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
            aria-label={t('studio.ariaValueSource', [index + 1])}
          >
            <option value="literal">fixed value</option>
            <option value="parameter">tool input</option>
          </select>
          {step.parameterized ? (
            <input
              style={{ flex: 1 }}
              value={step.parameter}
              placeholder={t('studio.parameterName')}
              aria-label={t('studio.ariaParameterName', [index + 1])}
              onChange={(event) => set({ parameter: event.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
            />
          ) : (
            <input
              style={{ flex: 1 }}
              value={step.value}
              placeholder={step.kind === 'navigate' ? '/path' : t('studio.value')}
              aria-label={t('studio.ariaValue', [index + 1])}
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
          aria-label={t('studio.ariaWaitState', [index + 1])}
        >
          <option value="present">until present</option>
          <option value="absent">until gone</option>
        </select>
      )}

      {READ_STEPS.has(step.kind) && (
        <div className="two" style={{ marginTop: 8 }}>
          <input
            value={step.binding}
            placeholder={t('studio.outputName')}
            aria-label={t('studio.ariaOutputName', [index + 1])}
            onChange={(event) => set({ binding: event.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
          />
          {step.kind === 'readAttribute' && (
            <input
              value={step.attribute}
              placeholder={t('studio.attribute')}
              aria-label={t('studio.ariaAttribute', [index + 1])}
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
  /*
   * What the right-hand panel is showing: one step, or the tool itself. A flow
   * builder with nothing selected has nowhere to put the settings that belong
   * to the whole flow, so the trigger node owns them — which is also the first
   * thing anyone needs to fill in.
   */
  const [selected, setSelected] = useState<string>('tool');

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
  const selectedStep = draft?.steps.find((step) => step.id === selected);
  const effects = validation?.adapter?.tools[0] ? summarizeEffects(validation.adapter.tools[0]) : null;

  const runProbe = useCallback(() => {
    if (!draft) return;
    const selectors = [...new Set(draft.steps.map((step) => step.selector).filter(Boolean))];
    setStatus(t('studio.checking'));
    void ext.runtime
      .sendMessage({ type: 'liha/probe-selectors', origin: draft.origin, selectors })
      .then((response: { probe?: Probe; error?: string } | undefined) => {
        if (response?.error) {
          setStatus(response.error);
          return;
        }
        setProbe(response?.probe ?? {});
        const unique = Object.values(response?.probe ?? {}).filter((count) => count === 1).length;
        setStatus(t('studio.checked', [selectors.length, unique]));
      })
      .catch((error: unknown) => setStatus(t('studio.unreachable', [String(error)])));
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
    setStatus(t('studio.exportedNative'));
  }

  function install() {
    if (!adapterJson) return;
    setStatus(t('studio.waitingInstall'));
    void ext.runtime
      .sendMessage({ type: 'liha/install-adapter', adapter: adapterJson, source: 'studio' })
      .then((outcome: { ok: boolean; errors: string[] } | undefined) => {
        setStatus(
          outcome?.ok
            ? t('studio.installed')
            : t('studio.notInstalled', [outcome?.errors.join('; ') ?? 'unknown error']),
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
            <p className="lede">{t('studio.lede')}</p>
          </div>
        </header>
        <div className="panel">
          <p className="empty">{t('studio.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="top__title">
          <h1>Adapter Studio</h1>
          <p className="lede">
            {t('studio.recordedFrom', [recording?.actions.length ?? 0])} <code>{draft.origin}</code>
          </p>
        </div>
        {/*
          * The verdict rides in the bar rather than under the JSON. It is the
          * thing that decides whether three of these buttons do anything, and
          * the JSON moved off-screen into the rail.
          */}
        {validation?.ok ? (
          <span className="ok">{t('studio.valid')}</span>
        ) : (
          <span className="problem">{t('studio.notValid')}</span>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={runProbe}>
            {t('studio.testSelectors')}
          </button>
          <button type="button" className="btn" onClick={download} disabled={!validation?.ok}>
            {t('studio.exportJson')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={downloadNative}
            disabled={!validation?.ok}
            title={t('studio.exportNativeTitle')}
          >
            {t('studio.exportNative')}
          </button>
          <button type="button" className="btn btn--primary" onClick={install} disabled={!validation?.ok}>
            {t('studio.installLocally')}
          </button>
        </div>
      </header>

      <div className="steps-flow steps-flow--bar">
        {([t('studio.stepRecord'), t('studio.stepReview'), t('studio.stepParameterize'), t('studio.stepTest'), t('studio.stepInstall')] as string[]).map((label, index) => (
          <span key={label} className={`flowstep ${index === 0 ? 'flowstep--on' : ''}`}>
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {status && <div className="banner">{status}</div>}

      <div className="stage">
        <div className="flow" role="list">
          {/*
            * The trigger, the way every flow builder starts: the thing that
            * happens before any of the steps. Here it is the agent's call, and
            * the tool's own settings are what it opens.
            */}
          <button
            type="button"
            className={`node node--trigger ${selected === 'tool' ? 'node--on' : ''}`}
            onClick={() => setSelected('tool')}
            role="listitem"
          >
            <span className="node__title">{t('studio.trigger')}</span>
            <span className="node__detail">
              {draft.toolName ? (
                <code>{draft.toolName}</code>
              ) : (
                t('studio.triggerUnnamed')
              )}
            </span>
            <span className="node__detail">
              {parameters.length > 0
                ? t('studio.triggerTakes', [parameters.map((parameter) => parameter.name).join(', ')])
                : t('studio.triggerTakesNothing')}
            </span>
          </button>

          {draft.steps.map((step, index) => {
            const { title, detail } = summarize(step);
            return (
              <Fragment key={step.id}>
                <span className="flow__link" aria-hidden="true" />
                <button
                  type="button"
                  role="listitem"
                  data-kind={step.kind}
                  data-param={step.parameterized ? '1' : '0'}
                  className={`node ${selected === step.id ? 'node--on' : ''}`}
                  onClick={() => setSelected(step.id)}
                >
                  <span className="node__index">{index + 1}</span>
                  <span className="node__title">{t(title)}</span>
                  <span className="node__detail node__detail--code">
                    {detail || t('studio.noSelector')}
                  </span>
                  {step.parameterized && step.parameter && (
                    <span className="node__detail">{t('studio.usesInput', [step.parameter])}</span>
                  )}
                  <MatchBadge count={probe[step.selector]} />
                </button>
              </Fragment>
            );
          })}

          {draft.steps.length === 0 && <p className="flow__empty">{t('studio.flowEmpty')}</p>}

          <span className="flow__link" aria-hidden="true" />
          <button
            type="button"
            className="node__add"
            aria-label={t('studio.addStepAria')}
            onClick={() => {
              const step = emptyStep();
              setDraft({ ...draft, steps: [...draft.steps, step] });
              setSelected(step.id);
            }}
          >
            +
          </button>
        </div>

        <aside className="inspector">
          <div className="inspector__head">
            <h2>{selectedStep ? t('studio.stepN', [draft.steps.indexOf(selectedStep) + 1]) : t('studio.toolDetails')}</h2>
            {selectedStep && <span className="muted">{t(summarize(selectedStep).title)}</span>}
          </div>
          {selectedStep ? (
            <section className="panel panel--flush">
              <div className="panel__body">
                <StepEditor
                  step={selectedStep}
                  index={draft.steps.indexOf(selectedStep)}
                  probe={probe}
                  onChange={(next) => updateStep(selectedStep.id, next)}
                  onMove={(delta) => moveStep(draft.steps.indexOf(selectedStep), delta)}
                  onRemove={() => {
                    setSelected('tool');
                    setDraft({ ...draft, steps: draft.steps.filter((candidate) => candidate.id !== selectedStep.id) });
                  }}
                />
              </div>
            </section>
          ) : (
            <>
          <section className="panel">
            <div className="panel__head">
              <h2>{t('studio.tool')}</h2>
              {effects && (
                <span className="muted">
                  {effects.clicks} click · {effects.inputs} input · {effects.submits} submit · {effects.reads} read
                </span>
              )}
            </div>
            <div className="panel__body">
              <Field label={t('studio.toolName')}>
                <input
                  value={draft.toolName}
                  placeholder="create_customer"
                  onChange={(event) =>
                    setDraft({ ...draft, toolName: event.target.value.replace(/[^a-z0-9_]/g, '') })
                  }
                />
              </Field>
              <Field label={t('studio.toolDescription')}>
                <textarea
                  value={draft.toolDescription}
                  placeholder="Create a customer by filling in the Add Customer form."
                  onChange={(event) => setDraft({ ...draft, toolDescription: event.target.value })}
                />
              </Field>
              <div className="two">
                <Field label={t('studio.capability')}>
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
                <Field label={t('studio.targetOrigin')}>
                  <input value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} />
                </Field>
              </div>
              {draft.capability === 'DESTRUCTIVE' && (
                <p className="muted">{t('studio.destructiveNote')}</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>{t('studio.adapter')}</h2>
            </div>
            <div className="panel__body">
              <div className="two">
                <Field label={t('studio.adapterId')}>
                  <input
                    value={draft.adapterId}
                    onChange={(event) =>
                      setDraft({ ...draft, adapterId: event.target.value.replace(/[^a-z0-9-]/g, '') })
                    }
                  />
                </Field>
                <Field label={t('studio.version')}>
                  <input value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} />
                </Field>
              </div>
              <Field label={t('studio.adapterName')}>
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
                <h2>{t('studio.toolInput')}</h2>
              </div>
              <div className="panel__body">
                {parameters.map((parameter) => (
                  <Field key={parameter.name} label={t('studio.parameterLabel', [parameter.name])}>
                    <input
                      value={descriptions[parameter.name] ?? ''}
                      placeholder={t('studio.parameterPlaceholder')}
                      onChange={(event) =>
                        setDescriptions({ ...descriptions, [parameter.name]: event.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
            </section>
          )}
            </>
          )}

          {validation && !validation.ok && (
            <div className="inspector__problems">
              {validation.errors.map((error) => (
                <p key={error} className="problem">
                  {error}
                </p>
              ))}
            </div>
          )}

          {/* Off to one side, because it is the output, not the workspace. */}
          <details className="jsonbox">
            <summary>{t('studio.adapterJson')}</summary>
            <pre>{JSON.stringify(adapterJson, null, 2)}</pre>
          </details>
        </aside>
      </div>


    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  // Mounted after the language is known, so no label renders in English and
  // then changes under someone already reading it.
  void loadLocale().then(() => {
    applyDocumentLanguage();
    createRoot(root).render(
      <StrictMode>
        <Studio />
      </StrictMode>,
    );
  });
}
