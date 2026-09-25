import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSubmissions } from './submissions.js';

const photoId = '11111111-1111-4111-8111-111111111111';
const verificationId = '22222222-2222-4222-8222-222222222222';
const payload = { title: 'Dining table', subtitle: 'Solid wood table in good condition.', category: 'Furniture & home', zone: 'B1', price: 1000, condition: 'Good', advertiserType: 'individual' };
const storePayload = { title: 'Madinaty Beauty Shop', subtitle: 'Cosmetics and skincare delivered within Madinaty.', category: 'Online Finds', onlineStoreCategory: 'Beauty & personal care', zone: 'B1', whatsapp: '+201001234567', socialAccount: 'https://instagram.com/madinatybeauty', advertiserType: 'small_business', servesMadinaty: true };
function fixture({ role = 'RESIDENT', verified = false, photos = [] } = {}) {
  const current = { userId: 'owner', user: { role, moderatorAssignment: role === 'MODERATOR' ? { permissions: ['RESIDENT_VERIFICATIONS'] } : null } };
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
    profile: { findUnique: vi.fn().mockResolvedValue({ verificationState: verified ? 'VERIFIED' : 'UNVERIFIED' }), update: vi.fn() },
    submission: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'submission', status: 'PUBLISHED' }) },
    publicationPause: { findFirst: vi.fn().mockResolvedValue(null) },
    contentControl: { findMany: vi.fn().mockResolvedValue([]) },
    upload: { findMany: vi.fn(async ({ where }) => photos.filter(photo => where.id.in.includes(photo.id) && photo.userId === where.userId && photo.purpose === where.purpose && photo.status === where.status && photo.submissionId === null)), updateMany: vi.fn() },
    residentVerification: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue({ id: verificationId, userId: 'resident' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(callback => callback(prisma));
  const auth = { protect: vi.fn().mockResolvedValue(current), session: vi.fn().mockResolvedValue(current) };
  const handler = createSubmissions({ prisma, auth });
  const send = vi.fn();
  const call = (body, path = 'api/submissions', method = 'POST') => handler.handle(Object.assign(Readable.from([JSON.stringify(body)]), { method, headers: {} }), {}, path.split('/'), send);
  return { prisma, auth, send, call };
}
const rental = { kind: 'listing', payload: { ...payload, category: 'Apartment rentals', furnishing: 'Unfurnished' } };
const vehicle = { kind: 'listing', payload: { ...payload, category: 'Cars & motorcycles', vehicleType: 'Cars', condition: 'Good' } };
const review = `api/admin/verifications/${verificationId}/review`;
afterEach(() => vi.useRealTimers());

describe('marketplace submission boundaries', () => {
  it('holds nurseries for business review and rejects individual nursery posts', async () => {
    const f = fixture();
    const nursery = { title: 'Little Stars Nursery', subtitle: 'Early years childcare in Madinaty.', category: 'Nurseries', zone: 'B1', providerName: 'Little Stars Nursery', whatsapp: '+201001234567', advertiserType: 'small_business', feeStatus: 'PAID' };
    await f.call({ kind: 'service', payload: nursery });
    expect(f.prisma.submission.create.mock.calls[0][0].data).toMatchObject({ status: 'PENDING_REVIEW', payload: { advertiserType: 'small_business', feeStatus: 'AWAITING_AGREEMENT' } });
    await expect(f.call({ kind: 'service', payload: { ...nursery, advertiserType: 'individual' } })).rejects.toMatchObject({ status: 400 });
  });
  it('validates kids item sections and assigns older posts to other items', async () => {
    const f = fixture();
    const kids = { ...payload, category: 'Kids & family' };
    await f.call({ kind: 'listing', payload: { ...kids, kidsItemType: 'Baby gear' } });
    expect(f.prisma.submission.create.mock.calls[0][0].data.payload.kidsItemType).toBe('Baby gear');
    await f.call({ kind: 'listing', payload: kids });
    expect(f.prisma.submission.create.mock.calls[1][0].data.payload.kidsItemType).toBe('Other kids items');
    await expect(f.call({ kind: 'listing', payload: { ...kids, kidsItemType: 'Nurseries' } })).rejects.toMatchObject({ status: 400 });
  });
  it('holds a local online store for commercial review without trusting client fee claims', async () => {
    const f = fixture();
    await f.call({ kind: 'store', payload: { ...storePayload, feeStatus: 'PAID' } });
    expect(f.prisma.submission.create.mock.calls[0][0].data).toMatchObject({ kind: 'store', status: 'PENDING_REVIEW', payload: { onlineStoreCategory: 'Beauty & personal care', socialAccount: 'https://instagram.com/madinatybeauty', advertiserType: 'small_business', businessRequest: 'posting', feeStatus: 'AWAITING_AGREEMENT' } });
  });
  it('rejects stores outside Madinaty or with unsafe social links', async () => {
    const f = fixture();
    await expect(f.call({ kind: 'store', payload: { ...storePayload, servesMadinaty: false } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'store', payload: { ...storePayload, zone: 'Nasr City' } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'store', payload: { ...storePayload, socialAccount: 'javascript:alert(1)' } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'store', payload: { ...storePayload, advertiserType: 'individual' } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('publishes store contact details without owner identity or private fee state', async () => {
    const f = fixture({ verified: true });
    f.prisma.submission.findMany.mockResolvedValue([{ id: 'store-id', kind: 'store', payload: { ...storePayload, feeStatus: 'AWAITING_AGREEMENT' }, uploads: [], createdAt: new Date(), user: { profile: { displayName: 'Owner Account', verificationState: 'VERIFIED' } } }]);
    await f.call({}, 'api/public-submissions', 'GET');
    const published = f.send.mock.calls[0][2].submissions[0];
    expect(published).toMatchObject({ kind: 'store', seller: 'Madinaty Beauty Shop', verified: false, payload: { onlineStoreCategory: 'Beauty & personal care', whatsapp: '+201001234567' } });
    expect(JSON.stringify(published)).not.toContain('Owner Account');
    expect(published.payload.feeStatus).toBeUndefined();
  });
  it('requires authentication before reading or writing submissions', async () => {
    const f = fixture();
    f.auth.protect.mockRejectedValue({ status: 401 });
    f.auth.session.mockRejectedValue({ status: 401 });
    await expect(f.call({ kind: 'listing', payload })).rejects.toMatchObject({ status: 401 });
    await expect(f.call({}, 'api/submissions', 'GET')).rejects.toMatchObject({ status: 401 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
    expect(f.prisma.submission.findMany).not.toHaveBeenCalled();
  });
  it('scopes submission history to the signed-in account', async () => {
    const f = fixture();
    await f.call({}, 'api/submissions', 'GET');
    expect(f.prisma.submission.findMany.mock.calls[0][0].where).toEqual({ userId: 'owner' });
  });
  it('exposes only published submissions through the public feed', async () => {
    const f = fixture();
    f.prisma.submission.findMany.mockResolvedValue([{ id: 'published-id', kind: 'listing', payload: { ...payload, feeStatus: 'AWAITING_AGREEMENT', businessAuthenticationStatus: 'PENDING_REVIEW' }, uploads: [], createdAt: new Date('2026-09-23T10:00:00Z'), user: { profile: { displayName: 'Neighbour', verificationState: 'VERIFIED' } } }]);
    await f.call({}, 'api/public-submissions', 'GET');
    expect(f.prisma.submission.findMany.mock.calls[0][0].where).toEqual({ status: 'PUBLISHED', ownerState: 'ACTIVE', user: { is: { status: 'ACTIVE' } } });
    expect(f.send.mock.calls[0][2].submissions[0]).toMatchObject({ id: 'published-id', kind: 'listing', seller: 'Neighbour', verified: true });
    expect(f.send.mock.calls[0][2].submissions[0].payload.feeStatus).toBeUndefined();
  });
  it('includes a service social account in the public feed', async () => {
    const f = fixture();
    f.prisma.submission.findMany.mockResolvedValue([{ id: 'service-id', kind: 'service', payload: { title: 'Arabic calligraphy lessons', subtitle: 'Helpful tutoring service provider.', category: 'Tutoring & education', providerName: 'Nour Hassan', socialAccount: 'https://instagram.com/provider', whatsapp: '+201001234567', subjects: [], otherSubject: 'Arabic calligraphy' }, uploads: [], createdAt: new Date(), user: { profile: { displayName: 'Provider', verificationState: 'UNVERIFIED' } } }]);
    await f.call({}, 'api/public-submissions', 'GET');
    expect(f.send.mock.calls[0][2].submissions[0].payload.socialAccount).toBe('https://instagram.com/provider');
    expect(f.send.mock.calls[0][2].submissions[0].payload.providerName).toBe('Nour Hassan');
    expect(f.send.mock.calls[0][2].submissions[0].payload.otherSubject).toBe('Arabic calligraphy');
  });
  it('shows an assisted provider rather than the administrator without leaking private consent', async () => {
    const f = fixture({ role: 'ADMIN', verified: true });
    f.prisma.submission.findMany.mockResolvedValue([{ id: 'assisted-id', kind: 'service', payload: { title: 'Housekeeping service', subtitle: 'Home cleaning in Madinaty.', category: 'Housekeeping & cleaning', zone: 'B1', providerName: 'Nour Hassan', whatsapp: '+201001234567', assistedPosting: { consentMethod: 'phone', confirmedAt: '2026-09-24T00:00:00Z' } }, uploads: [], createdAt: new Date(), user: { profile: { displayName: 'Madinaty Deals Admin', verificationState: 'VERIFIED' } } }]);
    await f.call({}, 'api/public-submissions', 'GET');
    const published = f.send.mock.calls[0][2].submissions[0];
    expect(published.seller).toBe('Nour Hassan');
    expect(published.verified).toBe(false);
    expect(published.payload.assistedPosting).toBeUndefined();
    expect(JSON.stringify(published)).not.toContain('Madinaty Deals Admin');
  });
  it('keeps an older vehicle ad out of the public feed if its owner is unverified', async () => {
    const f = fixture();
    f.prisma.submission.findMany.mockResolvedValue([{ id: 'old-vehicle', kind: 'listing', payload: vehicle.payload, uploads: [], createdAt: new Date(), user: { profile: { displayName: 'Neighbour', verificationState: 'UNVERIFIED' } } }]);
    await f.call({}, 'api/public-submissions', 'GET');
    expect(f.send.mock.calls[0][2].submissions).toEqual([]);
  });
  it('publishes ordinary listings immediately and ignores client-supplied ownership and approval', async () => {
    const f = fixture();
    await f.call({ kind: 'listing', payload: { ...payload, status: 'PUBLISHED', userId: 'attacker' }, userId: 'attacker', status: 'PUBLISHED' });
    expect(f.prisma.submission.create.mock.calls[0][0].data).toEqual({ userId: 'owner', kind: 'listing', payload, status: 'PUBLISHED' });
    expect(f.send).toHaveBeenCalledWith({}, 201, { id: 'submission', status: 'PUBLISHED', published: true });
  });
  it('holds new ads while publication is paused', async () => {
    const f = fixture();
    f.prisma.publicationPause.findFirst.mockResolvedValue({ category: '*' });
    f.prisma.submission.create.mockResolvedValue({ id: 'submission', status: 'PENDING_REVIEW' });
    await f.call({ kind: 'listing', payload });
    expect(f.prisma.submission.create.mock.calls[0][0].data.status).toBe('PENDING_REVIEW');
    expect(f.send.mock.calls[0][2].published).toBe(false);
  });
  it('holds risky and commercial submissions for review', async () => {
    const risky = fixture();
    await risky.call({ kind: 'listing', payload: { ...payload, subtitle: 'Guaranteed profit. Visit https://example.test' } });
    expect(risky.prisma.submission.create.mock.calls[0][0].data.status).toBe('PENDING_REVIEW');
    const commercial = fixture();
    await commercial.call({ kind: 'listing', payload: { ...payload, category: 'Electronics', advertiserType: 'small_business', businessRequest: 'posting' } });
    expect(commercial.prisma.submission.create.mock.calls[0][0].data.status).toBe('PENDING_REVIEW');
  });
  it('requires an explicit poster type for categories that allow both individuals and businesses', async () => {
    const f = fixture();
    const withoutType = { ...payload };
    delete withoutType.advertiserType;
    await expect(f.call({ kind: 'listing', payload: withoutType })).rejects.toMatchObject({ status: 400, message: 'Choose an advertiser type' });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('holds business services for a fee even outside the former split categories', async () => {
    const f = fixture();
    await f.call({ kind: 'service', payload: { ...payload, category: 'Home services', providerName: 'Nour Hassan', whatsapp: '+201001234567', advertiserType: 'small_business', businessRequest: 'posting', feeStatus: 'PAID' } });
    const created = f.prisma.submission.create.mock.calls[0][0].data;
    expect(created.status).toBe('PENDING_REVIEW');
    expect(created.payload).toMatchObject({ advertiserType: 'small_business', businessRequest: 'posting', feeStatus: 'AWAITING_AGREEMENT' });
  });
  it('keeps shops commercial and apartment rentals individual regardless of client claims', async () => {
    const f = fixture({ verified: true });
    await expect(f.call({ kind: 'listing', payload: { ...payload, category: 'Groceries', groceryActivity: 'Bakery' } })).rejects.toMatchObject({ status: 400 });
    await f.call({ kind: 'listing', payload: { ...payload, category: 'Groceries', groceryActivity: 'Bakery', advertiserType: 'small_business' } });
    expect(f.prisma.submission.create.mock.calls[0][0].data).toMatchObject({ status: 'PENDING_REVIEW', payload: { advertiserType: 'small_business', feeStatus: 'AWAITING_AGREEMENT' } });
    await expect(f.call({ ...rental, payload: { ...rental.payload, advertiserType: 'small_business' } })).rejects.toMatchObject({ status: 400 });
  });
  it('allows service providers without resident verification', async () => {
    const f = fixture({ role: 'SERVICE_PROVIDER' });
    await f.call({ kind: 'service', payload: { ...payload, category: 'Home services', providerName: 'Nour Hassan', whatsapp: '+201001234567', socialAccount: 'https://instagram.com/provider' } });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
    expect(f.prisma.profile.findUnique).not.toHaveBeenCalled();
    expect(f.prisma.submission.create.mock.calls[0][0].data.payload.socialAccount).toBe('https://instagram.com/provider');
    expect(f.prisma.submission.create.mock.calls[0][0].data.payload.providerName).toBe('Nour Hassan');
  });
  it.each(['Home services', 'Housekeeping & cleaning', 'Local delivery riders'])('lets an administrator post for a consenting individual in %s', async category => {
    const f = fixture({ role: 'ADMIN' });
    await f.call({ kind: 'service', payload: { ...payload, category, providerName: 'Nour Hassan', whatsapp: '+201001234567' }, assistedPosting: { consentMethod: 'phone', consentConfirmed: true } });
    const created = f.prisma.submission.create.mock.calls[0][0].data;
    expect(created.userId).toBe('owner');
    expect(created.payload).toMatchObject({ providerName: 'Nour Hassan', advertiserType: 'individual', assistedPosting: { consentMethod: 'phone' } });
    expect(created.payload.assistedPosting.confirmedAt).toBeTruthy();
    expect(f.prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'submission.assisted_created', actorId: 'owner', metadata: { consentMethod: 'phone', category } }) });
  });
  it('rejects non-admin assisted posting and ignores a forged private payload marker', async () => {
    const f = fixture();
    const service = { ...payload, category: 'Home services', providerName: 'Nour Hassan', whatsapp: '+201001234567', assistedPosting: { consentMethod: 'phone' } };
    await expect(f.call({ kind: 'service', payload: service, assistedPosting: { consentMethod: 'phone', consentConfirmed: true } })).rejects.toMatchObject({ status: 403 });
    await f.call({ kind: 'service', payload: service });
    expect(f.prisma.submission.create.mock.calls[0][0].data.payload.assistedPosting).toBeUndefined();
  });
  it('requires provider consent and restricts assisted posting to individual local services', async () => {
    const f = fixture({ role: 'ADMIN' });
    const service = { ...payload, category: 'Home services', providerName: 'Nour Hassan', whatsapp: '+201001234567' };
    await expect(f.call({ kind: 'service', payload: service, assistedPosting: { consentMethod: 'phone', consentConfirmed: false } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'service', payload: service, assistedPosting: { consentMethod: 'unknown', consentConfirmed: true } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'service', payload: { ...service, advertiserType: 'small_business' }, assistedPosting: { consentMethod: 'phone', consentConfirmed: true } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'service', payload: { ...service, category: 'Tutoring & education' }, assistedPosting: { consentMethod: 'phone', consentConfirmed: true } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'listing', payload, assistedPosting: { consentMethod: 'phone', consentConfirmed: true } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('requires a valid provider or business name for service submissions', async () => {
    const f = fixture({ role: 'SERVICE_PROVIDER' });
    const baseService = { ...payload, category: 'Home services', whatsapp: '+201001234567' };
    await expect(f.call({ kind: 'service', payload: { ...baseService, providerName: ' ' } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'service', payload: { ...baseService, providerName: 'A'.repeat(101) } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('allows an optional free social profile for individual and business service providers', async () => {
    for (const advertiserType of ['individual', 'small_business']) {
      const f = fixture({ role: 'SERVICE_PROVIDER' });
      await f.call({ kind: 'service', payload: { ...payload, category: 'Home services', providerName: 'Madinaty Services', whatsapp: '+201001234567', advertiserType, businessRequest: advertiserType === 'small_business' ? 'posting' : undefined, socialAccount: 'https://www.facebook.com/provider' } });
      expect(f.prisma.submission.create.mock.calls[0][0].data.payload.socialAccount).toBe('https://www.facebook.com/provider');
      expect(f.prisma.submission.create.mock.calls[0][0].data.payload.providerName).toBe('Madinaty Services');
    }
  });
  it.each(['http://instagram.com/provider', 'https://instagram.com.evil.test/provider', 'javascript:alert(1)'])('rejects a non-secure or unsupported social profile: %s', async socialAccount => {
    const f = fixture({ role: 'SERVICE_PROVIDER' });
    await expect(f.call({ kind: 'service', payload: { ...payload, category: 'Home services', providerName: 'Provider Name', whatsapp: '+201001234567', socialAccount } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('accepts a complete tutoring service submission as an individual', async () => {
    const f = fixture();
    await f.call({ kind: 'service', payload: {
      title: 'Math tutoring for students',
      subtitle: 'Private lessons for school students and exam preparation.',
      category: 'Tutoring & education',
      providerName: 'Nour Hassan',
      zone: 'B1',
      advertiserType: 'individual',
      educationLevel: 'Before university',
      subjects: ['Quran', 'Mathematics'],
      serviceArea: 'Madinaty-wide',
      whatsapp: '+20 100 000 0000',
      pricing: 'EGP 250 per hour',
      availability: 'Weekdays after 4pm',
    } });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
    expect(f.send).toHaveBeenCalledWith({}, 201, { id: 'submission', status: 'PUBLISHED', published: true });
  });
  it('accepts a short custom subject as the only tutoring subject', async () => {
    const f = fixture();
    await f.call({ kind: 'service', payload: { ...payload, title: 'Arabic calligraphy lessons', category: 'Tutoring & education', providerName: 'Nour Hassan', whatsapp: '+201001234567', subjects: [], otherSubject: 'Arabic calligraphy', advertiserType: 'individual' } });
    expect(f.prisma.submission.create.mock.calls[0][0].data.payload).toMatchObject({ subjects: [], otherSubject: 'Arabic calligraphy' });
  });
  it('rejects custom subjects over the word limit', async () => {
    const f = fixture();
    await expect(f.call({ kind: 'service', payload: { ...payload, category: 'Tutoring & education', providerName: 'Nour Hassan', whatsapp: '+201001234567', otherSubject: 'one two three four five six seven eight nine ten eleven' } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it.each([
    'Learn with me at https://example.com/profile',
    'Contact me at tutor@example.com',
    'Find my profile @nour.tutor',
    'Instagram: nour.tutor',
  ])('rejects tutoring descriptions containing links or social accounts: %s', async subtitle => {
    const f = fixture();
    await expect(f.call({ kind: 'service', payload: { ...payload, title: 'Math tutoring for students', subtitle, category: 'Tutoring & education', providerName: 'Nour Hassan', whatsapp: '+201001234567' } })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Community Content Policy violation') });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it.each(['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'javascript:alert(1)'])('rejects markup and script content in service descriptions: %s', async subtitle => {
    const f = fixture();
    await expect(f.call({ kind: 'service', payload: { ...payload, category: 'Home services', providerName: 'Nour Hassan', whatsapp: '+201001234567', subtitle } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('allows one structured promotion per month and rejects a second one', async () => {
    const f = fixture();
    const service = { ...payload, category: 'Home services', providerName: 'Madinaty Services', whatsapp: '+201001234567', offer: { kind: 'Percentage discount', discount: '10% off the first booking', validUntil: '2026-12-31' } };
    await f.call({ kind: 'service', payload: service });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
    f.prisma.submission.findMany.mockResolvedValue([{ createdAt: new Date(), payload: { offer: service.offer } }]);
    await expect(f.call({ kind: 'service', payload: { ...service, offer: { ...service.offer, discount: '20% off' } } })).rejects.toMatchObject({ status: 409, message: expect.stringContaining('hello@madinatydeals.com') });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
  });
  it('rejects multiple or malformed promotions', async () => {
    const f = fixture();
    const baseService = { ...payload, category: 'Moving', providerName: 'Moving Provider', whatsapp: '+201001234567' };
    await expect(f.call({ kind: 'service', payload: { ...baseService, offer: { kind: 'Percentage discount', discount: '10% and first session free', validUntil: '2026-12-31', secondOffer: 'free delivery' } } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'service', payload: { ...baseService, offer: { kind: 'Percentage discount', discount: '10%\nFirst session free', validUntil: '2026-12-31' } } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('keeps pet-care research submissions restricted to administrators and validates the subtype', async () => {
    const resident = fixture();
    const petCare = { ...payload, category: 'Pet care', providerName: 'Madinaty Vet', whatsapp: '+201001234567', petBusinessType: 'Veterinary clinics', advertiserType: 'small_business' };
    await expect(resident.call({ kind: 'service', payload: petCare })).rejects.toMatchObject({ status: 403 });
    expect(resident.prisma.submission.create).not.toHaveBeenCalled();
    const admin = fixture({ role: 'ADMIN' });
    await expect(admin.call({ kind: 'service', payload: { ...petCare, petBusinessType: 'Dog walkers' } })).rejects.toMatchObject({ status: 400 });
    await admin.call({ kind: 'service', payload: petCare });
    expect(admin.prisma.submission.create.mock.calls[0][0].data.payload.petBusinessType).toBe('Veterinary clinics');
  });
  it.each([{ role: 'RESIDENT', verified: false }, { role: 'SERVICE_PROVIDER', verified: true }])('rejects ineligible rentals: %j', async options => {
    const f = fixture(options);
    await expect(f.call(rental)).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('requires approved Madinaty residency for car and motorcycle ads, ignoring client claims', async () => {
    const unverified = fixture();
    await expect(unverified.call({ ...vehicle, payload: { ...vehicle.payload, residentVerified: true, verificationState: 'VERIFIED' } })).rejects.toMatchObject({ status: 403 });
    await expect(unverified.call({ ...vehicle, payload: { ...vehicle.payload, vehicleType: 'Motorcycles' } })).rejects.toMatchObject({ status: 403 });
    expect(unverified.prisma.submission.create).not.toHaveBeenCalled();
    const verified = fixture({ verified: true });
    await verified.call(vehicle);
    expect(verified.prisma.submission.create.mock.calls[0][0].data.payload.vehicleType).toBe('Cars');
    expect(verified.send.mock.calls[0][2].published).toBe(true);
  });
  it('rejects missing or invented vehicle types', async () => {
    const f = fixture({ verified: true });
    await expect(f.call({ ...vehicle, payload: { ...vehicle.payload, vehicleType: undefined } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ ...vehicle, payload: { ...vehicle.payload, vehicleType: 'Moving furniture' } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('accepts private transportation as a service rather than a vehicle sale', async () => {
    const f = fixture();
    await f.call({ kind: 'service', payload: { ...payload, category: 'Private transportation', providerName: 'Nour Hassan', whatsapp: '+201001234567' } });
    expect(f.prisma.submission.create.mock.calls[0][0].data.kind).toBe('service');
  });
  it('uses the Cairo calendar month and blocks a second rental', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T22:30:00Z'));
    const f = fixture({ verified: true });
    await f.call(rental);
    const month = f.prisma.submission.create.mock.calls[0][0].data.rentalMonth;
    expect(month).toBe(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date('2026-02-01T12:00:00Z')));
    f.prisma.submission.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(f.call(rental)).rejects.toMatchObject({ status: 409 });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
  });
  it.each([
    { userId: 'someone-else' }, { purpose: 'verification' }, { status: 'PENDING' }, { submissionId: 'already-used' }, { byteSize: 21 * 1024 * 1024 },
  ])('rejects unavailable or oversized photos: %j', async overrides => {
    const photo = { id: photoId, userId: 'owner', purpose: 'photo', status: 'READY', submissionId: null, byteSize: 100, ...overrides };
    const f = fixture({ photos: [photo] });
    await expect(f.call({ kind: 'listing', payload, uploadIds: [photoId] })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it.each([[photoId, photoId], ['-'.repeat(36)]])('rejects duplicate or malformed photo IDs before querying uploads: %j', async (...ids) => {
    const f = fixture();
    await expect(f.call({ kind: 'listing', payload, uploadIds: ids })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.upload.findMany).not.toHaveBeenCalled();
  });
});

describe('verification review boundaries', () => {
  it('returns only pending verification requests with their private document references to reviewers', async () => {
    const f = fixture({ role: 'ADMIN' });
    f.prisma.residentVerification.findMany.mockResolvedValue([{ id: verificationId, userId: 'resident', submittedAt: new Date('2026-09-20T12:00:00Z'), user: { email: 'resident@example.test', phone: null, profile: { displayName: 'Neighbour' } } }]);
    f.prisma.upload.findMany.mockResolvedValue([{ id: photoId, verificationId, documentType: 'MADINATY_ID' }]);
    await f.call({}, 'api/admin/verifications', 'GET');
    expect(f.prisma.residentVerification.findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING' });
    expect(f.send.mock.calls[0][2].requests[0]).toMatchObject({ id: verificationId, name: 'Neighbour', email: 'resident@example.test', uploads: [{ id: photoId, documentType: 'MADINATY_ID' }] });
  });
  it('denies non-reviewers and self-review', async () => {
    const resident = fixture();
    await expect(resident.call({ status: 'VERIFIED' }, review)).rejects.toMatchObject({ status: 403 });
    const admin = fixture({ role: 'ADMIN' });
    admin.prisma.residentVerification.findUnique.mockResolvedValue({ id: verificationId, userId: 'owner' });
    await expect(admin.call({ status: 'VERIFIED' }, review)).rejects.toMatchObject({ status: 403 });
    expect(admin.prisma.profile.update).not.toHaveBeenCalled();
  });
  it('rejects malformed request IDs before querying the database', async () => {
    const f = fixture({ role: 'ADMIN' });
    await expect(f.call({ status: 'VERIFIED' }, 'api/admin/verifications/not-a-uuid/review')).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.residentVerification.findUnique).not.toHaveBeenCalled();
  });
  it('does not grant residency when another reviewer already decided', async () => {
    const f = fixture({ role: 'MODERATOR' });
    f.prisma.residentVerification.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.call({ status: 'VERIFIED' }, review)).rejects.toMatchObject({ status: 409 });
    expect(f.prisma.profile.update).not.toHaveBeenCalled();
    expect(f.prisma.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(['VERIFIED', 'REJECTED'])('records a %s decision and only grants residency on approval', async status => {
    const f = fixture({ role: 'ADMIN' });
    await f.call({ status }, review);
    expect(f.prisma.profile.update).toHaveBeenCalledTimes(status === 'VERIFIED' ? 1 : 0);
    expect(f.prisma.auditLog.create.mock.calls[0][0].data.metadata).toEqual({ status });
    expect(f.send).toHaveBeenCalledWith({}, 200, { ok: true });
  });
});


describe('individual and small business submissions', () => {
  it.each(['Electronics', 'Tutoring & education'])('keeps %s individual ads free and ignores commercial approval fields', async category => {
    const f = fixture();
    await f.call({ kind: category === 'Electronics' ? 'listing' : 'service', payload: { ...payload, category, ...(category === 'Electronics' ? {} : { providerName: 'Nour Hassan' }), whatsapp: '+201001234567', advertiserType: 'individual', feeStatus: 'PAID', businessAuthenticationStatus: 'VERIFIED' } });
    const saved = f.prisma.submission.create.mock.calls[0][0].data.payload;
    expect(saved.advertiserType).toBe('individual');
    expect(saved.feeStatus).toBeUndefined();
    expect(saved.businessAuthenticationStatus).toBeUndefined();
  });
  it.each(['posting', 'authentication', 'both'])('retains a business %s request for fee agreement and review', async businessRequest => {
    const f = fixture();
    await f.call({ kind: 'listing', payload: { ...payload, category: 'Electronics', advertiserType: 'small_business', businessRequest, feeStatus: 'PAID', businessAuthenticationStatus: 'VERIFIED' } });
    const saved = f.prisma.submission.create.mock.calls[0][0].data.payload;
    expect(saved.businessRequest).toBe(businessRequest);
    expect(saved.feeStatus).toBe('AWAITING_AGREEMENT');
    expect(saved.businessAuthenticationStatus).toBe(businessRequest === 'posting' ? undefined : 'PENDING_REVIEW');
  });
  it.each([{ advertiserType: 'dealer' }, { advertiserType: 'small_business', businessRequest: 'free' }])('rejects invalid advertiser selections: %j', async fields => {
    const f = fixture();
    await expect(f.call({ kind: 'listing', payload: { ...payload, category: 'Electronics', ...fields } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
});


it('requires fee agreement for individual and business gym posts', async () => {
  const f = fixture();
  const gym = { ...payload, category: 'Health & fitness', providerName: 'Madinaty Gym', whatsapp: '+201001234567', advertiserType: 'individual' };
  await f.call({ kind: 'service', payload: gym });
  expect(f.prisma.submission.create.mock.calls[0][0].data.payload.feeStatus).toBe('AWAITING_AGREEMENT');
  await f.call({ kind: 'service', payload: { ...gym, advertiserType: 'small_business', businessRequest: 'posting' } });
  expect(f.prisma.submission.create.mock.calls[1][0].data.payload.feeStatus).toBe('AWAITING_AGREEMENT');
});
