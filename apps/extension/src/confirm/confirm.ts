import type { ConfirmationPayload } from '@liha/shared';
import { ext } from '../platform';

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
    el('h1', {}, `Allow ${request.toolName}?`),
    el('p', { class: 'lede' }, request.toolDescription),
    el(
      'div',
      { class: `banner banner--${request.capability}` },
      request.capability === 'DESTRUCTIVE'
        ? 'This tool deletes data. It always asks before running.'
        : 'This tool changes data on the site.',
    ),
  );

  const kv = el('dl');
  kv.append(el('dt', {}, 'Adapter'), el('dd', {}, `${request.adapterName} (${request.adapterId})`));
  kv.append(el('dt', {}, 'Site'), el('dd', {}, request.origin));
  kv.append(el('dt', {}, 'Capability'), el('dd', {}, request.capability));
  app.append(kv);

  if (request.preview.length > 0) {
    const panel = el('div', { class: 'panel' });
    panel.append(el('h2', {}, 'Values the agent supplied'));
    const values = el('div', { class: 'values' });
    for (const item of request.preview) values.append(el('div', {}, `${item.key}: ${item.value}`));
    panel.append(values);
    app.append(panel);
  }

  const actions = el('div', { class: 'actions' });
  const deny = el('button', { type: 'button' }, 'Deny');
  const allow = el('button', { type: 'button', class: request.capability === 'DESTRUCTIVE' ? 'danger' : 'primary' }, 'Allow once');
  deny.addEventListener('click', () => decide(false));
  allow.addEventListener('click', () => decide(true));
  actions.append(deny, allow);
  app.append(actions);
  app.append(
    el('p', { class: 'foot' }, 'These values are shown here only. They are never written to the extension log or storage.'),
  );
}

function renderInstall(payload: Extract<ConfirmationPayload, { kind: 'install' }>): void {
  if (!app) return;
  const request = payload.request;
  app.replaceChildren();
  app.append(
    el('h1', {}, `Install ${request.adapterName}?`),
    el(
      'p',
      { class: 'lede' },
      request.description ?? 'This adapter adds WebMCP tools to a site that does not implement WebMCP itself.',
    ),
    el(
      'div',
      { class: 'banner banner--install' },
      request.fromOrigin
        ? `Requested by ${request.fromOrigin}`
        : 'Requested from the Liha extension',
    ),
  );

  const kv = el('dl');
  kv.append(el('dt', {}, 'Adapter'), el('dd', {}, `${request.adapterId} v${request.version}`));
  kv.append(el('dt', {}, 'Runs on'), el('dd', {}, request.origins.join(', ')));
  kv.append(el('dt', {}, 'Source'), el('dd', {}, request.source));
  app.append(kv);

  const panel = el('div', { class: 'panel' });
  panel.append(el('h2', {}, `${request.tools.length} tool${request.tools.length === 1 ? '' : 's'}`));
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
        'Approving also grants this extension access to the origins listed above. Nothing outside them becomes reachable.',
      ),
    );
  }

  const actions = el('div', { class: 'actions' });
  const deny = el('button', { type: 'button' }, 'Cancel');
  const allow = el('button', { type: 'button', class: 'primary' }, 'Install');
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

void ext.runtime
  .sendMessage({ type: 'liha/get-confirmation', requestId })
  .then((response: { payload: ConfirmationPayload | null } | undefined) => {
    const payload = response?.payload;
    if (!payload) {
      if (app) app.replaceChildren(el('p', { class: 'muted' }, 'This request has already been answered.'));
      return;
    }
    if (payload.kind === 'tool') renderTool(payload);
    else renderInstall(payload);
  })
  .catch(() => {
    if (app) app.replaceChildren(el('p', { class: 'muted' }, 'Could not load this request.'));
  });
