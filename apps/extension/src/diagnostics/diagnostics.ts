import { diagnostics, ext } from '../platform';

/**
 * Compatibility diagnostics.
 *
 * The point of this page is to be honest about what this browser can and cannot
 * do. Where WebMCP or MAIN-world injection is missing, Liha says so plainly —
 * it does not install a home-made `modelContext` shim and call the browser
 * supported. A fake WebMCP would be worse than none: an agent would discover
 * tools that no agent runtime can actually reach.
 */
const app = document.getElementById('app');

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

function row(label: string, note: string, state: boolean | 'partial'): HTMLElement {
  const line = el('div', { class: 'row' });
  const text = el('div', { class: 'row__label' });
  text.append(label, el('span', { class: 'row__note' }, note));
  const value = state === 'partial' ? 'PARTIAL' : state ? 'YES' : 'NO';
  const cls = state === 'partial' ? 'partial' : state ? 'yes' : 'no';
  line.append(text, el('span', { class: `state state--${cls}` }, value));
  return line;
}

async function render(): Promise<void> {
  if (!app) return;
  const platform = diagnostics();

  // WebMCP itself lives on the page, not in the extension, so it is probed on a
  // real tab. An extension page is not a useful subject: this page would always
  // report "no WebMCP" about itself and mislead the reader.
  let webmcpOnPage: boolean | 'unknown' = 'unknown';
  let probedUrl: string | null = null;
  try {
    const tabs = await ext.tabs.query({});
    const web = tabs.filter((tab) => tab.url?.startsWith('http'));
    const target = web.find((tab) => tab.active) ?? web[0];
    if (target?.id !== undefined) {
      probedUrl = target.url ?? null;
      const [result] = await ext.scripting.executeScript({
        target: { tabId: target.id, frameIds: [0] },
        world: 'MAIN',
        func: () => typeof (document as Document & { modelContext?: unknown }).modelContext === 'object',
      });
      webmcpOnPage = result?.result === true;
    }
  } catch {
    webmcpOnPage = 'unknown';
  }

  const canRegisterTools = platform.mainWorldInjection && webmcpOnPage === true;

  app.replaceChildren();
  app.append(
    el('h1', {}, 'Compatibility'),
    el('p', { class: 'lede' }, `Detected browser engine: ${platform.engine}`),
  );

  const verdict = el('div', { class: `verdict verdict--${canRegisterTools ? 'ok' : 'limited'}` });
  if (canRegisterTools) {
    verdict.append(
      el('h3', {}, 'Fully supported'),
      el('p', {}, 'Adapters can register WebMCP tools on pages in this browser.'),
    );
  } else if (!platform.mainWorldInjection) {
    verdict.append(
      el('h3', {}, 'Adapter management only'),
      el(
        'p',
        {},
        'This browser cannot run extension code in a page’s MAIN world, which is the only place ' +
          'document.modelContext can be reached. You can install, inspect and manage adapters here, but no tools ' +
          'will be registered. Liha will not fake a WebMCP implementation to hide this.',
      ),
    );
  } else if (!platform.webmcpApi) {
    /*
     * Asked before "could not check a page", because it outranks it. This
     * browser has no WebMCP at all, and that is knowable from this page — so
     * saying "there is no open site to test against" would send the reader off
     * to open a tab that could not have helped.
     */
    verdict.append(
      el('h3', {}, 'WebMCP is not switched on'),
      el(
        'p',
        {},
        'Injection works, but this browser does not expose document.modelContext anywhere. ' +
          'In Chrome, enable chrome://flags/#enable-webmcp-testing and relaunch the browser.',
      ),
    );
  } else if (webmcpOnPage === 'unknown') {
    verdict.append(
      el('h3', {}, 'Could not check a page'),
      el(
        'p',
        {},
        'The browser has WebMCP and injection works, but there is no open site to test against, or this ' +
          'extension has no access to the open ones. Open a site an adapter targets and reload this page.',
      ),
    );
  } else {
    verdict.append(
      el('h3', {}, 'WebMCP is not on this page'),
      el(
        'p',
        {},
        `This browser has WebMCP, but ${probedUrl ?? 'the page checked'} does not expose ` +
          'document.modelContext. The API needs a secure context, so an http:// page will not have it.',
      ),
    );
  }
  app.append(verdict);

  const panel = el('div', { class: 'panel' });
  panel.append(el('h2', {}, 'Capabilities'));
  panel.append(row('Extension APIs', 'runtime, storage and messaging', platform.extensionApi));
  panel.append(row('Scripting API', 'required to inject the adapter runtime', platform.scriptingApi));
  panel.append(
    row(
      'MAIN world injection',
      'the only way an extension can reach document.modelContext',
      platform.mainWorldInjection,
    ),
  );
  panel.append(
    row(
      'WebMCP in this browser',
      'chrome://flags/#enable-webmcp-testing — needs no open page to answer',
      platform.webmcpApi,
    ),
  );
  panel.append(
    row(
      'WebMCP on an open page',
      webmcpOnPage === 'unknown'
        ? 'no reachable site was open to test against'
        : `document.modelContext on ${probedUrl ?? 'the checked page'}`,
      webmcpOnPage === 'unknown' ? 'partial' : webmcpOnPage,
    ),
  );
  panel.append(row('Dynamic content scripts', 'registering adapters for newly granted origins', platform.dynamicContentScripts));
  panel.append(row('Optional host permissions', 'asking for one origin at a time', platform.optionalHostPermissions));
  app.append(panel);

  app.append(
    el(
      'p',
      { class: 'muted' },
      'Chrome is the primary target. The Firefox build ships the same adapter management, storage and ' +
        'diagnostics; it registers tools as soon as Firefox supports MAIN-world injection and WebMCP.',
    ),
  );
}

void render();
