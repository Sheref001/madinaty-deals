import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { categories, formatPrice, zones } from './data';
import { useTranslation } from './i18n';
import { groceryActivities, kidsItemTypes, listingConditionOptions, vehicleTypes, type GroceryActivity, type KidsItemType, type Listing, type ListingCondition, type RentalFurnishing, type VehicleType } from './types';
import MediaUpload from './MediaUpload';
import { submitPost } from './api';
import PostingAudience from './PostingAudience';
import { businessOnlyCategories, individualOnlyCategories } from './categoryPolicy';
import type { AdvertiserType, BusinessRequest } from './types';

const listingCategories = categories.filter(item => ['sofa', 'monitor', 'baby', 'car-front', 'building', 'shopping-basket'].includes(item.icon));
type ListingDraft = { savedAt: number; category: string; title: string; description: string; price: string; zone: string; condition: ListingCondition; furnishing: RentalFurnishing; vehicleType: VehicleType; groceryActivity: GroceryActivity; kidsItemType?: KidsItemType; advertiserType: AdvertiserType | ''; businessRequest: BusinessRequest };
const draftKey = (accountId: string) => `madinaty-listing-draft:${accountId || 'local'}`;
function readDraft(accountId: string): ListingDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(accountId)) || 'null');
    return value && typeof value.savedAt === 'number' && Date.now() - value.savedAt < 30 * 86400000 && listingCategories.some(item => item.label === value.category) ? value as ListingDraft : null;
  } catch { return null; }
}

