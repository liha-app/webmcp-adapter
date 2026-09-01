import type { Capability, HealthStatus } from '@liha/adapter-schema';
import type { CatalogEntry, PopupState } from '@liha/shared';
import { ext } from '../platform';
import { diagnostics } from '../platform';

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

function capabilityBadge(capability: Capability): HTMLElement {
  return el('span', { class: `cap cap--${capability}` }, capability);
}

const HEALTH_LABEL: Record<HealthStatus, string> = {
  healthy: 'healthy',
  degraded: 'degraded',
  broken: 'broken',
  unknown: 'not checked',
};

function healthBadge(status: HealthStatus): HTMLElement {
  return el('span', { class: `health health--${status}`, title: 'Selector probe against the current page' }, HEALTH_LABEL[status]);
}

function send<T>(message: unknown): Promise<T> {
  return ext.runtime.sendMessage(message) as Promise<T>;
}

function renderAdapterCard(entry: CatalogEntry, state: PopupState): HTMLElement {
  const card = el('div', { class: 'card' });

  const header = el('div', { class: 'row' });
  header.append(el('h3', {}, entry.adapter.name));

  const toggle = el('label', { class: 'switch' });
  const checkbox = el('input', { type: 'checkbox' }) as HTMLInputElement;
  checkbox.checked = entry.enabled;
  checkbox.addEventListener('change', () => {
    void send({ type: 'liha/set-enabled', adapterId: entry.adapter.id, enabled: checkbox.checked }).then(load);
  });
  toggle.append(checkbox, el('span', {}, entry.enabled ? 'Enabled' : 'Disabled'));
  header.append(toggle);
  card.append(header);

  const live = state.runtime?.adapters.find((installed) => installed.id === entry.adapter.id);
  const meta = el('div', { class: 'row row--meta' });
  meta.append(el('span', { class: 'muted' }, `v${entry.adapter.version} · ${entry.source}`));
  if (live?.health) meta.append(healthBadge(live.health.status));
  card.append(meta);

  card.append(el('div', { class: 'origins' }, entry.adapter.origins.join('  ')));
  if (!entry.matchesCurrentOrigin) {
    card.append(el('div', { class: 'muted' }, 'Not scoped to the current page'));
  }

  const hasWrite = entry.adapter.tools.some((tool) => tool.capability === 'WRITE');
  if (hasWrite) {
    const policy = el('label', { class: 'switch switch--small' });
    const policyBox = el('input', { type: 'checkbox' }) as HTMLInputElement;
    policyBox.checked = entry.policy.confirmWrite;
    policyBox.addEventListener('change', () => {
      void send({
        type: 'liha/set-policy',
        adapterId: entry.adapter.id,
        policy: { confirmWrite: policyBox.checked },
      }).then(load);
    });
    policy.append(policyBox, el('span', {}, 'Ask before every WRITE'));
    card.append(policy);
  }

  for (const tool of entry.adapter.tools) {
    const liveTool = live?.tools.find((candidate) => candidate.name === tool.name);
    const health = live?.health?.tools.find((candidate) => candidate.name === tool.name);
    const row = el('div', { class: 'tool' });
    const line = el('div', { class: 'row' });
    line.append(el('code', {}, tool.name), capabilityBadge(tool.capability));
    row.append(line);
    row.append(el('div', { class: 'muted' }, tool.description));
    const status = el('div', { class: 'row row--meta' });
    status.append(
      el(
        'span',
        { class: `status ${liveTool?.registered ? 'status--ok' : 'status--warn'}` },
        liveTool?.registered ? 'registered with WebMCP' : 'not registered on this page',
      ),
    );
    if (health) status.append(healthBadge(health.status));
    if (tool.capability === 'DESTRUCTIVE') {
      status.append(el('span', { class: 'muted' }, 'always confirmed'));
    }
    row.append(status);
    card.append(row);
  }

  if (entry.source !== 'builtin') {
    const remove = el('button', { class: 'btn btn--link', type: 'button' }, 'Remove adapter');
    remove.addEventListener('click', () => {
      void send({ type: 'liha/remove-adapter', adapterId: entry.adapter.id }).then(load);
    });
    card.append(remove);
  }
  return card;
}

function render(state: PopupState): void {
  if (!app) return;
  app.replaceChildren();

  const platform = diagnostics();
  const webmcp = state.runtime?.webmcp;
  const statusText =
    webmcp === 'available'
      ? 'available'
      : webmcp === 'unsupported'
        ? 'not available in this browser'
        : 'unknown (runtime not loaded on this page)';
  const statusClass = webmcp === 'available' ? 'status--ok' : webmcp === 'unsupported' ? 'status--err' : 'status--warn';

  const kv = el('dl', { class: 'kv' });
  kv.append(el('dt', {}, 'Page'), el('dd', {}, state.origin ?? '(no page)'));
  kv.append(el('dt', {}, 'WebMCP'), el('dd', { class: `status ${statusClass}` }, statusText));
  kv.append(el('dt', {}, 'Runtime'), el('dd', {}, state.runtime ? `v${state.runtime.runtimeVersion}` : '—'));
  app.append(kv);

  if (webmcp === 'unsupported' || !platform.mainWorldInjection) {
    const note = el('p', { class: 'notice' });
    note.append(
      !platform.mainWorldInjection
        ? `This browser (${platform.engine}) cannot inject into a page's MAIN world, which is how WebMCP tools are registered. Adapter management works; tools cannot be registered.`
        : 'This browser does not expose document.modelContext. Enable chrome://flags/#enable-webmcp-testing and reload.',
    );
    app.append(note);
  }

  const actions = el('div', { class: 'actions' });
  const recording = state.recording !== null;
  const record = el('button', { class: `btn ${recording ? 'btn--danger' : ''}`, type: 'button', 'data-action': 'toggle-recording' }, recording ? `Stop recording (${state.recording?.actions.length ?? 0})` : 'Record a tool');
  record.addEventListener('click', () => {
    void send({ type: recording ? 'liha/stop-recording' : 'liha/start-recording' }).then(() => {
      if (recording) window.close();
      else load();
    });
  });
  const studio = el('button', { class: 'btn', type: 'button' }, 'Studio');
  studio.addEventListener('click', () => {
    void ext.tabs.create({ url: ext.runtime.getURL('studio/studio.html') });
  });
  const compat = el('button', { class: 'btn', type: 'button' }, 'Compatibility');
  compat.addEventListener('click', () => {
    void ext.tabs.create({ url: ext.runtime.getURL('diagnostics/diagnostics.html') });
  });
  actions.append(record, studio, compat);
  app.append(actions);

  for (const entry of state.catalog) app.append(renderAdapterCard(entry, state));

  if (state.runtimeError) app.append(el('p', { class: 'muted' }, `Runtime probe: ${state.runtimeError}`));

  const log = state.runtime?.log ?? [];
  app.append(el('h4', {}, 'Execution log'));
  const logBox = el('div', { class: 'log' });
  if (log.length === 0) {
    logBox.append(el('div', { class: 'muted' }, 'No tool activity yet.'));
  } else {
    for (const entry of log) {
      const time = new Date(entry.at).toLocaleTimeString();
      logBox.append(
        el('div', entry.level === 'error' ? { class: 'err' } : {}, `${time}  ${entry.tool}  ${entry.message}`),
      );
    }
  }
  app.append(logBox);
  app.append(el('p', { class: 'muted' }, 'Values typed into the page are never written to this log.'));
}

function load(): void {
  void send<PopupState>({ type: 'liha/get-state' }).then(render);
}

load();
