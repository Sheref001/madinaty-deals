export type View = 'home' | 'browse' | 'services' | 'businesses' | 'offers' | 'saved' | 'admin' | 'search' | 'account' | 'activity' | 'my-listings';
export type ResultType = 'listing' | 'service' | 'business' | 'offer';
export const listingConditionSets = {
  'Furniture & home': ['New', 'Like new', 'Good', 'Fair'] as const,
  Electronics: ['New', 'Like new', 'Fully working - used', 'Needs repair'] as const,
  'Kids & family': ['New', 'Like new', 'Good used condition', 'Worn'] as const,
  'Cars & motorcycles': ['New', 'Excellent', 'Good', 'Needs repair'] as const,
  'Apartment rentals': ['Newly finished', 'Well maintained', 'Needs renovation'] as const,
} as const;
export type ListingCondition = typeof listingConditionSets[keyof typeof listingConditionSets][number];
const generalListingConditions: ListingCondition[] = ['New', 'Like new', 'Good', 'Fair'];
export function listingConditionOptions(category?: string): ListingCondition[] {
  return category && category in listingConditionSets
    ? [...listingConditionSets[category as keyof typeof listingConditionSets]]
    : generalListingConditions;
}
export type RentalFurnishing = 'Furnished' | 'Unfurnished';
export const vehicleTypes = ['Cars', 'Motorcycles'] as const;
export type VehicleType = typeof vehicleTypes[number];
export const transportServiceTypes = ['Moving furniture', 'Private transportation'] as const;
export const groceryActivities = ['Grocery store', 'Butcher', 'Poultry', 'Bakery', 'Fishmonger', 'Fruits & vegetables', 'Dairy & cheese'] as const;
export type GroceryActivity = typeof groceryActivities[number];
export const kidsItemTypes = ['Baby gear', 'Clothing & shoes', 'Toys & games', 'Books & learning', 'Other kids items'] as const;
export type KidsItemType = typeof kidsItemTypes[number];
export const educationLevels = ['Before university', 'University'] as const;
export type EducationLevel = typeof educationLevels[number];
export const tutoringSubjects = ['Quran', 'Mathematics', 'English', 'Arabic', 'Physics', 'Chemistry', 'Biology', 'French', 'German', 'Computer science'] as const;
export type TutoringSubject = typeof tutoringSubjects[number];
export const homeServiceTypes = ['Electrician', 'Plumber', 'AC technician', 'Painter', 'Carpenter', 'General maintenance'] as const;
export type HomeServiceType = typeof homeServiceTypes[number];
export const housekeepingTypes = ['General cleaning', 'Deep cleaning', 'Move-in/move-out cleaning', 'Upholstery & carpet cleaning'] as const;
export type HousekeepingType = typeof housekeepingTypes[number];
export const fitnessProviderTypes = ['Fitness center', 'Personal trainers'] as const;
export type FitnessProviderType = typeof fitnessProviderTypes[number];
export const petBusinessTypes = ['Veterinary clinics', 'Pet shops'] as const;
export type PetBusinessType = typeof petBusinessTypes[number];
export const serviceOfferKinds = ['First session free', 'Buy two, get one free', 'Percentage discount', 'Fixed amount discount'] as const;
export type ServiceOfferKind = typeof serviceOfferKinds[number];

export type AdvertiserType = 'individual' | 'small_business';
export type BusinessRequest = 'posting' | 'authentication' | 'both';

export interface BaseResult {
  publicAdId?: string;
  imageUrl?: string;
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
  vehicleType?: VehicleType;
  groceryActivity?: GroceryActivity;
  kidsItemType?: KidsItemType;
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
  providerName?: string;
  whatsapp?: string;
  socialAccount?: string;
  response: string;
  pricing?: string;
  availability?: string;
  educationLevel?: EducationLevel;
  subjects?: TutoringSubject[];
  otherSubject?: string;
  homeServiceType?: HomeServiceType;
  housekeepingType?: HousekeepingType;
  fitnessProviderType?: FitnessProviderType;
  petBusinessType?: PetBusinessType;
  offer?: { kind: ServiceOfferKind; discount: string; validUntil: string };
}

export interface Business extends BaseResult {
  type: 'business';
  category: string;
  rating: number;
  reviewCount: number;
  hours: string;
  phone: string;
  whatsapp?: string;
  socialAccount?: string;
  onlineStoreCategory?: string;
  featured?: boolean;
  groceryActivity?: GroceryActivity;
  fitnessProviderType?: FitnessProviderType;
  petBusinessType?: PetBusinessType;
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
