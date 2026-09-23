import { describe, expect, it } from 'vitest';
import { allResults, listings } from './data';
import { filterResults, getViewResults, matchesQuery } from './domain';

describe('discovery domain rules', () => {
  it('matches a query across title, subtitle, category and zone', () => {
    expect(matchesQuery(listings[0], 'oak')).toBe(true);
    expect(matchesQuery(listings[0], 'B1')).toBe(true);
    expect(matchesQuery(listings[0], 'plumbing')).toBe(false);
  });

  it('filters by zone and verified state without exposing private data', () => {
    const filtered = filterResults(allResults, { query: '', zone: 'B1', verifiedOnly: true, sort: 'recommended' });
    expect(filtered.every((result) => result.zone === 'B1' || result.zone === 'All zones')).toBe(true);
    expect(filtered.every((result) => result.verified === true || ('sellerVerified' in result && result.sellerVerified === true))).toBe(true);
  });

  it('scopes collection views to their domain type', () => {
    expect(getViewResults('services', allResults).every((result) => result.type === 'service')).toBe(true);
    expect(getViewResults('businesses', allResults).every((result) => result.type === 'business')).toBe(true);
    expect(getViewResults('offers', allResults).every((result) => result.type === 'offer')).toBe(true);
  });

  it('supports ascending price sorting for marketplace listings', () => {
    const pricedListings = listings.map((listing, index) => ({ ...listing, price: [18500, 22000, 9800, 3500, 1800][index] }));
    const sorted = filterResults(pricedListings, { query: '', zone: 'All zones', verifiedOnly: false, sort: 'price-low' });
    expect(sorted.map((result) => result.type === 'listing' ? result.price : 0)).toEqual([1800, 3500, 9800, 18500, 22000]);
  });

  it('separates vehicles for sale from moving and private transport services', () => {
    const car = { ...listings[0], id: 'car', category: 'Cars & motorcycles', vehicleType: 'Cars' as const };
    const motorcycle = { ...listings[0], id: 'motorcycle', category: 'Cars & motorcycles', vehicleType: 'Motorcycles' as const };
    const moving = { ...allResults.find(result => result.id === 'service-2')! };
    const privateRide = { ...moving, id: 'private-ride', category: 'Private transportation' };
    const results = [car, motorcycle, moving, privateRide];
    const base = { query: '', zone: 'All zones', verifiedOnly: false, sort: 'recommended' as const, category: 'Cars & motorcycles' };
    expect(filterResults(results, { ...base, vehicleType: 'Cars' }).map(result => result.id)).toEqual(['car']);
    expect(filterResults(results, { ...base, vehicleType: 'Motorcycles' }).map(result => result.id)).toEqual(['motorcycle']);
    expect(filterResults(results, { ...base, vehicleType: 'Moving furniture' }).map(result => result.id)).toEqual(['service-2']);
    expect(filterResults(results, { ...base, vehicleType: 'Private transportation' }).map(result => result.id)).toEqual(['private-ride']);
  });
});
