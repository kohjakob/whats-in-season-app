import table from '../../data/i18n/poster.json';
import type { Produce } from '../produce/schema';
import type { Category } from './categories';
import type { Level } from '../engine/types';

export type Lang = 'en' | 'de' | 'fr' | 'it' | 'es' | 'ja' | 'zh' | 'ru';
export const LANGS: readonly Lang[] = ['en', 'de', 'fr', 'it', 'es', 'ja', 'zh', 'ru'];
export const LANG_LABEL: Record<Lang, string> = {
  en: 'English', de: 'Deutsch', fr: 'Français', it: 'Italiano', es: 'Español', ja: '日本語', zh: '中文', ru: 'Русский',
};

type UiKey = Level | 'vegetables' | 'fruit' | 'herbs' | 'nuts';
const ui = table.ui as Record<UiKey, Record<Lang, string>>;
const months = table.months as Record<Lang, string[]>;
const produceNames = table.produce as Record<string, Partial<Record<Lang, string>>>;

export interface PosterLabels {
  months: string[];
  level: Record<Level, string>;
  category: Record<Category, string>;
}

/** Everything the poster prints, in one language. English is the fallback for anything missing. */
export function posterLabels(lang: Lang): PosterLabels {
  const u = (k: UiKey) => ui[k][lang] ?? ui[k].en;
  return {
    months: months[lang] ?? months.en,
    level: { peak: u('peak'), available: u('available'), stored: u('stored') },
    category: { vegetable: u('vegetables'), fruit: u('fruit'), herb: u('herbs'), nut: u('nuts') },
  };
}

/** Produce name in a language: record names for en and de, the translation table otherwise. */
export function produceName(produce: Produce, lang: Lang): string {
  if (lang === 'en') return produce.names.en;
  if (lang === 'de' && produce.names.de) return produce.names.de;
  return produceNames[produce.id]?.[lang] ?? produce.names.en;
}

export function isLang(x: string | null | undefined): x is Lang {
  return !!x && (LANGS as readonly string[]).includes(x);
}
