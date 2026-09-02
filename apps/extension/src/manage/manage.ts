import type { PopupState } from '@liha/shared';
import { ext } from '../platform';
import { applyDocumentLanguage, currentLocale, LOCALE_LABEL, LOCALES, loadLocale, setLocale, t, type Locale } from '../i18n';
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

const SOURCE_TITLE: Record<string, () => string> = {
  builtin: () => t('manage.sourceBuiltin'),
  installed: () => t('manage.sourceInstalled'),
  studio: () => t('manage.sourceStudio'),
};

/**
 * The language control lives here rather than in the popup: it is a setting,
 * and the popup is now only about the page in front of you.
 */
function languageSetting(): HTMLElement {
  const box = el('div', { class: 'setting' });
  const label = el('label', { class: 'setting__label', for: 'locale' }, t('manage.language'));
  const select = el('select', { id: 'locale', class: 'select' }) as HTMLSelectElement;
  for (const locale of LOCALES) {
    const option = el('option', { value: locale }, LOCALE_LABEL[locale]) as HTMLOptionElement;
    option.selected = locale === currentLocale();
    select.append(option);
  }
  select.addEventListener('change', () => {
    void setLocale(select.value as Locale).then(() => {
      applyDocumentLanguage();
      load();
    });
  });
  box.append(label, select, el('p', { class: 'setting__note muted' }, t('manage.languageNote')));
  return box;
}

function render(state: PopupState): void {
  if (!app) return;
  app.replaceChildren();

  const total = state.catalog.length;
  const enabled = state.catalog.filter((entry) => entry.enabled).length;
  app.append(
    el('h1', {}, t('manage.title')),
    el('p', { class: 'lede' }, total === 0 ? t('manage.none') : t('manage.summary', [total, enabled])),
    languageSetting(),
  );

  const actions = el('div', { class: 'actions' });
  const studio = el('button', { class: 'btn', type: 'button' }, t('manage.openStudio'));
  studio.addEventListener('click', () => void ext.tabs.create({ url: ext.runtime.getURL('studio/studio.html') }));
  const compat = el('button', { class: 'btn', type: 'button' }, t('manage.compatibility'));
  compat.addEventListener('click', () =>
    void ext.tabs.create({ url: ext.runtime.getURL('diagnostics/diagnostics.html') }),
  );
  actions.append(studio, compat);
  app.append(actions);

  if (total === 0) {
    app.append(
      el('div', { class: 'empty' }, t('manage.emptyHint')),
    );
    return;
  }

  // Grouped by where each one came from, because that is what a reader is
  // deciding about: shipped, chosen from a catalogue, or written here.
  for (const source of ['builtin', 'installed', 'studio']) {
    const group = state.catalog.filter((entry) => entry.source === source);
    if (group.length === 0) continue;
    app.append(el('h2', {}, SOURCE_TITLE[source]?.() ?? source));
    for (const entry of group) {
      app.append(renderAdapterCard(entry, { onChanged: load, showOrigins: true }));
    }
  }
}

function load(): void {
  void send<PopupState>({ type: 'liha/get-state' }).then(render);
}

void loadLocale().then(() => {
  applyDocumentLanguage();
  load();
});
