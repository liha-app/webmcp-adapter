/**
 * DOM primitives for the step executor.
 *
 * The rule that matters here is FAIL CLOSED: if a selector does not resolve to
 * exactly one element, the tool call fails. It never falls back to "the first
 * match" or "something that looks similar", because a WRITE tool that guesses
 * which button to press is a browser-based malware primitive, not a feature.
 */

export type StepErrorCode =
  | 'selector-not-found'
  | 'selector-ambiguous'
  | 'invalid-selector'
  | 'sensitive-field'
  | 'not-actionable'
  | 'wrong-element'
  | 'timeout'
  | 'assertion-failed'
  | 'cross-origin'
  | 'denied'
  | 'unsupported-step';

export class StepError extends Error {
  constructor(
    message: string,
    readonly code: StepErrorCode,
  ) {
    super(message);
    this.name = 'StepError';
  }
}

export function countMatches(selector: string, root: ParentNode): number {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return -1;
  }
}

export function resolveExactlyOne(selector: string, root: ParentNode): Element {
  let matches: NodeListOf<Element>;
  try {
    matches = root.querySelectorAll(selector);
  } catch {
    throw new StepError(`invalid selector: ${selector}`, 'invalid-selector');
  }
  if (matches.length === 0) {
    throw new StepError(`selector "${selector}" matched 0 elements (expected exactly 1)`, 'selector-not-found');
  }
  if (matches.length > 1) {
    throw new StepError(
      `selector "${selector}" matched ${matches.length} elements (expected exactly 1)`,
      'selector-ambiguous',
    );
  }
  return matches[0] as Element;
}

const SENSITIVE_AUTOCOMPLETE = /^(cc-|new-password|current-password|one-time-code)/i;
const SENSITIVE_NAME = /(password|passwd|pwd|otp|cvv|cvc|card[-_]?number|ssn|secret|api[-_]?key|token)/i;

/**
 * Adapters may not type into, or read out of, credential and payment fields.
 * This is a hard block rather than a permission: an adapter that needs a
 * password is out of scope for this project by design.
 */
export function isSensitiveField(element: Element): boolean {
  const input = element as Partial<HTMLInputElement> & Element;
  const tag = element.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return false;
  if (tag === 'input' && (input.type ?? '').toLowerCase() === 'password') return true;
  const autocomplete = element.getAttribute('autocomplete') ?? '';
  if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) return true;
  const haystack = `${element.getAttribute('name') ?? ''} ${element.id} ${element.getAttribute('aria-label') ?? ''}`;
  return SENSITIVE_NAME.test(haystack);
}

function assertNotSensitive(element: Element, action: string): void {
  if (isSensitiveField(element)) {
    throw new StepError(`refusing to ${action} a credential or payment field`, 'sensitive-field');
  }
}

type Fillable = HTMLInputElement | HTMLTextAreaElement;

function isFillable(element: Element): element is Fillable {
  const tag = element.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea';
}

/**
 * Frameworks such as React track input values through the native value setter,
 * so assigning `element.value` directly leaves their state stale. Going through
 * the prototype setter and dispatching real events is what makes the app behave
 * exactly as if a person had typed.
 */
function setNativeValue(element: Element, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element) as object, 'value');
  if (descriptor?.set) descriptor.set.call(element, value);
  else (element as HTMLInputElement).value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillElement(element: Element, value: string): void {
  assertActionable(element, 'fill');
  if (!isFillable(element)) {
    throw new StepError(`element for fill is a <${element.tagName.toLowerCase()}>, not an input`, 'wrong-element');
  }
  assertNotSensitive(element, 'fill');
  setNativeValue(element, value);
}

export function selectOption(element: Element, value: string): void {
  assertActionable(element, 'select');
  if (element.tagName.toLowerCase() !== 'select') {
    throw new StepError(`element for select is a <${element.tagName.toLowerCase()}>, not a <select>`, 'wrong-element');
  }
  assertNotSensitive(element, 'set');
  const select = element as HTMLSelectElement;
  const options = [...select.options];
  const match =
    options.find((option) => option.value === value) ??
    options.find((option) => option.textContent?.trim() === value);
  if (!match) {
    throw new StepError(
      `<select> has no option matching "${value}" (options: ${options.map((o) => o.value).join(', ')})`,
      'assertion-failed',
    );
  }
  setNativeValue(select, match.value);
}

