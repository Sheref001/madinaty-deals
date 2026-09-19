export type View = 'home' | 'browse' | 'services' | 'businesses' | 'offers' | 'saved' | 'admin' | 'search';
export type ResultType = 'listing' | 'service' | 'business' | 'offer';
export type ListingCondition = 'Like new' | 'Good' | 'Fair';
export type RentalFurnishing = 'Furnished' | 'Unfurnished';

export type AdvertiserType = 'individual' | 'small_business';
export type BusinessRequest = 'posting' | 'authentication' | 'both';

export interface BaseResult {
  publicAdId?: string;
  advertiserType?: AdvertiserType;
  businessRequest?: BusinessRequest;
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  zone: string;
  createdAt: string;
  verified?: boolean;
  image: string;
  accent: string;
  viewCount?: number;
}

export interface Listing extends BaseResult {
  type: 'listing';
  category: string;
  price: number | null;
  condition: ListingCondition;
  furnishing?: RentalFurnishing;
  seller: string;
  sellerVerified?: boolean;
  status: 'active' | 'reserved' | 'sold';
}

export interface Service extends BaseResult {
  type: 'service';
  category: string;
  rating: number;
  reviewCount: number;
  serviceArea: string;
  phone: string;
  whatsapp?: string;
  response: string;
}

export interface Business extends BaseResult {
  type: 'business';
  category: string;
  rating: number;
  reviewCount: number;
  hours: string;
  phone: string;
  whatsapp?: string;
  featured?: boolean;
}

export interface Offer extends BaseResult {
  type: 'offer';
  category: string;
  business: string;
  discount: string;
  validUntil: string;
  featured?: boolean;
}

export type SearchResult = Listing | Service | Business | Offer;

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  occurredAt: string;
}
