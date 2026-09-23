import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { categories, formatPrice, zones } from './data';
import { useTranslation } from './i18n';
import { groceryActivities, listingConditionOptions, type GroceryActivity, type Listing, type ListingCondition, type RentalFurnishing } from './types';
import MediaUpload from './MediaUpload';
import { submitPost } from './api';
import PostingAudience from './PostingAudience';
import { splitCategories } from './categoryPolicy';
import type { AdvertiserType, BusinessRequest } from './types';

export default function ListingForm({ onPublish, residentVerified = false, rentalPostsThisMonth = 0 }: { onPublish: (listing: Listing, published: boolean) => void; residentVerified?: boolean; rentalPostsThisMonth?: number }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0].label);
  const [price, setPrice] = useState('');
  const [zone, setZone] = useState(zones[1]);
  const [condition, setCondition] = useState<ListingCondition>('Good');
  const [furnishing, setFurnishing] = useState<RentalFurnishing>('Unfurnished');
  const [groceryActivity, setGroceryActivity] = useState<GroceryActivity>('Grocery store');
  const [advertiserType, setAdvertiserType] = useState<AdvertiserType>('individual');
  const [businessRequest, setBusinessRequest] = useState<BusinessRequest>('posting');
  const [preview, setPreview] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isApartmentRental = category === 'Apartment rentals';
  const conditionOptions = listingConditionOptions(category);
  const valid = title.trim().length >= 5 && description.trim().length >= 10 && Number.isFinite(Number(price)) && Number(price) > 0;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    if (!preview) { setPreview(true); return; }
    const payload: Listing = { id: crypto.randomUUID(), type: 'listing', title: title.trim(), subtitle: description.trim(), category, ...(isApartmentRental ? { furnishing } : {}), ...(category === 'Groceries' ? { groceryActivity } : {}), ...(splitCategories.includes(category) ? { advertiserType, ...(advertiserType === 'small_business' ? { businessRequest } : {}) } : {}), price: Number(price), condition, seller: 'Sheref H.', sellerVerified: false, zone, createdAt: 'Just now', image: 'new', accent: 'lime', status: 'active' };
    setBusy(true); setError('');
    try { const result = await submitPost('listing', payload, photos); onPublish(payload, result.published === true); }
    catch (cause) { setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')); }
    finally { setBusy(false); }
  }
  return <form className="modal-form" onSubmit={submit}>
    <PostingAudience category={category} value={advertiserType} request={businessRequest} onChange={setAdvertiserType} onRequestChange={setBusinessRequest} preview={preview} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <ol className="listing-steps" aria-label={t('Listing progress')}><li aria-current={!preview ? 'step' : undefined}>{t('1. Item details')}</li><li aria-current={preview ? 'step' : undefined}>{t('2. Preview')}</li></ol>
    {preview ? <section className="listing-preview" aria-label={t('Listing preview')}>
      <span className="eyebrow">{t('Listing preview')}</span>
      <h3 dir="auto">{title}</h3><p dir="auto">{description}</p>
      <strong>{t(formatPrice(Number(price)))}</strong>
      <dl><dt>{t('Category')}</dt><dd>{t(category)}</dd>{isApartmentRental && <><dt>{t('Furnishing')}</dt><dd>{t(furnishing)}</dd></>}{category === 'Groceries' && <><dt>{t('Business type')}</dt><dd>{t(groceryActivity)}</dd></>}{!isApartmentRental && category !== 'Groceries' && <><dt>{t('Condition')}</dt><dd>{t(condition)}</dd></>}<dt>{t('Broad zone')}</dt><dd>{t(zone)}</dd></dl>
      <p className="privacy-note"><ShieldCheck size={16} />{t('Apartment details stay private')}</p>
    </section> : <>
      <p className="modal-intro">{t('Tell neighbours what makes your item useful. Mention any wear or defects so they know what to expect.')}</p>
      {isApartmentRental && <div className="rental-policy-note"><ShieldCheck size={17} /><span><b>{t('Resident-only apartment rentals')}</b><small>{residentVerified ? t('Verified residents may post one apartment rental per calendar month.') : t('You must verify that you live in Madinaty before posting an apartment rental. Brokers and dealers are not allowed.')}</small>{residentVerified && <small>{t(`${Math.max(0, 1 - rentalPostsThisMonth)} rental post remaining this month`)}</small>}</span></div>}
      <label>{t('What are you selling?')}<input autoFocus dir="auto" value={title} onChange={event => setTitle(event.target.value)} placeholder={t('e.g. Solid oak coffee table')} minLength={5} maxLength={120} required /></label>
      <div className="form-row"><label>{t('Category')}<select value={category} onChange={event => { const nextCategory = event.target.value; setCategory(nextCategory); setCondition(nextCategory === 'Apartment rentals' ? 'Well maintained' : listingConditionOptions(nextCategory)[0]); }}>{categories.filter(item => ['sofa', 'monitor', 'baby', 'car-front', 'building', 'shopping-basket'].includes(item.icon)).map(item => <option value={item.label} key={item.label}>{t(item.label)}</option>)}</select></label>
      <label>{t('Price (EGP)')}<input type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0" required /></label></div>
      <label>{t('Description')}<textarea dir="auto" rows={4} minLength={10} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('Size, age, included accessories and any signs of use')} required /></label>
      <MediaUpload files={photos} onChange={setPhotos} />
      {!isApartmentRental && category !== 'Groceries' && <div className="form-row"><label>{t('Condition')}<select value={conditionOptions.includes(condition) ? condition : conditionOptions[0]} onChange={event => setCondition(event.target.value as ListingCondition)}>{conditionOptions.map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>
      <label>{t('Broad zone')}<select value={zone} onChange={event => setZone(event.target.value)}>{zones.slice(1).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label></div>}
      {category === 'Groceries' && <div className="form-row"><label>{t('Business type')}<select value={groceryActivity} onChange={event => setGroceryActivity(event.target.value as GroceryActivity)}>{groceryActivities.map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label><label>{t('Broad zone')}<select value={zone} onChange={event => setZone(event.target.value)}>{zones.slice(1).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label></div>}
      {isApartmentRental && <><div className="form-row"><label>{t('Furnishing')}<select value={furnishing} onChange={event => setFurnishing(event.target.value as RentalFurnishing)}><option value="Furnished">{t('Furnished')}</option><option value="Unfurnished">{t('Unfurnished')}</option></select></label><label>{t('Broad zone')}<select value={zone} onChange={event => setZone(event.target.value)}>{zones.slice(1).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label></div></>}
    </>}
    <div className="modal-foot">
      {preview ? <button className="button button-outline" type="button" disabled={busy} onClick={() => setPreview(false)}>{t('Edit details')}</button> : <span className="privacy-note"><ShieldCheck size={15} />{t('Apartment details stay private')}</span>}
      <button className="button button-accent" type="submit" disabled={!valid || busy}>{t(busy ? 'Please wait…' : preview ? 'Publish listing' : 'Preview listing')}<ArrowRight size={16} /></button>
    </div>
    <p className="modal-intro">{t('Most posts publish immediately. Safety or commercial checks may hold a post for review.')}</p>
  </form>;
}
