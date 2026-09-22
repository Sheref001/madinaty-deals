import { useState } from 'react';
import { uploadFile, submitVerification } from './api';
import { useTranslation } from './i18n';
import FilePicker from './FilePicker';
const types = [['MADINATY_ID', 'Madinaty ID / community card'], ['ELECTRICITY_BILL', 'Electricity bill'], ['WATER_BILL', 'Water bill / receipt'], ['GAS_BILL', 'Gas bill / receipt'], ['LEASE_OR_OWNERSHIP', 'Lease or ownership document'], ['NATIONAL_ID', 'National ID (optional)']] as const;
export default function VerificationForm({ onSubmitted, onSkip }: { onSubmitted: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const [type, setType] = useState<string>('MADINATY_ID');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="modal-form" onSubmit={async event => {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true); setError('');
    try { const upload = await uploadFile(file, 'verification', type); await submitVerification([upload.id]); onSubmitted(); }
    catch (cause) { setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')); }
    finally { setBusy(false); }
  }}>
    <p>{t('Residency verification is optional. You can browse now and verify later.')}</p>
    <button type="button" className="button button-outline" onClick={onSkip} disabled={busy}>{t('Not now')}</button>
    <p>{t('One document is enough. Evidence is linked only to your verification request, never your public profile.')}</p>
    <label>{t('Document type')}<select value={type} onChange={event => setType(event.target.value)}>{types.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
    <div className="file-picker"><span><b>{t('Take a photo or choose a file')}</b><small>{file ? file.name : t('JPG, PNG or PDF · maximum 10 MB')}</small></span><FilePicker label="Choose file" accept="image/jpeg,image/png,application/pdf" disabled={busy} onFiles={files => {
      setError('');
      if (files.length !== 1) { setError(t('Choose one document at a time.')); return; }
      const selected = files[0];
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(selected.type) || selected.size > 10 * 1024 * 1024) { setError(t('Use a JPG, PNG or PDF under 10 MB.')); return; }
      setFile(selected);
    }} /></div>
    <p>{t('Private to you and the admin reviewer only. Files are not publicly accessible or shown to other users.')}</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button type="submit" className="button button-accent" disabled={!file || busy}>{t(busy ? 'Please wait…' : 'Request verification')}</button>
  </form>;
}
