import { beforeEach, describe, expect, it } from 'vitest';
import type { StepError } from './dom';
import {
  clickElement,
  fillElement,
  isSensitiveField,
  readElementAttribute,
  readElementText,
  resolveExactlyOne,
  selectOption,
  setChecked,
  submitForm,
} from './dom';

const setBody = (html: string) => {
  document.body.innerHTML = html;
};
const one = <T extends Element>(selector: string) => document.querySelector(selector) as T;

beforeEach(() => setBody(''));

describe('resolveExactlyOne', () => {
  it('returns the single match', () => {
    setBody('<button data-action="go">Go</button>');
    expect(resolveExactlyOne('[data-action="go"]', document).textContent).toBe('Go');
  });

  it('fails closed when nothing matches', () => {
    try {
      resolveExactlyOne('[data-action="go"]', document);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as StepError).code).toBe('selector-not-found');
    }
  });

  // The dangerous case: never pick one of several candidates for a WRITE step.
  it('fails closed when the selector is ambiguous', () => {
    setBody('<button class="b">A</button><button class="b">B</button><button class="b">C</button>');
    try {
      resolveExactlyOne('.b', document);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as StepError).code).toBe('selector-ambiguous');
      expect((error as StepError).message).toContain('matched 3 elements');
    }
  });

  it('fails closed on a malformed selector', () => {
    expect(() => resolveExactlyOne(':::', document)).toThrow(/invalid selector/);
  });
});

describe('sensitive field protection', () => {
  it.each([
    '<input type="password" name="p">',
    '<input name="password">',
    '<input name="card_number">',
    '<input name="cvv">',
    '<input name="user_api_key">',
    '<input autocomplete="cc-number" name="x">',
    '<input autocomplete="current-password" name="x">',
    '<input name="x" aria-label="One time code (otp)">',
  ])('flags %s as sensitive', (html) => {
    setBody(html);
    expect(isSensitiveField(one('input'))).toBe(true);
  });

  it('does not flag ordinary fields', () => {
    setBody('<input name="email"><input name="full_name"><textarea name="notes"></textarea>');
    for (const field of document.querySelectorAll('input, textarea')) {
      expect(isSensitiveField(field)).toBe(false);
    }
  });

  it('refuses to type into a credential field', () => {
    setBody('<input type="password" name="p">');
    expect(() => fillElement(one('input'), 'hunter2')).toThrow(/credential or payment/);
    expect(one<HTMLInputElement>('input').value).toBe('');
  });

  it('refuses to read a credential field, by text or by attribute', () => {
    setBody('<input name="password" value="hunter2">');
    expect(() => readElementText(one('input'))).toThrow(/credential or payment/);
    expect(() => readElementAttribute(one('input'), 'value')).toThrow(/credential or payment/);
  });
});

describe('fillElement', () => {
  it('sets the value and dispatches input and change events', () => {
    setBody('<input name="name">');
    const input = one<HTMLInputElement>('input');
    const seen: string[] = [];
    input.addEventListener('input', () => seen.push('input'));
    input.addEventListener('change', () => seen.push('change'));
    fillElement(input, 'Alice');
    expect(input.value).toBe('Alice');
    expect(seen).toEqual(['input', 'change']);
  });

  it('refuses elements that are not inputs', () => {
    setBody('<div id="d"></div>');
    expect(() => fillElement(one('#d'), 'x')).toThrow(/not an input/);
  });
});

describe('selectOption', () => {
  beforeEach(() => setBody('<select name="s"><option value="a">Alpha</option><option value="b">Beta</option></select>'));

  it('selects by value', () => {
    selectOption(one('select'), 'b');
    expect(one<HTMLSelectElement>('select').value).toBe('b');
  });

  it('selects by visible label when no value matches', () => {
    selectOption(one('select'), 'Alpha');
    expect(one<HTMLSelectElement>('select').value).toBe('a');
  });

  it('fails when no option matches rather than picking one', () => {
    expect(() => selectOption(one('select'), 'Gamma')).toThrow(/no option matching/);
    expect(one<HTMLSelectElement>('select').value).toBe('a');
  });

  it('refuses elements that are not a select', () => {
    setBody('<input name="s">');
    expect(() => selectOption(one('input'), 'a')).toThrow(/not a <select>/);
  });
});

