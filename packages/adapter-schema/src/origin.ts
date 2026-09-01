/**
 * Origin scoping is the adapter security boundary. An adapter published for
 * `https://crm.example.com` must never execute on `https://evil.example.com`,
 * so matching is exact-origin only: no wildcards, no suffix matching, no
 * "startsWith" tricks that `https://crm.example.com.evil.test` could defeat.
 */

/**
 * `new URL()` alone is not enough to validate an origin. The URL parser happily
 * accepts `https://*.example.com` and reports it as its own origin, so a
 * wildcard would pass an `origin === value` check while never matching a real
 * page. Rather than let an adapter claim a scope it does not have, the hostname
 * is checked against what a real host can actually be.
 */
const DNS_HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const IPV6_HOSTNAME = /^\[[0-9a-f:.]+\]$/;

export function isExactOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Canonical form only: rejects paths, query strings, credentials, trailing
  // slashes, uppercase hosts and explicitly written default ports.
  if (url.origin !== value) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return DNS_HOSTNAME.test(url.hostname) || IPV6_HOSTNAME.test(url.hostname);
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function originsMatch(origins: readonly string[], origin: string | null): boolean {
  if (!origin) return false;
  return origins.includes(origin);
}

/**
 * Resolves a same-origin navigation target. Anything that would leave the
 * adapter's origin — an absolute URL, a protocol-relative `//host`, a
 * `javascript:` URL — resolves to null so the caller can fail closed.
 */
export function resolveSameOriginPath(path: string, origin: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  try {
    const resolved = new URL(path, origin);
    return resolved.origin === origin ? resolved.href : null;
  } catch {
    return null;
  }
}
