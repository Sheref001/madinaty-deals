import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useTranslation } from './i18n';
import { getPushConfig, savePushSubscription, removePushSubscription } from './api';

const snoozeKey = 'madinaty-notifications-dismissed-until';
const unavailable = 'Notifications are currently unavailable. Please try again later.';
const supported = () => window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
const appleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
const hasConsent = () => { try { return localStorage.getItem('madinaty-push-subscribed') === 'true'; } catch { return false; } };

export default function PushNotifications() {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');
  const prepared = useRef<{ registration: ServiceWorkerRegistration; publicKey: string } | null>(null);
  const needsInstall = appleMobile() && !standalone();
  const canPush = supported() && !needsInstall;
  useEffect(() => {
    if (!canPush) return;
    let cancelled = false;
    Promise.all([getPushConfig(), navigator.serviceWorker.register('/push-sw.js').then(() => navigator.serviceWorker.ready)]).then(async ([config, registration]) => {
      const subscription = await registration.pushManager.getSubscription();
      if (cancelled) return;
      if (config.enabled && config.publicKey) prepared.current = { registration, publicKey: config.publicKey };
      setSubscribed(Boolean(subscription && hasConsent() && Notification.permission === 'granted'));
    }).catch(() => { /* Report unavailability only if the visitor tries to subscribe. */ }).finally(() => { if (!cancelled) setPreparing(false); });
    return () => { cancelled = true; };
  }, [canPush]);
  useEffect(() => {
    if ((!canPush && !needsInstall) || (canPush && Notification.permission !== 'default')) return;
    try { if (Number(localStorage.getItem(snoozeKey)) > Date.now() || hasConsent()) return; } catch { /* Keep the prompt dismissible without storage. */ }
    const timer = window.setTimeout(() => setOpen(true), 6000);
    return () => window.clearTimeout(timer);
  }, [canPush, needsInstall]);
  if (!canPush && !needsInstall) return null;
  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(snoozeKey, String(Date.now() + 7 * 86400000)); } catch { /* Dismiss for this page visit. */ }
  };
  const subscribe = async () => {
    if (busy) return;
    setError('');
    if (!prepared.current) { setError(unavailable); return; }
    if (Notification.permission === 'denied') { setError('Notifications are blocked. You can allow them in your browser settings.'); return; }
    setBusy(true);
    let created: PushSubscription | null = null;
    try {
      // Permission is requested directly from the button click, as Safari requires.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setError('Notifications were not enabled. You can change this in your browser settings.'); return; }
      const { registration, publicKey } = prepared.current;
      let subscription = await registration.pushManager.getSubscription();
      const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));
      const existingKey = subscription?.options.applicationServerKey;
      if (subscription && existingKey && Array.from(new Uint8Array(existingKey)).join(',') !== Array.from(bytes).join(',')) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }); created = subscription; }
      await savePushSubscription(subscription.toJSON(), language);
      try { localStorage.setItem('madinaty-push-subscribed', 'true'); } catch { /* Backend consent is authoritative. */ }
      setSubscribed(true);
    } catch {
      if (created) await created.unsubscribe().catch(() => false);
      setError(unavailable);
    } finally { setBusy(false); }
  };
  const unsubscribe = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        // Disable delivery in the browser even if the API is temporarily offline.
        const savedSubscription = subscription.toJSON();
        if (!await subscription.unsubscribe()) throw new Error('Unsubscribe failed');
        await removePushSubscription(savedSubscription).catch(() => {});
      }
      try { localStorage.removeItem('madinaty-push-subscribed'); } catch { /* Browser subscription is already removed. */ }
      setSubscribed(false); dismiss();
    } catch { setError('Could not turn off notifications. Please use your browser settings.'); }
    finally { setBusy(false); }
  };
  return <div className="push-notifications">
    {open ? <section className="push-prompt" aria-label={t('Updates and offers')}>
      <button type="button" className="icon-button push-close" aria-label={t('Close notification prompt')} onClick={dismiss}><X size={18} /></button>
      <span className="push-bell"><Bell size={24} /></span>
      <h2>{t(subscribed ? 'Notifications are enabled' : 'This website would like to send you awesome updates and offers!')}</h2>
      <p>{t('Notifications can be turned off anytime from browser settings.')}</p>
      {needsInstall ? <p>{t('On iPhone or iPad, use Share → Add to Home Screen, then open Madinaty Deals from its icon to enable notifications.')}</p> : <>
        {error && <p role="alert" className="form-error">{t(error)}</p>}
        {subscribed && <p role="status">{t('You are subscribed to Madinaty Deals updates and offers.')}</p>}
        <div className="push-actions"><button type="button" className="button button-outline" onClick={dismiss}>{t('Not now')}</button><button type="button" className="button button-accent" disabled={busy || preparing} onClick={subscribed ? unsubscribe : subscribe}>{t(busy || preparing ? 'Please wait…' : subscribed ? 'Turn off notifications' : 'Allow notifications')}</button></div>
      </>}
    </section> : <button type="button" className="push-toggle" onClick={() => { setError(''); setOpen(true); }}><Bell size={17} />{t('Notifications')}</button>}
  </div>;
}
