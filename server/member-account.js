import { URL } from 'node:url';
import console from 'node:console';
import { RequestError, readJson } from './request.js';
import { consumeLimit } from './auth.js';
import { isOnlineStoreZone, publicPayload, validateServiceDescription } from './submissions.js';
import { vehicleResidenceAllowed } from './moderation.js';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const publicSelect = { id: true, kind: true, payload: true, status: true, ownerState: true, createdAt: true, uploads: { where: { purpose: 'photo', status: 'READY' }, orderBy: { createdAt: 'asc' }, select: { id: true } }, user: { select: { status: true, profile: { select: { displayName: true, verificationState: true } } } } };
const ownedSelect = { id: true, kind: true, payload: true, status: true, ownerState: true, version: true, createdAt: true, updatedAt: true };
const isVisible = item => item && item.status === 'PUBLISHED' && item.ownerState === 'ACTIVE' && item.user.status === 'ACTIVE' && vehicleResidenceAllowed(item);
const sellerName = item => item.kind === 'store' ? item.payload.title : item.kind === 'service' ? item.payload.providerName || 'Neighbour' : item.user.profile?.displayName || 'Neighbour';

function publicRecord(item) {
  if (!isVisible(item)) return null;
  return { id: item.id, kind: item.kind, payload: publicPayload(item.kind, item.payload), createdAt: item.createdAt, uploadIds: item.uploads.map(upload => upload.id), seller: sellerName(item), verified: item.kind !== 'store' && !item.payload.assistedPosting && item.user.profile?.verificationState === 'VERIFIED' };
}

function ownerRecord(item) {
  return { ...item, payload: publicPayload(item.kind, item.payload), assisted: Boolean(item.payload.assistedPosting), feeStatus: typeof item.payload.feeStatus === 'string' ? item.payload.feeStatus : null };
}

function editablePayload(item, changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new RequestError(400, 'Invalid listing changes');
  const fields = item.kind === 'service' ? ['title', 'subtitle', 'zone', 'pricing', 'availability', 'serviceArea'] : item.kind === 'store' ? ['title', 'subtitle', 'zone'] : ['title', 'subtitle', 'zone', 'price'];
  if (!Object.keys(changes).length || Object.keys(changes).some(key => !fields.includes(key))) throw new RequestError(400, 'Only listing details, rates and availability can be edited here. Contact support for other changes.');
  const payload = { ...item.payload };
  for (const [key, value] of Object.entries(changes)) {
    if (key === 'price') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100000000) throw new RequestError(400, 'Invalid price');
      payload.price = value;
      continue;
    }
    const limits = { title: [5, 120], subtitle: [10, 2000], zone: [1, 80], pricing: [0, 80], availability: [0, 120], serviceArea: [1, 80] };
    const [minimum, maximum] = limits[key];
    if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum) throw new RequestError(400, 'Invalid listing details');
    if (/<\s*\/?\s*[a-z!][^>]*>?|\bjavascript\s*:/i.test(value)) throw new RequestError(400, 'HTML and script content are not allowed in listing details.');
    payload[key] = value.trim();
  }
  if (item.kind === 'service' || item.kind === 'store') validateServiceDescription(payload.category, payload.subtitle);
  if (item.kind === 'store' && !isOnlineStoreZone(payload.zone)) throw new RequestError(400, 'Choose a Madinaty delivery area');
  return payload;
}

