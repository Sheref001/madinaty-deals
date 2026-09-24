import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { onlineStoreCategories } from './categoryPolicy';
import { zones } from './data';
import { useTranslation } from './i18n';
import { getDescriptionPolicyViolation } from './contentPolicy';
import { submitPost } from './api';
import MediaUpload from './MediaUpload';

function validSocialAccount(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    const hosts = ['facebook.com', 'instagram.com', 'linkedin.com', 'threads.net', 'tiktok.com', 'x.com', 'youtube.com', 'youtu.be'];
    return url.protocol === 'https:' && !url.username && !url.password && hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export default function OnlineStoreForm({ onPublish }: { onPublish: () => void }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<'details' | 'preview'>('details');
  const [storeName, setStoreName] = useState('');
  const [storeCategory, setStoreCategory] = useState<(typeof onlineStoreCategories)[number]>('Beauty & personal care');
  const [description, setDescription] = useState('');
  const [zone, setZone] = useState('All zones');
  const [whatsapp, setWhatsapp] = useState('');
  const [socialAccount, setSocialAccount] = useState('');
  const [servesMadinaty, setServesMadinaty] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const descriptionViolation = getDescriptionPolicyViolation(description, false);
  const valid = storeName.trim().length >= 5 && description.trim().length >= 10 && /^[+\d ()-]{8,30}$/.test(whatsapp) && validSocialAccount(socialAccount) && !descriptionViolation && servesMadinaty;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (stage !== 'preview' || !valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await submitPost('store', { title: storeName.trim(), subtitle: description.trim(), category: 'Online Finds', onlineStoreCategory: storeCategory, zone, whatsapp: whatsapp.trim(), socialAccount: socialAccount.trim(), advertiserType: 'small_business', servesMadinaty }, photos);
      onPublish();
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return <form className="modal-form" onSubmit={submit}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {stage === 'details' ? <>
      <p className="modal-intro">{t('Online stores and home businesses serving Madinaty through delivery or pickup.')}</p>
      <label>{t('Store name')}<input autoFocus dir="auto" value={storeName} onChange={event => setStoreName(event.target.value)} minLength={5} maxLength={120} required /></label>
      <label>{t('Store type')}<select value={storeCategory} onChange={event => setStoreCategory(event.target.value as (typeof onlineStoreCategories)[number])}>{onlineStoreCategories.map(category => <option value={category} key={category}>{t(category)}</option>)}</select></label>
      <label>{t('What do you sell?')}<textarea dir="auto" rows={4} value={description} onChange={event => setDescription(event.target.value)} minLength={10} maxLength={2000} required /></label>
      {descriptionViolation && <p className="form-error" role="alert">{t(descriptionViolation)}</p>}
      <label>{t('Delivery area')}<select value={zone} onChange={event => setZone(event.target.value)}><option value="All zones">{t('All of Madinaty')}</option>{zones.slice(1, 13).map(value => <option value={value} key={value}>{t(value)}</option>)}</select></label>
      <label>{t('WhatsApp number')}<input type="tel" dir="ltr" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} minLength={8} maxLength={30} required /></label>
      <label>{t('One social account (free)')}<input type="url" dir="ltr" value={socialAccount} onChange={event => setSocialAccount(event.target.value)} placeholder="https://instagram.com/yourstore" maxLength={2048} /><small>{t('Add one Instagram, Facebook, TikTok, LinkedIn, YouTube, X or Threads profile link at no charge.')}</small></label>
      {socialAccount.trim() && !validSocialAccount(socialAccount) && <p className="form-error" role="alert">{t('Use a link to one supported social account')}</p>}
      <MediaUpload files={photos} onChange={setPhotos} />
      <label><input type="checkbox" checked={servesMadinaty} onChange={event => setServesMadinaty(event.target.checked)} required /> {t('This store delivers to or offers pickup for Madinaty residents.')}</label>
      <p className="content-policy-note"><ShieldCheck size={15} /> {t('Business posts wait for fee agreement and review.')}</p>
    </> : <section className="listing-preview" aria-label={t('Online store preview')}>
      <span className="eyebrow">{t('Online Finds')}</span><h3 dir="auto">{storeName.trim()}</h3><p dir="auto">{description.trim()}</p>
      <dl><dt>{t('Store type')}</dt><dd>{t(storeCategory)}</dd><dt>{t('Delivery area')}</dt><dd>{t(zone === 'All zones' ? 'All of Madinaty' : zone)}</dd><dt>{t('WhatsApp number')}</dt><dd><bdi dir="ltr">{whatsapp.trim()}</bdi></dd>{socialAccount.trim() && <><dt>{t('Social account')}</dt><dd><bdi dir="ltr">{socialAccount.trim()}</bdi></dd></>}</dl>
      <p className="content-policy-note"><ShieldCheck size={15} /> {t('Business posts wait for fee agreement and review.')}</p>
    </section>}
    <div className="modal-foot">
      {stage === 'preview' ? <button className="button button-outline" type="button" disabled={busy} onClick={() => setStage('details')}>{t('Edit details')}</button> : <span className="privacy-note">{t('No physical shop is required.')}</span>}
      {stage === 'details' ? <button className="button button-accent" type="button" disabled={!valid} onClick={() => setStage('preview')}>{t('Preview store')}<ArrowRight size={16} /></button> : <button className="button button-accent" type="submit" disabled={busy || !valid}>{t(busy ? 'Please wait…' : 'Submit store for review')}<ArrowRight size={16} /></button>}
    </div>
  </form>;
}
