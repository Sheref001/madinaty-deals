import type { Business, Listing, Offer, Service } from './types';

// Placeholder configuration only. Replace these labels after manual verification.
export const zones = ['All zones', 'Zone 1 (configure)', 'Zone 2 (configure)', 'Zone 3 (configure)', 'Zone 4 (configure)', 'Service area (configure)', 'Business area (configure)'];

export const categories = [
  { label: 'Furniture & home', icon: 'sofa', count: 128 },
  { label: 'Electronics', icon: 'monitor', count: 86 },
  { label: 'Kids & family', icon: 'baby', count: 74 },
  { label: 'Home services', icon: 'wrench', count: 52 },
  { label: 'Food & coffee', icon: 'utensils', count: 41 },
  { label: 'Poultry & groceries', icon: 'utensils', count: 18 },
  { label: 'Health & fitness', icon: 'heart-pulse', count: 29 },
];

export const listings: Listing[] = [
  {
    id: 'listing-1', type: 'listing', title: 'Solid oak dining table', subtitle: 'Seats 6 · lightly used · pickup only', category: 'Furniture & home', price: null,
    condition: 'Good', seller: 'Mariam H.', sellerVerified: true, zone: 'Zone 1 (configure)', createdAt: '2 hours ago', image: 'table', accent: 'clay', status: 'active',
  },
  {
    id: 'listing-2', type: 'listing', title: 'LG 55” 4K Smart TV', subtitle: 'Perfect working condition · original remote', category: 'Electronics', price: null,
    condition: 'Like new', seller: 'Omar A.', sellerVerified: true, zone: 'Zone 2 (configure)', createdAt: '5 hours ago', image: 'tv', accent: 'navy', status: 'active',
  },
  {
    id: 'listing-3', type: 'listing', title: 'Stokke Tripp Trapp chair', subtitle: 'Natural wood · includes baby set', category: 'Kids & family', price: 9800,
    condition: 'Like new', seller: 'Nour E.', zone: 'Zone 3 (configure)', createdAt: 'Yesterday', image: 'chair', accent: 'sage', status: 'active',
  },
  {
    id: 'listing-4', type: 'listing', title: 'IKEA Hemnes shoe cabinet', subtitle: 'White · four compartments · some wear', category: 'Furniture & home', price: null,
    condition: 'Fair', seller: 'Hany M.', zone: 'Zone 4 (configure)', createdAt: 'Yesterday', image: 'cabinet', accent: 'sand', status: 'reserved',
  },
  {
    id: 'listing-5', type: 'listing', title: 'Foldable kids scooter', subtitle: 'Ages 5–9 · barely used', category: 'Kids & family', price: null,
    condition: 'Like new', seller: 'Salma K.', sellerVerified: true, zone: 'Zone 1 (configure)', createdAt: '2 days ago', image: 'scooter', accent: 'coral', status: 'active',
  },
];

export const services: Service[] = [
  {
    id: 'service-1', type: 'service', title: 'Cool Point AC Services', subtitle: 'Installation, maintenance & repair', category: 'Home services', rating: 4.9, reviewCount: 84,
    serviceArea: 'Madinaty service area (configure)', phone: '', response: 'Response time to be configured', zone: 'All zones', createdAt: 'Verified provider', image: 'ac', accent: 'blue', verified: true,
  },
  {
    id: 'service-2', type: 'service', title: 'Madinaty Move', subtitle: 'Careful moving for apartments & villas', category: 'Moving', rating: 4.8, reviewCount: 37,
    serviceArea: 'Service area to be configured', phone: '', response: 'Response time to be configured', zone: 'Zone 2 (configure)', createdAt: 'Verified provider', image: 'moving', accent: 'orange', verified: true,
  },
  {
    id: 'service-3', type: 'service', title: 'Kite Learning Studio', subtitle: 'Math & English tutoring for ages 7–16', category: 'Tutoring', rating: 4.7, reviewCount: 21,
    serviceArea: 'Service area to be configured', phone: '', response: 'Response time to be configured', zone: 'Zone 3 (configure)', createdAt: 'Verified provider', image: 'tutor', accent: 'lilac', verified: true,
  },
  {
    id: 'service-4', type: 'service', title: 'Paws & Paths', subtitle: 'Dog walking, sitting and home visits', category: 'Pet care', rating: 4.9, reviewCount: 16,
    serviceArea: 'Service area to be configured', phone: '', response: 'Response time to be configured', zone: 'Zone 4 (configure)', createdAt: 'Verified provider', image: 'pet', accent: 'mint', verified: true,
  },
];

