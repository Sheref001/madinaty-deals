import { useState } from 'react';
import { requestCode, verifyCode, type Account } from './api';
import { useTranslation } from './i18n';

export default function AuthForm({ onSignedIn, registrationEnabled }: { onSignedIn: (account: Account) => void; registrationEnabled: boolean }) {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const channel = 'email' as const;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="modal-form" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (challengeId) onSignedIn(await verifyCode(challengeId, code));
      else {
        const result = await requestCode(identifier, channel, name || 'Madinaty Deals member');
        setChallengeId(result.challengeId);
      }
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'));
    } finally { setBusy(false); }
  }}>
    <p>{t(challengeId ? 'Check your email for a six-digit code. It expires in 10 minutes.' : registrationEnabled ? 'Sign in or create an account with a code sent to your email.' : 'Enter the email address for your existing account. New account creation is temporarily paused.')}</p>
    {!challengeId ? <>{registrationEnabled && <label>{t('Your name')}<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></label>}<label>{t('Email address')}<input required type="email" inputMode="email" maxLength={254} value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="email" /></label></> : <label>{t('Verification code')}<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value)} /></label>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <button className="button button-accent" disabled={busy} type="submit">{t(busy ? 'Please wait…' : challengeId ? 'Sign in' : 'Send sign-in code')}</button>
    {challengeId && <button className="text-link" type="button" disabled={busy} onClick={() => { setChallengeId(''); setCode(''); }}>{t('Use another email')}</button>}
  </form>;
}
