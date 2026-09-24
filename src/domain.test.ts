import { describe, expect, it } from 'vitest';
import { listings, results } from './testFixtures';
import { filterResults, getViewResults, matchesQuery } from './domain';

describe('discovery domain rules', () => {
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
    expect(getViewResults('businesses', results)).toEqual([]);
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
});
