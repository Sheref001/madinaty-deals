import type { Business, Listing, Offer, Service } from './types';

// Real Madinaty areas, using the names residents and local maps use.
// Residential groups are followed by villa areas and major service/destination areas.
export const zones = [
  'All zones',
  'B1', 'B2', 'B3', 'B6', 'B7', 'B8', 'B9 + B13', 'B10', 'B11', 'B12', 'B14', 'B15',
  'Privado', 'VG1', 'VG2', 'VG3', 'VG4', 'VG5', 'The Lake Villas',
  'Craft Zone', 'East Hub', 'Open Air Mall', 'Arabesque', 'South Park', 'Central Park',
  'Banks Area', 'All Seasons Park', 'The Strip', 'Madinaty Central', 'Medical Center',
  'Madinaty City Hall', 'Main Bus Station', 'Madinaty Golf Club', 'Madinaty Sporting Club', 'Four Seasons Madinaty',
];

export const categories = [
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Furniture & home', icon: 'sofa', count: 128, photo: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1200&q=88' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Electronics', icon: 'monitor', count: 86, photo: 'https://images.unsplash.com/photo-1624823183493-ed5832f48f18?auto=format&fit=crop&w=1200&q=88' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Kids & family', icon: 'baby', count: 74, photo: 'https://images.unsplash.com/photo-1696563541384-bf48ecbaac45?auto=format&fit=crop&w=1200&q=88' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Cars & motorcycles', icon: 'car-front', count: 36, photo: 'https://plus.unsplash.com/premium_photo-1661369981367-914fd4081355?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Apartment rentals', icon: 'building', count: 12, photo: '/images/madinaty-rentals.webp' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Home services', icon: 'wrench', count: 52, photo: 'https://images.unsplash.com/photo-1717281234297-3def5ae3eee1?auto=format&fit=crop&w=1200&q=88' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Housekeeping & cleaning', icon: 'sparkles', count: 1, photo: 'https://plus.unsplash.com/premium_photo-1723572010850-e6551746f4de?auto=format&fit=crop&w=1200&q=88' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Local delivery riders', icon: 'bike', count: 1, photo: 'https://images.unsplash.com/photo-1659493000588-c3f35d630905?auto=format&fit=crop&w=1200&q=88' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Tutoring & education', icon: 'graduation-cap', count: 24, photo: 'https://plus.unsplash.com/premium_photo-1681248156475-be7454b5d54b?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Deals & promotions', icon: 'tag', count: 3, photo: '/images/madinaty-offers.webp' },
  // Demo image requested from Food Business Middle East & Africa; confirm permission before production use.
  { label: 'Groceries', icon: 'shopping-basket', count: 18, photo: 'https://www.foodbusinessmea.com/wp-content/uploads/2022/12/Food-Tank2.jpg' },
  // Photo: Unsplash contributor, from the user-provided reference photo.
  { label: 'Health & fitness', icon: 'heart-pulse', count: 29, photo: 'https://plus.unsplash.com/premium_photo-1726614172307-15106d1750cd?auto=format&fit=crop&w=1200&q=88' },
];

export const listings: Listing[] = [
  {
    id: 'listing-1', publicAdId: 'MD-RNR3YY868D', type: 'listing', title: 'Solid oak dining table', subtitle: 'Seats 6 · lightly used · pickup only', category: 'Furniture & home', price: null,
    condition: 'Good', seller: 'Mariam H.', sellerVerified: true, zone: 'B1', createdAt: '2 hours ago', image: 'table', accent: 'clay', status: 'active',
  },
  {
    id: 'listing-2', publicAdId: 'MD-BWAK8PSJRB', type: 'listing', title: 'LG 55” 4K Smart TV', subtitle: 'Perfect working condition · original remote', category: 'Electronics', price: null,
    condition: 'Fully working - used', seller: 'Omar A.', sellerVerified: true, zone: 'B2', createdAt: '5 hours ago', image: 'tv', accent: 'navy', status: 'active',
  },
  {
    id: 'listing-3', publicAdId: 'MD-S3ZDZY9SXV', type: 'listing', title: 'Stokke Tripp Trapp chair', subtitle: 'Natural wood · includes baby set', category: 'Kids & family', price: 9800,
    condition: 'Like new', seller: 'Nour E.', zone: 'B3', createdAt: 'Yesterday', image: 'chair', accent: 'sage', status: 'active',
  },
  {
    id: 'listing-4', publicAdId: 'MD-83Q8CX8HUU', type: 'listing', title: 'IKEA Hemnes shoe cabinet', subtitle: 'White · four compartments · some wear', category: 'Furniture & home', price: null,
    condition: 'Fair', seller: 'Hany M.', zone: 'B6', createdAt: 'Yesterday', image: 'cabinet', accent: 'sand', status: 'reserved',
  },
  {
    id: 'listing-5', publicAdId: 'MD-Q7EHXNF9Q6', type: 'listing', title: 'Foldable kids scooter', subtitle: 'Ages 5–9 · barely used', category: 'Kids & family', price: null,
    condition: 'Like new', seller: 'Salma K.', sellerVerified: true, zone: 'B7', createdAt: '2 days ago', image: 'scooter', accent: 'coral', status: 'active',
  },
];

