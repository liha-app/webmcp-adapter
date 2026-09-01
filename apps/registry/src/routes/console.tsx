import type { Capability } from '@liha/adapter-schema';

/**
 * The hero's agent panel.
 *
 * This is the "this is an AI product" signal, and it is made of the real
 * artifact rather than decoration: the tools a page actually exposes, the call
 * an agent actually makes, and the steps the adapter actually runs. An
 * abstract orb would say less and mean nothing.
 */
interface ConsoleTool {
  name: string;
  capability: Capability;
  /** The one the agent picks, highlighted so the choice is visible. */
  active?: boolean;
}

const TOOLS: ConsoleTool[] = [
  { name: 'search_customers', capability: 'READ' },
  { name: 'create_customer', capability: 'WRITE', active: true },
  { name: 'update_customer', capability: 'WRITE' },
];

const STEPS = [
  'click  Add customer',
  'fill   name',
  'fill   email',
  'click  Create',
] as const;

export function AgentConsole() {
  let tick = 0;
  const delay = () => ({ animationDelay: `${(tick++ * 110) + 200}ms` });

  return (
    <div className="console" aria-label="An agent discovering and calling a tool on an ordinary website">
      <div className="console__bar">
        <span className="console__dot" />
        WebMCP agent · acme-crm.example
      </div>

      <div className="console__body">
        <p className="console__prompt" style={delay()}>
          <span className="console__caret">›</span> Create a customer named Alice Smith
        </p>

        <p className="console__label" style={delay()}>
          tools discovered on this page
        </p>
        <ul className="console__tools">
          {TOOLS.map((tool) => (
            <li key={tool.name} className={tool.active ? 'is-active' : ''} style={delay()}>
              <code>{tool.name}</code>
              <span className={`cap cap--${tool.capability}`}>{tool.capability}</span>
            </li>
          ))}
        </ul>

        <div className="console__call" style={delay()}>
          <code>
            create_customer(<span className="console__arg">name</span>: &quot;Alice Smith&quot;,{' '}
            <span className="console__arg">email</span>: &quot;alice@example.com&quot;)
          </code>
        </div>

        <ul className="console__steps">
          {STEPS.map((step) => (
            <li key={step} style={delay()}>
              {step}
            </li>
          ))}
          <li className="is-done" style={delay()}>
            customer c-1004 created
          </li>
        </ul>
      </div>

      <p className="console__foot">The site implements no WebMCP. An adapter added these tools.</p>
    </div>
  );
}
