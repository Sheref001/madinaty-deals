/* global process, fetch, URL, console */
// Real PostgreSQL + HTTP regression checks. No Cognito, email, or production data.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { createRequestHandler } from '../server/app.js';
import { createAuth } from '../server/auth.js';
import { createSubmissions } from '../server/submissions.js';
import { createUploads } from '../server/uploads.js';
import { createLocalStorage } from '../server/local-storage.js';

assert.ok(process.env.TEST_DATABASE_URL, 'Set TEST_DATABASE_URL to a disposable local PostgreSQL database ending in _test');
const database = new URL(process.env.TEST_DATABASE_URL);
assert.ok(['postgres:', 'postgresql:'].includes(database.protocol));
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname), 'Only local test databases are allowed');
assert.match(database.pathname, /^\/[a-z0-9_]+_test$/, 'Database name must end in _test');
assert.ok([...database.searchParams.keys()].every(key => key === 'schema'), 'Connection overrides are not allowed');
// Never reset an existing schema. Every run gets its own migrated schema.
const schema = 'publication_test_' + randomUUID().replaceAll('-', '');
database.searchParams.set('schema', schema);
const datasourceUrl = database.toString();
const prisma = new PrismaClient({ datasourceUrl });
const directory = await mkdtemp(join(tmpdir(), 'madinaty-publishing-'));
let server;