export const services: Service[] = [
  {
    id: 'service-1', publicAdId: 'MD-3Y6HWDLU45', type: 'service', title: 'Cool Point AC Services', subtitle: 'Installation, maintenance & repair', category: 'Home services', rating: 4.9, reviewCount: 84,
    serviceArea: 'Madinaty-wide', phone: '', response: 'Response time to be configured', homeServiceType: 'AC technician', zone: 'All zones', createdAt: 'Verified provider', image: 'ac', accent: 'blue', verified: true,
  },
  {
    id: 'service-2', publicAdId: 'MD-3U9CHSMVJ5', type: 'service', title: 'Madinaty Move', subtitle: 'Careful moving for apartments & villas', category: 'Moving', rating: 4.8, reviewCount: 37,
    serviceArea: 'Madinaty-wide', phone: '', response: 'Response time to be configured', zone: 'B8', createdAt: 'Verified provider', image: 'moving', accent: 'orange', verified: true,
  },
  {
    id: 'service-3', publicAdId: 'MD-VM8MQ8ZSWK', advertiserType: 'small_business', type: 'service', title: 'Kite Learning Studio', subtitle: 'Math & English tutoring for ages 7–16', category: 'Tutoring & education', rating: 4.7, reviewCount: 21,
    serviceArea: 'Madinaty-wide', phone: '', response: 'Response time to be configured', educationLevel: 'Before university', subjects: ['Mathematics', 'English'], zone: 'B10', createdAt: 'Verified provider', image: 'tutor', accent: 'lilac', verified: true,
  },
  {
    id: 'service-tutor-demo', publicAdId: 'MD-TJ4WXHZAPK', type: 'service', title: 'Sheref · Math Tutor · DEMO', subtitle: 'Experienced math tutor for International and Thanaweya Amma schools', category: 'Tutoring & education', rating: 5, reviewCount: 0,
    serviceArea: 'Madinaty-wide', phone: '+201226666391', whatsapp: '+201226666391', response: 'Usually replies quickly', educationLevel: 'Before university', subjects: ['Mathematics'], zone: 'B10', createdAt: 'Demo profile', image: 'tutor', accent: 'lilac', verified: false,
  },
  {
    id: 'service-english-tutor-demo', publicAdId: 'MD-2BQMAD9ZDR', type: 'service', title: 'Nehal · English Tutor · DEMO', subtitle: 'Experienced English tutor for school students and exam preparation', category: 'Tutoring & education', rating: 5, reviewCount: 0,
    serviceArea: 'Madinaty-wide', phone: '+13433639621', whatsapp: '+13433639621', response: 'Usually replies quickly', educationLevel: 'Before university', subjects: ['English'], zone: 'B10', createdAt: 'Demo profile', image: 'tutor', accent: 'lilac', verified: false,
  },
  {
    id: 'service-4', publicAdId: 'MD-EWEAA2Z4Y2', type: 'service', title: 'Paws & Paths', subtitle: 'Dog walking, sitting and home visits', category: 'Pet care', rating: 4.9, reviewCount: 16,
    serviceArea: 'Madinaty-wide', phone: '', response: 'Response time to be configured', zone: 'B11', createdAt: 'Verified provider', image: 'pet', accent: 'mint', verified: true,
  },
  {
    id: 'service-cleaning-demo', publicAdId: 'MD-NHXCV537G3', type: 'service', title: 'Madinaty Home Care · DEMO', subtitle: 'Housekeeping, deep cleaning & move-in cleaning', category: 'Housekeeping & cleaning', rating: 0, reviewCount: 0,
    serviceArea: 'Madinaty-wide', phone: '', response: 'Response time to be configured', housekeepingType: 'General cleaning', zone: 'All zones', createdAt: 'Community provider', image: 'cleaning', accent: 'blue', verified: false,
  },
  {
    id: 'service-delivery-noor-demo', publicAdId: 'MD-4AFAKH484Q', type: 'service', title: 'Noor (نور) · Delivery Rider · DEMO', subtitle: 'Motorcycle pickup and delivery within Madinaty', category: 'Local delivery riders', rating: 5, reviewCount: 0,
    serviceArea: 'Madinaty-wide', phone: '+201009878120', whatsapp: '+201009878120', response: 'Usually replies quickly', zone: 'All zones', createdAt: 'Demo profile', image: 'delivery', accent: 'orange', verified: false,
  },
];

