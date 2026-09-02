import type { ConfirmationPayload } from '@liha/shared';
import { ext } from '../platform';
import { applyDocumentLanguage, loadLocale, t } from '../i18n';

const app = document.getElementById('app');
const requestId = new URLSearchParams(location.search).get('id') ?? '';

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

function decide(approved: boolean): void {
  void ext.runtime
    .sendMessage({ type: 'liha/confirm-decision', requestId, approved })
    .catch(() => undefined)
    .then(() => window.close());
}

/**
 * Closing the window is a denial, and the service worker treats it as one. This
 * only covers the case where the page is dismissed some other way.
 */
window.addEventListener('beforeunload', () => {
  void ext.runtime.sendMessage({ type: 'liha/confirm-decision', requestId, approved: false }).catch(() => undefined);
});

function renderTool(payload: Extract<ConfirmationPayload, { kind: 'tool' }>): void {
  if (!app) return;
  const request = payload.request;
  app.replaceChildren();
  app.append(
    el('h1', {}, t('confirm.allowTool', [request.toolName])),
    el('p', { class: 'lede' }, request.toolDescription),
    el(
      'div',
      { class: `banner banner--${request.capability}` },
      t(request.capability === 'DESTRUCTIVE' ? 'confirm.destructive' : 'confirm.changesData'),
    ),
  );

  const kv = el('dl');
  kv.append(el('dt', {}, t('confirm.adapter')), el('dd', {}, `${request.adapterName} (${request.adapterId})`));
  kv.append(el('dt', {}, t('confirm.site')), el('dd', {}, request.origin));
  kv.append(el('dt', {}, t('confirm.capability')), el('dd', {}, request.capability));
  app.append(kv);

  if (request.preview.length > 0) {
    const panel = el('div', { class: 'panel' });
    panel.append(el('h2', {}, t('confirm.values')));
    const values = el('div', { class: 'values' });
    for (const item of request.preview) values.append(el('div', {}, `${item.key}: ${item.value}`));
    panel.append(values);
    app.append(panel);
  }

  const actions = el('div', { class: 'actions' });
  const deny = el('button', { type: 'button', 'data-decision': 'deny' }, t('confirm.deny'));
  const allow = el('button', { type: 'button', class: request.capability === 'DESTRUCTIVE' ? 'danger' : 'primary', 'data-decision': 'allow' }, t('confirm.allowOnce'));
  deny.addEventListener('click', () => decide(false));
  allow.addEventListener('click', () => decide(true));
  actions.append(deny, allow);
  app.append(actions);
  app.append(
    el('p', { class: 'foot' }, t('confirm.valuesNote')),
  );
}

function renderInstall(payload: Extract<ConfirmationPayload, { kind: 'install' }>): void {
  if (!app) return;
  const request = payload.request;
  app.replaceChildren();
  app.append(
    el('h1', {}, t('confirm.installTitle', [request.adapterName])),
    el(
      'p',
      { class: 'lede' },
      request.description ?? t('confirm.installLede'),
    ),
    el(
      'div',
      { class: 'banner banner--install' },
      request.fromOrigin ? t('confirm.requestedBy', [request.fromOrigin]) : t('confirm.requestedInternally'),
    ),
  );

  const kv = el('dl');
  kv.append(el('dt', {}, t('confirm.adapter')), el('dd', {}, `${request.adapterId} v${request.version}`));
  kv.append(el('dt', {}, t('confirm.runsOn')), el('dd', {}, request.origins.join(', ')));
  kv.append(el('dt', {}, t('confirm.source')), el('dd', {}, request.source));
  app.append(kv);

  const panel = el('div', { class: 'panel' });
  panel.append(
    el('h2', {}, t(request.tools.length === 1 ? 'confirm.toolCountOne' : 'confirm.toolCountMany', [request.tools.length])),
  );
  for (const tool of request.tools) {
    const item = el('div', { class: 'item' });
    item.append(el('code', {}, tool.name), el('span', { class: `cap cap--${tool.capability}` }, tool.capability));
    item.append(el('div', { class: 'muted' }, tool.description));
    panel.append(item);
  }
  app.append(panel);

  if (request.needsHostPermission) {
    app.append(
      el(
        'p',
        { class: 'foot' },
        t('confirm.hostPermission'),
      ),
    );
  }

  const actions = el('div', { class: 'actions' });
  const deny = el('button', { type: 'button', 'data-decision': 'deny' }, t('confirm.cancel'));
  const allow = el('button', { type: 'button', class: 'primary', 'data-decision': 'allow' }, t('confirm.install'));
  deny.addEventListener('click', () => decide(false));
  allow.addEventListener('click', () => {
    if (!request.needsHostPermission) {
      decide(true);
      return;
    }
    // Host access is requested from this click so the browser accepts it as a
    // user gesture; a refusal here means the adapter is not installed.
    void ext.permissions
      .request({ origins: request.origins.map((origin) => `${origin}/*`) })
      .then((granted) => decide(granted === true))
      .catch(() => decide(false));
  });
  actions.append(deny, allow);
  app.append(actions);
}

// The language is settled before anything is drawn: this window is the one
// screen where a misread sentence has consequences.
void loadLocale()
  .then(applyDocumentLanguage)
  .then(() => ext.runtime.sendMessage({ type: 'liha/get-confirmation', requestId }))
  .then((response: { payload: ConfirmationPayload | null } | undefined) => {
    const payload = response?.payload;
    if (!payload) {
      if (app) app.replaceChildren(el('p', { class: 'muted' }, t('confirm.answered')));
      return;
    }
    if (payload.kind === 'tool') renderTool(payload);
    else renderInstall(payload);
  })
  .catch(() => {
    if (app) app.replaceChildren(el('p', { class: 'muted' }, t('confirm.loadFailed')));
  });
