/* global URL */
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { RequestError, readJson } from './request.js';
import { consumeLimit, canReview } from './auth.js';
import { ownerListingActive, vehicleResidenceAllowed } from './moderation.js';

export async function readUpload(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) { request.resume(); throw new RequestError(413, 'File is too large'); }
    chunks.push(chunk);
  }
  if (!size) throw new RequestError(400, 'Choose a file');
  return Buffer.concat(chunks);
}

export async function sanitizeFile(bytes, mimeType, purpose) {
  if (purpose === 'verification' && mimeType === 'application/pdf') {
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new RequestError(400, 'Invalid PDF file');
    return { bytes, mimeType };
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(mimeType)) throw new RequestError(400, 'Use JPG, PNG, WEBP, GIF or AVIF images');
  try {
    const pipeline = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
    const metadata = await pipeline.metadata();
    const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'heif', 'image/gif': 'gif' };
    if (metadata.format !== expected[mimeType]) throw new Error('Type mismatch');
    const output = await pipeline.rotate().resize({ width: purpose === 'photo' ? 2000 : 4000, height: purpose === 'photo' ? 2000 : 4000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return { bytes: output, mimeType: 'image/webp' };
  } catch { throw new RequestError(400, 'Invalid or unsupported image'); }
}

const documentTypes = new Set(['NATIONAL_ID', 'MADINATY_ID', 'ELECTRICITY_BILL', 'WATER_BILL', 'GAS_BILL', 'LEASE_OR_OWNERSHIP', 'OTHER']);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export function createUploads({ prisma, config, auth, storage }) {
  let active = 0;
  async function handle(request, response, parts, send) {
    const url = new URL(request.url, config.origin);
    if (parts[1] === 'public-uploads' && parts.length === 3 && uuid(parts[2]) && request.method === 'GET') {
      const upload = await prisma.upload.findUnique({ where: { id: parts[2] }, select: { mimeType: true, objectKey: true, purpose: true, status: true, submission: { select: { kind: true, status: true, ownerState: true, payload: true, user: { select: { status: true, profile: { select: { verificationState: true } } } } } } } });
      if (!upload || upload.purpose !== 'photo' || upload.status !== 'READY' || upload.submission?.status !== 'PUBLISHED' || upload.submission.user.status !== 'ACTIVE' || !vehicleResidenceAllowed(upload.submission) || !ownerListingActive(upload.submission)) throw new RequestError(404, 'Not found');
      const bytes = await storage.get(upload.objectKey);
      response.writeHead(200, { 'content-type': upload.mimeType, 'content-disposition': 'inline', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
      return response.end(Buffer.from(bytes));
    }
    if (parts[1] === 'uploads' && request.method === 'POST' && parts.length === 2) {
      const current = await auth.protect(request);
      await consumeLimit(prisma, 'upload', current.userId, 30, 3600000);
      if (active >= 4) throw new RequestError(503, 'Uploads are busy. Please try again shortly.');
      const purpose = url.searchParams.get('purpose');
      const documentType = url.searchParams.get('documentType');
      if (!['photo', 'verification'].includes(purpose) || (purpose === 'verification' && !documentTypes.has(documentType))) throw new RequestError(400, 'Invalid upload purpose');
      let originalFileName;
      // eslint-disable-next-line no-control-regex
      try { originalFileName = decodeURIComponent(String(request.headers['x-file-name'] || 'upload')).replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 160); } catch { throw new RequestError(400, 'Invalid file name'); }
      active++;
      try {
        const original = await readUpload(request, purpose === 'photo' ? 5 * 1024 * 1024 : 10 * 1024 * 1024);
        const file = await sanitizeFile(original, String(request.headers['content-type'] || '').split(';')[0], purpose);
        const id = randomUUID();
        const objectKey = `${purpose}/${current.userId}/${id}`;
        const data = { id, userId: current.userId, purpose, documentType: purpose === 'verification' ? documentType : null, objectKey, originalFileName, mimeType: file.mimeType, byteSize: file.bytes.length, sha256: createHash('sha256').update(file.bytes).digest('hex') };
        // Reserve quota before storing bytes, including concurrent requests.
        await prisma.$transaction(async tx => {
          // Cast void to text so Prisma can read the result without aborting the transaction.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${current.userId}))::text`;
          const total = await tx.upload.aggregate({ where: { userId: current.userId }, _sum: { byteSize: true } });
          if ((total._sum.byteSize || 0) + data.byteSize > 200 * 1024 * 1024) throw new RequestError(413, 'Your upload storage limit has been reached');
          await tx.upload.create({ data });
        });
        try {
          await storage.put(objectKey, file.bytes);
        } catch {
          await prisma.upload.delete({ where: { id } });
          throw new RequestError(503, 'File storage is unavailable. Please try again later.');
        }
        await prisma.$transaction([
          prisma.upload.update({ where: { id }, data: { status: 'READY' } }),
          prisma.auditLog.create({ data: { actorId: current.userId, action: 'upload.created', targetType: 'Upload', targetId: id } }),
        ]);
        return send(response, 201, { upload: { id, originalFileName, mimeType: file.mimeType, byteSize: file.bytes.length } });
      } finally { active--; }
    }
    if (parts[1] === 'uploads' && parts.length === 3 && uuid(parts[2])) {
      const current = request.method === 'GET' ? await auth.session(request) : await auth.protect(request);
      const upload = await prisma.upload.findUnique({ where: { id: parts[2] } });
      const permission = upload?.purpose === 'verification' ? 'RESIDENT_VERIFICATIONS' : 'CONTENT_REVIEW';
      const reviewerAccess = upload?.purpose === 'verification' ? Boolean(upload.verificationId) : upload?.purpose === 'photo' ? Boolean(upload.submissionId) : false;
      if (!upload || upload.status !== 'READY' || (upload.userId !== current.userId && !(reviewerAccess && canReview(current.publicUser || current.user, permission)))) throw new RequestError(404, 'Not found');
      if (request.method === 'GET') {
        await prisma.auditLog.create({ data: { actorId: current.userId, action: 'upload.read', targetType: 'Upload', targetId: upload.id } });
        const bytes = await storage.get(upload.objectKey);
        response.writeHead(200, { 'content-type': upload.mimeType, 'content-disposition': 'attachment; filename="document"', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" });
        return response.end(Buffer.from(bytes));
      }
      if (request.method === 'DELETE') {
        await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${current.userId}))::text`;
          const latest = await tx.upload.findUnique({ where: { id: upload.id } });
          if (!latest || latest.userId !== current.userId || latest.submissionId || latest.verificationId) throw new RequestError(409, 'Submitted evidence cannot be deleted here');
          await storage.remove(latest.objectKey);
          await tx.upload.delete({ where: { id: latest.id } });
          await tx.auditLog.create({ data: { actorId: current.userId, action: 'upload.deleted', targetType: 'Upload', targetId: latest.id } });
        });
        return send(response, 200, { ok: true });
      }
    }
    if (parts[1] === 'verifications' && parts.length === 2 && request.method === 'POST') {
      const current = await auth.protect(request);
      await consumeLimit(prisma, 'verification', current.userId, 3, 86400000);
      const body = await readJson(request);
      if (!Array.isArray(body.uploadIds) || !body.uploadIds.length || body.uploadIds.length > 6 || !body.uploadIds.every(uuid) || new Set(body.uploadIds).size !== body.uploadIds.length) throw new RequestError(400, 'Select one to six verification documents');
      const result = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${current.userId}))::text`;
        if (await tx.residentVerification.findFirst({ where: { userId: current.userId, status: 'PENDING' } })) throw new RequestError(409, 'You already have a verification request awaiting review');
        const uploads = await tx.upload.findMany({ where: { id: { in: body.uploadIds }, userId: current.userId, purpose: 'verification', verificationId: null, status: 'READY' } });
        if (uploads.length !== body.uploadIds.length) throw new RequestError(400, 'Invalid verification documents');
        const verification = await tx.residentVerification.create({ data: { userId: current.userId, documents: { create: uploads.map(({ documentType, objectKey, originalFileName, mimeType, byteSize, sha256 }) => ({ documentType, objectKey, originalFileName, mimeType, byteSize, sha256 })) } } });
        await tx.upload.updateMany({ where: { id: { in: body.uploadIds } }, data: { verificationId: verification.id } });
        await tx.auditLog.create({ data: { actorId: current.userId, action: 'verification.submitted', targetType: 'ResidentVerification', targetId: verification.id } });
        return verification;
      });
      return send(response, 201, { id: result.id, status: result.status });
    }
    throw new RequestError(404, 'Not found');
  }
  return { handle };
}
