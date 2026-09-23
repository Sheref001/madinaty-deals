import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminContent, getAdminReports, getPublicationPauses, moderateContent, openPrivateUpload, setPublicationPause, type AdminContentReport, type ContentControl, type ModeratedContent, type PublicationPause } from './api';
import { allResults, categories } from './data';
import { useTranslation } from './i18n';

type Row = { id: string; kind: string; status: string; title: string; description: string; category: string; owner?: ModeratedContent['owner']; uploadIds: string[]; commercial?: boolean; createdAt?: string };

export default function AdminModeration({ isAdmin, canReadReports }: { isAdmin: boolean; canReadReports: boolean }) {
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState<ModeratedContent[]>([]);
  const [controls, setControls] = useState<ContentControl[]>([]);
  const [reports, setReports] = useState<AdminContentReport[]>([]);
  const [pauses, setPauses] = useState<PublicationPause[]>([]);
  const [tab, setTab] = useState<'reported' | 'pending' | 'recent' | 'hidden'>(canReadReports ? 'reported' : 'pending');
  const [query, setQuery] = useState('');
  const [directId, setDirectId] = useState('');
  const [directType, setDirectType] = useState('listing');
  const [pauseCategory, setPauseCategory] = useState('*');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    return Promise.all([getAdminContent(), canReadReports ? getAdminReports() : Promise.resolve({ reports: [] }), isAdmin ? getPublicationPauses() : Promise.resolve({ pauses: [] })])
      .then(([content, reportData, pauseData]) => { setSubmissions(content.submissions); setControls(content.controls); setReports(reportData.reports); setPauses(pauseData.pauses); setError(''); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load review queue')).finally(() => setLoading(false));
  }, [canReadReports, isAdmin]);
  useEffect(() => { load(); window.addEventListener('madinaty-operations-refresh', load); return () => window.removeEventListener('madinaty-operations-refresh', load); }, [load]);
  const rows = useMemo<Row[]>(() => {
    const staticRows = allResults.map(item => { const control = controls.find(value => value.contentType === item.type && value.contentId === item.id); return { id: item.id, kind: item.type, status: control?.status || 'PUBLISHED', title: item.title, description: item.subtitle, category: item.category, uploadIds: [] }; });
    return [...submissions.map(item => ({ ...item, kind: item.kind })), ...staticRows];
  }, [submissions, controls]);
  const openReports = reports.filter(item => ['OPEN', 'IN_REVIEW'].includes(item.status));
  const filtered = rows.filter(item => {
    const matches = !query || `${item.title} ${item.id} ${item.category} ${item.owner?.email || ''} ${item.owner?.phone || ''}`.toLowerCase().includes(query.toLowerCase());
    if (!matches) return false;
    if (tab === 'reported') return openReports.some(report => report.contentId === item.id && report.contentType === item.kind);
    if (tab === 'pending') return item.status === 'PENDING_REVIEW';
    if (tab === 'hidden') return ['HIDDEN', 'REMOVED'].includes(item.status);
    return true;
  }).slice(0, 200);
  const act = async (item: Row, action: 'HIDE' | 'RESTORE' | 'APPROVE' | 'REMOVE') => {
    const reason = ['HIDE', 'REMOVE'].includes(action) ? window.prompt(t('Enter the reason for this moderation action. It will be recorded.'))?.trim() : '';
    if (['HIDE', 'REMOVE'].includes(action) && (!reason || reason.length < 5)) { setError(t('Enter a reason of at least five characters')); return; }
    if (action === 'REMOVE' && !window.confirm(t('Remove this ad? It will require administrator review before it can return.'))) return;
    setBusy(item.id); setError('');
    try { await moderateContent(item.kind, item.id, action, reason || ''); window.dispatchEvent(new Event('madinaty-operations-refresh')); window.dispatchEvent(new Event('madinaty-feed-refresh')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change ad status'); }
    finally { setBusy(''); }
  };
  const changePause = async (paused: boolean) => {
    const reason = paused ? window.prompt(t('Why are you pausing publication? New ads will wait for review.'))?.trim() : '';
    if (paused && (!reason || reason.length < 5)) { setError(t('Enter a reason of at least five characters')); return; }
    setBusy('pause'); setError('');
    try { const result = await setPublicationPause(pauseCategory, paused, reason || ''); setPauses(result.pauses); window.dispatchEvent(new Event('madinaty-operations-refresh')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change publication pause'); }
    finally { setBusy(''); }
  };
  const paused = pauses.some(item => item.category === pauseCategory);
  const directAction = async (action: 'HIDE' | 'RESTORE') => {
    const contentId = directId.trim();
    if (!contentId) { setError(t('Enter the exact ad ID')); return; }
    const reason = action === 'HIDE' ? window.prompt(t('Enter the reason for this moderation action. It will be recorded.'))?.trim() : '';
    if (action === 'HIDE' && (!reason || reason.length < 5)) { setError(t('Enter a reason of at least five characters')); return; }
    setBusy('direct'); setError('');
    try { await moderateContent(directType, contentId, action, reason || ''); setDirectId(''); window.dispatchEvent(new Event('madinaty-operations-refresh')); window.dispatchEvent(new Event('madinaty-feed-refresh')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change ad status'); }
    finally { setBusy(''); }
  };
  return <section className="admin-panel admin-moderation">
    <div className="panel-heading"><div><span className="eyebrow">{t('SAFETY · CONTENT')}</span><h2>{t('Content review workspace')}</h2><p className="admin-panel-copy">{t('Review reports, new ads, and hidden content in one place. Hiding an ad also blocks its public photos and direct links.')}</p></div><button className="button button-outline" onClick={load} disabled={loading || Boolean(busy)}>{t('Refresh')}</button></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {isAdmin && <div className="publication-control"><h3>{t('Emergency publication pause')}</h3><p>{t('New posts in a paused category are held for review. Existing posts stay visible.')}</p><div className="publication-controls"><select aria-label={t('Publication category')} value={pauseCategory} onChange={event => setPauseCategory(event.target.value)}><option value="*">{t('All categories')}</option>{categories.map(category => <option value={category.label} key={category.label}>{t(category.label)}</option>)}<option value="Moving">{t('Moving')}</option></select><button className={paused ? 'small-action approve-action' : 'small-action danger-action'} disabled={Boolean(busy)} onClick={() => changePause(!paused)}>{t(paused ? 'Resume publication' : 'Pause publication')}</button></div>{pauses.length > 0 && <p><b>{t('Paused now')}:</b> {pauses.map(item => t(item.category === '*' ? 'All categories' : item.category)).join(' · ')}</p>}</div>}
    <div className="publication-control"><h3>{t('Emergency action by ad ID')}</h3><p>{t('Use the exact ID from a report or ad link, including older ads outside this list.')}</p><div className="publication-controls"><select aria-label={t('Ad type')} value={directType} onChange={event => setDirectType(event.target.value)}><option value="listing">{t('Listing')}</option><option value="service">{t('Service')}</option><option value="business">{t('Business')}</option><option value="offer">{t('Offer')}</option></select><input aria-label={t('Exact ad ID')} value={directId} onChange={event => setDirectId(event.target.value)} maxLength={160} /><button className="small-action danger-action" disabled={Boolean(busy)} onClick={() => directAction('HIDE')}>{t('Hide now')}</button><button className="small-action approve-action" disabled={Boolean(busy)} onClick={() => directAction('RESTORE')}>{t('Restore')}</button></div></div>
    <div className="moderation-toolbar"><div className="moderation-tabs">{(['reported', 'pending', 'recent', 'hidden'] as const).filter(value => value !== 'reported' || canReadReports).map(value => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{t(value === 'reported' ? 'Reported' : value === 'pending' ? 'Awaiting review' : value === 'recent' ? 'All recent ads' : 'Hidden / removed')}</button>)}</div><label>{t('Find an ad')}<input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Title, ID, category or owner')} /></label></div>
    {loading ? <p className="dashboard-empty">{t('Loading ads…')}</p> : filtered.length ? <div className="moderation-list">{filtered.map(item => <article className="moderation-row" key={`${item.kind}:${item.id}`}><div><b>{item.title}</b><small>{t(item.category)} · {item.kind} · {item.id}</small><small>{t(item.status)}{item.commercial ? ` · ${t('Commercial approval required')}` : ''}</small><p>{item.description}</p>{item.owner && <small>{t('Owner')}: {item.owner.name} · {item.owner.email || item.owner.phone || item.owner.id}{item.owner.status !== 'ACTIVE' ? ` · ${t('Suspended')}` : ''}</small>}{item.uploadIds.length > 0 && <button className="small-action" onClick={() => openPrivateUpload(item.uploadIds[0]).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not open photo'))}>{t('View photo')}</button>}</div><div className="verification-actions">{['PUBLISHED', 'PENDING_REVIEW'].includes(item.status) && <button className="small-action danger-action" disabled={Boolean(busy)} onClick={() => act(item, 'HIDE')}>{t('Hide now')}</button>}{item.status === 'PENDING_REVIEW' && <button className="small-action approve-action" disabled={Boolean(busy)} onClick={() => act(item, 'APPROVE')}>{t('Approve')}</button>}{(item.status === 'HIDDEN' || (item.status === 'REMOVED' && isAdmin)) && <button className="small-action approve-action" disabled={Boolean(busy)} onClick={() => act(item, 'RESTORE')}>{t(item.status === 'REMOVED' ? 'Send back to review' : 'Restore')}</button>}{isAdmin && item.status !== 'REMOVED' && <button className="small-action danger-action" disabled={Boolean(busy)} onClick={() => act(item, 'REMOVE')}>{t('Remove')}</button>}</div></article>)}</div> : <p className="dashboard-empty">{t('No ads in this view.')}</p>}
  </section>;
}
