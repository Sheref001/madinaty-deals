/* global Response, URLSearchParams */
import { describe, expect, it, vi } from 'vitest';
import { createMailer } from './mailer.js';

const config = {
  mailProvider: 'microsoft-graph-delegated',
  from: 'hello@madinatydeals.com',
  graph: { tenantId: 'tenant-id', clientId: 'client-id', tokenFile: '/unused/token.json' },
};

describe('Microsoft Graph mailer', () => {
  it('exchanges the delegated refresh token and sends as the signed-in mailbox', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-token', refresh_token: 'rotated-refresh-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const tokenStore = { read: vi.fn().mockResolvedValue('refresh-token'), write: vi.fn() };
    const delegatedMailer = createMailer(config, fetchImpl, tokenStore);

    await expect(delegatedMailer.sendMail({ to: 'person@example.com', subject: 'Sign-in code', text: '123456' })).resolves.toMatchObject({ provider: 'microsoft-graph-delegated' });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
    expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).get('grant_type')).toBe('refresh_token');
    expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).get('refresh_token')).toBe('refresh-token');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/me/sendMail');
    expect(fetchImpl.mock.calls[1][1].headers.authorization).toBe('Bearer access-token');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).message.toRecipients[0].emailAddress.address).toBe('person@example.com');
    expect(tokenStore.write).toHaveBeenCalledWith('rotated-refresh-token');
  });

  it('caches the token for subsequent messages', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const tokenStore = { read: vi.fn().mockResolvedValue('refresh-token'), write: vi.fn() };
    const mailer = createMailer(config, fetchImpl, tokenStore);

    await mailer.sendMail({ to: 'first@example.com', subject: 'One', text: '1' });
    await mailer.sendMail({ to: 'second@example.com', subject: 'Two', text: '2' });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not expose provider response bodies in errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('sensitive provider detail', { status: 401 }));
    const mailer = createMailer(config, fetchImpl, { read: vi.fn().mockResolvedValue('refresh-token'), write: vi.fn() });

    await expect(mailer.sendMail({ to: 'person@example.com', subject: 'Sign-in code', text: '123456' })).rejects.toThrow('Microsoft token request failed (401)');
    await expect(mailer.sendMail({ to: 'person@example.com', subject: 'Sign-in code', text: '123456' })).rejects.not.toThrow('sensitive provider detail');
  });
});