export function createMemberAccount({ prisma, auth, storage }) {
  async function handle(request, response, parts, send) {
    const current = request.method === 'GET' ? await auth.session(request) : await auth.protect(request);
    const section = parts[2];
    const id = parts[3];
    if (!['saved', 'activity', 'listings'].includes(section) || parts.length < 3 || parts.length > 4 || (id && !uuid(id))) throw new RequestError(404, 'Not found');
    if (request.method === 'GET' && !id) {
      if (section === 'saved') {
        const records = await prisma.savedSubmission.findMany({ where: { userId: current.userId }, orderBy: [{ createdAt: 'desc' }, { submissionId: 'asc' }], take: 500, select: { submissionId: true, submission: { select: publicSelect } } });
        return send(response, 200, { saved: records.map(record => ({ id: record.submissionId, submission: publicRecord(record.submission) })) });
      }
      const url = new URL(request.url, 'http://localhost');
      const page = Number(url.searchParams.get('page') || '0');
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new RequestError(400, 'Invalid page');
      if (section === 'activity') {
        const records = await prisma.contactActivity.findMany({ where: { userId: current.userId }, orderBy: [{ openedAt: 'desc' }, { submissionId: 'asc' }], skip: page * 20, take: 21, select: { submissionId: true, title: true, providerName: true, kind: true, openedAt: true, submission: { select: publicSelect } } });
        return send(response, 200, { activity: records.slice(0, 20).map(record => ({ id: record.submissionId, title: record.title, providerName: record.providerName, kind: record.kind, openedAt: record.openedAt, submission: publicRecord(record.submission) })), hasMore: records.length > 20 });
      }
      const kind = url.searchParams.get('kind');
      if (!['listing', 'service', 'store'].includes(kind)) throw new RequestError(400, 'Choose items, services or online stores');
      const records = await prisma.submission.findMany({ where: { userId: current.userId, kind }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: page * 20, take: 21, select: ownedSelect });
      return send(response, 200, { listings: records.slice(0, 20).map(ownerRecord), hasMore: records.length > 20 });
    }
    if (id && request.method === 'DELETE' && section !== 'listings') {
      await prisma[section === 'saved' ? 'savedSubmission' : 'contactActivity'].deleteMany({ where: { userId: current.userId, submissionId: id } });
      return send(response, 200, { ok: true });
    }
    if (!id || request.method !== 'POST') throw new RequestError(404, 'Not found');
    await consumeLimit(prisma, 'member-account', current.userId, 120, 3600000);
    const body = await readJson(request);
    if (section !== 'listings') {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${current.userId}))::text`;
        const item = await tx.submission.findUnique({ where: { id }, select: publicSelect });
        if (!isVisible(item)) throw new RequestError(404, 'This ad is no longer available');
        const where = { userId_submissionId: { userId: current.userId, submissionId: id } };
        if (section === 'saved') {
          const existing = await tx.savedSubmission.findUnique({ where });
          if (!existing && await tx.savedSubmission.count({ where: { userId: current.userId } }) >= 500) throw new RequestError(409, 'Your shortlist is full. Remove a saved item first.');
          await tx.savedSubmission.upsert({ where, update: {}, create: { userId: current.userId, submissionId: id } });
        } else {
          if (!['service', 'store'].includes(item.kind) || typeof item.payload.whatsapp !== 'string' || !/^[+\d ()-]{8,30}$/.test(item.payload.whatsapp)) throw new RequestError(400, 'Contact details are unavailable');
          const data = { title: String(item.payload.title).slice(0, 120), providerName: String(sellerName(item)).slice(0, 100), kind: item.kind, openedAt: new Date() };
          await tx.contactActivity.upsert({ where, update: data, create: { userId: current.userId, submissionId: id, ...data } });
        }
      });
      return send(response, 200, { ok: true });
    }
    if (!Number.isSafeInteger(body.version) || body.version < 1 || !['edit', 'pause', 'resume', 'close', 'sold', 'remove'].includes(body.action)) throw new RequestError(400, 'Invalid listing action');
    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${current.userId}))::text`;
      const item = await tx.submission.findFirst({ where: { id, userId: current.userId }, select: ownedSelect });
      if (!item) throw new RequestError(404, 'Listing not found');
      if (item.version !== body.version) throw new RequestError(409, 'This listing changed. Refresh your listings before trying again.');
      if (item.ownerState === 'REMOVED') throw new RequestError(409, 'This listing has been removed');
      const data = { version: { increment: 1 } };
      if (body.action === 'edit') {
        if (!['ACTIVE', 'PAUSED'].includes(item.ownerState) || !['PUBLISHED', 'PENDING_REVIEW'].includes(item.status)) throw new RequestError(409, 'This listing cannot be edited in its current state');
        data.payload = editablePayload(item, body.changes);
        const changedContent = ['title', 'subtitle', 'zone', 'serviceArea'].some(key => data.payload[key] !== item.payload[key]);
        if (changedContent) data.status = 'PENDING_REVIEW';
      } else if (body.action === 'pause' && item.ownerState === 'ACTIVE') data.ownerState = 'PAUSED';
      else if (body.action === 'resume' && item.ownerState === 'PAUSED') {
        data.ownerState = 'ACTIVE';
        const pause = await tx.publicationPause.findFirst({ where: { category: { in: ['*', item.payload.category, ...(item.payload.offer ? ['Deals & promotions'] : [])] } } });
        if (pause && item.status === 'PUBLISHED') data.status = 'PENDING_REVIEW';
      } else if (body.action === 'sold' && item.kind === 'listing' && ['ACTIVE', 'PAUSED'].includes(item.ownerState)) data.ownerState = 'SOLD';
      else if (body.action === 'close' && ['ACTIVE', 'PAUSED'].includes(item.ownerState)) data.ownerState = 'CLOSED';
      else if (body.action === 'remove') data.ownerState = 'REMOVED';
      else throw new RequestError(409, 'This listing cannot be changed in its current state');
      const changed = await tx.submission.updateMany({ where: { id, userId: current.userId, version: body.version, status: item.status, ownerState: item.ownerState }, data });
      if (!changed.count) throw new RequestError(409, 'This listing changed. Refresh your listings before trying again.');
      await tx.auditLog.create({ data: { actorId: current.userId, action: `submission.owner_${body.action}`, targetType: 'Submission', targetId: id, metadata: { previousVersion: item.version, from: item.ownerState, to: data.ownerState || item.ownerState, ...(data.payload ? { before: publicPayload(item.kind, item.payload), after: publicPayload(item.kind, data.payload) } : {}) } } });
      return ownerRecord(await tx.submission.findFirst({ where: { id, userId: current.userId }, select: ownedSelect }));
    });
    if (storage?.archiveClosedAdPhoto && ['close', 'sold', 'remove'].includes(body.action)) {
      const photos = await prisma.upload.findMany({ where: { submissionId: id, purpose: 'photo', status: 'READY', objectKey: { startsWith: 'active/' } }, select: { id: true, objectKey: true } });
      for (const photo of photos) {
        try {
          const destination = await storage.archiveClosedAdPhoto(photo.objectKey);
          if (destination) await prisma.upload.updateMany({ where: { id: photo.id, objectKey: photo.objectKey }, data: { objectKey: destination } });
        } catch (error) { console.error('Failed to archive closed ad photo', { submissionId: id, uploadId: photo.id, reason: error.name }); }
      }
    }
    return send(response, 200, { listing: updated });
  }
  return { handle };
}