export const businesses: Business[] = [
  {
    id: 'business-poultry-demo', publicAdId: 'MD-B7VJ5GFCHA', type: 'business', title: 'Craft Zone Poultry · DEMO', subtitle: 'Fresh poultry, eggs & fast local delivery', category: 'Groceries', rating: 4.9, reviewCount: 12,
    hours: 'Daily · hours to be confirmed', phone: '', whatsapp: '', groceryActivity: 'Poultry', zone: 'Craft Zone', createdAt: 'Featured demo ad', image: 'poultry', accent: 'coral', verified: false, featured: true,
  },
  {
    id: 'business-1', publicAdId: 'MD-WK3L9GV84R', type: 'business', title: 'The Brunch Club', subtitle: 'Coffee, breakfast & all-day plates', category: 'Restaurants', rating: 4.8, reviewCount: 213,
    hours: 'Opening hours to be configured', phone: '', zone: 'East Hub', createdAt: 'Business profile', image: 'brunch', accent: 'terracotta', verified: true, featured: true,
  },
  {
    id: 'business-2', publicAdId: 'MD-WWGNSSTGUR', type: 'business', title: 'Studio 8 Pilates', subtitle: 'Reformer, mat & private sessions', category: 'Health & fitness', rating: 4.9, reviewCount: 96,
    hours: 'Opening hours to be configured', phone: '', fitnessProviderType: 'Fitness center', zone: 'Madinaty Sporting Club', createdAt: 'Business profile', image: 'pilates', accent: 'plum', verified: true,
  },
  {
    id: 'business-3', publicAdId: 'MD-DSA9RD7WAU', type: 'business', title: 'Little Explorers Nursery', subtitle: 'Play-based early learning · ages 2–5', category: 'Kids & family', rating: 4.7, reviewCount: 48,
    hours: 'Opening hours to be configured', phone: '', zone: 'B12', createdAt: 'Business profile', image: 'nursery', accent: 'yellow', verified: true,
  },
];

export const offers: Offer[] = [
  {
    id: 'offer-1', publicAdId: 'MD-BXRAFBZX3T', type: 'offer', title: 'Local offer details to be configured', subtitle: 'Offer copy and terms are not set yet', category: 'Restaurants', business: 'The Brunch Club', discount: 'CONFIGURE OFFER', validUntil: 'Validity to be configured', zone: 'South Park', createdAt: 'Local offer', image: 'dessert', accent: 'pink', featured: true,
  },
  {
    id: 'offer-2', publicAdId: 'MD-JH47TKQXGS', type: 'offer', title: 'New member class offer', subtitle: 'Terms and eligibility to be configured', category: 'Health & fitness', business: 'Studio 8 Pilates', discount: 'CONFIGURE OFFER', validUntil: 'Validity to be configured', zone: 'Madinaty Sporting Club', createdAt: 'Local offer', image: 'reformer', accent: 'violet',
  },
  {
    id: 'offer-3', publicAdId: 'MD-G9QLHDY9BZ', type: 'offer', title: 'First order offer', subtitle: 'Offer terms and code to be configured', category: 'Food & coffee', business: 'Daily Dose Coffee', discount: 'CONFIGURE OFFER', validUntil: 'Validity to be configured', zone: 'Open Air Mall', createdAt: 'Local offer', image: 'coffee', accent: 'brown',
  },
];

export const allResults = [...listings, ...services, ...businesses, ...offers];

export const formatPrice = (amount: number | null) => amount === null ? 'Price on request' : `EGP ${amount.toLocaleString('en-US')}`;

export const getResultLabel = (type: string) => ({ listing: 'For sale', service: 'Service', business: 'Business', offer: 'Offer' }[type] ?? type);
