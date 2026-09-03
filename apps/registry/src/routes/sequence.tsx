import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * The same page, three times, with a real tool call between each.
 *
 * The frames are screenshots taken by tools/marketing/capture.mjs: a browser
 * with the extension in it, the shop adapter registered, and the calls made
 * through the DevTools WebMCP domain. Nothing was posed — the walnut top, the
 * adjustable base and the bag are what `choose_top`, `choose_base` and
 * `add_to_bag` did to the store's own controls.
 *
 * It advances on a timer and stops when it is off-screen or the visitor has
 * asked for less motion, in which case it holds the last frame: the point is
 * the outcome, and a still of the finished bag still makes it.
 */
const FRAMES = [
  { src: '/shots/drive-1.jpg', call: 'choose_top' },
  { src: '/shots/drive-2.jpg', call: 'choose_base' },
  { src: '/shots/drive-3.jpg', call: 'add_to_bag' },
] as const;

const HOLD_MS = 2200;

export function DriveSequence() {
  const { t } = useI18n();
  const [frame, setFrame] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFrame(FRAMES.length - 1);
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => setFrame((current) => (current + 1) % FRAMES.length), HOLD_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const watch = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : stop()), {
      threshold: 0.25,
    });
    if (box.current) watch.observe(box.current);
    return () => {
      stop();
      watch.disconnect();
    };
  }, []);

  return (
    <figure className="sequence" ref={box} data-testid="drive-sequence">
      <div className="sequence__stage">
        {FRAMES.map((entry, index) => (
          <img
            key={entry.src}
            className="sequence__frame"
            src={entry.src}
            width={1280}
            height={800}
            alt={t('drive.alt')}
            loading="lazy"
            data-current={index === frame ? 'true' : 'false'}
          />
        ))}
      </div>
      <figcaption className="sequence__calls">
        {FRAMES.map((entry, index) => (
          <span key={entry.call} data-current={index === frame ? 'true' : 'false'}>
            {entry.call}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
