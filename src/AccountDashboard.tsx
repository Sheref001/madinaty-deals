import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Bookmark, Clock, Package, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { changeOwnedListing, getContactActivity, getOwnedListings, removeContactActivity, type Account, type ContactActivity, type ListingAction, type OwnedListing, type PublicSubmission, type SavedItem } from './api';
import { useTranslation } from './i18n';
import type { View } from './types';
import { getDescriptionPolicyViolation } from './contentPolicy';
import { zones } from './data';
import './account.css';

type AccountSection = 'account' | 'saved' | 'activity' | 'my-listings';
type Props = { account: Account; section: AccountSection; onNavigate: (view: View) => void; onPost: () => void; onVerify: () => void; saved: SavedItem[]; savedReady: boolean; savedError: string; onUnsave: (id: string) => void; renderResult: (record: PublicSubmission) => ReactNode };
const tabs: { id: AccountSection; label: string; icon: typeof UserRound }[] = [{ id: 'account', label: 'My Account', icon: UserRound }, { id: 'saved', label: 'Saved', icon: Bookmark }, { id: 'activity', label: 'My Activity', icon: Clock }, { id: 'my-listings', label: 'My Listings', icon: Package }];

export default function AccountDashboard({ account, section, onNavigate, onPost, onVerify, saved, savedReady, savedError, onUnsave, renderResult }: Props) {
  const { t } = useTranslation();
  return <section className="account-dashboard">
    <div className="account-heading"><div><span className="eyebrow">{t('YOUR MADINATY DEALS')}</span><h1>{t(tabs.find(tab => tab.id === section)?.label || 'My Account')}</h1><p>{t('Buy, sell and offer services from one account.')}</p></div><button className="button button-accent" onClick={onPost}><Plus size={17} />{t('Post ad')}</button></div>
    <nav className="account-tabs" aria-label={t('Account navigation')}>{tabs.map(({ id, label, icon: Icon }) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => onNavigate(id)}><Icon size={18} />{t(label)}</button>)}</nav>
    {section === 'account' && <>
      <div className="account-profile"><UserRound size={30} /><div><h2 dir="auto">{account.name}</h2>{account.email && <p><bdi>{account.email}</bdi></p>}{account.phone && <p><bdi>{account.phone}</bdi></p>}<p>{t(account.residentVerified ? 'Verified resident' : 'Residency not verified')}</p></div>{!account.residentVerified && <button className="button button-outline" onClick={onVerify}><ShieldCheck size={16} />{t('Become a verified resident')}</button>}</div>
      <div className="account-shortcuts">{tabs.slice(1).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onNavigate(id)}><Icon size={25} /><strong>{t(label)}</strong><span>{t(id === 'saved' ? 'Your shortlist, available on every device.' : id === 'activity' ? 'Find services and stores whose contact links you opened.' : 'Manage your items, services and online stores.')}</span></button>)}</div>
      <p className="account-note">{t('Saved items and contact activity are private. Other members see only your public listings.')}</p>
    </>}
    {section === 'saved' && <SavedPanel items={saved} ready={savedReady} error={savedError} onUnsave={onUnsave} renderResult={renderResult} />}
    {section === 'activity' && <ActivityPanel renderResult={renderResult} />}
    {section === 'my-listings' && <ListingsPanel onPost={onPost} />}
  </section>;
}

function SavedPanel({ items, ready, error, onUnsave, renderResult }: { items: SavedItem[]; ready: boolean; error: string; onUnsave: (id: string) => void; renderResult: Props['renderResult'] }) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(20);
  return <><p className="account-note">{t('Your shortlist, available on every device.')}</p>{error ? <div role="alert"><p>{t(error)}</p><button className="button button-outline" onClick={() => window.dispatchEvent(new Event('madinaty-saved-refresh'))}>{t('Retry')}</button></div> : !ready ? <p role="status">{t('Loading…')}</p> : items.length ? <><div className="account-saved-grid">{items.slice(0, limit).map(item => <div key={item.id}>{item.submission ? renderResult(item.submission) : <div className="account-card"><h2>{t('Unavailable listing')}</h2><p>{t('This ad is paused, closed or no longer public.')}</p><button className="text-link" onClick={() => onUnsave(`submission-${item.id}`)}>{t('Remove from saved')}</button></div>}</div>)}</div>{items.length > limit && <button className="button button-outline" onClick={() => setLimit(value => value + 20)}>{t('Show more')}</button>}</> : <EmptyState text="You have no saved items yet." />}</>;
}

