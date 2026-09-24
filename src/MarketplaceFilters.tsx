import { useTranslation } from './i18n';
import type { SearchResult } from './types';
import { listingConditionOptions } from './types';
import { onlineStoreCategories } from './categoryPolicy';
import { educationLevels, fitnessProviderTypes, groceryActivities, homeServiceTypes, housekeepingTypes, petBusinessTypes, transportServiceTypes, tutoringSubjects, vehicleTypes } from './types';

export interface CollectionFilters { category: string; advertiserType: string; condition: string; furnishing: string; vehicleType: string; min: string; max: string; educationLevel: string; subject: string; groceryActivity: string; homeServiceType: string; housekeepingType: string; fitnessProviderType: string; petBusinessType: string; onlineStoreCategory: string }

export default function MarketplaceFilters({ value, onChange, onClear, results, showPrice, showFurnishing, showAdvertiserType, conditionCategory }: { value: CollectionFilters; onClear: () => void; onChange: (value: CollectionFilters) => void; results: SearchResult[]; showPrice: boolean; showFurnishing?: boolean; showAdvertiserType?: boolean; conditionCategory?: string }) {
  const { t } = useTranslation();
  const categories = [...new Set(results.map(result => result.category))];
  function change(key: keyof CollectionFilters, next: string) {
    if (key === 'vehicleType' && transportServiceTypes.includes(next as typeof transportServiceTypes[number])) onChange({ ...value, vehicleType: next, condition: '', min: '', max: '' });
    else onChange({ ...value, [key]: next });
  }
  return <aside className="market-filters" aria-label={t('Refine results')}>
    <h2>{t('Refine results')}</h2>
    {conditionCategory !== 'Cars & motorcycles' && <label>{t('Category')}<select value={value.category} onChange={event => change('category', event.target.value)}><option value="">{t('All categories')}</option>{categories.map(category => <option key={category} value={category}>{t(category)}</option>)}</select></label>}
    {conditionCategory === 'Cars & motorcycles' && <label>{t('Vehicle & transport')}<select value={value.vehicleType} onChange={event => change('vehicleType', event.target.value)}><option value="">{t('All vehicles and transport services')}</option>{[...vehicleTypes, ...transportServiceTypes].map(type => <option key={type} value={type}>{t(type)}</option>)}</select></label>}
    {showAdvertiserType && <label>{t('Provider type')}<select value={value.advertiserType} onChange={event => change('advertiserType', event.target.value)}><option value="">{t('All providers')}</option><option value="individual">{t('Individuals')}</option><option value="small_business">{t(conditionCategory === 'Tutoring & education' ? 'Tutoring centres' : 'Small businesses')}</option></select></label>}
    {showFurnishing && <label>{t('Furnishing')}<select value={value.furnishing} onChange={event => change('furnishing', event.target.value)}><option value="">{t('Furnished or unfurnished')}</option><option value="Furnished">{t('Furnished')}</option><option value="Unfurnished">{t('Unfurnished')}</option></select></label>}
    {conditionCategory === 'Tutoring & education' && <><label>{t('Education stage')}<select value={value.educationLevel} onChange={event => change('educationLevel', event.target.value)}><option value="">{t('All education stages')}</option>{educationLevels.map(level => <option value={level} key={level}>{t(level)}</option>)}</select></label><label>{t('Subject')}<select value={value.subject} onChange={event => change('subject', event.target.value)}><option value="">{t('All subjects')}</option>{tutoringSubjects.map(subject => <option value={subject} key={subject}>{t(subject)}</option>)}</select></label></>}
    {conditionCategory === 'Groceries' && <label>{t('Business type')}<select value={value.groceryActivity} onChange={event => change('groceryActivity', event.target.value)}><option value="">{t('All grocery activities')}</option>{groceryActivities.map(activity => <option value={activity} key={activity}>{t(activity)}</option>)}</select></label>}
    {conditionCategory === 'Home services' && <label>{t('Service type')}<select value={value.homeServiceType} onChange={event => change('homeServiceType', event.target.value)}><option value="">{t('All home services')}</option>{homeServiceTypes.map(type => <option value={type} key={type}>{t(type)}</option>)}</select></label>}
    {conditionCategory === 'Online Finds' && <label>{t('Store type')}<select value={value.onlineStoreCategory} onChange={event => change('onlineStoreCategory', event.target.value)}><option value="">{t('All online stores')}</option>{onlineStoreCategories.map(category => <option key={category} value={category}>{t(category)}</option>)}</select></label>}
    {conditionCategory === 'Housekeeping & cleaning' && <label>{t('Cleaning type')}<select value={value.housekeepingType} onChange={event => change('housekeepingType', event.target.value)}><option value="">{t('All cleaning services')}</option>{housekeepingTypes.map(type => <option value={type} key={type}>{t(type)}</option>)}</select></label>}
    {conditionCategory === 'Health & fitness' && <label>{t('Fitness provider')}<select value={value.fitnessProviderType} onChange={event => change('fitnessProviderType', event.target.value)}><option value="">{t('All fitness providers')}</option>{fitnessProviderTypes.map(type => <option value={type} key={type}>{t(type)}</option>)}</select></label>}
    {conditionCategory === 'Pet care' && <label>{t('Pet business type')}<select value={value.petBusinessType} onChange={event => change('petBusinessType', event.target.value)}><option value="">{t('All pet businesses')}</option>{petBusinessTypes.map(type => <option value={type} key={type}>{t(type)}</option>)}</select></label>}
    {showPrice && !(conditionCategory === 'Cars & motorcycles' && transportServiceTypes.includes(value.vehicleType as typeof transportServiceTypes[number])) && <>
      <fieldset><legend>{t('Price (EGP)')}</legend><div className="price-inputs"><label>{t('Minimum price')}<input type="number" min="0" step="0.01" value={value.min} onChange={event => change('min', event.target.value)} /></label><label>{t('Maximum price')}<input type="number" min="0" step="0.01" value={value.max} onChange={event => change('max', event.target.value)} /></label></div></fieldset>
      {value.min && value.max && Number(value.min) > Number(value.max) && <p role="alert">{t('Maximum price must be at least the minimum.')}</p>}
      {conditionCategory !== 'Apartment rentals' && conditionCategory !== 'Groceries' && conditionCategory !== 'Health & fitness' && <label>{t('Condition')}<select value={value.condition} onChange={event => change('condition', event.target.value)}><option value="">{t('Any condition')}</option>{listingConditionOptions(conditionCategory || value.category).map(condition => <option key={condition} value={condition}>{t(condition)}</option>)}</select></label>}
    </>}
    <button className="button button-outline" onClick={onClear}>{t('Clear filters')}</button>
  </aside>;
}
