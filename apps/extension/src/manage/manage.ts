import type { PopupState } from '@liha/shared';
import { ext } from '../platform';
import { el, renderAdapterCard, send } from '../ui/adapters';

/**
 * Every installed adapter, and the settings that belong to them.
 *
 * The popup answers one question — what applies to the page in front of you —
 * and used to answer it inside a list of everything else. This is where the
 * list went: not scoped to any page, so it shows origins and says nothing about
 * whether a tool is registered right now, which would be a fact about a tab
 * this page is not looking at.
 */
const app = document.getElementById('app');

const SOURCE_TITLE: Record<string, string> = {
  builtin: 'Shipped with the extension',
  installed: 'Installed from the Store',
  studio: 'Built in the Studio',
};

function render(state: PopupState): void {
  if (!app) return;
  app.replaceChildren();

  const total = state.catalog.length;
  const enabled = state.catalog.filter((entry) => entry.enabled).length;
  app.append(
    el('h1', {}, 'Adapters'),
    el(
      'p',
      { class: 'lede' },
      total === 0
        ? 'Nothing is installed yet.'
        : `${total} installed, ${enabled} enabled. Each one may only touch the origins listed under it.`,
    ),
  );

  const actions = el('div', { class: 'actions' });
  const studio = el('button', { class: 'btn', type: 'button' }, 'Open Studio');
  studio.addEventListener('click', () => void ext.tabs.create({ url: ext.runtime.getURL('studio/studio.html') }));
  const compat = el('button', { class: 'btn', type: 'button' }, 'Compatibility');
  compat.addEventListener('click', () =>
    void ext.tabs.create({ url: ext.runtime.getURL('diagnostics/diagnostics.html') }),
  );
  actions.append(studio, compat);
  app.append(actions);

  if (total === 0) {
    app.append(
      el(
        'div',
        { class: 'empty' },
        'Record a workflow from the popup, or install an adapter from the Store.',
      ),
    );
    return;
  }

  // Grouped by where each one came from, because that is what a reader is
  // deciding about: shipped, chosen from a catalogue, or written here.
  for (const source of ['builtin', 'installed', 'studio']) {
    const group = state.catalog.filter((entry) => entry.source === source);
    if (group.length === 0) continue;
    app.append(el('h2', {}, SOURCE_TITLE[source] ?? source));
    for (const entry of group) {
      app.append(renderAdapterCard(entry, { onChanged: load, showOrigins: true }));
    }
  }
}

function load(): void {
  void send<PopupState>({ type: 'liha/get-state' }).then(render);
}

load();