export const businesses: Business[] = [
  {
    id: 'business-poultry-demo', type: 'business', title: 'Craft Zone Poultry · DEMO', subtitle: 'Fresh poultry, eggs & local delivery', category: 'Poultry & groceries', rating: 4.9, reviewCount: 12,
    hours: 'Daily · hours to be confirmed', phone: '', whatsapp: '', zone: 'Craft Zone (configure)', createdAt: 'Featured demo ad', image: 'poultry', accent: 'coral', verified: false, featured: true,
  },
  {
    id: 'business-1', type: 'business', title: 'The Brunch Club', subtitle: 'Coffee, breakfast & all-day plates', category: 'Restaurants', rating: 4.8, reviewCount: 213,
    hours: 'Opening hours to be configured', phone: '', zone: 'Zone 4 (configure)', createdAt: 'Business profile', image: 'brunch', accent: 'terracotta', verified: true, featured: true,
  },
  {
    id: 'business-2', type: 'business', title: 'Studio 8 Pilates', subtitle: 'Reformer, mat & private sessions', category: 'Health & fitness', rating: 4.9, reviewCount: 96,
    hours: 'Opening hours to be configured', phone: '', zone: 'Zone 4 (configure)', createdAt: 'Business profile', image: 'pilates', accent: 'plum', verified: true,
  },
  {
    id: 'business-3', type: 'business', title: 'Little Explorers Nursery', subtitle: 'Play-based early learning · ages 2–5', category: 'Kids & family', rating: 4.7, reviewCount: 48,
    hours: 'Opening hours to be configured', phone: '', zone: 'Zone 1 (configure)', createdAt: 'Business profile', image: 'nursery', accent: 'yellow', verified: true,
  },
];

export const offers: Offer[] = [
  {
    id: 'offer-1', type: 'offer', title: 'Local offer details to be configured', subtitle: 'Offer copy and terms are not set yet', category: 'Restaurants', business: 'The Brunch Club', discount: 'CONFIGURE OFFER', validUntil: 'Validity to be configured', zone: 'Zone 4 (configure)', createdAt: 'Local offer', image: 'dessert', accent: 'pink', featured: true,
  },
  {
    id: 'offer-2', type: 'offer', title: 'New member class offer', subtitle: 'Terms and eligibility to be configured', category: 'Health & fitness', business: 'Studio 8 Pilates', discount: 'CONFIGURE OFFER', validUntil: 'Validity to be configured', zone: 'Zone 4 (configure)', createdAt: 'Local offer', image: 'reformer', accent: 'violet',
  },
  {
    id: 'offer-3', type: 'offer', title: 'First order offer', subtitle: 'Offer terms and code to be configured', category: 'Food & coffee', business: 'Daily Dose Coffee', discount: 'CONFIGURE OFFER', validUntil: 'Validity to be configured', zone: 'Zone 2 (configure)', createdAt: 'Local offer', image: 'coffee', accent: 'brown',
  },
];

export const allResults = [...listings, ...services, ...businesses, ...offers];

export const formatPrice = (amount: number | null) => amount === null ? 'Price on request' : `EGP ${amount.toLocaleString('en-US')}`;

export const getResultLabel = (type: string) => ({ listing: 'For sale', service: 'Service', business: 'Business', offer: 'Offer' }[type] ?? type);
