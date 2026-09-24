export const zones = [
  'All zones',
  'B1', 'B2', 'B3', 'B6', 'B7', 'B8', 'B9 + B13', 'B10', 'B11', 'B12', 'B14', 'B15',
  'Privado', 'VG1', 'VG2', 'VG3', 'VG4', 'VG5', 'The Lake Villas',
  'Craft Zone', 'East Hub', 'Open Air Mall', 'Arabesque', 'South Park', 'Central Park',
  'Banks Area', 'All Seasons Park', 'The Strip', 'Madinaty Central', 'Medical Center',
  'Madinaty City Hall', 'Main Bus Station', 'Madinaty Golf Club', 'Madinaty Sporting Club', 'Four Seasons Madinaty',
];

export const categories = [
  { label: 'Furniture & home', icon: 'sofa', photo: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Electronics', icon: 'monitor', photo: 'https://images.unsplash.com/photo-1624823183493-ed5832f48f18?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Kids & family', icon: 'baby', photo: 'https://images.unsplash.com/photo-1696563541384-bf48ecbaac45?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Cars & motorcycles', icon: 'car-front', photo: 'https://plus.unsplash.com/premium_photo-1661369981367-914fd4081355?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Apartment rentals', icon: 'building', photo: '/images/madinaty-rentals.webp' },
  { label: 'Home services', icon: 'wrench', photo: 'https://images.unsplash.com/photo-1717281234297-3def5ae3eee1?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Housekeeping & cleaning', icon: 'sparkles', photo: 'https://plus.unsplash.com/premium_photo-1723572010850-e6551746f4de?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Local delivery riders', icon: 'bike', photo: 'https://images.unsplash.com/photo-1659493000588-c3f35d630905?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Tutoring & education', icon: 'graduation-cap', photo: 'https://plus.unsplash.com/premium_photo-1681248156475-be7454b5d54b?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Groceries', icon: 'shopping-basket', photo: 'https://www.foodbusinessmea.com/wp-content/uploads/2022/12/Food-Tank2.jpg' },
  { label: 'Online Finds', icon: 'store', photo: 'https://images.pexels.com/photos/7667442/pexels-photo-7667442.jpeg?auto=compress&dpr=1&h=750&w=1260' },
  { label: 'Health & fitness', icon: 'heart-pulse', photo: 'https://plus.unsplash.com/premium_photo-1726614172307-15106d1750cd?auto=format&fit=crop&w=1200&q=88' },
  { label: 'Pet care', icon: 'paw-print', adminOnly: true },
  { label: 'Deals & promotions', icon: 'tag', photo: '/images/madinaty-offers.webp' },
];

export const formatPrice = (amount: number | null) => amount === null ? 'Price on request' : `EGP ${amount.toLocaleString('en-US')}`;

export const getResultLabel = (type: string) => ({ listing: 'For sale', service: 'Service', business: 'Business', offer: 'Offer' }[type] ?? type);
