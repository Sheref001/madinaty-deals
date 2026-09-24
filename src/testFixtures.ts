import type { PublicSubmission } from './api';
import type { Listing, SearchResult, Service } from './types';

export const listings: Listing[] = [
  { id: 'test-table', type: 'listing', title: 'Test dining table', subtitle: 'Seats six', category: 'Furniture & home', price: 100, condition: 'Good', seller: 'Test seller', sellerVerified: true, zone: 'B1', createdAt: '2 hours ago', image: 'table', accent: 'clay', status: 'active' },
  { id: 'test-tv', type: 'listing', title: 'Test television', subtitle: 'Working', category: 'Electronics', price: 200, condition: 'Fully working - used', seller: 'Test seller', sellerVerified: true, zone: 'B2', createdAt: '5 hours ago', image: 'tv', accent: 'navy', status: 'active' },
  { id: 'test-chair', type: 'listing', title: 'Test child chair', subtitle: 'Wooden', category: 'Kids & family', price: null, condition: 'Like new', seller: 'Test seller', zone: 'B3', createdAt: 'Yesterday', image: 'chair', accent: 'sage', status: 'active' },
  { id: 'test-cabinet', type: 'listing', title: 'Test shoe cabinet', subtitle: 'White', category: 'Furniture & home', price: null, condition: 'Fair', seller: 'Test seller', zone: 'B6', createdAt: 'Yesterday', image: 'cabinet', accent: 'sand', status: 'active' },
  { id: 'test-scooter', type: 'listing', title: 'Test scooter', subtitle: 'For children', category: 'Kids & family', price: null, condition: 'Like new', seller: 'Test seller', zone: 'B7', createdAt: '2 days ago', image: 'scooter', accent: 'coral', status: 'active' },
];

const service = (id: string, title: string, subtitle: string, category: string, advertiserType: 'individual' | 'small_business' = 'individual'): Service => ({ id, type: 'service', title, subtitle, category, advertiserType, rating: 0, reviewCount: 0, serviceArea: 'Madinaty-wide', phone: '', response: '', zone: 'B1', createdAt: 'Just now', image: 'new-service', accent: 'mint' });

export const results: SearchResult[] = [
  ...listings,
  service('test-ac', 'Test AC service', 'Installation, maintenance & repair', 'Home services'),
  service('test-moving', 'Test moving service', 'Moving furniture', 'Moving'),
  service('test-tutor', 'Test math tutor', 'Mathematics tutoring', 'Tutoring & education'),
  service('test-center', 'Test learning center', 'School tutoring', 'Tutoring & education', 'small_business'),
  service('test-ride', 'Test private ride', 'Private transportation', 'Private transportation'),
];

export const submissions: PublicSubmission[] = results.map(result => ({
  id: result.id,
  kind: result.type as 'listing' | 'service',
  payload: { title: result.title, subtitle: result.subtitle, category: result.category, zone: result.zone, advertiserType: result.advertiserType, ...(result.type === 'listing' ? { price: result.price, condition: result.condition } : {}) },
  uploadIds: [],
  createdAt: '2026-01-01T00:00:00Z',
  seller: result.type === 'listing' ? result.seller : 'Test provider',
  verified: result.type === 'listing' ? Boolean(result.sellerVerified) : false,
}));
