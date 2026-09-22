// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { submitPost, uploadFile } from './api';

afterEach(() => vi.unstubAllGlobals());

it('explains an HTML 413 from Nginx and stops before submitting the listing', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('<html>413 Request Entity Too Large</html>', { status: 413, headers: { 'content-type': 'text/html' } }));
  vi.stubGlobal('fetch', fetch);
  const photo = new File(['bytes'], 'test.jpg', { type: 'image/jpeg' });
  await expect(submitPost('listing', { title: 'My table' }, [photo])).rejects.toThrow('The server rejected the file size.');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/api/uploads?purpose=photo');
});

it('preserves validation messages from the application', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Invalid or unsupported image' }, { status: 400 })));
  await expect(uploadFile(new File(['bad'], 'test.jpg', { type: 'image/jpeg' }), 'photo')).rejects.toThrow('Invalid or unsupported image');
});

it.each([401, 403, 429, 502])('explains a non-JSON HTTP %s without leaking raw HTML', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>internal proxy detail</html>', { status })));
  try {
    await uploadFile(new File(['bytes'], 'test.jpg', { type: 'image/jpeg' }), 'photo');
    expect.fail('Expected request rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toMatch(/Request failed|internal proxy detail|<html>/);
  }
});

it('sends the file bytes, then attaches the returned upload ID to the submission', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ upload: { id: 'photo-id' } }, { status: 201 }))
    .mockResolvedValueOnce(Response.json({ id: 'submission-id', status: 'PENDING_REVIEW' }, { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  const photo = new File(['bytes'], 'صورة.jpg', { type: 'image/jpeg' });
  const payload = { title: 'My table' };
  expect(await submitPost('listing', payload, [photo])).toEqual({ id: 'submission-id', status: 'PENDING_REVIEW' });
  expect(fetch.mock.calls[0][1].body).toBe(photo);
  expect(fetch.mock.calls[0][1].headers['x-file-name']).toBe(encodeURIComponent(photo.name));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ kind: 'listing', payload, uploadIds: ['photo-id'] });
});