function ActivityPanel({ renderResult }: { renderResult: Props['renderResult'] }) {
  const { t, language } = useTranslation();
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<{ page: number; reload: number; activity: ContactActivity[]; hasMore: boolean } | null>(null);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getContactActivity(page).then(result => { if (active) { setData({ ...result, page, reload }); setError(''); } }).catch(() => { if (active) setError('Could not load your activity. Please retry.'); });
    return () => { active = false; };
  }, [page, reload]);
  async function remove(id: string) {
    setBusy(true);
    try { await removeContactActivity(id); setReload(value => value + 1); }
    catch { setError('Could not remove this activity. Please retry.'); }
    finally { setBusy(false); }
  }
  const ready = data?.page === page && data.reload === reload;
  return <><p className="account-note">{t('Contact opened means you opened a WhatsApp link. It does not confirm a message, booking or purchase.')}</p>{error && <div role="alert"><p>{t(error)}</p><button className="button button-outline" onClick={() => setReload(value => value + 1)}>{t('Retry')}</button></div>}{!ready && !error ? <p role="status">{t('Loading…')}</p> : ready && <>{data.activity.length ? <div className="account-records">{data.activity.map(item => <article className="account-card" key={item.id}><span className="account-status">{t('Contact opened')}</span><h2 dir="auto">{item.title}</h2><p dir="auto">{item.providerName}</p><time dateTime={item.openedAt}>{new Date(item.openedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB')}</time><div className="account-actions">{item.submission ? <button className="button button-outline" onClick={() => setOpened(opened === item.id ? null : item.id)}>{t(opened === item.id ? 'Hide listing' : 'View listing')}</button> : <p>{t('This ad is paused, closed or no longer public.')}</p>}<button className="text-link" disabled={busy} onClick={() => void remove(item.id)}>{t('Remove from history')}</button></div>{opened === item.id && item.submission && renderResult(item.submission)}</article>)}</div> : <EmptyState text="No contact activity yet." />}<Pagination page={page} hasMore={data.hasMore} onChange={setPage} /></>}</>;
}

function ListingsPanel({ onPost }: { onPost: () => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'listing' | 'service' | 'store'>('listing');
  return <><div className="account-kind-tabs"><button aria-pressed={kind === 'listing'} onClick={() => setKind('listing')}>{t('My Items')}</button><button aria-pressed={kind === 'service'} onClick={() => setKind('service')}>{t('My Services')}</button><button aria-pressed={kind === 'store'} onClick={() => setKind('store')}>{t('My Online Stores')}</button></div><OwnedListings key={kind} kind={kind} onPost={onPost} /></>;
}

function OwnedListings({ kind, onPost }: { kind: 'listing' | 'service' | 'store'; onPost: () => void }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<{ page: number; reload: number; listings: OwnedListing[]; hasMore: boolean } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getOwnedListings(kind, page).then(result => { if (active) { setData({ ...result, page, reload }); setError(''); } }).catch(() => { if (active) setError('Could not load your listings. Please retry.'); });
    return () => { active = false; };
  }, [kind, page, reload]);
  const ready = data?.page === page && data.reload === reload;
  return <>{error && <div role="alert"><p>{t(error)}</p></div>}<button className="text-link" onClick={() => setReload(value => value + 1)}>{t('Refresh listings')}</button>{!ready && !error ? <p role="status">{t('Loading…')}</p> : ready && <>{data.listings.length ? <div className="account-records">{data.listings.map(item => <OwnedListingCard key={`${item.id}:${item.version}`} item={item} onChanged={listing => { setData(current => current ? { ...current, listings: current.listings.map(record => record.id === listing.id ? listing : record) } : current); window.dispatchEvent(new Event('madinaty-feed-refresh')); window.dispatchEvent(new Event('madinaty-saved-refresh')); }} />)}</div> : <><EmptyState text={kind === 'service' ? 'You have not posted any services yet.' : kind === 'store' ? 'You have not listed any online stores yet.' : 'You have not posted any items yet.'} /><button className="button button-accent" onClick={onPost}>{t('Post ad')}</button></>}<Pagination page={page} hasMore={data.hasMore} onChange={setPage} /></>}</>;
}

const statusLabels: Record<string, string> = { PUBLISHED: 'Live', PENDING_REVIEW: 'Awaiting review', HIDDEN: 'Hidden by moderation', REMOVED: 'Removed', REJECTED: 'Changes required', ACTIVE: 'Active', PAUSED: 'Paused', CLOSED: 'Closed', SOLD: 'Sold' };

function OwnedListingCard({ item, onChanged }: { item: OwnedListing; onChanged: (item: OwnedListing) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<ListingAction | null>(null);
  const manageable = ['ACTIVE', 'PAUSED'].includes(item.ownerState);
  async function change(action: ListingAction, changes?: Record<string, unknown>) {
    setBusy(true); setError('');
    try { const result = await changeOwnedListing(item.id, item.version, action, changes); onChanged(result.listing); setEditing(false); setConfirmation(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this listing. Please retry.'); }
    finally { setBusy(false); }
  }
  return <article className="account-card">
    <span className="account-status">{t(statusLabels[item.ownerState === 'ACTIVE' ? item.status : item.ownerState] || item.status)}</span>{item.ownerState !== 'ACTIVE' && <span className="account-status">{t(statusLabels[item.status] || item.status)}</span>}
    <h2 dir="auto">{String(item.payload.title || '')}</h2><p>{t(String(item.payload.category || ''))} · {t(String(item.payload.zone || ''))}</p>
    {item.kind === 'listing' ? <p>{t('Price (EGP)')}: {String(item.payload.price ?? '')}</p> : item.kind === 'store' ? <p>{t('Store type')}: {t(String(item.payload.onlineStoreCategory || ''))}</p> : <><p>{t('Rate')}: {String(item.payload.pricing || '—')}</p><p>{t('Availability')}: {String(item.payload.availability || '—')}</p></>}
    {item.assisted && <p>{t('Posted on behalf of a provider. Confirm their permission before changing their details.')}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {editing ? <ListingEditor item={item} busy={busy} onSave={changes => void change('edit', changes)} onCancel={() => setEditing(false)} /> : <div className="account-actions">
      {manageable && ['PUBLISHED', 'PENDING_REVIEW'].includes(item.status) && <button className="button button-outline" disabled={busy} onClick={() => setEditing(true)}>{t('Edit details')}</button>}
      {manageable && <button className="button button-outline" disabled={busy} onClick={() => void change(item.ownerState === 'PAUSED' ? 'resume' : 'pause')}>{t(item.ownerState === 'PAUSED' ? 'Resume listing' : 'Pause listing')}</button>}
      {manageable && <button className="text-link" disabled={busy} onClick={() => setConfirmation(item.kind === 'listing' ? 'sold' : 'close')}>{t(item.kind === 'listing' ? 'Mark as sold' : item.kind === 'store' ? 'Close store' : 'Close service')}</button>}
      {item.ownerState !== 'REMOVED' && <button className="text-link" disabled={busy} onClick={() => setConfirmation('remove')}>{t('Remove listing')}</button>}
    </div>}
    {confirmation && <div className="account-confirm" role="group" aria-label={t('Confirm listing action')}><p>{t('This ends the listing and cannot be undone here. Posting quotas are not reset. Pause it instead if you plan to return.')}</p><button className="button button-accent" disabled={busy} onClick={() => void change(confirmation)}>{t('Confirm')}</button><button className="button button-outline" disabled={busy} onClick={() => setConfirmation(null)}>{t('Cancel')}</button></div>}
  </article>;
}

function ListingEditor({ item, busy, onSave, onCancel }: { item: OwnedListing; busy: boolean; onSave: (changes: Record<string, unknown>) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const fields = item.kind === 'listing' ? ['title', 'subtitle', 'zone', 'price'] : item.kind === 'store' ? ['title', 'subtitle', 'zone'] : ['title', 'subtitle', 'zone', 'pricing', 'availability', 'serviceArea'];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(key => [key, String(item.payload[key] ?? (key === 'serviceArea' ? item.payload.zone : ''))])));
  const [policyNotice, setPolicyNotice] = useState('');
  const educational = ['Tutoring', 'Tutoring & education'].includes(String(item.payload.category));
  const descriptionViolation = item.kind === 'service' || item.kind === 'store' ? getDescriptionPolicyViolation(values.subtitle, educational) : '';
  const labels: Record<string, string> = { title: 'Title', subtitle: 'Description', zone: 'Broad zone', price: 'Price (EGP)', pricing: 'Rate', availability: 'Availability', serviceArea: 'Service area' };
  const limits: Record<string, [number, number]> = { title: [5, 120], subtitle: [10, 2000], zone: [1, 80], pricing: [0, 80], availability: [0, 120], serviceArea: [1, 80] };
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || descriptionViolation) return;
    const changes = Object.fromEntries(fields.filter(key => values[key] !== String(item.payload[key] ?? (key === 'serviceArea' ? item.payload.zone : ''))).map(key => [key, key === 'price' ? Number(values[key]) : values[key]]));
    if (Object.keys(changes).length) onSave(changes);
    else onCancel();
  }
  return <form className="modal-form account-editor" onSubmit={submit}>
    <p>{t(item.kind === 'store' ? 'Changes to store details require review and temporarily hide the listing.' : 'Rates and availability update immediately for live listings. Changes to the title, description or area require review and temporarily hide the listing.')}</p>
    <fieldset disabled={busy}>{fields.map(key => <label key={key}>{t(item.kind === 'store' && key === 'zone' ? 'Delivery area' : labels[key])}{key === 'subtitle' ? <textarea dir="auto" value={values[key]} minLength={10} maxLength={2000} rows={4} required onPaste={event => { if (item.kind !== 'service' && item.kind !== 'store') return; const input = event.currentTarget; const next = input.value.slice(0, input.selectionStart) + event.clipboardData.getData('text') + input.value.slice(input.selectionEnd); const violation = getDescriptionPolicyViolation(next, educational); if (violation) { event.preventDefault(); setPolicyNotice(violation); } }} onChange={event => { setPolicyNotice(''); setValues(current => ({ ...current, [key]: event.target.value })); }} /> : item.kind === 'store' && key === 'zone' ? <select value={values[key]} onChange={event => setValues(current => ({ ...current, zone: event.target.value }))}><option value="All zones">{t('All of Madinaty')}</option>{zones.slice(1, 13).map(zone => <option key={zone} value={zone}>{t(zone)}</option>)}</select> : <input dir="auto" type={key === 'price' ? 'number' : 'text'} value={values[key]} min={key === 'price' ? '0.01' : undefined} max={key === 'price' ? '100000000' : undefined} step={key === 'price' ? '0.01' : undefined} minLength={limits[key]?.[0]} maxLength={limits[key]?.[1]} required={!['pricing', 'availability'].includes(key)} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} />}</label>)}</fieldset>
    {(descriptionViolation || policyNotice) && <p className="form-error" role="alert">{t(descriptionViolation || policyNotice)}</p>}
    <p>{t('For category, provider identity, contact, photo or promotion changes, contact hello@madinatydeals.com.')}</p>
    <div className="account-actions"><button className="button button-accent" disabled={busy || Boolean(descriptionViolation)} type="submit">{t(busy ? 'Please wait…' : 'Save changes')}</button><button className="button button-outline" disabled={busy} type="button" onClick={onCancel}>{t('Cancel')}</button></div>
  </form>;
}

function EmptyState({ text }: { text: string }) {
  const { t } = useTranslation();
  return <div className="empty-state"><p>{t(text)}</p></div>;
}

function Pagination({ page, hasMore, onChange }: { page: number; hasMore: boolean; onChange: (page: number) => void }) {
  const { t } = useTranslation();
  if (!page && !hasMore) return null;
  return <nav className="account-pagination" aria-label={t('Pages')}><button className="button button-outline" disabled={page === 0} onClick={() => onChange(page - 1)}>{t('Previous')}</button><span>{page + 1}</span><button className="button button-outline" disabled={!hasMore} onClick={() => onChange(page + 1)}>{t('Next')}</button></nav>;
}
