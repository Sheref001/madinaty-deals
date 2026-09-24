import { RequestError } from './request.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const contentTypes = new Set(['listing', 'service', 'business', 'offer']);
export const contentActions = new Set(['HIDE', 'RESTORE', 'APPROVE', 'REMOVE']);
export const publicationCategories = new Set(['Furniture & home', 'Electronics', 'Kids & family', 'Cars & motorcycles', 'Apartment rentals', 'Groceries', 'Tutoring', 'Tutoring & education', 'Health & fitness', 'Home services', 'Housekeeping & cleaning', 'Local delivery riders', 'Moving', 'Private transportation', 'Pet care', 'Deals & promotions']);

export function vehicleResidenceAllowed(submission) {
  return submission?.kind !== 'listing' || submission.payload?.category !== 'Cars & motorcycles' || submission.user?.profile?.verificationState === 'VERIFIED';
}

export function ownerListingActive(submission) {
  return !submission?.ownerState || submission.ownerState === 'ACTIVE';
}

export function submissionId(contentId) {
  const id = typeof contentId === 'string' && contentId.startsWith('submission-') ? contentId.slice(11) : '';
  return uuid.test(id) ? id : null;
}

export async function isContentVisible(prisma, contentType, contentId) {
  const id = submissionId(contentId);
  if (id) {
    const submission = await prisma.submission.findUnique({ where: { id }, select: { kind: true, status: true, ownerState: true, payload: true, user: { select: { status: true, profile: { select: { verificationState: true } } } } } });
    return submission?.kind === contentType && submission.status === 'PUBLISHED' && ownerListingActive(submission) && submission.user?.status === 'ACTIVE' && vehicleResidenceAllowed(submission);
  }
  const control = await prisma.contentControl.findUnique({ where: { contentType_contentId: { contentType, contentId } }, select: { status: true } });
  return !control || control.status === 'PUBLISHED';
}

// Called within the same transaction as a report decision or direct moderation action.
export async function setContentStatus(tx, { contentType, contentId, action, reason, actorId, admin }) {
  if (!contentTypes.has(contentType) || typeof contentId !== 'string' || !/^[a-zA-Z0-9-]{1,160}$/.test(contentId) || !contentActions.has(action)) throw new RequestError(400, 'Invalid content action');
  if (action === 'REMOVE' && !admin) throw new RequestError(403, 'Administrator access required');
  if (['HIDE', 'REMOVE'].includes(action) && (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500)) throw new RequestError(400, 'Enter a reason of at least five characters');
  const id = submissionId(contentId);
  let before;
  let after;
  if (id) {
    const item = await tx.submission.findUnique({ where: { id }, select: { id: true, kind: true, status: true, version: true, statusBeforeHide: true, payload: true, user: { select: { profile: { select: { verificationState: true } } } } } });
    if (!item || item.kind !== contentType) throw new RequestError(404, 'Ad not found');
    before = item.status;
    if (action === 'HIDE' && ['PUBLISHED', 'PENDING_REVIEW'].includes(before)) after = 'HIDDEN';
    else if (action === 'RESTORE' && before === 'HIDDEN') after = item.statusBeforeHide === 'PUBLISHED' ? 'PUBLISHED' : 'PENDING_REVIEW';
    else if (action === 'RESTORE' && before === 'REMOVED' && admin) after = 'PENDING_REVIEW';
    else if (action === 'APPROVE' && before === 'PENDING_REVIEW') {
      if (!admin && (item.payload?.advertiserType === 'small_business' || item.payload?.feeStatus === 'AWAITING_AGREEMENT')) throw new RequestError(403, 'Commercial approval requires an administrator');
      after = 'PUBLISHED';
    } else if (action === 'REMOVE' && before !== 'REMOVED') after = 'REMOVED';
    else throw new RequestError(409, 'This ad cannot be changed from its current state');
    if (after === 'PUBLISHED' && !vehicleResidenceAllowed(item)) throw new RequestError(403, 'Vehicle listings require verified Madinaty residency');
    const changed = await tx.submission.updateMany({ where: { id, status: before, version: item.version }, data: { status: after, version: { increment: 1 }, statusBeforeHide: action === 'HIDE' ? before : action === 'RESTORE' ? null : item.statusBeforeHide } });
    if (!changed.count) throw new RequestError(409, 'This ad changed while you were reviewing it');
  } else {
    if (action === 'APPROVE') throw new RequestError(400, 'This content does not have a review queue');
    const where = { contentType_contentId: { contentType, contentId } };
    const control = await tx.contentControl.findUnique({ where, select: { status: true } });
    before = control?.status || 'PUBLISHED';
    if (action === 'RESTORE' && ['HIDDEN', 'REMOVED'].includes(before) && (before !== 'REMOVED' || admin)) {
      await tx.contentControl.delete({ where });
      after = 'PUBLISHED';
    } else if (['HIDE', 'REMOVE'].includes(action) && before !== 'REMOVED' && !(action === 'HIDE' && before === 'HIDDEN')) {
      after = action === 'HIDE' ? 'HIDDEN' : 'REMOVED';
      await tx.contentControl.upsert({ where, update: { status: after, reason: reason.trim() }, create: { contentType, contentId, status: after, reason: reason.trim() } });
    } else throw new RequestError(409, 'This content cannot be changed from its current state');
  }
  await tx.auditLog.create({ data: { actorId, action: `moderation.${action.toLowerCase()}`, targetType: contentType, targetId: contentId, metadata: { from: before, to: after, reason: typeof reason === 'string' ? reason.trim().slice(0, 500) : null } } });
  return { contentType, contentId, status: after };
}
