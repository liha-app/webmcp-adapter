import { useCallback, useEffect, useMemo, useState } from 'react';
import { detectModelContext } from '@liha/adapter-runtime';
import { REGISTRY_TOOLS, type RegistryTool } from '../lib/webmcp';

/**
 * Run this page's own WebMCP tools, from this page.
 *
 * The point is that nothing here is a mock-up. When the browser exposes
 * WebMCP, the call really goes through `document.modelContext.executeTool` —
 * the same path a visitor's agent takes. When it does not, the same function
 * runs directly and the panel says so, because a demo that quietly fakes the
 * mechanism it is demonstrating would be worse than no demo.
 */
type Route = 'webmcp' | 'direct';

interface Outcome {
  route: Route;
  tool: string;
  text: string;
  ms: number;
  isError: boolean;
}

function initialValues(tool: RegistryTool): Record<string, string> {
  const properties = (tool.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
  const values: Record<string, string> = {};
  for (const key of Object.keys(properties)) values[key] = tool.example[key] ?? '';
  return values;
}

export function LiveTools() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string>(REGISTRY_TOOLS[0]!.name);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(REGISTRY_TOOLS[0]!));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [running, setRunning] = useState(false);

  const tool = useMemo(() => REGISTRY_TOOLS.find((candidate) => candidate.name === selected)!, [selected]);
  const properties = (tool.inputSchema.properties ?? {}) as Record<string, { description?: string }>;

  useEffect(() => {
    // The tools are registered by the app shell; this only reports whether the
    // browser has the API at all.
    setSupported(detectModelContext(document) !== null);
  }, []);

  function choose(name: string) {
    const next = REGISTRY_TOOLS.find((candidate) => candidate.name === name)!;
    setSelected(name);
    setValues(initialValues(next));
    setOutcome(null);
  }

  const run = useCallback(async () => {
    setRunning(true);
    const started = performance.now();
    const input: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) if (value !== '') input[key] = value;

    try {
      const modelContext = detectModelContext(document);
      if (modelContext) {
        const registered = await modelContext.getTools();
        const target = registered.find((candidate) => candidate.name === tool.name);
        if (target) {
          const raw = await modelContext.executeTool(target, JSON.stringify(input));
          const parsed = JSON.parse(raw ?? 'null') as { content?: Array<{ text: string }>; isError?: boolean };
          setOutcome({
            route: 'webmcp',
            tool: tool.name,
            text: parsed.content?.map((part) => part.text).join('\n') ?? '',
            ms: Math.round(performance.now() - started),
            isError: parsed.isError === true,
          });
          return;
        }
      }
      const result = tool.execute(input);
      setOutcome({
        route: 'direct',
        tool: tool.name,
        text: result.content.map((part) => part.text).join('\n'),
        ms: Math.round(performance.now() - started),
        isError: result.isError === true,
      });
    } catch (error) {
      setOutcome({
        route: 'direct',
        tool: tool.name,
        text: error instanceof Error ? error.message : String(error),
        ms: Math.round(performance.now() - started),
        isError: true,
      });
    } finally {
      setRunning(false);
    }
  }, [tool, values]);

  return (
    <div className="live" data-testid="live-tools">
      <div className="live__tools" role="tablist" aria-label="Tools on this page">
        {REGISTRY_TOOLS.map((candidate) => (
          <button
            key={candidate.name}
            type="button"
            role="tab"
            aria-selected={candidate.name === selected}
            className={candidate.name === selected ? 'is-selected' : ''}
            onClick={() => choose(candidate.name)}
          >
            {candidate.name}
          </button>
        ))}
      </div>

      <div className="live__panel">
        <p className="live__desc">{tool.description}</p>

        <div className="live__form">
          {Object.entries(properties).map(([key, property]) => (
            <label key={key}>
              <span>{key}</span>
              {key === 'adapter' ? (
                <textarea
                  value={values[key] ?? ''}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                  rows={3}
                />
              ) : (
                <input
                  value={values[key] ?? ''}
                  placeholder={property.description ?? ''}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                />
              )}
            </label>
          ))}
          {Object.keys(properties).length === 0 && <p className="live__noargs">This tool takes no arguments.</p>}
        </div>

        <div className="live__run">
          <button type="button" className="getbutton getbutton--filled getbutton--large" onClick={run} disabled={running} data-action="run-tool">
            {running ? 'Running…' : `Run ${tool.name}`}
          </button>
          <span className="live__route">
            {supported === null
              ? ''
              : supported
                ? 'will run through document.modelContext'
                : 'your browser has no WebMCP — this will run the same function directly'}
          </span>
        </div>

        {outcome && (
          <div className="live__result" data-testid="live-result">
            <div className="live__resulthead">
              <span className={`live__badge live__badge--${outcome.route}`}>
                {outcome.route === 'webmcp' ? 'executed through WebMCP' : 'executed directly'}
              </span>
              <span>
                {outcome.tool} · {outcome.ms}ms
              </span>
            </div>
            <pre>{outcome.text}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
