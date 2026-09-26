import type { SearchResult } from './types';
import { normalizeSearch, translate } from './i18n';
import { businessOnlyCategories } from './categoryPolicy';

export interface BrowseFilters {
  query: string;
  zone: string;
  verifiedOnly: boolean;
  sort: 'recommended' | 'newest' | 'price-low' | 'price-high';
  category?: string;
  advertiserType?: 'individual' | 'small_business';
  condition?: string;
  furnishing?: string;
  vehicleType?: string;
  minPrice?: number;
  maxPrice?: number;
  educationLevel?: string;
  subject?: string;
  groceryActivity?: string;
  homeServiceType?: string;
  housekeepingType?: string;
  fitnessProviderType?: string;
  petBusinessType?: string;
  onlineStoreCategory?: string;
  kidsSection?: string;
}

export function matchesQuery(result: SearchResult, query: string): boolean {
  if (!query.trim()) return true;
  const fields = [result.title, result.subtitle, result.zone, result.category,
    ...(result.type === 'listing' ? [result.kidsItemType, result.groceryActivity, result.vehicleType] : []),
    ...(result.type === 'business' ? [result.onlineStoreCategory] : []),
    ...(result.type === 'service' ? [result.homeServiceType, result.housekeepingType, result.fitnessProviderType, result.providerName, result.educationLevel, ...(result.subjects || []), result.otherSubject] : [])];
  const haystack = normalizeSearch(fields.filter((field): field is string => typeof field === 'string').flatMap((field) => [field, translate(field, 'ar')]).join(' '));
  return haystack.includes(normalizeSearch(query.trim()));
}

export function filterResults(results: SearchResult[], filters: BrowseFilters): SearchResult[] {
  const filtered = results.filter((result) => {
    const zoneMatches = filters.zone === 'All zones' || result.zone === filters.zone || result.zone === 'All zones';
    const verifiedMatches = !filters.verifiedOnly || result.verified === true || ('sellerVerified' in result && result.sellerVerified === true);
    const audienceMatches = !filters.advertiserType || (isBusinessResult(result) ? 'small_business' : 'individual') === filters.advertiserType;
    const categoryMatches = !filters.category || result.category === filters.category || (filters.category === 'Tutoring & education' && result.category === 'Tutoring') || (filters.category === 'Deals & promotions' && hasActivePromotion(result)) || (filters.category === 'Cars & motorcycles' && result.type === 'service' && ['Moving', 'Private transportation'].includes(result.category)) || (filters.category === 'Kids & family' && result.type === 'service' && result.category === 'Nurseries');
    const kidsSectionMatches = !filters.kidsSection || (filters.kidsSection === 'Nurseries' ? result.type === 'service' && result.category === 'Nurseries' : result.type === 'listing' && result.category === 'Kids & family' && (result.kidsItemType || 'Other kids items') === filters.kidsSection);
    const conditionMatches = !filters.condition || (result.type === 'listing' && result.condition === filters.condition);
    const furnishingMatches = !filters.furnishing || (result.type === 'listing' && result.furnishing === filters.furnishing);
    const vehicleTypeMatches = !filters.vehicleType || (result.type === 'listing' && result.category === 'Cars & motorcycles' && result.vehicleType === filters.vehicleType) || (result.type === 'service' && ((filters.vehicleType === 'Moving furniture' && result.category === 'Moving') || (filters.vehicleType === 'Private transportation' && result.category === 'Private transportation')));
    const hasPriceFilter = filters.minPrice !== undefined || filters.maxPrice !== undefined;
    const priceMatches = !hasPriceFilter || (result.type === 'listing' && result.price !== null && result.price >= (filters.minPrice ?? 0) && result.price <= (filters.maxPrice ?? Infinity));
    const educationLevelMatches = !filters.educationLevel || (result.type === 'service' && result.educationLevel === filters.educationLevel);
    const subjectMatches = !filters.subject || (result.type === 'service' && (filters.subject === 'Other subject' ? Boolean(result.otherSubject) : result.subjects?.includes(filters.subject as never)));
    const groceryActivityMatches = !filters.groceryActivity || ((result.type === 'business' || result.type === 'listing') && result.groceryActivity === filters.groceryActivity);
    const homeServiceTypeMatches = !filters.homeServiceType || (result.type === 'service' && result.homeServiceType === filters.homeServiceType);
    const housekeepingTypeMatches = !filters.housekeepingType || (result.type === 'service' && result.housekeepingType === filters.housekeepingType);
    const fitnessProviderTypeMatches = !filters.fitnessProviderType || ((result.type === 'business' || result.type === 'service') && result.fitnessProviderType === filters.fitnessProviderType);
    const petBusinessTypeMatches = !filters.petBusinessType || ((result.type === 'business' || result.type === 'service') && result.petBusinessType === filters.petBusinessType);
    const onlineStoreMatches = !filters.onlineStoreCategory || (result.type === 'business' && result.onlineStoreCategory === filters.onlineStoreCategory);
    return audienceMatches && zoneMatches && verifiedMatches && categoryMatches && kidsSectionMatches && conditionMatches && furnishingMatches && vehicleTypeMatches && priceMatches && educationLevelMatches && subjectMatches && groceryActivityMatches && homeServiceTypeMatches && housekeepingTypeMatches && fitnessProviderTypeMatches && petBusinessTypeMatches && onlineStoreMatches && matchesQuery(result, filters.query);
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === 'price-low' || filters.sort === 'price-high') {
      const first = a.type === 'listing' ? a.price : null;
      const second = b.type === 'listing' ? b.price : null;
      if (first === null) return second === null ? 0 : 1;
      if (second === null) return -1;
      return filters.sort === 'price-low' ? first - second : second - first;
    }
    if (filters.sort === 'newest') return relativeAge(a.createdAt) - relativeAge(b.createdAt);
    // Promotions must not change organic ordering.
    return 0;
  });
}

function relativeAge(label: string): number {
  const timestamp = Date.parse(label);
  if (Number.isFinite(timestamp)) return (Date.now() - timestamp) / 3600000;
  if (label === 'Just now') return 0;
  if (label === 'Yesterday') return 24;
  const match = label.match(/^(\d+) (hours?|days?) ago$/);
  return match ? Number(match[1]) * (match[2].startsWith('day') ? 24 : 1) : Infinity;
}

export function getViewResults(view: string, results: SearchResult[]): SearchResult[] {
  if (view === 'services') return results.filter((result) => result.type === 'service');
  if (view === 'businesses') return results.filter(isBusinessResult);
  if (view === 'offers') return results.filter(result => hasActivePromotion(result));
  if (view === 'browse') return results.filter((result) => result.type === 'listing');
  return results;
}

export function isBusinessResult(result: SearchResult): boolean {
  return result.type === 'business' || result.advertiserType === 'small_business' || businessOnlyCategories.includes(result.category);
}
export function hasActivePromotion(result: SearchResult, now = new Date()): boolean {
  const offer = result.type === 'service' ? result.offer : result.type === 'offer' ? result : undefined;
  if (!offer || !/^\d{4}-\d{2}-\d{2}$/.test(offer.validUntil)) return false;
  const expires = Date.parse(offer.validUntil + 'T23:59:59.999Z');
  return Number.isFinite(expires) && expires >= now.getTime();
}
export function postedDate(value: string, language: 'en' | 'ar'): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp) : translate(value, language);
}
