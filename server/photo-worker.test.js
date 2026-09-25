import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { processPhoto } from './photo-worker.js';

const userId = '12345678-1234-1234-1234-123456789012';
const photoId = '87654321-4321-4321-4321-210987654321';
const key = `raw/${userId}/${photoId}`;

describe('S3 photo worker', () => {
  it('converts a valid raw photo to metadata-stripped WebP and deletes the raw object', async () => {
    const input = await sharp({ create: { width: 30, height: 30, channels: 3, background: 'red' } }).withExif({ IFD0: { Artist: 'secret' } }).jpeg().toBuffer();
    const send = vi.fn(async command => {
      if (command.constructor.name === 'GetObjectCommand') return { ContentType: 'image/jpeg', ContentLength: input.length, Body: { transformToByteArray: async () => input } };
      return {};
    });
    expect(await processPhoto({ bucket: 'private-photos', key, s3: { send } })).toBe(`active/${userId}/${photoId}`);
    const put = send.mock.calls.map(([command]) => command).find(command => command.constructor.name === 'PutObjectCommand');
    expect(put.input.ContentType).toBe('image/webp');
    expect(put.input.IfNoneMatch).toBe('*');
    expect(put.input.Metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await sharp(put.input.Body).metadata()).exif).toBeUndefined();
    expect(send.mock.calls.at(-1)[0].constructor.name).toBe('DeleteObjectCommand');
  });

  it('rejects invalid photos before writing an active object', async () => {
    const send = vi.fn(async () => ({ ContentType: 'image/jpeg', ContentLength: 7, Body: { transformToByteArray: async () => Buffer.from('invalid') } }));
    await expect(processPhoto({ bucket: 'private-photos', key, s3: { send } })).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
