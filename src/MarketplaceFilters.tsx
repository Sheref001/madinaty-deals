import { useTranslation } from './i18n';
import type { SearchResult } from './types';
import { listingConditionOptions } from './types';
import { educationLevels, tutoringSubjects } from './types';

export interface CollectionFilters { category: string; condition: string; furnishing: string; min: string; max: string; educationLevel: string; subject: string }

export default function MarketplaceFilters({ value, onChange, onClear, results, showPrice, showFurnishing, conditionCategory }: { value: CollectionFilters; onClear: () => void; onChange: (value: CollectionFilters) => void; results: SearchResult[]; showPrice: boolean; showFurnishing?: boolean; conditionCategory?: string }) {
  const { t } = useTranslation();
  const categories = [...new Set(results.map(result => result.category))];
  function change(key: keyof CollectionFilters, next: string) { onChange({ ...value, [key]: next }); }
  return <aside className="market-filters" aria-label={t('Refine results')}>
    <h2>{t('Refine results')}</h2>
    <label>{t('Category')}<select value={value.category} onChange={event => change('category', event.target.value)}><option value="">{t('All categories')}</option>{categories.map(category => <option key={category} value={category}>{t(category)}</option>)}</select></label>
    {showFurnishing && <label>{t('Furnishing')}<select value={value.furnishing} onChange={event => change('furnishing', event.target.value)}><option value="">{t('Furnished or unfurnished')}</option><option value="Furnished">{t('Furnished')}</option><option value="Unfurnished">{t('Unfurnished')}</option></select></label>}
    {conditionCategory === 'Tutoring & education' && <><label>{t('Education stage')}<select value={value.educationLevel} onChange={event => change('educationLevel', event.target.value)}><option value="">{t('All education stages')}</option>{educationLevels.map(level => <option value={level} key={level}>{t(level)}</option>)}</select></label><label>{t('Subject')}<select value={value.subject} onChange={event => change('subject', event.target.value)}><option value="">{t('All subjects')}</option>{tutoringSubjects.map(subject => <option value={subject} key={subject}>{t(subject)}</option>)}</select></label></>}
    {showPrice && <>
      <fieldset><legend>{t('Price (EGP)')}</legend><div className="price-inputs"><label>{t('Minimum price')}<input type="number" min="0" step="0.01" value={value.min} onChange={event => change('min', event.target.value)} /></label><label>{t('Maximum price')}<input type="number" min="0" step="0.01" value={value.max} onChange={event => change('max', event.target.value)} /></label></div></fieldset>
      {value.min && value.max && Number(value.min) > Number(value.max) && <p role="alert">{t('Maximum price must be at least the minimum.')}</p>}
      {conditionCategory !== 'Apartment rentals' && <label>{t('Condition')}<select value={value.condition} onChange={event => change('condition', event.target.value)}><option value="">{t('Any condition')}</option>{listingConditionOptions(conditionCategory || value.category).map(condition => <option key={condition} value={condition}>{t(condition)}</option>)}</select></label>}
    </>}
    <button className="button button-outline" onClick={onClear}>{t('Clear filters')}</button>
  </aside>;
}
