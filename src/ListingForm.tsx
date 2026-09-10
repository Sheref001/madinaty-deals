import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { categories, formatPrice, zones } from './data';
import { useTranslation } from './i18n';
import type { Listing, ListingCondition } from './types';

export default function ListingForm({ onPublish }: { onPublish: (listing: Listing) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0].label);
  const [price, setPrice] = useState('');
  const [zone, setZone] = useState(zones[1]);
  const [condition, setCondition] = useState<ListingCondition>('Good');
  const [preview, setPreview] = useState(false);
  const valid = title.trim().length >= 5 && description.trim().length >= 10 && Number.isFinite(Number(price)) && Number(price) > 0;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (!preview) { setPreview(true); return; }
    onPublish({ id: crypto.randomUUID(), type: 'listing', title: title.trim(), subtitle: description.trim(), category, price: Number(price), condition, seller: 'Sheref H.', sellerVerified: false, zone, createdAt: 'Just now', image: 'new', accent: 'lime', status: 'active' });
  }
  return <form className="modal-form" onSubmit={submit}>
    <ol className="listing-steps" aria-label={t('Listing progress')}><li aria-current={!preview ? 'step' : undefined}>{t('1. Item details')}</li><li aria-current={preview ? 'step' : undefined}>{t('2. Preview')}</li></ol>
    {preview ? <section className="listing-preview" aria-label={t('Listing preview')}>
      <span className="eyebrow">{t('Listing preview')}</span>
      <h3 dir="auto">{title}</h3><p dir="auto">{description}</p>
      <strong>{t(formatPrice(Number(price)))}</strong>
      <dl><dt>{t('Category')}</dt><dd>{t(category)}</dd><dt>{t('Condition')}</dt><dd>{t(condition)}</dd><dt>{t('Broad zone')}</dt><dd>{t(zone)}</dd></dl>
      <p className="privacy-note"><ShieldCheck size={16} />{t('Apartment details stay private')}</p>
    </section> : <>
      <p className="modal-intro">{t('Tell neighbours what makes your item useful. Mention any wear or defects so they know what to expect.')}</p>
      <label>{t('What are you selling?')}<input autoFocus dir="auto" value={title} onChange={event => setTitle(event.target.value)} placeholder={t('e.g. Solid oak coffee table')} minLength={5} maxLength={120} required /></label>
      <div className="form-row"><label>{t('Category')}<select value={category} onChange={event => setCategory(event.target.value)}>{categories.filter(item => ['sofa', 'monitor', 'baby', 'car-front', 'shopping-basket'].includes(item.icon)).map(item => <option value={item.label} key={item.label}>{t(item.label)}</option>)}</select></label>
      <label>{t('Price (EGP)')}<input type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0" required /></label></div>
      <label>{t('Description')}<textarea dir="auto" rows={4} minLength={10} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('Size, age, included accessories and any signs of use')} required /></label>
      <div className="form-row"><label>{t('Condition')}<select value={condition} onChange={event => setCondition(event.target.value as ListingCondition)}>{(['Like new', 'Good', 'Fair'] as const).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>
      <label>{t('Broad zone')}<select value={zone} onChange={event => setZone(event.target.value)}>{zones.slice(1).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label></div>
    </>}
    <div className="modal-foot">
      {preview ? <button className="button button-outline" type="button" onClick={() => setPreview(false)}>{t('Edit details')}</button> : <span className="privacy-note"><ShieldCheck size={15} />{t('Apartment details stay private')}</span>}
      <button className="button button-accent" type="submit" disabled={!valid}>{t(preview ? 'Add to this demo' : 'Preview listing')}<ArrowRight size={16} /></button>
    </div>
    <p className="modal-intro">{t('This is a local preview: your listing is only added for this visit. Photos and public publishing are not connected yet.')}</p>
  </form>;
}
