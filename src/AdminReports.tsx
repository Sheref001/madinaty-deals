import { useCallback, useEffect, useState } from 'react';
import { Check, Flag, RefreshCw, X } from 'lucide-react';
import { getAdminReports, reviewAdminReport, type AdminContentReport } from './api';
import { useTranslation } from './i18n';

export default function AdminReports() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<AdminContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => { setLoading(true); setError(''); getAdminReports().then(result => setReports(result.reports)).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load reports')).finally(() => setLoading(false)); }, []);
  useEffect(() => { getAdminReports().then(result => setReports(result.reports)).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load reports')).finally(() => setLoading(false)); }, []);
  const review = async (report: AdminContentReport, status: 'RESOLVED' | 'DISMISSED') => {
    setBusy(report.id); setError('');
    try { await reviewAdminReport(report.id, status); setReports(current => current.filter(item => item.id !== report.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not review report'); }
    finally { setBusy(''); }
  };
  return <section className="admin-panel admin-review-panel">
    <div className="panel-heading"><div><span className="eyebrow">{t('TRUST · REPORTS')}</span><h2>{t('Reported content')}</h2><p className="admin-panel-copy">{t('Review reports submitted by visitors and keep the marketplace trustworthy.')}</p></div><button className="button button-outline" onClick={load} disabled={loading || Boolean(busy)}><RefreshCw size={14} /> {t('Refresh')}</button></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {loading ? <p className="dashboard-empty">{t('Loading reports…')}</p> : reports.length ? <div className="verification-queue">{reports.map(report => <article className="verification-row" key={report.id}><div className="verification-request-heading"><span className="queue-avatar"><Flag size={16} /></span><span><b>{t(report.reason)}</b><small>{report.contentType} · {report.contentId} · {new Date(report.createdAt).toLocaleDateString()}</small></span></div><p className="admin-panel-copy">{report.details || t('No additional details provided.')}</p><div className="verification-actions"><button className="small-action approve-action" disabled={Boolean(busy)} onClick={() => review(report, 'RESOLVED')}><Check size={14} /> {t('Resolve')}</button><button className="small-action danger-action" disabled={Boolean(busy)} onClick={() => review(report, 'DISMISSED')}><X size={14} /> {t('Dismiss')}</button></div></article>)}</div> : <div className="dashboard-empty"><Flag size={22} /><p>{t('No reports are waiting for review.')}</p></div>}
  </section>;
}
