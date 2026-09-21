import { useCallback, useEffect, useState } from 'react';
import { Check, FileText, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { getAdminVerifications, openPrivateUpload, reviewAdminVerification, type AdminVerificationRequest } from './api';
import { useTranslation } from './i18n';

const documentLabels: Record<string, string> = {
  MADINATY_ID: 'Madinaty ID / community card', ELECTRICITY_BILL: 'Electricity bill', WATER_BILL: 'Water bill / receipt',
  GAS_BILL: 'Gas bill / receipt', LEASE_OR_OWNERSHIP: 'Lease or ownership document', NATIONAL_ID: 'National ID (optional)', OTHER: 'Other supporting document',
};

export default function AdminReviewQueue() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<AdminVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true); setError('');
    getAdminVerifications().then(result => { setRequests(result.requests); setError(''); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load verification requests'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    getAdminVerifications().then(result => { setRequests(result.requests); setError(''); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load verification requests'))
      .finally(() => setLoading(false));
  }, []);

  const review = async (item: AdminVerificationRequest, status: 'VERIFIED' | 'REJECTED') => {
    const action = status === 'VERIFIED' ? t('Approve this resident verification?') : t('Reject this resident verification?');
    if (!window.confirm(action)) return;
    const rejectionReason = status === 'REJECTED' ? window.prompt(t('Optional rejection reason')) : '';
    if (rejectionReason === null) return;
    const reason = rejectionReason || '';
    setBusy(item.id); setError('');
    try {
      await reviewAdminVerification(item.id, status, reason);
      setRequests(current => current.filter(request => request.id !== item.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not review verification request'); }
    finally { setBusy(''); }
  };

  return <section className="admin-panel admin-review-panel">
    <div className="panel-heading"><div><span className="eyebrow">{t('TRUST · RESIDENTS')}</span><h2>{t('Resident verification requests')}</h2><p className="admin-panel-copy">{t('Review the submitted evidence before confirming residency.')}</p></div><button className="button button-outline" onClick={load} disabled={loading || Boolean(busy)}><RefreshCw size={14} /> {t('Refresh')}</button></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {loading ? <p className="dashboard-empty">{t('Loading verification requests…')}</p> : requests.length ? <div className="verification-queue">{requests.map(item => <article className="verification-row" key={item.id}>
      <div className="verification-request-heading"><span className="queue-avatar"><ShieldCheck size={16} /></span><span><b>{item.name}</b><small>{item.email || item.phone || item.userId} · {new Date(item.submittedAt).toLocaleDateString()}</small></span></div>
      <div className="verification-documents">{item.uploads.map(upload => <button className="small-action" key={upload.id} disabled={busy === item.id} onClick={async () => { try { await openPrivateUpload(upload.id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open the private document'); } }}><FileText size={13} /> {t(documentLabels[upload.documentType] || 'Verification document')}</button>)}</div>
      <div className="verification-actions"><button className="small-action approve-action" disabled={Boolean(busy)} onClick={() => review(item, 'VERIFIED')}><Check size={14} /> {t('Approve resident')}</button><button className="small-action danger-action" disabled={Boolean(busy)} onClick={() => review(item, 'REJECTED')}><X size={14} /> {t('Reject')}</button></div>
    </article>)}</div> : <div className="dashboard-empty"><ShieldCheck size={22} /><p>{t('No resident verification requests are waiting for review.')}</p></div>}
    <div className="dashboard-note"><ShieldCheck size={17} /><p><b>{t('Other moderation tools')}</b><br />{t('Reports, business claims and post approvals are not connected to a live review queue yet.')}</p></div>
  </section>;
}
