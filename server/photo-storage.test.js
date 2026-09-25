import { describe, expect, it, vi } from 'vitest';
import { createPhotoStorage } from './photo-storage.js';

const key = 'active/12345678-1234-1234-1234-123456789012/87654321-4321-4321-4321-210987654321';

describe('S3 photo storage', () => {
  it('keeps old local photo keys on local storage', async () => {
    const localStorage = { get: vi.fn().mockResolvedValue(new Uint8Array([1])) };
    const send = vi.fn();
    const storage = createPhotoStorage({ bucket: 'private-photos', region: 'eu-north-1', localStorage, client: { send } });
    await storage.get(key.replace('active/', 'photo/'));
    expect(localStorage.get).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it('archives a closed photo by copy then delete', async () => {
    const send = vi.fn(async command => {
      if (command.constructor.name === 'HeadObjectCommand') throw { name: 'NotFound', $metadata: { httpStatusCode: 404 } };
      return {};
    });
    const storage = createPhotoStorage({ bucket: 'private-photos', region: 'eu-north-1', localStorage: {}, client: { send } });
    expect(await storage.archiveClosedAdPhoto(key)).toBe(key.replace('active/', 'closed/'));
    expect(send.mock.calls.map(([command]) => command.constructor.name)).toEqual(['HeadObjectCommand', 'CopyObjectCommand', 'DeleteObjectCommand']);
  });
});
