/**
 * "Liha is recording", on the page being recorded.
 *
 * The popup closes the moment you click back into the page, which is the same
 * moment you start demonstrating the workflow — so for the whole of the part
 * that matters there was nothing on screen saying anything was being captured.
 * People stopped trusting it and pressed Record twice.
 *
 * Three constraints shape what this is:
 *
 *  - It must not become part of the recording. It lives in a closed shadow root
 *    on a host element the recorder ignores, so clicking Stop is not captured
 *    as a step, and the page's own CSS cannot reach in and reshape it.
 *  - It must not sit on top of the thing being demonstrated. Bottom left, small,
 *    and it takes pointer events only on itself.
 *  - It must leave. Recording ends and the host element is removed, including
 *    when the page is torn down mid-take.
 *
 * The count comes from the service worker rather than from counting locally:
 * pressing a form's submit button raises two events that are one action, and a
 * badge that said 5 while the Studio said 4 would be its own bug report.
 */
const HOST_ID = 'liha-recording-indicator';

const STYLE = `
  :host { all: initial; }
  .bar {
    position: fixed;
    bottom: 16px;
    left: 16px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px 7px 12px;
    border-radius: 999px;
    background: rgba(28, 28, 30, 0.92);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
    color: #f5f5f7;
    font: 500 12px/1 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
    letter-spacing: -0.006em;
    user-select: none;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff453a;
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none } }
  .count { font-variant-numeric: tabular-nums; opacity: 0.7; }
  button {
    appearance: none;
    border: 0;
    border-radius: 999px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.16);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:hover { background: rgba(255, 255, 255, 0.26); }
`;

export interface Indicator {
  show(label: string, stopLabel: string, onStop: () => void): void;
  count(value: number): void;
  hide(): void;
}

export function createIndicator(): Indicator {
  let host: HTMLElement | null = null;
  let counter: HTMLElement | null = null;

  const hide = () => {
    host?.remove();
    host = null;
    counter = null;
  };

  return {
    show(label, stopLabel, onStop) {
      if (host) return;
      host = document.createElement('div');
      host.id = HOST_ID;
      // Recorded steps are built from what a person clicked on the page. This
      // is not part of the page, and `data-liha-ui` is what tells the recorder
      // to look straight through it.
      host.setAttribute('data-liha-ui', 'recording');
      const shadow = host.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      style.textContent = STYLE;
      const bar = document.createElement('div');
      bar.className = 'bar';
      const dot = document.createElement('span');
      dot.className = 'dot';
      const text = document.createElement('span');
      text.textContent = label;
      counter = document.createElement('span');
      counter.className = 'count';
      counter.textContent = '0';
      const stop = document.createElement('button');
      stop.type = 'button';
      stop.textContent = stopLabel;
      stop.addEventListener('click', (event) => {
        event.stopPropagation();
        onStop();
      });
      bar.append(dot, text, counter, stop);
      shadow.append(style, bar);
      (document.body ?? document.documentElement).append(host);
    },
    count(value) {
      if (counter) counter.textContent = String(value);
    },
    hide,
  };
}
