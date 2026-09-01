/**
 * The flow diagrams.
 *
 * Plain bordered boxes and arrows rather than an illustration: the shape of the
 * pipeline is the argument, and a reader should be able to follow it in a couple
 * of seconds without decoding a graphic.
 */
export function Flow({
  steps,
  tone = 'default',
  animate = false,
}: {
  steps: Array<{ label: string; detail?: string; strong?: boolean }>;
  tone?: 'default' | 'muted';
  animate?: boolean;
}) {
  return (
    <ol className={`flow flow--${tone}`} aria-label="Pipeline">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`flow__node ${step.strong ? 'flow__node--strong' : ''} ${animate ? 'flow__node--in' : ''}`}
          style={animate ? { animationDelay: `${index * 90}ms` } : undefined}
        >
          <span className="flow__label">{step.label}</span>
          {step.detail && <span className="flow__detail">{step.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