export default function ListingForm({ onPublish, onVerify, accountId = '', residentVerified = false, rentalPostsThisMonth = 0 }: { onPublish: (listing: Listing, published: boolean) => void; onVerify?: () => void; accountId?: string; residentVerified?: boolean; rentalPostsThisMonth?: number }) {
  const { t } = useTranslation();
  const [draft] = useState(() => readDraft(accountId));
  const [stage, setStage] = useState<'setup' | 'details' | 'preview'>('setup');
  const [title, setTitle] = useState(draft?.title || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [category, setCategory] = useState(draft?.category || '');
  const [price, setPrice] = useState(draft?.price || '');
  const [zone, setZone] = useState(draft?.zone || zones[1]);
  const [condition, setCondition] = useState<ListingCondition>(draft?.condition || 'Good');
  const [furnishing, setFurnishing] = useState<RentalFurnishing>(draft?.furnishing || 'Unfurnished');
  const [vehicleType, setVehicleType] = useState<VehicleType>(draft?.vehicleType || 'Cars');
  const [groceryActivity, setGroceryActivity] = useState<GroceryActivity>(draft?.groceryActivity || 'Grocery store');
  const [kidsItemType, setKidsItemType] = useState<KidsItemType | ''>(draft?.kidsItemType || '');
  const [advertiserType, setAdvertiserType] = useState<AdvertiserType | ''>(draft?.advertiserType || '');
  const [businessRequest, setBusinessRequest] = useState<BusinessRequest>(draft?.businessRequest || 'posting');
  const [draftSaved, setDraftSaved] = useState(Boolean(draft));
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isApartmentRental = category === 'Apartment rentals';
  const isVehicle = category === 'Cars & motorcycles';
  const needsVerification = (isVehicle || isApartmentRental) && !residentVerified;
  const effectiveAdvertiserType: AdvertiserType | '' = businessOnlyCategories.includes(category) ? 'small_business' : individualOnlyCategories.includes(category) ? 'individual' : advertiserType;
  const setupValid = Boolean(category && effectiveAdvertiserType && !needsVerification);
  const conditionOptions = listingConditionOptions(category);
  const valid = title.trim().length >= 5 && description.trim().length >= 10 && Number.isFinite(Number(price)) && Number(price) > 0 && (category !== 'Kids & family' || Boolean(kidsItemType));
  function saveDraft() {
    try {
      localStorage.setItem(draftKey(accountId), JSON.stringify({ savedAt: Date.now(), category, title, description, price, zone, condition, furnishing, vehicleType, groceryActivity, kidsItemType: kidsItemType || undefined, advertiserType, businessRequest } satisfies ListingDraft));
      setDraftSaved(true);
    } catch { setError(t('Could not save this draft on this browser.')); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!setupValid || !valid || busy || stage !== 'preview') return;
    const payload: Listing = { id: crypto.randomUUID(), type: 'listing', title: title.trim(), subtitle: description.trim(), category, ...(isApartmentRental ? { furnishing } : {}), ...(isVehicle ? { vehicleType } : {}), ...(category === 'Groceries' ? { groceryActivity } : {}), ...(category === 'Kids & family' && kidsItemType ? { kidsItemType } : {}), advertiserType: effectiveAdvertiserType as AdvertiserType, ...(effectiveAdvertiserType === 'small_business' && !businessOnlyCategories.includes(category) ? { businessRequest } : {}), price: Number(price), condition, seller: 'Sheref H.', sellerVerified: false, zone, createdAt: 'Just now', image: 'new', accent: 'lime', status: 'active' };
    setBusy(true); setError('');
    try { const result = await submitPost('listing', payload, photos); localStorage.removeItem(draftKey(accountId)); onPublish(payload, result.published === true); }
    catch (cause) { setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')); }
    finally { setBusy(false); }
  }
  return <form className="modal-form" onSubmit={submit}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <ol className="listing-steps" aria-label={t('Listing progress')}><li aria-current={stage === 'setup' ? 'step' : undefined}>{t('1. Category & poster')}</li><li aria-current={stage === 'details' ? 'step' : undefined}>{t('2. Details')}</li><li aria-current={stage === 'preview' ? 'step' : undefined}>{t('3. Preview')}</li></ol>
    {stage === 'setup' ? <>
      <p className="modal-intro">{t('Choose the category first so we can show the right posting rules.')}</p>
      <label>{t('Category')}<select autoFocus value={category} onChange={event => { const next = event.target.value; setCategory(next); setAdvertiserType(''); setCondition(next === 'Apartment rentals' ? 'Well maintained' : listingConditionOptions(next)[0]); }}><option value="" disabled>{t('Select a category')}</option>{listingCategories.map(item => <option value={item.label} key={item.label}>{t(item.label)}</option>)}</select></label>
      {isVehicle && <label>{t('Vehicle type')}<select value={vehicleType} onChange={event => setVehicleType(event.target.value as VehicleType)}>{vehicleTypes.map(type => <option key={type} value={type}>{t(type)}</option>)}</select></label>}
      {isApartmentRental && <label>{t('Furnishing')}<select value={furnishing} onChange={event => setFurnishing(event.target.value as RentalFurnishing)}><option value="Furnished">{t('Furnished')}</option><option value="Unfurnished">{t('Unfurnished')}</option></select></label>}
      {category === 'Groceries' && <label>{t('Business type')}<select value={groceryActivity} onChange={event => setGroceryActivity(event.target.value as GroceryActivity)}>{groceryActivities.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>}
      <PostingAudience category={category} value={advertiserType} request={businessRequest} onChange={setAdvertiserType} onRequestChange={setBusinessRequest} />
      {needsVerification && <div className="rental-policy-note"><ShieldCheck size={17} /><span><b>{t(isVehicle ? 'Resident-only vehicle listings' : 'Resident-only apartment rentals')}</b><small>{t(isVehicle ? 'Verify that you live in Madinaty before posting a car or motorcycle.' : 'You must verify that you live in Madinaty before posting an apartment rental. Brokers and dealers are not allowed.')}</small>{onVerify && <button className="button button-outline" type="button" onClick={() => { saveDraft(); onVerify(); }}>{t('Save draft and verify residence')}</button>}</span></div>}
      {isApartmentRental && residentVerified && <p className="modal-intro">{t(`${Math.max(0, 1 - rentalPostsThisMonth)} rental post remaining this month`)}</p>}
      {draftSaved && <p className="draft-note">{t('Draft saved on this browser. Photos must be selected again.')}</p>}
    </> : stage === 'preview' ? <section className="listing-preview" aria-label={t('Listing preview')}>
      <span className="eyebrow">{t('Listing preview')}</span>
      <h3 dir="auto">{title}</h3><p dir="auto">{description}</p>
      <strong>{t(formatPrice(Number(price)))}</strong>
      <dl><dt>{t('Category')}</dt><dd>{t(category)}</dd><dt>{t('Posting as')}</dt><dd>{t(effectiveAdvertiserType === 'small_business' ? 'Business' : 'Individual')}</dd>{category === 'Kids & family' && <><dt>{t('Kids item section')}</dt><dd>{t(kidsItemType)}</dd></>}{isVehicle && <><dt>{t('Vehicle type')}</dt><dd>{t(vehicleType)}</dd></>}{isApartmentRental && <><dt>{t('Furnishing')}</dt><dd>{t(furnishing)}</dd></>}{category === 'Groceries' && <><dt>{t('Business type')}</dt><dd>{t(groceryActivity)}</dd></>}{!isApartmentRental && category !== 'Groceries' && <><dt>{t('Condition')}</dt><dd>{t(condition)}</dd></>}<dt>{t('Broad zone')}</dt><dd>{t(zone)}</dd></dl>
      {effectiveAdvertiserType === 'small_business' && <p>{t('Business posts wait for fee agreement and review.')}</p>}
      <p className="privacy-note"><ShieldCheck size={16} />{t(isApartmentRental ? 'Apartment details stay private' : 'Verification evidence stays private')}</p>
    </section> : <>
      <p className="modal-intro">{t('Tell neighbours what makes your item useful. Mention any wear or defects so they know what to expect.')}</p>
      {category === 'Kids & family' && <label>{t('Kids item section')}<select value={kidsItemType} onChange={event => setKidsItemType(event.target.value as KidsItemType)} required><option value="" disabled>{t('Choose a section')}</option>{kidsItemTypes.map(type => <option key={type} value={type}>{t(type)}</option>)}</select></label>}
      <label>{t('Price (EGP)')}<input type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0" required /></label>
      <label>{t('What are you selling?')}<input dir="auto" value={title} onChange={event => setTitle(event.target.value)} placeholder={t('e.g. Solid oak coffee table')} minLength={5} maxLength={120} required /></label>
      <label>{t('Description')}<textarea dir="auto" rows={4} minLength={10} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('Size, age, included accessories and any signs of use')} required /></label>
      <MediaUpload files={photos} onChange={setPhotos} />
      {!isApartmentRental && category !== 'Groceries' && <div className="form-row"><label>{t('Condition')}<select value={conditionOptions.includes(condition) ? condition : conditionOptions[0]} onChange={event => setCondition(event.target.value as ListingCondition)}>{conditionOptions.map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>
      <label>{t('Broad zone')}<select value={zone} onChange={event => setZone(event.target.value)}>{zones.slice(1).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label></div>}
      {(category === 'Groceries' || isApartmentRental) && <label>{t('Broad zone')}<select value={zone} onChange={event => setZone(event.target.value)}>{zones.slice(1).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>}
    </>}
    <div className="modal-foot">
      {stage === 'preview' ? <button className="button button-outline" type="button" disabled={busy} onClick={() => setStage('details')}>{t('Edit details')}</button> : stage === 'details' ? <button className="button button-outline" type="button" onClick={() => setStage('setup')}>{t('Back to category')}</button> : <span className="privacy-note"><ShieldCheck size={15} />{t(isApartmentRental ? 'Apartment details stay private' : 'Verification evidence stays private')}</span>}
      {stage === 'details' && <button className="button button-outline" type="button" onClick={saveDraft}>{t('Save draft')}</button>}
      {stage === 'setup' ? <button className="button button-accent" type="button" disabled={!setupValid} onClick={() => setStage('details')}>{t('Continue to details')}<ArrowRight size={16} /></button> : stage === 'details' ? <button className="button button-accent" type="button" disabled={!valid} onClick={() => setStage('preview')}>{t('Preview listing')}<ArrowRight size={16} /></button> : <button className="button button-accent" type="submit" disabled={!setupValid || !valid || busy}>{t(busy ? 'Please wait…' : 'Publish listing')}<ArrowRight size={16} /></button>}
    </div>
    <p className="modal-intro">{t('Most posts publish immediately. Safety or commercial checks may hold a post for review.')}</p>
  </form>;
}
