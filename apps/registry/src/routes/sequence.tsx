import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * A tool call moving a page, recorded from the real thing.
 *
 * tools/marketing/record.mjs drives this with the extension loaded and the
 * calls going through the DevTools WebMCP domain, sampling the page on a fixed
 * cadence. The walnut top, the adjustable base and the filled bag are what
 * `choose_top`, `choose_base` and `add_to_bag` did to the store's own controls.
 *
 * The labels underneath light up as the recording passes each call, so it is
 * clear which frame belongs to which ask. They are driven by the video's own
 * clock rather than a timer, so they cannot drift out of step with it.
 */
const CALLS = [
  { name: 'choose_top', at: 0.9 },
  { name: 'choose_base', at: 2.4 },
  { name: 'add_to_bag', at: 3.9 },
] as const;

export function DriveSequence() {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [reached, setReached] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // The poster is the first frame; the outcome is in the labels.
      setStill(true);
      setReached(CALLS.length);
      return;
    }
    const onTime = () => {
      const passed = CALLS.filter((call) => element.currentTime >= call.at).length;
      setReached(passed);
    };
    element.addEventListener('timeupdate', onTime);
    // Plays only while it is on screen; a video nobody is looking at is a
    // decoder running for nothing.
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void element.play().catch(() => setStill(true));
        else element.pause();
      },
      { threshold: 0.3 },
    );
    watch.observe(element);
    return () => {
      element.removeEventListener('timeupdate', onTime);
      watch.disconnect();
    };
  }, []);

  return (
    <figure className="sequence" data-testid="drive-sequence">
      <video
        ref={video}
        className="sequence__video"
        width={1280}
        height={800}
        poster="/shots/drive-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={t('drive.alt')}
        data-still={still ? 'true' : 'false'}
      >
        <source src="/shots/drive.webm" type="video/webm" />
        <source src="/shots/drive.mp4" type="video/mp4" />
      </video>
      <figcaption className="sequence__calls">
        {CALLS.map((call, index) => (
          <span key={call.name} data-current={index < reached ? 'true' : 'false'}>
            {call.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
