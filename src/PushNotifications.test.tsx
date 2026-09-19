// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PushNotifications from './PushNotifications';
import { LanguageContext } from './i18n';
import { getPushConfig, savePushSubscription, removePushSubscription } from './api';
vi.mock('./api', () => ({ getPushConfig: vi.fn(), savePushSubscription: vi.fn(), removePushSubscription: vi.fn() }));
const requestPermission = vi.fn();
const unsubscribe = vi.fn();
const subscription = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/wp/test', keys: {} }), unsubscribe };
const subscribe = vi.fn();
const getSubscription = vi.fn();
const registration = { pushManager: { subscribe, getSubscription } };
const originalSW = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  vi.stubGlobal('PushManager', class {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn().mockResolvedValue(registration), ready: Promise.resolve(registration), getRegistration: vi.fn().mockResolvedValue(registration) } });
  vi.mocked(getPushConfig).mockResolvedValue({ enabled: true, publicKey: btoa('test-key') });
  vi.mocked(savePushSubscription).mockResolvedValue({ ok: true });
  vi.mocked(removePushSubscription).mockResolvedValue({ ok: true });
  getSubscription.mockResolvedValue(null); subscribe.mockResolvedValue(subscription); unsubscribe.mockResolvedValue(true); requestPermission.mockResolvedValue('granted');
});
afterEach(() => {
  cleanup(); localStorage.clear(); vi.unstubAllGlobals();
  if (originalSW) Object.defineProperty(navigator, 'serviceWorker', originalSW);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});
async function open() {
  render(<LanguageContext.Provider value="en"><PushNotifications /></LanguageContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Allow notifications' }) as HTMLButtonElement).disabled).toBe(false));
}
it('requests browser permission only after the visitor explicitly allows notifications', async () => {
  await open(); expect(requestPermission).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Allow notifications' }));
  await screen.findByRole('status');
  expect(savePushSubscription).toHaveBeenCalledWith(subscription.toJSON(), 'en');
  expect(requestPermission).toHaveBeenCalledOnce();
});
it('snoozes the prompt when the visitor chooses not now', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
  expect(screen.queryByRole('region', { name: 'Updates and offers' })).toBeNull();
  expect(Number(localStorage.getItem('madinaty-notifications-dismissed-until'))).toBeGreaterThan(Date.now());
  expect(requestPermission).not.toHaveBeenCalled();
});
it('does not claim subscription success when permission is refused', async () => {
  requestPermission.mockResolvedValue('denied'); await open();
  fireEvent.click(screen.getByRole('button', { name: 'Allow notifications' }));
  expect((await screen.findByRole('alert')).textContent).toContain('not enabled');
  expect(savePushSubscription).not.toHaveBeenCalled();
});
it('does not ask for permission when server delivery is not configured', async () => {
  vi.mocked(getPushConfig).mockResolvedValue({ enabled: false, publicKey: null }); await open();
  fireEvent.click(screen.getByRole('button', { name: 'Allow notifications' }));
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable');
  expect(requestPermission).not.toHaveBeenCalled();
});
it('removes a new browser subscription if saving consent fails', async () => {
  vi.mocked(savePushSubscription).mockRejectedValue(new Error('offline')); await open();
  fireEvent.click(screen.getByRole('button', { name: 'Allow notifications' }));
  await screen.findByRole('alert');
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(localStorage.getItem('madinaty-push-subscribed')).toBeNull();
});
it('turns off browser delivery even when server cleanup is unavailable', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: 'Allow notifications' }));
  await screen.findByRole('status');
  getSubscription.mockResolvedValue(subscription);
  vi.mocked(removePushSubscription).mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Turn off notifications' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Updates and offers' })).toBeNull());
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(localStorage.getItem('madinaty-push-subscribed')).toBeNull();
});
