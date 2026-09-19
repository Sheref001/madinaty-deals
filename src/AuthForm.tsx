import { useEffect, useRef, useState } from 'react';
import { getAuthConfig, requestCode, verifyCode, type Account } from './api';
import { useTranslation } from './i18n';

type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile; } }

export default function AuthForm({ onSignedIn }: { onSignedIn: (account: Account) => void }) {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const channel = 'email' as const;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const setup = (sitekey: string) => {
      if (cancelled || !widget.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(widget.current, { sitekey, action: 'login', callback: (value: string) => { setToken(value); setReady(true); }, 'expired-callback': () => { setToken(''); setReady(false); }, 'error-callback': () => { setReady(false); setError('Human verification failed. Please try again.'); } });
    };
    getAuthConfig().then(({ turnstileSiteKey }) => {
      if (cancelled) return;
      if (!turnstileSiteKey) { setReady(true); return; }
      if (window.turnstile) { setup(turnstileSiteKey); return; }
      let script = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.dataset.turnstile = 'true';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', () => setup(turnstileSiteKey), { once: true });
      script.addEventListener('error', () => { if (!cancelled) setError('Human verification could not load. Please try again.'); }, { once: true });
    }).catch(() => { if (!cancelled) setError('Sign-in is unavailable. Please try again later.'); });
    return () => { cancelled = true; if (widgetId.current) window.turnstile?.remove(widgetId.current); };
  }, []);
  return <form className="modal-form" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (challengeId) onSignedIn(await verifyCode(challengeId, code));
      else {
        const result = await requestCode(identifier, channel, name, token);
        setChallengeId(result.challengeId);
      }
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'));
      if (widgetId.current && !challengeId) { window.turnstile?.reset(widgetId.current); setReady(false); setToken(''); }
    } finally { setBusy(false); }
  }}>
    <p>{t(challengeId ? 'Check your email for a six-digit code. It expires in 10 minutes.' : 'Sign in or create an account with a code sent to your email.')}</p>
    {!challengeId ? <><label>{t('Your name')}<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></label><label>{t('Email address')}<input required type="email" inputMode="email" maxLength={254} value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="email" /></label></> : <label>{t('Verification code')}<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value)} /></label>}
    <div ref={widget} hidden={Boolean(challengeId)} />
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <button className="button button-accent" disabled={busy || (!challengeId && !ready)} type="submit">{t(busy ? 'Please wait…' : challengeId ? 'Sign in' : 'Send sign-in code')}</button>
    {challengeId && <button className="text-link" type="button" disabled={busy} onClick={() => { setChallengeId(''); setCode(''); if (widgetId.current) { window.turnstile?.reset(widgetId.current); setReady(false); } }}>{t('Use another email')}</button>}
  </form>;
}
