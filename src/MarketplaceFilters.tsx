import { useTranslation } from './i18n';
import { listingConditionOptions, type View } from './types';
import { categoryChoices, categoryDefinition, cleanCollection, hasPriceFilter, hasProviderFilter, type CollectionFilters } from './discovery';

export default function MarketplaceFilters({ value, onChange, onClear, category, view, isAdmin, onCategoryChange }: { value: CollectionFilters; onClear: () => void; onChange: (value: CollectionFilters) => void; category: string; view: View; isAdmin: boolean; onCategoryChange: (category: string) => void }) {
  const { t } = useTranslation();
  const definition = categoryDefinition(category);
  function change(key: keyof CollectionFilters, next: string) {
    onChange(cleanCollection({ ...value, [key]: next }, category, view));
  }
  return <aside className="market-filters" aria-label={t('Refine results')}>
    <h2>{t('Refine results')}</h2>
    <label>{t('Category')}<select value={category} onChange={event => onCategoryChange(event.target.value)}><option value="">{t('All categories')}</option>{categoryChoices(view, category, isAdmin).map(item => <option key={item.label} value={item.label}>{t(item.label)}</option>)}</select></label>
    {hasProviderFilter(category) && value.scope !== 'businesses' && <label>{t('Provider type')}<select value={value.advertiserType} onChange={event => change('advertiserType', event.target.value)}><option value="">{t('All providers')}</option><option value="individual">{t('Individuals')}</option><option value="small_business">{t(category === 'Tutoring & education' ? 'Tutoring centres' : 'Small businesses')}</option></select></label>}
    {definition?.filters.map(filter => <label key={filter.key}>{t(filter.label)}<select value={value[filter.key]} onChange={event => change(filter.key, event.target.value)}><option value="">{t(filter.all)}</option>{filter.options.map(option => <option key={option} value={option}>{t(option)}</option>)}</select></label>)}
    {hasPriceFilter(category, view, value) && <>
      <fieldset><legend>{t('Price (EGP)')}</legend><div className="price-inputs"><label>{t('Minimum price')}<input type="number" min="0" step="0.01" value={value.min} onChange={event => change('min', event.target.value)} /></label><label>{t('Maximum price')}<input type="number" min="0" step="0.01" value={value.max} onChange={event => change('max', event.target.value)} /></label></div></fieldset>
      {value.min && value.max && Number(value.min) > Number(value.max) && <p role="alert">{t('Maximum price must be at least the minimum.')}</p>}
      {!['Apartment rentals', 'Groceries'].includes(category) && <label>{t('Condition')}<select value={value.condition} onChange={event => change('condition', event.target.value)}><option value="">{t('Any condition')}</option>{listingConditionOptions(category).map(condition => <option key={condition} value={condition}>{t(condition)}</option>)}</select></label>}
    </>}
    <button className="button button-outline" type="button" onClick={onClear}>{t('Clear filters')}</button>
  </aside>;
}
