import { categories, zones } from './data';
import { businessOnlyCategories, individualOnlyCategories, onlineStoreCategories } from './categoryPolicy';
import { educationLevels, fitnessProviderTypes, groceryActivities, homeServiceTypes, housekeepingTypes, kidsItemTypes, petBusinessTypes, transportServiceTypes, tutoringSubjects, vehicleTypes, listingConditionOptions, type View } from './types';

export interface CollectionFilters {
  scope: string; advertiserType: string; condition: string; furnishing: string; vehicleType: string;
  min: string; max: string; educationLevel: string; subject: string; groceryActivity: string;
  homeServiceType: string; housekeepingType: string; fitnessProviderType: string;
  petBusinessType: string; onlineStoreCategory: string; kidsSection: string;
}
export const emptyFilters: CollectionFilters = { scope: '', advertiserType: '', condition: '', furnishing: '', vehicleType: '', min: '', max: '', educationLevel: '', subject: '', groceryActivity: '', homeServiceType: '', housekeepingType: '', fitnessProviderType: '', petBusinessType: '', onlineStoreCategory: '', kidsSection: '' };
type FilterSpec = { key: keyof CollectionFilters; label: string; all: string; options: readonly string[] };
type Category = { label: string; views: View[]; view: View; filters: FilterSpec[]; priced?: boolean; adminOnly?: boolean };
const field = (key: FilterSpec['key'], label: string, all: string, options: readonly string[]): FilterSpec => ({ key, label, all, options });
const services: View[] = ['services', 'businesses'];
const items: View[] = ['browse', 'businesses'];
export const discoveryCategories: Category[] = [
  { label: 'Furniture & home', views: items, view: 'browse', filters: [], priced: true },
  { label: 'Electronics', views: items, view: 'browse', filters: [], priced: true },
  { label: 'Kids & family', views: ['browse', 'services', 'businesses'], view: 'search', priced: true, filters: [field('kidsSection', 'Kids & family sections', 'All kids & family', ['Nurseries', ...kidsItemTypes])] },
  { label: 'Cars & motorcycles', views: ['browse', 'services', 'businesses'], view: 'search', priced: true, filters: [field('vehicleType', 'Vehicle & transport', 'All vehicles and transport services', [...vehicleTypes, ...transportServiceTypes])] },
  { label: 'Apartment rentals', views: ['browse'], view: 'browse', priced: true, filters: [field('furnishing', 'Furnishing', 'Furnished or unfurnished', ['Furnished', 'Unfurnished'])] },
  { label: 'Home services', views: services, view: 'services', filters: [field('homeServiceType', 'Service type', 'All home services', homeServiceTypes)] },
  { label: 'Housekeeping & cleaning', views: services, view: 'services', filters: [field('housekeepingType', 'Cleaning type', 'All cleaning services', housekeepingTypes)] },
  { label: 'Local delivery riders', views: services, view: 'services', filters: [] },
  { label: 'Tutoring & education', views: services, view: 'services', filters: [field('educationLevel', 'Education stage', 'All education stages', educationLevels), field('subject', 'Subject', 'All subjects', [...tutoringSubjects, 'Other subject'])] },
  { label: 'Groceries', views: items, view: 'browse', priced: true, filters: [field('groceryActivity', 'Business type', 'All grocery activities', groceryActivities)] },
  { label: 'Online Finds', views: ['businesses'], view: 'businesses', filters: [field('onlineStoreCategory', 'Store type', 'All online stores', onlineStoreCategories)] },
  { label: 'Health & fitness', views: services, view: 'services', filters: [field('fitnessProviderType', 'Fitness provider', 'All fitness providers', fitnessProviderTypes)] },
  { label: 'Nurseries', views: services, view: 'services', filters: [] },
  { label: 'Moving', views: services, view: 'services', filters: [] },
  { label: 'Private transportation', views: services, view: 'services', filters: [] },
  { label: 'Pet care', views: services, view: 'services', adminOnly: true, filters: [field('petBusinessType', 'Pet business type', 'All pet businesses', petBusinessTypes)] },
  { label: 'Deals & promotions', views: ['offers'], view: 'offers', filters: [] },
];
export const categoryDefinition = (label: string) => discoveryCategories.find(item => item.label === (label === 'Tutoring' ? 'Tutoring & education' : label));
export const categoryChoices = (view: View, selectedCategory: string, isAdmin = false) => discoveryCategories.filter(item => (!item.adminOnly || isAdmin) && (Boolean(selectedCategory) || view === 'search' || view === 'saved' || item.views.includes(view)));
export const categoryTiles = (isAdmin = false) => categories.filter(item => !item.adminOnly || isAdmin);
export const hasProviderFilter = (category: string) => Boolean(category) && !businessOnlyCategories.includes(category) && !individualOnlyCategories.includes(category) && !['Health & fitness', 'Kids & family', 'Deals & promotions'].includes(category);
export const hasPriceFilter = (category: string, view: View, value: CollectionFilters) => (!category ? view === 'browse' || view === 'search' || view === 'saved' : Boolean(categoryDefinition(category)?.priced)) && value.scope !== 'services' && value.kidsSection !== 'Nurseries' && !transportServiceTypes.includes(value.vehicleType as typeof transportServiceTypes[number]);

