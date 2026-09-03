import { summarizeEffects, type AdapterCategory, type AdapterDefinition } from '@liha/adapter-schema';
import type { Locale } from '../i18n';
import type { CatalogEntry } from './catalog';

interface ToolCopy {
  description: string;
  inputs?: Record<string, string>;
}

interface AdapterCopy {
  description: string;
  tools: Record<string, ToolCopy>;
}

/**
 * The adapter JSON is the canonical, language-neutral artifact an agent installs,
 * so it stays untouched. This copy is only for the human-facing Japanese store.
 * Keeping every official tool here also lets the completeness test catch a new
 * tool that would otherwise leak English into the Japanese product page.
 */
export const JA_CATALOG_COPY: Record<string, AdapterCopy> = {
  'demo-crm': {
    description:
      'Acme CRMの実際の画面を操作して、顧客を検索・作成・更新します。サイト自体はWebMCPを実装していません。',
    tools: {
      search_customers: {
        description: '名前またはメールアドレスで顧客一覧を検索し、一致した顧客情報を返します。',
        inputs: { query: '検索する名前またはメールアドレスの一部' },
      },
      create_customer: {
        description:
          '実際の「顧客を追加」フォームに入力・送信して新しい顧客を作成し、検索し直して登録結果を確認します。',
        inputs: { name: '顧客の氏名', email: '連絡先メールアドレス' },
      },
      update_customer: {
        description:
          'メールアドレスで顧客を1件に絞り込み、氏名を変更します。検索結果が1件にならない場合は実行しません。',
        inputs: { email: '顧客を特定するメールアドレス', name: '変更後の氏名' },
      },
    },
  },
  'demo-project': {
    description:
      'Kite Project Managerでタスクの作成、担当者・ステータスの変更、フラグ付け、削除を行います。削除はDESTRUCTIVEに分類され、実行前に必ず確認を求めます。',
    tools: {
      list_tasks: {
        description: 'タイトルまたは担当者でタスクを検索し、担当者とステータスを含む一致結果を返します。',
        inputs: { query: 'タイトルまたは担当者の一部。空欄ならすべて表示' },
      },
      create_task: {
        description:
          '実際の「新しいタスク」フォームからタイトルと担当者を登録し、検索し直して作成結果を確認します。',
        inputs: { title: 'タスクの内容', assignee: 'タスクの担当者' },
      },
      assign_task: {
        description:
          'タスクをタイトルで1件に絞り込み、担当者を変更します。検索結果が1件にならない場合は実行しません。',
        inputs: { title: '1件のタスクを特定できるタイトル', assignee: '変更後の担当者' },
      },
      change_task_status: {
        description:
          'タスクをタイトルで1件に絞り込み、ステータスを変更します。検索結果が1件にならない場合は実行しません。',
        inputs: { title: '1件のタスクを特定できるタイトル', status: '変更後のステータス' },
      },
      flag_task: {
        description: '確認が必要なタスクに注意フラグを付けます。',
        inputs: { title: '1件のタスクを特定できるタイトル' },
      },
      unflag_task: {
        description: 'タスクの注意フラグを外します。',
        inputs: { title: '1件のタスクを特定できるタイトル' },
      },
      delete_task: {
        description:
          'タスクを完全に削除します。タイトルで1件に絞り込めない場合は実行せず、削除前に必ず確認を求めます。',
        inputs: { title: '1件のタスクを特定できるタイトル' },
      },
    },
  },
  'demo-shop': {
    description:
      'ストア本来の画面でNimbus Deskを構成し、写真の切り替え、バッグへの追加、クーポン適用、注文内容の確認まで行います。サイト自体はWebMCPを実装していません。',
    tools: {
      view_configure: {
        description: 'デスクの構成画面を開き、現在選ばれている内容を返します。',
      },
      read_configuration: {
        description:
          '現在のNimbus Deskの天板・サイズ・脚と価格を返します。先にview_configureで構成画面を開いてください。',
      },
      next_photo: {
        description: '商品ギャラリーを次の写真へ進め、現在表示している写真を返します。',
      },
      choose_top: {
        description: 'デスクの天板素材を選びます。選択すると価格も更新されます。',
        inputs: { top: '取り付ける天板素材' },
      },
      choose_size: {
        description: 'デスクの天板サイズを選びます。',
        inputs: { size: '取り付ける天板サイズ' },
      },
      choose_base: {
        description: 'デスクを支える脚を選びます。',
        inputs: { base: '取り付ける脚の種類' },
      },
      add_to_bag: {
        description: '現在の構成でデスクをバッグへ追加し、バッグの内容を返します。',
      },
      view_bag: {
        description: 'バッグを開き、入っている商品と合計金額を返します。',
      },
      apply_coupon: {
        description: 'バッグでクーポンコードを入力し、適用結果と更新後の合計金額を返します。',
        inputs: { code: '適用するクーポンコード' },
      },
      review_order: {
        description:
          'バッグから注文確認へ進み、注文予定の内容を返します。決済画面はないため、購入処理は行いません。',
      },
    },
  },
};

