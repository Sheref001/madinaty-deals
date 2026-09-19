import { useTranslation } from './i18n';
import type { SearchResult } from './types';
import { listingConditionOptions } from './types';

export interface CollectionFilters { category: string; condition: string; furnishing: string; min: string; max: string }

export default function MarketplaceFilters({ value, onChange, onClear, results, showPrice, showFurnishing }: { value: CollectionFilters; onClear: () => void; onChange: (value: CollectionFilters) => void; results: SearchResult[]; showPrice: boolean; showFurnishing?: boolean }) {
  const { t } = useTranslation();
  const categories = [...new Set(results.map(result => result.category))];
  function change(key: keyof CollectionFilters, next: string) { onChange({ ...value, [key]: next }); }
  return <aside className="market-filters" aria-label={t('Refine results')}>
    <h2>{t('Refine results')}</h2>
    <label>{t('Category')}<select value={value.category} onChange={event => change('category', event.target.value)}><option value="">{t('All categories')}</option>{categories.map(category => <option key={category} value={category}>{t(category)}</option>)}</select></label>
    {showFurnishing && <label>{t('Apartment type')}<select value={value.furnishing} onChange={event => change('furnishing', event.target.value)}><option value="">{t('Furnished or unfurnished')}</option><option value="Furnished">{t('Furnished')}</option><option value="Unfurnished">{t('Unfurnished')}</option></select></label>}
    {showPrice && <>
      <fieldset><legend>{t('Price (EGP)')}</legend><div className="price-inputs"><label>{t('Minimum price')}<input type="number" min="0" step="0.01" value={value.min} onChange={event => change('min', event.target.value)} /></label><label>{t('Maximum price')}<input type="number" min="0" step="0.01" value={value.max} onChange={event => change('max', event.target.value)} /></label></div></fieldset>
      {value.min && value.max && Number(value.min) > Number(value.max) && <p role="alert">{t('Maximum price must be at least the minimum.')}</p>}
      <label>{t('Condition')}<select value={value.condition} onChange={event => change('condition', event.target.value)}><option value="">{t('Any condition')}</option>{listingConditionOptions(value.category).map(condition => <option key={condition} value={condition}>{t(condition)}</option>)}</select></label>
    </>}
    <button className="button button-outline" onClick={onClear}>{t('Clear filters')}</button>
  </aside>;
}