export function setChecked(element: Element, checked: boolean): void {
  assertActionable(element, 'set');
  const input = element as HTMLInputElement;
  const type = (input.type ?? '').toLowerCase();
  if (element.tagName.toLowerCase() !== 'input' || (type !== 'checkbox' && type !== 'radio')) {
    throw new StepError('element is not a checkbox or radio input', 'wrong-element');
  }
  if (input.checked === checked) return;
  input.click();
  if (input.checked !== checked) {
    throw new StepError(`could not set the control to ${checked ? 'checked' : 'unchecked'}`, 'assertion-failed');
  }
}

export function clickElement(element: Element): void {
  assertActionable(element, 'click');
  if (typeof (element as HTMLElement).click !== 'function') {
    throw new StepError('element is not clickable', 'wrong-element');
  }
  (element as HTMLElement).click();
}

export function submitForm(element: Element): void {
  assertActionable(element, 'submit');
  const form =
    element.tagName.toLowerCase() === 'form' ? (element as HTMLFormElement) : (element as HTMLElement).closest('form');
  if (!form) throw new StepError('no <form> found for submit step', 'wrong-element');
  // requestSubmit runs validation and fires submit handlers, exactly as a user
  // pressing the button would. form.submit() would skip both.
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/**
 * The text of an element — and for a form control, its value.
 *
 * `textContent` of a `<select>` is every option concatenated, which is never
 * what anyone means by "read this". The reading that matters for a control is
 * what it currently holds, so a select answers with its selected option's
 * label and an input or textarea with its value. Sensitive fields are refused
 * before any of that, the same as everywhere else.
 */
export function readElementText(element: Element): string {
  assertNotSensitive(element, 'read');
  const tag = element.tagName.toLowerCase();
  if (tag === 'select') {
    const select = element as HTMLSelectElement;
    const option = select.selectedOptions[0] ?? select.options[select.selectedIndex];
    return (option?.textContent ?? select.value).replace(/\s+/g, ' ').trim();
  }
  if (tag === 'input' || tag === 'textarea') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value.replace(/\s+/g, ' ').trim();
  }
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function readElementAttribute(element: Element, attribute: string): string {
  assertNotSensitive(element, 'read');
  if (/^(value)$/i.test(attribute) && isSensitiveField(element)) {
    throw new StepError('refusing to read a credential or payment field', 'sensitive-field');
  }
  return element.getAttribute(attribute) ?? '';
}

/**
 * Visibility as a person would judge it. Used by assertVisible and by
 * `waitFor` when a framework leaves elements mounted but hidden.
 */
export function isVisible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.hidden) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  /*
   * `checkVisibility` is the browser's own answer, and it knows about things
   * this function never will — content-visibility, a collapsed <details>, an
   * ancestor with `display: contents`. Its presence also tells us we are in a
   * browser that lays out, which is what makes the zero-size test below safe:
   * jsdom reports a zero box for everything, so applying it there would call
   * every element hidden.
   */
  const canCheck = typeof (html as { checkVisibility?: unknown }).checkVisibility === 'function';
  if (canCheck) {
    const visible = (html as unknown as { checkVisibility: (options?: unknown) => boolean }).checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
      contentVisibilityAuto: true,
    });
    if (!visible) return false;
    const rect = html.getBoundingClientRect();
    // A zero-sized box occupies nothing and can be clicked by nobody. It used
    // to pass, because the heuristic below reads a rect at the origin as "this
    // environment does not lay out".
    return rect.width > 0 && rect.height > 0;
  }

  const view = element.ownerDocument?.defaultView;
  if (view?.getComputedStyle) {
    const style = view.getComputedStyle(html);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  }
  if (typeof html.getBoundingClientRect === 'function') {
    const rect = html.getBoundingClientRect();
    const laysOut = rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0;
    if (laysOut) return rect.width > 0 && rect.height > 0;
  }
  return true;
}

/**
 * Refuses to act on something a person could not have acted on.
 *
 * A step that clicks an invisible button or fills a hidden input is not
 * driving the site's interface; it is reaching past it. The runtime's whole
 * claim is that it does what a person would do through the controls a person
 * can see, so the controls have to be ones a person can see.
 */
export function assertActionable(element: Element, action: string): void {
  if (!isVisible(element)) {
    throw new StepError(`refusing to ${action} an element that is not visible`, 'not-actionable');
  }
  const control = element as HTMLInputElement;
  if (control.disabled === true) {
    throw new StepError(`refusing to ${action} a disabled control`, 'not-actionable');
  }
  if (element.getAttribute('aria-disabled') === 'true') {
    throw new StepError(`refusing to ${action} a control marked aria-disabled`, 'not-actionable');
  }
  if ((element as HTMLInputElement).readOnly === true && action !== 'click') {
    throw new StepError(`refusing to ${action} a read-only field`, 'not-actionable');
  }
}