const CATEGORY_LABELS: Record<Locale, Record<AdapterCategory, string>> = {
  en: {
    crm: 'CRM',
    commerce: 'Commerce',
    productivity: 'Productivity',
    'developer-tools': 'Developer tools',
    registry: 'Registry',
    other: 'Other',
  },
  ja: {
    crm: '顧客管理',
    commerce: 'EC・コマース',
    productivity: '仕事効率化',
    'developer-tools': '開発者ツール',
    registry: 'レジストリ',
    other: 'その他',
  },
};

export function categoryLabel(category: AdapterCategory | undefined, locale: Locale): string {
  return CATEGORY_LABELS[locale][category ?? 'other'];
}

export function adapterDescription(adapter: AdapterDefinition, locale: Locale): string {
  if (locale === 'ja') return JA_CATALOG_COPY[adapter.id]?.description ?? adapter.description ?? '';
  return adapter.description ?? '';
}

export function toolDescription(
  adapterId: string,
  toolName: string,
  canonical: string,
  locale: Locale,
): string {
  if (locale === 'ja') return JA_CATALOG_COPY[adapterId]?.tools[toolName]?.description ?? canonical;
  return canonical;
}

export function catalogSearchText(entry: CatalogEntry, locale: Locale): string {
  if (locale === 'en') return '';
  return [
    adapterDescription(entry.adapter, locale),
    categoryLabel(entry.adapter.category, locale),
    ...entry.adapter.tools.map((tool) => toolDescription(entry.adapter.id, tool.name, tool.description, locale)),
  ].join(' ');
}

export function localizedInputSchema(
  adapterId: string,
  toolName: string,
  schema: Record<string, unknown>,
  locale: Locale,
): Record<string, unknown> {
  if (locale === 'en') return schema;
  const inputCopy = JA_CATALOG_COPY[adapterId]?.tools[toolName]?.inputs;
  if (!inputCopy) return schema;

  const localized = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  const properties = localized.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return localized;
  for (const [name, description] of Object.entries(inputCopy)) {
    if (properties[name]) properties[name].description = description;
  }
  return localized;
}

export function toolEffectSummary(
  adapter: AdapterDefinition,
  toolName: string,
  locale: Locale,
): string {
  const tool = adapter.tools.find((candidate) => candidate.name === toolName);
  if (!tool) return '';
  const effects = summarizeEffects(tool);
  const counts = [
    ['click', 'clicks', 'クリック', effects.clicks],
    ['input', 'inputs', '入力', effects.inputs],
    ['submit', 'submits', '送信', effects.submits],
    ['navigation', 'navigations', '画面遷移', effects.navigations],
    ['read', 'reads', '読み取り', effects.reads],
  ] as const;
  const parts = counts
    .filter(([, , , count]) => count > 0)
    .map(([singular, plural, japanese, count]) =>
      locale === 'ja' ? `${japanese}${count}回` : `${count} ${count === 1 ? singular : plural}`,
    );
  if (parts.length > 0) return parts.join(' · ');
  return locale === 'ja' ? 'ページ操作なし' : 'no page interaction';
}

export function verifiedDate(value: string | undefined, locale: Locale, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: locale === 'ja' ? 'long' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
