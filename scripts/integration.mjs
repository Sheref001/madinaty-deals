/* global process, fetch, URL, console */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
const base = process.env.TEST_BASE_URL || 'http://localhost:43187';
const inbox = process.env.TEST_MAILPIT_URL || 'http://localhost:48025';
const origin = new URL(base).origin;
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Integration script is restricted to local test services');
const suffix = Date.now();
async function api(path, { method = 'GET', body, session, headers = {}, expected = 200 } = {}) {
  const response = await fetch(base + '/api' + path, { method, headers: { origin, ...(body && !Buffer.isBuffer(body) ? { 'content-type': 'application/json' } : {}), ...(session ? { cookie: session.cookie, 'x-csrf-token': session.csrfToken } : {}), ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text.slice(0, 200)}`);
  return { body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text, response };
}
async function login(email) {
  const { body: challenge } = await api('/auth/request-code', { method: 'POST', body: { email, name: 'Integration Neighbour' }, expected: 202 });
  let code;
  for (let attempt = 0; attempt < 20 && !code; attempt++) {
    const messages = await (await fetch(inbox + '/api/v1/messages')).json();
    const message = messages.messages.find(item => item.To.some(to => to.Address === email));
    if (message) {
      const detail = await (await fetch(inbox + '/api/v1/message/' + message.ID)).json();
      code = detail.Text.match(/\b\d{6}\b/)[0];
    } else await delay(500);
  }
  assert.ok(code, 'Email code arrived in the local SMTP inbox');
  await api('/auth/verify-code', { method: 'POST', body: { challengeId: challenge.challengeId, code: code === '000000' ? '111111' : '000000' }, expected: 400 });
  const verified = await api('/auth/verify-code', { method: 'POST', body: { challengeId: challenge.challengeId, code } });
  const session = { cookie: verified.response.headers.get('set-cookie').split(';')[0], csrfToken: verified.body.csrfToken, user: verified.body.user };
  assert.match(verified.response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  await api('/auth/verify-code', { method: 'POST', body: { challengeId: challenge.challengeId, code }, expected: 400 });
  return session;
}
await api('/ready');
await api('/uploads?purpose=photo', { method: 'POST', body: Buffer.from('bad'), expected: 401 });
const owner = await login(`owner-${suffix}@example.test`);
const other = await login(`other-${suffix}@example.test`);
const admin = await login('admin@example.test');
assert.equal((await api('/auth/session', { session: owner })).body.user.id, owner.user.id);
await api('/admin/verifications', { session: owner, expected: 403 });
await api('/auth/logout', { method: 'POST', session: owner, headers: { 'x-csrf-token': 'bad' }, expected: 403 });
await api('/auth/logout', { method: 'POST', session: owner, headers: { origin: 'https://other.example' }, expected: 403 });
const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: 'green' } }).png().toBuffer();
const upload = async (purpose, documentType = '') => (await api(`/uploads?purpose=${purpose}&documentType=${documentType}`, { method: 'POST', session: owner, body: png, headers: { 'content-type': 'image/png', 'x-file-name': 'private.png' }, expected: 201 })).body.upload;
const photo = await upload('photo');
await api('/uploads/' + photo.id, { expected: 401 });
await api('/uploads/' + photo.id, { session: other, expected: 404 });
await api('/uploads/' + photo.id, { session: owner });
await api('/uploads?purpose=photo', { method: 'POST', session: owner, body: Buffer.from('not an image'), headers: { 'content-type': 'image/jpeg' }, expected: 400 });
// Standard harmless antivirus test signature; verifies the real ClamAV service.
const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
await api('/uploads?purpose=photo', { method: 'POST', session: owner, body: eicar, headers: { 'content-type': 'image/jpeg' }, expected: 400 });
const payload = { title: 'Integration table', subtitle: 'A test listing for local integration checks.', category: 'Furniture & home', zone: 'B1', price: 100, condition: 'Good' };
await api('/submissions', { method: 'POST', session: other, body: { kind: 'listing', payload, uploadIds: [photo.id] }, expected: 400 });
const submission = await api('/submissions', { method: 'POST', session: owner, body: { kind: 'listing', payload, uploadIds: [photo.id] }, expected: 201 });
assert.equal(submission.body.status, 'PENDING_REVIEW');
await api('/uploads/' + photo.id, { method: 'DELETE', session: owner, expected: 409 });
const evidence = await upload('verification', 'MADINATY_ID');
const verification = await api('/verifications', { method: 'POST', session: owner, body: { uploadIds: [evidence.id] }, expected: 201 });
assert.equal(verification.body.status, 'PENDING');
await api('/uploads/' + evidence.id, { session: other, expected: 404 });
await api('/uploads/' + evidence.id, { session: admin });
const reviewPath = `/admin/verifications/${verification.body.id}/review`;
await api(reviewPath, { method: 'POST', session: owner, body: { status: 'VERIFIED' }, expected: 403 });
await api(reviewPath, { method: 'POST', session: admin, body: { status: 'VERIFIED' } });
assert.equal((await api('/auth/session', { session: owner })).body.user.residentVerified, true);
const rental = { ...payload, category: 'Apartment rentals' };
await api('/submissions', { method: 'POST', session: owner, body: { kind: 'listing', payload: rental }, expected: 201 });
await api('/submissions', { method: 'POST', session: owner, body: { kind: 'listing', payload: rental }, expected: 409 });
await api('/content/listing/integration/comments', { method: 'POST', body: { body: 'Anonymous comment' }, expected: 401 });
await api('/content/listing/integration/comments', { method: 'POST', session: owner, body: { body: 'تعليق للمراجعة', language: 'ar' }, expected: 201 });
assert.equal((await api('/content/listing/integration/comments')).body.comments.length, 0);
await api('/auth/logout', { method: 'POST', session: owner });
assert.equal((await api('/auth/session', { session: owner })).body.user, null);
await api('/uploads/' + evidence.id, { session: owner, expected: 401 });
console.log('PASS: PostgreSQL readiness, SMTP OTP, replay/CSRF/role boundaries, local private uploads, moderation, rental quota and logout.');
