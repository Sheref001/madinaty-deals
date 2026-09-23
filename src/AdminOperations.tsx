import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAdminOperations, type OperationAction } from './api';
import { useTranslation } from './i18n';

export default function AdminOperations({ showHistory }: { showHistory: boolean }) {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<{ users: number; published: number; pending: number; hidden: number; services: number; reports: number; views: number } | null>(null);
  const [recent, setRecent] = useState<OperationAction[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    getAdminOperations().then(data => { setCounts(data.counts); setRecent(data.recent); setError(''); }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load dashboard')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); window.addEventListener('madinaty-operations-refresh', load); return () => window.removeEventListener('madinaty-operations-refresh', load); }, [load]);
  const cards = counts ? [
    ['Active accounts', counts.users], ['Published user ads', counts.published], ['Awaiting review', counts.pending],
    ['Hidden or removed', counts.hidden], ['Published user services', counts.services], ['Open reports', counts.reports], ['Ad views', counts.views],
  ] as const : [];
  return <section className="admin-panel">
    <div className="panel-heading"><div><span className="eyebrow">{t('LIVE OPERATIONS')}</span><h2>{t('Marketplace overview')}</h2><p className="admin-panel-copy">{t('These totals come from the website database and are shared across devices.')}</p></div><button className="button button-outline" onClick={load} disabled={loading}><RefreshCw size={14} />{t('Refresh')}</button></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {loading && !counts ? <p className="dashboard-empty">{t('Loading dashboard…')}</p> : <div className="admin-stats dashboard-stats">{cards.map(([label, value]) => <div key={label}><span><b>{value}</b><small>{t(label)}</small></span></div>)}</div>}
    {showHistory && <><h3>{t('Recent owner and moderator actions')}</h3>
    {recent.length ? <div className="activity-list">{recent.map(item => <div className="activity-row" key={item.id}><span><b>{t(item.action)}</b><small>{item.actor} · {new Date(item.createdAt).toLocaleString()}</small><small>{item.targetType} · {item.targetId || ''}{item.metadata?.reason ? ` · ${item.metadata.reason}` : ''}</small></span></div>)}</div> : <p className="dashboard-empty">{t('No moderation actions yet.')}</p>}</>}
  </section>;
}
