import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { sanitizeFile, createUploads } from './uploads.js';

describe('upload boundaries', () => {
  it('re-encodes photos, strips metadata and rejects mismatched MIME types', async () => {
    const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).withExif({ IFD0: { Artist: 'private-name' } }).jpeg().toBuffer();
    const clean = await sanitizeFile(original, 'image/jpeg', 'photo');
    expect(clean.mimeType).toBe('image/webp');
    expect((await sharp(clean.bytes).metadata()).exif).toBeUndefined();
    await expect(sanitizeFile(original, 'image/png', 'photo')).rejects.toMatchObject({ status: 400 });
  });
  it('rejects arbitrary bytes, SVG and PDF masquerading as listing photos', async () => {
    for (const [content, mime, purpose] of [['not an image', 'image/jpeg', 'photo'], ['<svg/>', 'image/svg+xml', 'photo'], ['%PDF-1.7\n%%EOF', 'application/pdf', 'photo'], ['not a pdf', 'application/pdf', 'verification']]) {
      await expect(sanitizeFile(Buffer.from(content), mime, purpose)).rejects.toMatchObject({ status: 400 });
    }
  });
  it('denies documents to unrelated accounts without contacting storage', async () => {
    const storage = { send: vi.fn() };
    const uploads = createUploads({ config: { origin: 'https://madinatydeals.com' }, storage, auth: { session: async () => ({ userId: 'other', user: { role: 'RESIDENT' } }) }, prisma: { upload: { findUnique: async () => ({ userId: 'owner' }) } } });
    await expect(uploads.handle({ method: 'GET', url: '/api/uploads/12345678-1234-1234-1234-123456789012' }, {}, ['api', 'uploads', '12345678-1234-1234-1234-123456789012'], vi.fn())).rejects.toMatchObject({ status: 404 });
    expect(storage.send).not.toHaveBeenCalled();
  });
});
