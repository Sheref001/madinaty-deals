import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import { expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8');
function worker() {
  const handlers = {};
  const self = {
    location: { origin: 'https://madinatydeals.com' },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: { openWindow: vi.fn().mockResolvedValue(undefined) },
    addEventListener: (name, handler) => { handlers[name] = handler; },
  };
  runInNewContext(source, { self, URL });
  return { self, handlers };
}
it('displays a visible notification without installing a fetch/cache handler', async () => {
  const { self, handlers } = worker();
  let done;
  handlers.push({ data: { json: () => ({ title: 'عرض جديد', body: 'تفاصيل العرض', url: '/?lang=ar', tag: 'campaign' }) }, waitUntil: promise => { done = promise; } });
  await done;
  expect(self.registration.showNotification).toHaveBeenCalledWith('عرض جديد', expect.objectContaining({ body: 'تفاصيل العرض', data: { url: '/?lang=ar' }, tag: 'campaign' }));
  expect(handlers.fetch).toBeUndefined();
});
it.each(['https://attacker.test/', 'javascript:alert(1)', '//attacker.test/'])('does not navigate to a foreign notification target: %s', url => {
  const { self, handlers } = worker();
  handlers.notificationclick({ notification: { close: vi.fn(), data: { url } }, waitUntil: () => {} });
  expect(self.clients.openWindow).toHaveBeenCalledWith('https://madinatydeals.com/');
});
it('opens the intended offer on this website', () => {
  const { self, handlers } = worker();
  handlers.notificationclick({ notification: { close: vi.fn(), data: { url: '/?ad=offer-2' } }, waitUntil: () => {} });
  expect(self.clients.openWindow).toHaveBeenCalledWith('https://madinatydeals.com/?ad=offer-2');
});
