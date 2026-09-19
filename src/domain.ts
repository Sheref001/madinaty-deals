import type { SearchResult } from './types';
import { normalizeSearch, translate } from './i18n';

export interface BrowseFilters {
  query: string;
  zone: string;
  verifiedOnly: boolean;
  sort: 'recommended' | 'newest' | 'price-low' | 'price-high';
  category?: string;
  advertiserType?: 'individual' | 'small_business';
  condition?: string;
  furnishing?: string;
  minPrice?: number;
  maxPrice?: number;
  educationLevel?: string;
  subject?: string;
}

export function matchesQuery(result: SearchResult, query: string): boolean {
  if (!query.trim()) return true;
  const fields = [result.title, result.subtitle, result.zone, 'category' in result ? result.category : ''];
  const haystack = normalizeSearch(fields.flatMap((field) => [field, translate(field, 'ar')]).join(' '));
  return haystack.includes(normalizeSearch(query.trim()));
}

export function filterResults(results: SearchResult[], filters: BrowseFilters): SearchResult[] {
  const filtered = results.filter((result) => {
    const zoneMatches = filters.zone === 'All zones' || result.zone === filters.zone || result.zone === 'All zones';
    const verifiedMatches = !filters.verifiedOnly || result.verified === true || ('sellerVerified' in result && result.sellerVerified === true);
    const audienceMatches = !filters.advertiserType || (result.advertiserType || (result.type === 'business' ? 'small_business' : 'individual')) === filters.advertiserType;
    const categoryMatches = !filters.category || result.category === filters.category;
    const conditionMatches = !filters.condition || (result.type === 'listing' && result.condition === filters.condition);
    const furnishingMatches = !filters.furnishing || (result.type === 'listing' && result.furnishing === filters.furnishing);
    const hasPriceFilter = filters.minPrice !== undefined || filters.maxPrice !== undefined;
    const priceMatches = !hasPriceFilter || (result.type === 'listing' && result.price !== null && result.price >= (filters.minPrice ?? 0) && result.price <= (filters.maxPrice ?? Infinity));
    const educationLevelMatches = !filters.educationLevel || (result.type === 'service' && result.educationLevel === filters.educationLevel);
    const subjectMatches = !filters.subject || (result.type === 'service' && result.subjects?.includes(filters.subject as never));
    return audienceMatches && zoneMatches && verifiedMatches && categoryMatches && conditionMatches && furnishingMatches && priceMatches && educationLevelMatches && subjectMatches && matchesQuery(result, filters.query);
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
  // Local fixtures use relative labels; the API should supply timestamps.
  if (label === 'Just now') return 0;
  if (label === 'Yesterday') return 24;
  const match = label.match(/^(\d+) (hours?|days?) ago$/);
  return match ? Number(match[1]) * (match[2].startsWith('day') ? 24 : 1) : Infinity;
}

export function getViewResults(view: string, results: SearchResult[]): SearchResult[] {
  if (view === 'services') return results.filter((result) => result.type === 'service');
  if (view === 'businesses') return results.filter((result) => result.type === 'business');
  if (view === 'offers') return results.filter((result) => result.type === 'offer');
  if (view === 'browse') return results.filter((result) => result.type === 'listing');
  return results;
}
