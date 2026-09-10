import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { zones } from './data';
import { useTranslation } from './i18n';
import type { Service } from './types';

const serviceCategories = ['Tutoring', 'Home services', 'Moving', 'Pet care', 'Other services'];

export default function ServiceForm({ onPublish }: { onPublish: (service: Service) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(serviceCategories[0]);
  const [area, setArea] = useState(zones[1]);
  const [price, setPrice] = useState('');
  const [availability, setAvailability] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [preview, setPreview] = useState(false);
  const valid = title.trim().length >= 5 && description.trim().length >= 10 && whatsapp.trim().length >= 8;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (!preview) { setPreview(true); return; }
    onPublish({ id: crypto.randomUUID(), type: 'service', title: title.trim(), subtitle: description.trim(), category, serviceArea: area, phone: '', whatsapp: whatsapp.trim(), response: availability.trim() || 'Response time to be configured', rating: 0, reviewCount: 0, zone: area, createdAt: 'Just now', image: 'new-service', accent: 'mint', verified: false });
  }
  return <form className="modal-form" onSubmit={submit}>
    <ol className="listing-steps" aria-label={t('Service progress')}><li aria-current={!preview ? 'step' : undefined}>{t('1. Service details')}</li><li aria-current={preview ? 'step' : undefined}>{t('2. Preview')}</li></ol>
    {preview ? <section className="listing-preview" aria-label={t('Service preview')}><span className="eyebrow">{t('Service preview')}</span><h3 dir="auto">{title}</h3><p dir="auto">{description}</p><dl><dt>{t('Category')}</dt><dd>{t(category)}</dd><dt>{t('Service area')}</dt><dd>{t(area)}</dd><dt>{t('Pricing')}</dt><dd>{price.trim() || t('Contact for price')}</dd><dt>{t('Availability')}</dt><dd>{availability.trim() || t('To be confirmed')}</dd></dl><p className="privacy-note"><ShieldCheck size={16} />{t('Your phone stays private until you choose to share it.')}</p></section> : <><p className="modal-intro">{t('Tell neighbours what you can help with, where you work and how they can reach you.')}</p><label>{t('What service are you offering?')}<input autoFocus dir="auto" value={title} onChange={event => setTitle(event.target.value)} placeholder={t('e.g. Math tutoring for school students')} minLength={5} maxLength={120} required /></label><div className="form-row"><label>{t('Category')}<select value={category} onChange={event => setCategory(event.target.value)}>{serviceCategories.map(item => <option value={item} key={item}>{t(item)}</option>)}</select></label><label>{t('Pricing')}<input value={price} onChange={event => setPrice(event.target.value)} placeholder={t('e.g. EGP 250 per hour')} maxLength={80} /></label></div><label>{t('Description')}<textarea dir="auto" rows={4} minLength={10} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('Mention grades, curriculum, format and experience')} required /></label><div className="form-row"><label>{t('Service area')}<select value={area} onChange={event => setArea(event.target.value)}>{zones.slice(1).map(item => <option value={item} key={item}>{t(item)}</option>)}</select></label><label>{t('Availability')}<input value={availability} onChange={event => setAvailability(event.target.value)} placeholder={t('e.g. Weekdays after 4pm')} maxLength={120} /></label></div><label>{t('WhatsApp number')}<input type="tel" dir="ltr" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder={t('+20 1X XXX XXXX')} minLength={8} required /></label></>}
    <div className="modal-foot">{preview ? <button className="button button-outline" type="button" onClick={() => setPreview(false)}>{t('Edit details')}</button> : <span className="privacy-note"><ShieldCheck size={15} />{t('Contact details are used only for enquiries.')}</span>}<button className="button button-accent" type="submit" disabled={!valid}>{t(preview ? 'Add service to this demo' : 'Preview service')}<ArrowRight size={16} /></button></div><p className="modal-intro">{t('This is a local preview: your service is only added for this visit and will need review before public publishing.')}</p>
  </form>;
}
