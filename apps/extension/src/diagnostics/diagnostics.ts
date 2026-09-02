import { diagnostics, ext } from '../platform';
import { applyDocumentLanguage, loadLocale, t } from '../i18n';

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
  const value = t(state === 'partial' ? 'diag.partial' : state ? 'diag.yes' : 'diag.no');
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
    el('h1', {}, t('diag.title')),
    el('p', { class: 'lede' }, t('diag.engine', [platform.engine])),
  );

  const verdict = el('div', { class: `verdict verdict--${canRegisterTools ? 'ok' : 'limited'}` });
  if (canRegisterTools) {
    verdict.append(
      el('h3', {}, t('diag.fully')),
      el('p', {}, t('diag.fullyBody')),
    );
  } else if (!platform.mainWorldInjection) {
    verdict.append(
      el('h3', {}, t('diag.managementOnly')),
      el('p', {}, t('diag.managementOnlyBody')),
    );
  } else if (!platform.webmcpApi) {
    /*
     * Asked before "could not check a page", because it outranks it. This
     * browser has no WebMCP at all, and that is knowable from this page — so
     * saying "there is no open site to test against" would send the reader off
     * to open a tab that could not have helped.
     */
    verdict.append(
      el('h3', {}, t('diag.notSwitchedOn')),
      el('p', {}, t('diag.notSwitchedOnBody')),
    );
  } else if (webmcpOnPage === 'unknown') {
    verdict.append(
      el('h3', {}, t('diag.couldNotCheck')),
      el('p', {}, t('diag.couldNotCheckBody')),
    );
  } else {
    verdict.append(
      el('h3', {}, t('diag.notOnPage')),
      el('p', {}, t('diag.notOnPageBody', [probedUrl ?? t('diag.webmcpPageChecked')])),
    );
  }
  app.append(verdict);

  const panel = el('div', { class: 'panel' });
  panel.append(el('h2', {}, t('diag.capabilities')));
  panel.append(row(t('diag.extensionApi'), t('diag.extensionApiNote'), platform.extensionApi));
  panel.append(row(t('diag.scriptingApi'), t('diag.scriptingApiNote'), platform.scriptingApi));
  panel.append(row(t('diag.mainWorld'), t('diag.mainWorldNote'), platform.mainWorldInjection));
  panel.append(row(t('diag.webmcpBrowser'), t('diag.webmcpBrowserNote'), platform.webmcpApi));
  panel.append(
    row(
      t('diag.webmcpPage'),
      webmcpOnPage === 'unknown'
        ? t('diag.webmcpPageNone')
        : t('diag.webmcpPageOn', [probedUrl ?? t('diag.webmcpPageChecked')]),
      webmcpOnPage === 'unknown' ? 'partial' : webmcpOnPage,
    ),
  );
  panel.append(row(t('diag.dynamicScripts'), t('diag.dynamicScriptsNote'), platform.dynamicContentScripts));
  panel.append(row(t('diag.optionalPermissions'), t('diag.optionalPermissionsNote'), platform.optionalHostPermissions));
  app.append(panel);

  app.append(el('p', { class: 'muted' }, t('diag.footer')));
}

void loadLocale().then(applyDocumentLanguage).then(render);