describe('setChecked', () => {
  it('checks and unchecks a checkbox', () => {
    setBody('<input type="checkbox">');
    const box = one<HTMLInputElement>('input');
    setChecked(box, true);
    expect(box.checked).toBe(true);
    setChecked(box, false);
    expect(box.checked).toBe(false);
  });

  it('is a no-op when already in the requested state', () => {
    setBody('<input type="checkbox" checked>');
    const box = one<HTMLInputElement>('input');
    let clicks = 0;
    box.addEventListener('click', () => clicks++);
    setChecked(box, true);
    expect(clicks).toBe(0);
  });

  it('refuses elements that are not checkboxes', () => {
    setBody('<input type="text">');
    expect(() => setChecked(one('input'), true)).toThrow(/not a checkbox/);
  });
});

describe('submitForm', () => {
  it('submits the form a control belongs to', () => {
    setBody('<form id="f"><button type="submit">Go</button></form>');
    let submitted = false;
    one('#f').addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    submitForm(one('button'));
    expect(submitted).toBe(true);
  });

  it('fails when there is no form', () => {
    setBody('<button>Go</button>');
    expect(() => submitForm(one('button'))).toThrow(/no <form>/);
  });
});

describe('readElementText on a form control', () => {
  it('answers with the selected option, not every option', () => {
    // textContent of a <select> is the whole list concatenated, which is never
    // what "read this" means. A configurator reading its own choice back got
    // "Nimbus 3Nimbus 3 ProNimbus 3 Max" before this.
    document.body.innerHTML = `<select><option value="a">Nimbus 3</option><option value="b" selected>Nimbus 3 Pro</option></select>`;
    expect(readElementText(one('select'))).toBe('Nimbus 3 Pro');
  });

  it('answers with an input’s value rather than its empty text', () => {
    document.body.innerHTML = `<input value="cable" />`;
    expect(readElementText(one('input'))).toBe('cable');
  });

  it('still refuses a credential field', () => {
    document.body.innerHTML = `<input type="password" value="hunter2" />`;
    expect(() => readElementText(one('input'))).toThrow(/credential or payment/);
  });
});

describe('clickElement and readElementText', () => {
  it('clicks and reads collapsed text', () => {
    setBody('<div id="d">  Alice   Smith\n</div>');
    let clicked = false;
    one('#d').addEventListener('click', () => (clicked = true));
    clickElement(one('#d'));
    expect(clicked).toBe(true);
    expect(readElementText(one('#d'))).toBe('Alice Smith');
  });
});

describe('acting only on controls a person could act on', () => {
  /*
   * A step that clicks an invisible button or fills a hidden input is not
   * driving the site's interface, it is reaching past it — and the runtime's
   * whole claim is that it does what a person would do through the controls a
   * person can see.
   */
  it('refuses a hidden button', () => {
    document.body.innerHTML = `<button id="b" style="display:none">Delete</button>`;
    expect(() => clickElement(one('#b'))).toThrow(/not visible/);
  });

  it('refuses an aria-hidden control', () => {
    document.body.innerHTML = `<button id="b" aria-hidden="true">Delete</button>`;
    expect(() => clickElement(one('#b'))).toThrow(/not visible/);
  });

  it('refuses a disabled control, and one that only says it is', () => {
    document.body.innerHTML = `<button id="a" disabled>Go</button><button id="b" aria-disabled="true">Go</button>`;
    expect(() => clickElement(one('#a'))).toThrow(/disabled/);
    expect(() => clickElement(one('#b'))).toThrow(/aria-disabled/);
  });

  it('refuses to fill a hidden or read-only field', () => {
    document.body.innerHTML = `<input id="a" type="hidden"><input id="b" readonly>`;
    expect(() => fillElement(one('#a'), 'x')).toThrow();
    expect(() => fillElement(one('#b'), 'x')).toThrow(/read-only/);
  });

  it('still acts on an ordinary control', () => {
    document.body.innerHTML = `<button id="b">Go</button><input id="i">`;
    expect(() => clickElement(one('#b'))).not.toThrow();
    expect(() => fillElement(one('#i'), 'x')).not.toThrow();
  });
});
