import { displayText, type Capability, type HealthStatus } from '@liha/adapter-schema';
import type { InstalledAdapterStatus } from '@liha/adapter-runtime';
import type { CatalogEntry } from '@liha/shared';
import { ext } from '../platform';
import { currentLocale, t } from '../i18n';

/**
 * The adapter card, shared by the two places that show one.
 *
 * They ask different questions of the same object. The popup asks "what applies
 * to the page I am looking at, and is it working here", so it shows live
 * registration and hides origins — the answer to "which origins" is "this one,
 * or it would not be on screen". The Adapters page asks "what is installed and
 * what may it touch", so it shows origins and says nothing about registration,
 * which is a property of a page it is not looking at.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

export function send<T>(message: unknown): Promise<T> {
  return ext.runtime.sendMessage(message) as Promise<T>;
}

export function capabilityBadge(capability: Capability): HTMLElement {
  return el('span', { class: `cap cap--${capability}` }, capability);
}

export function healthBadge(status: HealthStatus): HTMLElement {
  return el(
    'span',
    { class: `health health--${status}`, title: t('card.healthTitle') },
    t(`health.${status}`),
  );
}

export interface CardOptions {
  /** What the runtime reports for this adapter on the open page, where there is one. */
  live?: InstalledAdapterStatus | undefined;
  /** Re-read state after a toggle, so the card reflects what was actually stored. */
  onChanged: () => void;
  /** Only the listing needs these: in the popup, the origin is the page you are on. */
  showOrigins: boolean;
}

export function renderAdapterCard(entry: CatalogEntry, options: CardOptions): HTMLElement {
  const { live, onChanged, showOrigins } = options;
  const card = el('div', { class: 'card' });

  const header = el('div', { class: 'row' });
  /*
   * The reader's language where the author wrote one. What an agent is handed
   * is untouched: `tool.description` is an instruction to a model, not a
   * caption, and it stays as its author wrote it.
   */
  const shown = (
    entity: { name?: string; description?: string; i18n?: Record<string, { name?: string; description?: string }> },
    field: 'name' | 'description',
  ) => displayText(entity, field, currentLocale()) ?? '';
  header.append(el('h3', {}, shown(entry.adapter, 'name')));

  const toggle = el('label', { class: 'switch' });
  // role="switch" rather than a bare checkbox: it is on/off state, not a choice
  // being ticked in a form, and that is what a screen reader should say too.
  const checkbox = el('input', { type: 'checkbox', role: 'switch' }) as HTMLInputElement;
  checkbox.checked = entry.enabled;
  checkbox.addEventListener('change', () => {
    void send({ type: 'liha/set-enabled', adapterId: entry.adapter.id, enabled: checkbox.checked }).then(onChanged);
  });
  toggle.append(checkbox, el('span', {}, t(entry.enabled ? 'card.enabled' : 'card.disabled')));
  header.append(toggle);
  card.append(header);

  const meta = el('div', { class: 'row row--meta' });
  meta.append(el('span', { class: 'muted' }, `v${entry.adapter.version} · ${entry.source}`));
  if (live?.health) meta.append(healthBadge(live.health.status));
  /*
   * Which page this verdict is about. Health changes from page to page — a tool
   * for a product page is not on a search page — and a badge with no page
   * attached invites the reader to take it as a fact about the adapter.
   */
  if (live?.health?.url) {
    const where = (() => {
      try {
        const url = new URL(live.health.url);
        return `${url.hostname}${url.pathname}`.replace(/\/$/, '') || url.hostname;
      } catch {
        return live.health.url;
      }
    })();
    meta.append(el('span', { class: 'muted' }, t('card.checkedOn', [where])));
  }
  card.append(meta);

  if (showOrigins) card.append(el('div', { class: 'origins' }, entry.adapter.origins.join('  ')));

  const hasWrite = entry.adapter.tools.some((tool) => tool.capability === 'WRITE');
  if (hasWrite) {
    const policy = el('label', { class: 'switch switch--small' });
    const policyBox = el('input', { type: 'checkbox', role: 'switch' }) as HTMLInputElement;
    policyBox.checked = entry.policy.confirmWrite;
    policyBox.addEventListener('change', () => {
      void send({
        type: 'liha/set-policy',
        adapterId: entry.adapter.id,
        policy: { confirmWrite: policyBox.checked },
      }).then(onChanged);
    });
    policy.append(policyBox, el('span', {}, t('card.confirmWrite')));
    card.append(policy);
  }

  for (const tool of entry.adapter.tools) {
    const liveTool = live?.tools.find((candidate) => candidate.name === tool.name);
    const health = live?.health?.tools.find((candidate) => candidate.name === tool.name);
    const row = el('div', { class: 'tool' });
    const line = el('div', { class: 'row' });
    line.append(el('code', {}, tool.name), capabilityBadge(tool.capability));
    row.append(line);
    row.append(el('div', { class: 'muted' }, shown(tool, 'description')));

    const status = el('div', { class: 'row row--meta' });
    /*
     * A tool that is doing its job says nothing.
     *
     * Registration is a fact about the open page, so the listing — which is not
     * looking at one — says nothing rather than reporting "not registered"
     * about every tool on every site the reader is not currently visiting. And
     * where it is looking at one, only disagreement is worth a line: every tool
     * carrying "registered" and "healthy" made a wall of green down the popup,
     * and the one tool that had failed had nothing to stand out against. The
     * adapter's own badge already says the adapter is live.
     */
    if (!showOrigins && !liveTool?.registered) {
      status.append(el('span', { class: 'status status--warn' }, t('card.notRegistered')));
    }
    if (health && health.status !== 'healthy') status.append(healthBadge(health.status));
    if (tool.capability === 'DESTRUCTIVE') status.append(el('span', { class: 'muted' }, t('card.alwaysConfirmed')));
    if (status.childElementCount > 0) row.append(status);
    card.append(row);
  }

  if (entry.source !== 'builtin') {
    const remove = el('button', { class: 'btn btn--link', type: 'button' }, t('card.remove'));
    remove.addEventListener('click', () => {
      void send({ type: 'liha/remove-adapter', adapterId: entry.adapter.id }).then(onChanged);
    });
    card.append(remove);
  }
  return card;
}
