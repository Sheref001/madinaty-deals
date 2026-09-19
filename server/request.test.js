import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readJson, routeParts, validContent } from './request.js';

const bodyStream = (...chunks) => Readable.from(chunks);

describe('API request validation', () => {
  it('accepts empty bodies and JSON objects', async () => {
    expect(await readJson(bodyStream())).toEqual({});
    expect(await readJson(bodyStream('{"body":', '"hello"}'))).toEqual({ body: 'hello' });
  });

  it.each(['{', 'null', '[]', 'true', '42', '"hello"'])('rejects invalid or non-object JSON: %s', async raw => {
    await expect(readJson(bodyStream(raw))).rejects.toMatchObject({ status: 400 });
  });

  it('decodes Arabic UTF-8 characters split across network chunks', async () => {
    const bytes = Buffer.from(JSON.stringify({ body: 'مرحبا' }));
    expect(await readJson(bodyStream(...Array.from(bytes, byte => Buffer.from([byte])))))
      .toEqual({ body: 'مرحبا' });
  });

  it('limits bytes, including multibyte Arabic content', async () => {
    await expect(readJson(bodyStream(JSON.stringify({ body: 'م'.repeat(5000) }))))
      .rejects.toMatchObject({ status: 413 });
  });

  it('accepts the size boundary and rejects the next byte', async () => {
    expect(await readJson(bodyStream('{}' + ' '.repeat(9998)))).toEqual({});
    await expect(readJson(bodyStream('{}' + ' '.repeat(9999)))).rejects.toMatchObject({ status: 413 });
  });

  it('rejects oversized input before waiting for the end of the request', async () => {
    const request = new Readable({ read() {} });
    request.push(Buffer.alloc(10001));
    await expect(readJson(request)).rejects.toMatchObject({ status: 413 });
    request.destroy();
  });

  it('returns a client error for invalid URL escapes', () => {
    expect(() => routeParts('/api/content/listing/%ZZ/comments')).toThrow(expect.objectContaining({ status: 400 }));
    expect(routeParts('/api/content/listing/hello%20world/comments?q=x')).toEqual(['api', 'content', 'listing', 'hello world', 'comments']);
  });

  it('rejects incomplete and unsupported content identifiers without throwing', () => {
    expect(validContent('listing', undefined)).toBe(false);
    expect(validContent('listing', '')).toBe(false);
    expect(validContent('unknown', 'id')).toBe(false);
    expect(validContent('listing', 'x'.repeat(161))).toBe(false);
    expect(validContent('listing', 'id')).toBe(true);
  });
});
