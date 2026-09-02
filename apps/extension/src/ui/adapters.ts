import type { Capability, HealthStatus } from '@liha/adapter-schema';
import type { InstalledAdapterStatus } from '@liha/adapter-runtime';
import type { CatalogEntry } from '@liha/shared';
import { ext } from '../platform';
import { t } from '../i18n';

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
  header.append(el('h3', {}, entry.adapter.name));

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
    row.append(el('div', { class: 'muted' }, tool.description));

    const status = el('div', { class: 'row row--meta' });
    // Registration is a fact about the open page. The listing is not looking at
    // one, so it says nothing rather than saying "not registered" about every
    // tool on every site the reader is not currently visiting.
    if (!showOrigins) {
      status.append(
        el(
          'span',
          { class: `status ${liveTool?.registered ? 'status--ok' : 'status--warn'}` },
          t(liveTool?.registered ? 'card.registered' : 'card.notRegistered'),
        ),
      );
    }
    if (health) status.append(healthBadge(health.status));
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
