import { describe, expect, it } from 'vitest';
import { isExactOrigin, originOf, originsMatch, resolveSameOriginPath } from './origin';

describe('isExactOrigin', () => {
  it.each(['https://crm.example.com', 'http://localhost:5273', 'http://127.0.0.1:5273', 'https://a.b.c.example.com'])(
    'accepts %s',
    (origin) => {
      expect(isExactOrigin(origin)).toBe(true);
    },
  );

  // `new URL()` accepts a wildcard hostname and reports it as its own origin, so
  // an origin check built on that alone lets an adapter claim a scope it can
  // never actually match.
  it.each([
    'https://*.example.com',
    'https://*',
    'https://crm.example.com/app',
    'https://crm.example.com/',
    'https://crm.example.com?a=1',
    'https://user:pass@crm.example.com',
    'https://CRM.example.com',
    'https://crm.example.com:443',
    'file:///etc/passwd',
    'chrome-extension://abcdefghijklmnop',
    '*://*/*',
    'not a url',
    '',
  ])('rejects %s', (origin) => {
    expect(isExactOrigin(origin)).toBe(false);
  });
});

describe('originsMatch', () => {
  const origins = ['https://crm.example.com'];

  it('matches only the exact origin', () => {
    expect(originsMatch(origins, 'https://crm.example.com')).toBe(true);
  });

  // Each of these is a real-world way an attacker tries to look like the target.
  it.each([
    'https://evil.example.com',
    'https://crm.example.com.evil.test',
    'http://crm.example.com',
    'https://crm.example.com:8443',
    'https://sub.crm.example.com',
    null,
  ])('refuses %s', (origin) => {
    expect(originsMatch(origins, origin)).toBe(false);
  });
});

describe('originOf', () => {
  it('extracts the origin from a url', () => {
    expect(originOf('https://crm.example.com/customers?q=1')).toBe('https://crm.example.com');
    expect(originOf('not-a-url')).toBeNull();
  });
});

describe('resolveSameOriginPath', () => {
  const origin = 'https://crm.example.com';

  it('resolves a same-origin path', () => {
    expect(resolveSameOriginPath('/cart', origin)).toBe('https://crm.example.com/cart');
    expect(resolveSameOriginPath('/a/b?x=1', origin)).toBe('https://crm.example.com/a/b?x=1');
  });

  // A navigate step must never be able to carry the user off the origin they
  // approved, whatever the adapter (or a tool argument) asks for.
  it.each([
    'https://evil.test/steal',
    '//evil.test/steal',
    // eslint-disable-next-line no-script-url -- this is the fixture under test
    'javascript:alert(1)',
    'data:text/html,<script>1</script>',
    'cart',
    '',
  ])('refuses to leave the origin for %s', (path) => {
    expect(resolveSameOriginPath(path, origin)).toBeNull();
  });
});
