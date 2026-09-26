import type { PublicSubmission } from './api';
import { kidsItemTypes, educationLevels, tutoringSubjects, homeServiceTypes, housekeepingTypes, fitnessProviderTypes, petBusinessTypes, serviceOfferKinds, type Listing, type SearchResult, type Service } from './types';

function serviceDetails(payload: Record<string, unknown>): Partial<Service> {
  const pick = <T extends string>(value: unknown, options: readonly T[]): T | undefined => typeof value === 'string' && options.includes(value as T) ? value as T : undefined;
  const offer = payload.offer as Record<string, unknown> | undefined;
  const kind = offer && pick(offer.kind, serviceOfferKinds);
  return {
    educationLevel: pick(payload.educationLevel, educationLevels),
    subjects: Array.isArray(payload.subjects) ? payload.subjects.filter((item): item is typeof tutoringSubjects[number] => Boolean(pick(item, tutoringSubjects))) : undefined,
    homeServiceType: pick(payload.homeServiceType, homeServiceTypes),
    housekeepingType: pick(payload.housekeepingType, housekeepingTypes),
    fitnessProviderType: pick(payload.fitnessProviderType, fitnessProviderTypes),
    petBusinessType: pick(payload.petBusinessType, petBusinessTypes),
    ...(kind && typeof offer?.discount === 'string' && typeof offer?.validUntil === 'string' ? { offer: { kind, discount: offer.discount, validUntil: offer.validUntil } } : {}),
  };
}

export function publicSubmissionResult(record: PublicSubmission): SearchResult | null {
  const payload = record.payload;
  if (record.kind === 'listing') {
    if (typeof payload.title !== 'string' || typeof payload.subtitle !== 'string' || typeof payload.category !== 'string' || typeof payload.zone !== 'string') return null;
    return { id: `submission-${record.id}`, publicAdId: `MD-${record.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`, type: 'listing', title: payload.title, subtitle: payload.subtitle, category: payload.category === 'Tutoring' ? 'Tutoring & education' : payload.category, zone: payload.zone, createdAt: record.createdAt, image: 'new', accent: 'lime', imageUrl: record.uploadIds[0] ? `/api/public-uploads/${record.uploadIds[0]}` : undefined, price: typeof payload.price === 'number' ? payload.price : null, condition: (typeof payload.condition === 'string' ? payload.condition : 'Good') as Listing['condition'], seller: record.seller, sellerVerified: record.verified, status: 'active', ...(payload.advertiserType === 'small_business' || payload.advertiserType === 'individual' ? { advertiserType: payload.advertiserType } : {}), ...(typeof payload.furnishing === 'string' ? { furnishing: payload.furnishing as Listing['furnishing'] } : {}), ...(typeof payload.vehicleType === 'string' && ['Cars', 'Motorcycles'].includes(payload.vehicleType) ? { vehicleType: payload.vehicleType as Listing['vehicleType'] } : {}), ...(typeof payload.groceryActivity === 'string' ? { groceryActivity: payload.groceryActivity as Listing['groceryActivity'] } : {}), ...(typeof payload.kidsItemType === 'string' && kidsItemTypes.includes(payload.kidsItemType as typeof kidsItemTypes[number]) ? { kidsItemType: payload.kidsItemType as Listing['kidsItemType'] } : {}) };
  }
  if (record.kind === 'store') {
    if (typeof payload.title !== 'string' || typeof payload.subtitle !== 'string' || payload.category !== 'Online Finds' || typeof payload.zone !== 'string') return null;
    return { id: `submission-${record.id}`, publicAdId: `MD-${record.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`, type: 'business', title: payload.title, subtitle: payload.subtitle, category: payload.category, zone: payload.zone, createdAt: record.createdAt, image: 'new-service', accent: 'mint', imageUrl: record.uploadIds[0] ? `/api/public-uploads/${record.uploadIds[0]}` : undefined, rating: 0, reviewCount: 0, hours: 'Delivery or pickup', phone: '', whatsapp: typeof payload.whatsapp === 'string' ? payload.whatsapp : undefined, socialAccount: typeof payload.socialAccount === 'string' ? payload.socialAccount : undefined, onlineStoreCategory: typeof payload.onlineStoreCategory === 'string' ? payload.onlineStoreCategory : undefined, verified: false, advertiserType: 'small_business' };
  }
  if (typeof payload.title !== 'string' || typeof payload.subtitle !== 'string' || typeof payload.category !== 'string' || typeof payload.zone !== 'string') return null;
  return { id: `submission-${record.id}`, publicAdId: `MD-${record.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`, type: 'service', title: payload.title, subtitle: payload.subtitle, category: payload.category === 'Tutoring' ? 'Tutoring & education' : payload.category, zone: payload.zone, createdAt: record.createdAt, image: 'new-service', accent: 'mint', imageUrl: record.uploadIds[0] ? `/api/public-uploads/${record.uploadIds[0]}` : undefined, rating: 0, reviewCount: 0, serviceArea: typeof payload.serviceArea === 'string' ? payload.serviceArea : payload.zone, providerName: typeof payload.providerName === 'string' ? payload.providerName : record.seller, phone: '', whatsapp: typeof payload.whatsapp === 'string' ? payload.whatsapp : undefined, socialAccount: typeof payload.socialAccount === 'string' ? payload.socialAccount : undefined, otherSubject: typeof payload.otherSubject === 'string' ? payload.otherSubject : undefined, response: 'Response time to be configured', ...serviceDetails(payload), verified: record.verified, ...(payload.advertiserType === 'small_business' || payload.advertiserType === 'individual' ? { advertiserType: payload.advertiserType } : {}), pricing: typeof payload.pricing === 'string' ? payload.pricing : undefined, availability: typeof payload.availability === 'string' ? payload.availability : undefined };
}
