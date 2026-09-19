import { RequestError, readJson } from './request.js';
import { consumeLimit, isReviewer } from './auth.js';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);

export function createSubmissions({ prisma, auth }) {
  async function handle(request, response, parts, send) {
    if (parts[1] === 'admin') {
      const current = request.method === 'GET' ? await auth.session(request) : await auth.protect(request);
      if (!isReviewer(current.user)) throw new RequestError(403, 'Reviewer access required');
      if (request.method === 'GET' && parts.join('/') === 'api/admin/verifications') {
        const requests = await prisma.residentVerification.findMany({ where: { status: 'PENDING' }, take: 50, orderBy: { submittedAt: 'asc' }, select: { id: true, userId: true, submittedAt: true } });
        const records = await prisma.upload.findMany({ where: { verificationId: { in: requests.map(item => item.id) } }, select: { id: true, verificationId: true, documentType: true } });
        return send(response, 200, { requests: requests.map(item => ({ ...item, uploads: records.filter(upload => upload.verificationId === item.id) })) });
      }
      if (request.method === 'POST' && parts.length === 5 && parts[2] === 'verifications' && parts[4] === 'review') {
        if (!uuid(parts[3])) throw new RequestError(400, 'Invalid verification request');
        const body = await readJson(request);
        if (!['VERIFIED', 'REJECTED'].includes(body.status)) throw new RequestError(400, 'Invalid review status');
        const verification = await prisma.residentVerification.findUnique({ where: { id: parts[3] } });
        if (!verification || verification.userId === current.userId) throw new RequestError(403, 'You cannot review this request');
        await prisma.$transaction(async tx => {
          const changed = await tx.residentVerification.updateMany({ where: { id: verification.id, status: 'PENDING' }, data: { status: body.status, reviewerId: current.userId, reviewedAt: new Date(), reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null } });
          if (!changed.count) throw new RequestError(409, 'Request has already been reviewed');
          if (body.status === 'VERIFIED') await tx.profile.update({ where: { userId: verification.userId }, data: { verificationState: 'VERIFIED' } });
          await tx.auditLog.create({ data: { actorId: current.userId, action: 'verification.reviewed', targetType: 'ResidentVerification', targetId: verification.id, metadata: { status: body.status } } });
        });
        return send(response, 200, { ok: true });
      }
      throw new RequestError(404, 'Not found');
    }
    if (parts.length !== 2) throw new RequestError(404, 'Not found');
    if (request.method === 'GET') {
      const current = await auth.session(request);
      return send(response, 200, { submissions: await prisma.submission.findMany({ where: { userId: current.userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, kind: true, status: true, createdAt: true } }) });
    }
    if (request.method !== 'POST') throw new RequestError(404, 'Not found');
    const current = await auth.protect(request);
    await consumeLimit(prisma, 'submission', current.userId, 10, 86400000);
    const body = await readJson(request);
    const payload = body.payload;
    if (!['listing', 'service'].includes(body.kind) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new RequestError(400, 'Invalid submission');
    for (const [key, min, max] of [['title', 5, 120], ['subtitle', 10, 2000], ['category', 2, 80], ['zone', 1, 80]]) {
      if (typeof payload[key] !== 'string' || payload[key].trim().length < min || payload[key].length > max) throw new RequestError(400, `Invalid ${key}`);
    }
    const clean = Object.fromEntries(['title', 'subtitle', 'category', 'zone'].map(key => [key, payload[key].trim()]));
    if (body.kind === 'listing') {
      if (!['Furniture & home', 'Electronics', 'Kids & family', 'Cars & motorcycles', 'Apartment rentals', 'Groceries'].includes(clean.category)) throw new RequestError(400, 'Invalid category');
      if (typeof payload.price !== 'number' || !Number.isFinite(payload.price) || payload.price <= 0 || payload.price > 100000000 || !['New', 'Like new', 'Good', 'Fair', 'Fully working - used', 'Needs repair', 'Good used condition', 'Worn', 'Excellent', 'Newly finished', 'Well maintained', 'Needs renovation'].includes(payload.condition)) throw new RequestError(400, 'Invalid price or condition');
      Object.assign(clean, { price: payload.price, condition: payload.condition });
      if (clean.category === 'Apartment rentals') {
        if (!['Furnished', 'Unfurnished'].includes(payload.furnishing)) throw new RequestError(400, 'Choose furnished or unfurnished');
        clean.furnishing = payload.furnishing;
      }
    } else {
      if (!['Tutoring', 'Tutoring & education', 'Health & fitness', 'Home services', 'Housekeeping & cleaning', 'Local delivery riders', 'Moving', 'Pet care', 'Other services'].includes(clean.category)) throw new RequestError(400, 'Invalid category');
      if (typeof payload.whatsapp !== 'string' || !/^[+\d ()-]{8,30}$/.test(payload.whatsapp)) throw new RequestError(400, 'Invalid WhatsApp number');
      Object.assign(clean, { whatsapp: payload.whatsapp });
      if (clean.category === 'Tutoring & education') {
        const educationLevel = payload.educationLevel || 'Before university';
        const submittedSubjects = payload.subjects || ['Mathematics'];
        if (!['Before university', 'University'].includes(educationLevel)) throw new RequestError(400, 'Choose an education stage');
        const subjects = ['Quran', 'Mathematics', 'English', 'Arabic', 'Physics', 'Chemistry', 'Biology', 'French', 'German', 'Computer science'];
        if (!Array.isArray(submittedSubjects) || submittedSubjects.length < 1 || submittedSubjects.length > subjects.length || !submittedSubjects.every(subject => subjects.includes(subject))) throw new RequestError(400, 'Choose at least one subject');
        clean.educationLevel = educationLevel;
        clean.subjects = [...new Set(submittedSubjects)];
      }
      if (['Tutoring & education', 'Health & fitness'].includes(clean.category) && payload.offer !== undefined) {
        if (!payload.offer || typeof payload.offer !== 'object' || Array.isArray(payload.offer)) throw new RequestError(400, 'Invalid offer');
        if (typeof payload.offer.discount !== 'string' || payload.offer.discount.trim().length < 2 || payload.offer.discount.length > 120) throw new RequestError(400, 'Enter valid offer details');
        if (typeof payload.offer.validUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.offer.validUntil)) throw new RequestError(400, 'Choose an offer expiry date');
        clean.offer = { discount: payload.offer.discount.trim(), validUntil: payload.offer.validUntil };
      }
    }
    if (['Tutoring', 'Tutoring & education', 'Health & fitness', 'Electronics'].includes(clean.category)) {
      if (!['individual', 'small_business'].includes(payload.advertiserType)) throw new RequestError(400, 'Choose an advertiser type');
      clean.advertiserType = payload.advertiserType;
      if (clean.category === 'Health & fitness') clean.feeStatus = 'AWAITING_AGREEMENT';
      if (payload.advertiserType === 'small_business') {
        const tutoringCentre = ['Tutoring', 'Tutoring & education'].includes(clean.category);
        if (!tutoringCentre && !['posting', 'authentication', 'both'].includes(payload.businessRequest)) throw new RequestError(400, 'Choose a business request');
        clean.businessRequest = tutoringCentre ? 'posting' : payload.businessRequest;
        clean.feeStatus = 'AWAITING_AGREEMENT';
        if (!tutoringCentre && payload.businessRequest !== 'posting') clean.businessAuthenticationStatus = 'PENDING_REVIEW';
      }
    }
    const ids = body.uploadIds || [];
    if (!Array.isArray(ids) || ids.length > 6 || !ids.every(uuid) || new Set(ids).size !== ids.length) throw new RequestError(400, 'Invalid photos');
    const rental = body.kind === 'listing' && clean.category === 'Apartment rentals';
    const rentalMonth = rental ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date()) : null;
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${current.userId}))`;
      if (rental) {
        const profile = await tx.profile.findUnique({ where: { userId: current.userId } });
        if (profile?.verificationState !== 'VERIFIED' || current.user.role !== 'RESIDENT') throw new RequestError(403, 'Apartment rentals require verified Madinaty residency');
        if (await tx.submission.findFirst({ where: { userId: current.userId, rentalMonth } })) throw new RequestError(409, 'You can post one apartment rental per month');
      }
      const photos = await tx.upload.findMany({ where: { id: { in: ids }, userId: current.userId, purpose: 'photo', submissionId: null, status: 'READY' } });
      if (photos.length !== ids.length || photos.reduce((sum, item) => sum + item.byteSize, 0) > 20 * 1024 * 1024) throw new RequestError(400, 'Invalid photos');
      const submission = await tx.submission.create({ data: { userId: current.userId, kind: body.kind, payload: clean, rentalMonth } });
      await tx.upload.updateMany({ where: { id: { in: ids } }, data: { submissionId: submission.id } });
      await tx.auditLog.create({ data: { actorId: current.userId, action: 'submission.created', targetType: 'Submission', targetId: submission.id } });
      return submission;
    });
    return send(response, 201, { id: result.id, status: result.status });
  }
  return { handle };
}
