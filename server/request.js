import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readJson(request) {
  const chunks = [];
  let size = 0;
  // Keep the connection available so the handler can send a useful 413 response.
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 10000) {
      request.resume();
      throw new RequestError(413, 'Payload too large');
    }
    chunks.push(bytes);
  }
  let body;
  try {
    body = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    throw new RequestError(400, 'Invalid JSON');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestError(400, 'JSON body must be an object');
  }
  return body;
}

export function routeParts(url) {
  try {
    return new URL(url, 'http://localhost').pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    throw new RequestError(400, 'Invalid request URL');
  }
}

const allowedTypes = new Set(['listing', 'service', 'business', 'offer']);
export const validContent = (type, id) => allowedTypes.has(type) && typeof id === 'string' && id.length > 0 && id.length <= 160;