export function cleanCollection(value: Partial<CollectionFilters>, category: string, view: View): CollectionFilters {
  const clean = { ...emptyFilters };
  if (categoryDefinition(category)?.views.includes(value.scope as View)) clean.scope = value.scope!;
  if (hasProviderFilter(category) && ['individual', 'small_business'].includes(value.advertiserType || '')) clean.advertiserType = value.advertiserType!;
  if (clean.scope === 'businesses') clean.advertiserType = '';
  for (const filter of categoryDefinition(category)?.filters || []) if (filter.options.includes(value[filter.key] || '')) clean[filter.key] = value[filter.key]!;
  if (hasPriceFilter(category, view, clean)) {
    for (const key of ['min', 'max'] as const) if (value[key] && Number.isFinite(Number(value[key])) && Number(value[key]) >= 0) clean[key] = value[key]!;
    if (!['Apartment rentals', 'Groceries'].includes(category) && listingConditionOptions(category).includes(value.condition as never)) clean.condition = value.condition!;
  }
  return clean;
}
export function readCollection(category: string, view: View): CollectionFilters {
  const params = new URLSearchParams(window.location.search);
  return cleanCollection(Object.fromEntries(Object.keys(emptyFilters).map(key => [key, params.get(key) || ''])), category, view);
}
export function writeCollection(value: CollectionFilters) {
  const url = new URL(window.location.href);
  for (const [key, val] of Object.entries(value)) { if (val) url.searchParams.set(key, val); else url.searchParams.delete(key); }
  window.history.replaceState(window.history.state, '', url);
}
export function readDiscoveryLocation() {
  const params = new URLSearchParams(window.location.search);
  const category = categoryDefinition(params.get('category') || '')?.label || '';
  const validViews = ['home', 'browse', 'search', 'services', 'businesses', 'offers', 'saved', 'account', 'activity', 'my-listings'];
  const view = category ? categoryDefinition(category)!.view : validViews.includes(params.get('view') || '') ? params.get('view') as View : params.has('ad') ? 'search' : 'home';
  const sort = ['recommended', 'newest', 'price-low', 'price-high'].includes(params.get('sort') || '') ? params.get('sort')! as 'recommended' | 'newest' | 'price-low' | 'price-high' : 'recommended';
  return { view, category, query: (params.get('q') || '').slice(0, 200), zone: zones.includes(params.get('zone') || '') ? params.get('zone')! : 'All zones', verifiedOnly: params.get('verified') === 'true', sort };
}
