/**
 * Things jsdom does not implement, made quiet.
 *
 * jsdom has no layout, so `window.scrollTo` exists only to log
 * "Error: Not implemented: window.scrollTo" through its virtual console. The
 * demo shop calls it on every route change, which is correct behaviour for a
 * site — a new page starts at the top of itself — and it filled the test run
 * with a stack trace per navigation until a real failure was hard to find.
 *
 * This replaces the reporter, not the behaviour: the app still calls scrollTo
 * on exactly the same paths, and nothing here is visible to production code.
 */
if (typeof window !== 'undefined') {
  const noop = () => undefined;
  Object.defineProperty(window, 'scrollTo', { value: noop, writable: true, configurable: true });
  Object.defineProperty(window, 'scroll', { value: noop, writable: true, configurable: true });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: noop, writable: true, configurable: true });
}
