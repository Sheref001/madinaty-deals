import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { zones } from './data';
import { useTranslation } from './i18n';
import { educationLevels, tutoringSubjects, type EducationLevel, type Service, type TutoringSubject } from './types';
import MediaUpload from './MediaUpload';
import { submitPost } from './api';
import PostingAudience from './PostingAudience';
import { splitCategories, businessOnlyCategories } from './categoryPolicy';
import type { AdvertiserType, BusinessRequest } from './types';

const serviceCategories = ['Tutoring & education', 'Health & fitness', 'Home services', 'Housekeeping & cleaning', 'Local delivery riders', 'Moving', 'Pet care', 'Other services'];

export default function ServiceForm({ onPublish }: { onPublish: (service: Service) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(serviceCategories[0]);
  const [area, setArea] = useState(zones[1]);
  const [price, setPrice] = useState('');
  const [availability, setAvailability] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('Before university');
  const [subjects, setSubjects] = useState<TutoringSubject[]>(['Mathematics']);
  const [advertiserType, setAdvertiserType] = useState<AdvertiserType>('individual');
  const [businessRequest, setBusinessRequest] = useState<BusinessRequest>('posting');
  const [preview, setPreview] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const businessOnly = businessOnlyCategories.includes(category);
  const isTutoring = category === 'Tutoring & education';
  const effectiveAdvertiserType = businessOnly ? 'small_business' : advertiserType;
  const valid = title.trim().length >= 5 && description.trim().length >= 10 && whatsapp.trim().length >= 8 && (!isTutoring || subjects.length > 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    if (!preview) { setPreview(true); return; }
    const payload: Service = { id: crypto.randomUUID(), type: 'service', title: title.trim(), subtitle: description.trim(), category, ...(category === 'Tutoring & education' ? { educationLevel, subjects } : {}), ...((businessOnly || splitCategories.includes(category)) ? { advertiserType: effectiveAdvertiserType, ...(effectiveAdvertiserType === 'small_business' ? { businessRequest } : {}) } : {}), serviceArea: area, phone: '', whatsapp: whatsapp.trim(), response: availability.trim() || 'Response time to be configured', rating: 0, reviewCount: 0, zone: area, createdAt: 'Just now', image: 'new-service', accent: 'mint', verified: false };
    setBusy(true); setError('');
    try { await submitPost('service', payload, photos); onPublish(payload); }
    catch (cause) { setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')); }
    finally { setBusy(false); }
  }
  return <form className="modal-form" onSubmit={submit}>
    <PostingAudience category={category} value={advertiserType} request={businessRequest} onChange={setAdvertiserType} onRequestChange={setBusinessRequest} preview={preview} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <ol className="listing-steps" aria-label={t('Service progress')}><li aria-current={!preview ? 'step' : undefined}>{t('1. Service details')}</li><li aria-current={preview ? 'step' : undefined}>{t('2. Preview')}</li></ol>
    {preview ? <section className="listing-preview" aria-label={t('Service preview')}><span className="eyebrow">{t('Service preview')}</span><h3 dir="auto">{title}</h3><p dir="auto">{description}</p><dl><dt>{t('Category')}</dt><dd>{t(category)}</dd>{isTutoring && <><dt>{t('Education stage')}</dt><dd>{t(educationLevel)}</dd><dt>{t('Subjects')}</dt><dd>{subjects.map(subject => t(subject)).join(', ')}</dd></>}<dt>{t('Service area')}</dt><dd>{t(area)}</dd><dt>{t('Pricing')}</dt><dd>{price.trim() || t('Contact for price')}</dd><dt>{t('Availability')}</dt><dd>{availability.trim() || t('To be confirmed')}</dd></dl><p className="privacy-note"><ShieldCheck size={16} />{t('Your phone stays private until you choose to share it.')}</p></section> : <><p className="modal-intro">{t('Tell neighbours what you can help with, where you work and how they can reach you.')}</p><div className="service-policy-note"><ShieldCheck size={16} /><span><b>{t('No residency verification required')}</b><small>{t('Service providers may live outside Madinaty. We verify the service details and contact information instead.')}</small></span></div><label>{t('What service are you offering?')}<input autoFocus dir="auto" value={title} onChange={event => setTitle(event.target.value)} placeholder={t('e.g. Math tutoring for school students')} minLength={5} maxLength={120} required /></label><div className="form-row"><label>{t('Category')}<select value={category} onChange={event => setCategory(event.target.value)}>{serviceCategories.map(item => <option value={item} key={item}>{t(item)}</option>)}</select></label><label>{t('Pricing')}<input value={price} onChange={event => setPrice(event.target.value)} placeholder={t('e.g. EGP 250 per hour')} maxLength={80} /></label></div>{isTutoring && <div className="form-row"><label>{t('Education stage')}<select value={educationLevel} onChange={event => setEducationLevel(event.target.value as EducationLevel)}>{educationLevels.map(level => <option value={level} key={level}>{t(level)}</option>)}</select></label><fieldset className="subject-options"><legend>{t('Subjects')}</legend>{tutoringSubjects.map(subject => <label key={subject}><input type="checkbox" checked={subjects.includes(subject)} onChange={event => setSubjects(current => event.target.checked ? [...new Set([...current, subject])] : current.filter(item => item !== subject))} />{t(subject)}</label>)}</fieldset></div>}<label>{t('Description')}<textarea dir="auto" rows={4} minLength={10} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('Mention grades, curriculum, format and experience')} required /></label><div className="form-row"><label>{t('Service area')}<select value={area} onChange={event => setArea(event.target.value)}>{zones.slice(1).map(item => <option value={item} key={item}>{t(item)}</option>)}</select></label><label>{t('Availability')}<input value={availability} onChange={event => setAvailability(event.target.value)} placeholder={t('e.g. Weekdays after 4pm')} maxLength={120} /></label></div><label>{t('WhatsApp number')}<input type="tel" dir="ltr" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder={t('+20 1X XXX XXXX')} minLength={8} required /></label></>}
    {!preview && <MediaUpload files={photos} onChange={setPhotos} />}<p className="content-policy-note"><ShieldCheck size={15} />{t('Every post is checked against our safety policy before it is published.')}</p><div className="modal-foot">{preview ? <button className="button button-outline" type="button" onClick={() => setPreview(false)}>{t('Edit details')}</button> : <span className="privacy-note"><ShieldCheck size={15} />{t('Contact details are used only for enquiries.')}</span>}<button className="button button-accent" type="submit" disabled={!valid || busy}>{t(preview ? 'Submit for review' : 'Preview service')}<ArrowRight size={16} /></button></div><p className="modal-intro">{t('Your post and photos will be saved privately for review before publishing.')}</p>
  </form>;
}
