import { describe, expect, it } from 'vitest';
import { listings, results } from './testFixtures';
import { filterResults, getViewResults, matchesQuery } from './domain';

describe('discovery domain rules', () => {
  it('filters online stores by type and finds translated store categories', () => {
    const store = { id: 'store-one', type: 'business' as const, title: 'Nour Beauty', subtitle: 'Cosmetics for Madinaty', category: 'Online Finds', onlineStoreCategory: 'Beauty & personal care', zone: 'B1', createdAt: 'Just now', image: 'new-service', accent: 'mint' as const, rating: 0, reviewCount: 0, hours: 'Delivery or pickup', phone: '', verified: false };
    expect(getViewResults('businesses', [store])).toEqual([store]);
    expect(matchesQuery(store, 'الجمال والعناية الشخصية')).toBe(true);
    expect(filterResults([store], { query: '', zone: 'All zones', verifiedOnly: false, sort: 'recommended', onlineStoreCategory: 'Beauty & personal care' })).toEqual([store]);
    expect(filterResults([store], { query: '', zone: 'All zones', verifiedOnly: false, sort: 'recommended', onlineStoreCategory: 'Food & treats' })).toEqual([]);
  });
  it('matches a query across title, subtitle, category and zone', () => {
    expect(matchesQuery(listings[0], 'dining')).toBe(true);
    expect(matchesQuery(listings[0], 'B1')).toBe(true);
    expect(matchesQuery(listings[0], 'plumbing')).toBe(false);
  });

  it('filters by zone and verified state without exposing private data', () => {
    const filtered = filterResults(results, { query: '', zone: 'B1', verifiedOnly: true, sort: 'recommended' });
    expect(filtered.every((result) => result.zone === 'B1' || result.zone === 'All zones')).toBe(true);
    expect(filtered.every((result) => result.verified === true || ('sellerVerified' in result && result.sellerVerified === true))).toBe(true);
  });

  it('scopes collection views to their domain type', () => {
    expect(getViewResults('services', results).every((result) => result.type === 'service')).toBe(true);
    expect(getViewResults('businesses', results)).toEqual([results[8]]);
    expect(getViewResults('offers', results)).toEqual([]);
  });

  it('supports ascending price sorting for marketplace listings', () => {
    const pricedListings = listings.map((listing, index) => ({ ...listing, price: [18500, 22000, 9800, 3500, 1800][index] }));
    const sorted = filterResults(pricedListings, { query: '', zone: 'All zones', verifiedOnly: false, sort: 'price-low' });
    expect(sorted.map((result) => result.type === 'listing' ? result.price : 0)).toEqual([1800, 3500, 9800, 18500, 22000]);
  });

  it('separates vehicles for sale from moving and private transport services', () => {
    const car = { ...listings[0], id: 'car', category: 'Cars & motorcycles', vehicleType: 'Cars' as const };
    const motorcycle = { ...listings[0], id: 'motorcycle', category: 'Cars & motorcycles', vehicleType: 'Motorcycles' as const };
    const moving = { ...results.find(result => result.id === 'test-moving')! };
    const privateRide = { ...moving, id: 'private-ride', category: 'Private transportation' };
    const vehicleResults = [car, motorcycle, moving, privateRide];
    const base = { query: '', zone: 'All zones', verifiedOnly: false, sort: 'recommended' as const, category: 'Cars & motorcycles' };
    expect(filterResults(vehicleResults, { ...base, vehicleType: 'Cars' }).map(result => result.id)).toEqual(['car']);
    expect(filterResults(vehicleResults, { ...base, vehicleType: 'Motorcycles' }).map(result => result.id)).toEqual(['motorcycle']);
    expect(filterResults(vehicleResults, { ...base, vehicleType: 'Moving furniture' }).map(result => result.id)).toEqual(['test-moving']);
    expect(filterResults(vehicleResults, { ...base, vehicleType: 'Private transportation' }).map(result => result.id)).toEqual(['private-ride']);
  });

  it('shows nurseries and kids items together, while keeping item sections distinct', () => {
    const nursery = { ...results.find(result => result.type === 'service')!, id: 'nursery', category: 'Nurseries', advertiserType: 'small_business' as const };
    const babyGear = { ...listings[0], id: 'baby-gear', category: 'Kids & family', kidsItemType: 'Baby gear' as const };
    const legacyKidsItem = { ...listings[0], id: 'legacy-kids', category: 'Kids & family', kidsItemType: undefined };
    const mixed = [nursery, babyGear, legacyKidsItem, listings[0]];
    const base = { query: '', zone: 'All zones', verifiedOnly: false, sort: 'recommended' as const, category: 'Kids & family' };
    expect(filterResults(mixed, base).map(result => result.id)).toEqual(['nursery', 'baby-gear', 'legacy-kids']);
    expect(filterResults(mixed, { ...base, kidsSection: 'Nurseries' }).map(result => result.id)).toEqual(['nursery']);
    expect(filterResults(mixed, { ...base, kidsSection: 'Baby gear' }).map(result => result.id)).toEqual(['baby-gear']);
    expect(filterResults(mixed, { ...base, kidsSection: 'Other kids items' }).map(result => result.id)).toEqual(['legacy-kids']);
  });
});