try {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: datasourceUrl },
    stdio: 'pipe',
  });
  const config = { local: true, cookieName: 'test_session', secret: randomBytes(32).toString('hex') };
  const auth = createAuth({ prisma, config, mailer: { sendMail() { throw new Error('This test must never send email'); } } });
  const submissions = createSubmissions({ prisma, auth });
  const uploads = createUploads({ prisma, auth, config, storage: createLocalStorage(directory) });
  server = createServer(createRequestHandler({ prisma, auth, submissions, uploads, config }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;

  async function api(path, { session, body, method = 'GET', headers = {}, status = 200 } = {}) {
    const binary = body instanceof Uint8Array;
    const response = await fetch(config.origin + '/api' + path, {
      method,
      headers: {
        origin: config.origin,
        ...(body !== undefined && !binary ? { 'content-type': 'application/json' } : {}),
        ...(session ? { cookie: session.cookie, 'x-csrf-token': session.csrfToken } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
    });
    const result = response.headers.get('content-type')?.includes('application/json') ? await response.json() : new Uint8Array(await response.arrayBuffer());
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
    return result;
  }
  async function account(name) {
    const user = await prisma.user.create({ data: { email: `${name}@example.test`, emailVerifiedAt: new Date(), profile: { create: { displayName: name } } } });
    // Use the same session creator as a successful Cognito callback, locally.
    const cookie = (await prisma.$transaction(tx => auth.createLoginSession(tx, user.id))).split(';')[0];
    const session = { cookie };
    session.csrfToken = (await api('/auth/session', { session })).csrfToken;
    assert.ok(session.csrfToken);
    return { ...session, userId: user.id };
  }
  const owner = await account('publisher');
  const other = await account('other');
  const tutoring = {
    kind: 'service', payload: {
      title: 'مدرس رياضيات في مدينتي', subtitle: 'دروس رياضيات للمرحلة الثانوية داخل مدينتي.',
      category: 'Tutoring & education', zone: 'All Madinaty', advertiserType: 'individual',
      whatsapp: '+201000000000', educationLevel: 'Before university', subjects: ['Mathematics'],
      pricing: '500 EGP per month', availability: 'Evenings',
    },
  };
  const publish = (body, status = 201, session = owner) => api('/submissions', { method: 'POST', body, session, status });
  await publish(tutoring, 401, null);
  await api('/submissions', { method: 'POST', body: tutoring, session: owner, headers: { 'x-csrf-token': 'wrong' }, status: 403 });
  const service = await publish(tutoring);
  assert.equal(service.status, 'PUBLISHED');
  const saved = await prisma.submission.findUniqueOrThrow({ where: { id: service.id } });
  assert.equal(saved.userId, owner.userId);
  assert.equal(saved.payload.title, tutoring.payload.title);
  assert.equal(saved.rentalMonth, null);
  assert.equal(await prisma.auditLog.count({ where: { targetId: service.id, action: 'submission.created' } }), 1);
  console.log('PASS: tutoring service publishes and persists with its audit record');

  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: 'green' } }).png().toBuffer();
  const upload = async (purpose = 'photo') => (await api(`/uploads?purpose=${purpose}&documentType=MADINATY_ID`, {
    method: 'POST', session: owner, body: png, headers: { 'content-type': 'image/png', 'x-file-name': encodeURIComponent('صورة.png') }, status: 201,
  })).upload;
  const photo = await upload();
  const listing = { kind: 'listing', payload: { title: 'Wooden dining table', subtitle: 'Solid wood table in good condition.', category: 'Furniture & home', zone: 'B1', price: 500, condition: 'Good', advertiserType: 'individual' }, uploadIds: [photo.id] };
  await publish(listing, 400, other);
  const ad = await publish(listing);
  assert.equal(ad.status, 'PUBLISHED');
  assert.equal((await prisma.upload.findUniqueOrThrow({ where: { id: photo.id } })).submissionId, ad.id);
  const image = await api('/public-uploads/' + photo.id);
  assert.equal((await sharp(image).metadata()).format, 'webp');
  await publish(listing, 400); // attached images cannot be claimed again
  await api('/uploads/' + photo.id, { method: 'DELETE', session: owner, status: 409 });
  const feed = await api('/public-submissions');
  assert.ok(feed.submissions.some(item => item.id === ad.id && item.uploadIds.includes(photo.id)));
  assert.ok(feed.submissions.some(item => item.id === service.id));
  console.log('PASS: photo upload, listing publication, public image, and image ownership');

  const business = await publish({ ...tutoring, payload: { ...tutoring.payload, advertiserType: 'small_business' } });
  assert.equal(business.status, 'PENDING_REVIEW');
  const invalid = { ...listing, uploadIds: [], payload: { ...listing.payload, price: -1 } };
  await publish(invalid, 400);
  const offered = { ...tutoring, payload: { ...tutoring.payload, offer: { kind: 'First session free', discount: 'First session free', validUntil: '2099-01-01' } } };
  // Same account sends two simultaneous promotions. Only one must persist.
  const concurrent = await Promise.all([offered, offered].map(async body => {
    const response = await fetch(config.origin + '/api/submissions', { method: 'POST', headers: { origin: config.origin, 'content-type': 'application/json', cookie: owner.cookie, 'x-csrf-token': owner.csrfToken }, body: JSON.stringify(body) });
    await response.text();
    return response.status;
  }));
  assert.deepEqual(concurrent.sort(), [201, 409]);
  assert.equal((await prisma.submission.findMany({ where: { userId: owner.userId } })).filter(item => item.payload.offer).length, 1);
  console.log('PASS: business review, validation, and concurrent monthly promotion limit');

  const unused = await upload();
  await api('/uploads/' + unused.id, { method: 'DELETE', session: owner });
  assert.equal(await prisma.upload.findUnique({ where: { id: unused.id } }), null);
  const evidence = await upload('verification');
  const verification = await api('/verifications', { method: 'POST', session: owner, body: { uploadIds: [evidence.id] }, status: 201 });
  assert.equal(verification.status, 'PENDING');
  assert.equal((await prisma.upload.findUniqueOrThrow({ where: { id: evidence.id } })).verificationId, verification.id);
  await api('/verifications', { method: 'POST', session: owner, body: { uploadIds: [evidence.id] }, status: 409 });
  console.log('PASS: unattached photo removal and resident verification submission');
} finally {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  try {
    // Identifier is generated above, never taken from input. Drop ONLY this run's schema.
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
}
