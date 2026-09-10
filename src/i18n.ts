import { createContext, useContext } from 'react';
import { arabic } from './ar';

export type Language = 'ar' | 'en';
export const languageKey = 'madinaty-deals-language';
export const LanguageContext = createContext<Language>('ar');

export function initialLanguage(): Language {
  try { return localStorage.getItem(languageKey) === 'en' ? 'en' : 'ar'; }
  catch { return 'ar'; }
}

export function translate(text: string, language: Language): string {
  if (language === 'en') return text;
  const key = text.trim();
  if (arabic[key]) return text.replace(key, arabic[key]);
  const price = key.match(/^EGP ([\d,]+(?:\.\d+)?)$/);
  if (price) return `${Number(price[1].replace(/,/g, '')).toLocaleString('ar-EG')} ج.م.`;
  const empty = key.match(/^We couldn't find anything for “(.*)”\.$/);
  if (empty) return `لم نجد نتائج لـ «${empty[1]}».`;
  const remove = key.match(/^Remove (.*) from saved$/);
  if (remove) return `إزالة ${translate(remove[1], language)} من المحفوظات`;
  const save = key.match(/^Save (.*)$/);
  if (save) return `حفظ ${translate(save[1], language)}`;
  const report = key.match(/^Report (.*)$/);
  if (report) return `الإبلاغ عن ${translate(report[1], language)}`;
  return text;
}

export function useTranslation() {
  const language = useContext(LanguageContext);
  return { language, t: (text: string) => translate(text, language) };
}

export function normalizeSearch(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
}
