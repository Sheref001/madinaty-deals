import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { zones } from './data';
import { useTranslation } from './i18n';
import { educationLevels, fitnessProviderTypes, homeServiceTypes, housekeepingTypes, serviceOfferKinds, tutoringSubjects, type EducationLevel, type FitnessProviderType, type HomeServiceType, type HousekeepingType, type PetBusinessType, type Service, type ServiceOfferKind, type TutoringSubject } from './types';
import MediaUpload from './MediaUpload';
import { submitPost } from './api';
import PostingAudience from './PostingAudience';
import { splitCategories, businessOnlyCategories } from './categoryPolicy';
import type { AdvertiserType, BusinessRequest } from './types';

const serviceCategories = ['Tutoring & education', 'Health & fitness', 'Home services', 'Housekeeping & cleaning', 'Local delivery riders', 'Moving', 'Other local services'];
const serviceAreas = [{ value: 'All zones', label: 'All of Madinaty' }, ...zones.slice(1).map(value => ({ value, label: value }))];
const petBusinessType: PetBusinessType = 'Veterinary clinics';

export default function ServiceForm({ onPublish }: { onPublish: (service: Service) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [area, setArea] = useState(zones[1]);
  const [price, setPrice] = useState('');
  const [availability, setAvailability] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('Before university');
  const [subjects, setSubjects] = useState<TutoringSubject[]>(['Mathematics']);
  const [homeServiceType, setHomeServiceType] = useState<HomeServiceType>('General maintenance');
  const [housekeepingType, setHousekeepingType] = useState<HousekeepingType>('General cleaning');
  const [fitnessProviderType, setFitnessProviderType] = useState<FitnessProviderType>('Fitness center');
  const [advertiserType, setAdvertiserType] = useState<AdvertiserType>('individual');
  const [businessRequest, setBusinessRequest] = useState<BusinessRequest>('posting');
  const [offerEnabled, setOfferEnabled] = useState(false);
  const [offerKind, setOfferKind] = useState<ServiceOfferKind>('First session free');
  const [offerDiscount, setOfferDiscount] = useState('');
  const [offerValidUntil, setOfferValidUntil] = useState('');
  const [preview, setPreview] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const businessOnly = businessOnlyCategories.includes(category);
  const isTutoring = category === 'Tutoring & education';
  const promotionEligible = Boolean(category);
  const serviceAreaLabel = area === 'All zones' ? 'All of Madinaty' : area;
  const effectiveAdvertiserType = businessOnly ? 'small_business' : advertiserType;
  const validOffer = !offerEnabled || (offerDiscount.trim().length >= 2 && Boolean(offerValidUntil));
  const valid = Boolean(category) && title.trim().length >= 5 && description.trim().length >= 10 && whatsapp.trim().length >= 8 && (!isTutoring || subjects.length > 0) && validOffer;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    if (!preview) { setPreview(true); return; }
    const payload: Service = { id: crypto.randomUUID(), type: 'service', title: title.trim(), subtitle: description.trim(), category, ...(category === 'Tutoring & education' ? { educationLevel, subjects } : {}), ...(category === 'Home services' ? { homeServiceType } : {}), ...(category === 'Housekeeping & cleaning' ? { housekeepingType } : {}), ...(category === 'Health & fitness' ? { fitnessProviderType } : {}), ...(category === 'Pet care' ? { petBusinessType } : {}), ...((businessOnly || splitCategories.includes(category)) ? { advertiserType: effectiveAdvertiserType, ...(effectiveAdvertiserType === 'small_business' ? { businessRequest } : {}) } : {}), ...(offerEnabled && promotionEligible ? { offer: { kind: offerKind, discount: offerDiscount.trim(), validUntil: offerValidUntil } } : {}), serviceArea: area === 'All zones' ? 'Madinaty-wide' : area, phone: '', whatsapp: whatsapp.trim(), response: availability.trim() || 'Response time to be configured', pricing: price.trim() || undefined, availability: availability.trim() || undefined, rating: 0, reviewCount: 0, zone: area, createdAt: 'Just now', image: 'new-service', accent: 'mint', verified: false };
    setBusy(true); setError('');
    try { await submitPost('service', payload, photos); onPublish(payload); }
    catch (cause) { setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')); }
    finally { setBusy(false); }
  }
  return <form className="modal-form" onSubmit={submit}>
    <PostingAudience category={category} value={advertiserType} request={businessRequest} onChange={setAdvertiserType} onRequestChange={setBusinessRequest} preview={preview} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <ol className="listing-steps" aria-label={t('Service progress')}><li aria-current={!preview ? 'step' : undefined}>{t('1. Service details')}</li><li aria-current={preview ? 'step' : undefined}>{t('2. Preview')}</li></ol>
    {preview ? <section className="listing-preview" aria-label={t('Service preview')}><span className="eyebrow">{t('Service preview')}</span><h3 dir="auto">{title}</h3><p dir="auto">{description}</p><dl><dt>{t('Category')}</dt><dd>{t(category)}</dd>{isTutoring && <><dt>{t('Education stage')}</dt><dd>{t(educationLevel)}</dd><dt>{t('Subjects')}</dt><dd>{subjects.map(subject => t(subject)).join(', ')}</dd></>}{category === 'Home services' && <><dt>{t('Service type')}</dt><dd>{t(homeServiceType)}</dd></>}{category === 'Housekeeping & cleaning' && <><dt>{t('Cleaning type')}</dt><dd>{t(housekeepingType)}</dd></>}{category === 'Health & fitness' && <><dt>{t('Fitness provider')}</dt><dd>{t(fitnessProviderType)}</dd></>}{category === 'Pet care' && <><dt>{t('Pet business type')}</dt><dd>{t(petBusinessType)}</dd></>}{offerEnabled && promotionEligible && <><dt>{t('Promotion type')}</dt><dd>{t(offerKind)}</dd><dt>{t('Offer')}</dt><dd>{offerDiscount} · {offerValidUntil}</dd></>}<dt>{t('Service area')}</dt><dd>{t(serviceAreaLabel)}</dd><dt>{t('Pricing')}</dt><dd>{price.trim() || t('Contact for price')}</dd><dt>{t('Availability')}</dt><dd>{availability.trim() || t('To be confirmed')}</dd></dl><p className="privacy-note"><ShieldCheck size={16} />{t('Your phone stays private until you choose to share it.')}</p></section> : <><p className="modal-intro">{t('Tell neighbours what you can help with, where you work and how they can reach you.')}</p><div className="service-policy-note"><ShieldCheck size={16} /><span><b>{t('No residency verification required')}</b><small>{t('Service providers may live outside Madinaty. We verify the service details and contact information instead.')}</small></span></div><label className="service-category-picker">{t('Choose your service category')}<select autoFocus required value={category} onChange={event => setCategory(event.target.value)}><option value="" disabled>{t('Select a service category')}</option>{serviceCategories.map(item => <option value={item} key={item}>{t(item)}</option>)}</select></label><label>{t('What service are you offering?')}<input dir="auto" value={title} onChange={event => setTitle(event.target.value)} placeholder={t('e.g. AC repair, tutoring, cleaning or delivery')} minLength={5} maxLength={120} required /></label><label>{t('Pricing')}<input value={price} onChange={event => setPrice(event.target.value)} placeholder={t('e.g. EGP 250 per hour')} maxLength={80} /></label>{isTutoring && <div className="form-row"><label>{t('Education stage')}<select value={educationLevel} onChange={event => setEducationLevel(event.target.value as EducationLevel)}>{educationLevels.map(level => <option value={level} key={level}>{t(level)}</option>)}</select></label><fieldset className="subject-options"><legend>{t('Subjects')}</legend>{tutoringSubjects.map(subject => <label key={subject}><input type="checkbox" checked={subjects.includes(subject)} onChange={event => setSubjects(current => event.target.checked ? [...new Set([...current, subject])] : current.filter(item => item !== subject))} />{t(subject)}</label>)}</fieldset></div>}{category === 'Home services' && <label>{t('Service type')}<select value={homeServiceType} onChange={event => setHomeServiceType(event.target.value as HomeServiceType)}>{homeServiceTypes.map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>}{category === 'Housekeeping & cleaning' && <label>{t('Cleaning type')}<select value={housekeepingType} onChange={event => setHousekeepingType(event.target.value as HousekeepingType)}>{housekeepingTypes.map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>}{category === 'Health & fitness' && <label>{t('Fitness provider')}<select value={fitnessProviderType} onChange={event => setFitnessProviderType(event.target.value as FitnessProviderType)}>{fitnessProviderTypes.map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>}<label>{t('Description')}<textarea dir="auto" rows={4} minLength={10} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('Describe the service, your experience and what customers can expect')} required /></label><div className="form-row"><label>{t('Service area')}<select value={area} onChange={event => setArea(event.target.value)}>{serviceAreas.map(item => <option value={item.value} key={item.value}>{t(item.label)}</option>)}</select></label><label>{t('Availability')}<input value={availability} onChange={event => setAvailability(event.target.value)} placeholder={t('e.g. Weekdays after 4pm')} maxLength={120} /></label></div><label>{t('WhatsApp number')}<input type="tel" dir="ltr" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder={t('+20 1X XXX XXXX')} minLength={8} required /></label>{promotionEligible && <fieldset className="offer-fields"><legend>{t('Optional promotion')}</legend><p className="offer-policy-note">{t('One promotion per calendar month is free. Removing it later uses this month’s free slot. A change or additional promotion requires a quote from us.')}</p><label><input type="checkbox" checked={offerEnabled} onChange={event => setOfferEnabled(event.target.checked)} />{t('Add one promotion to this service')}</label>{offerEnabled && <div className="form-row"><label>{t('Promotion type')}<select value={offerKind} onChange={event => setOfferKind(event.target.value as ServiceOfferKind)}>{serviceOfferKinds.map(kind => <option value={kind} key={kind}>{t(kind)}</option>)}</select></label><label>{t('Offer details')}<input value={offerDiscount} onChange={event => setOfferDiscount(event.target.value)} placeholder={t('e.g. First lecture free')} minLength={2} maxLength={120} required /></label><label>{t('Offer valid until')}<input type="date" value={offerValidUntil} onChange={event => setOfferValidUntil(event.target.value)} required /></label></div>}<a className="offer-quote-link" href="mailto:hello@madinatydeals.com?subject=Madinaty%20Deals%20promotion%20quote">{t('Need another promotion or an edit? Contact hello@madinatydeals.com')}</a></fieldset>}</>}
    {!preview && <MediaUpload files={photos} onChange={setPhotos} />}<p className="content-policy-note"><ShieldCheck size={15} />{t('Every post is checked against our safety policy before it is published.')}</p><div className="modal-foot">{preview ? <button className="button button-outline" type="button" onClick={() => setPreview(false)}>{t('Edit details')}</button> : <span className="privacy-note"><ShieldCheck size={15} />{t('Contact details are used only for enquiries.')}</span>}<button className="button button-accent" type="submit" disabled={!valid || busy}>{t(preview ? 'Submit for review' : 'Preview service')}<ArrowRight size={16} /></button></div><p className="modal-intro">{t('Your post and photos will be saved privately for review before publishing.')}</p>
  </form>;
}
