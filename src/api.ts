const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export interface PublicComment { id: string; displayName: string; body: string; language: string; createdAt: string; verifiedResident?: boolean; }

const visitorId = () => {
  try {
    const key = 'madinaty-anonymous-visitor-id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch { return `session-${Math.random().toString(36).slice(2)}`; }
};

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${apiBase}${path}`, { ...options, credentials: 'include', headers: { ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}), 'content-type': 'application/json', 'x-visitor-id': visitorId(), ...(options.headers || {}) } });
  if (!response.ok) {
    // A reverse proxy can return HTML before the request ever reaches Node.
    // Do not discard the HTTP status or display the proxy's raw HTML to users.
    const body = await response.json().catch(() => null);
    const fallback = response.status === 413
      ? 'The server rejected the file size. Try a smaller file or contact hello@madinatydeals.com.'
      : response.status === 401
        ? 'Your session has expired. Sign in again, then retry.'
        : response.status === 403
          ? 'The request was blocked. Refresh the page and try again. If it continues, contact hello@madinatydeals.com.'
          : response.status === 429
            ? 'Too many attempts. Please wait before trying again.'
            : 'The server could not complete this request. Please try again later.';
    throw new Error(typeof body?.error === 'string' ? body.error : fallback);
  }
  return response.json();
};

export const recordView = (type: string, id: string) => request(`/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}/view`, { method: 'POST' }) as Promise<{ viewCount: number }>;
export const getComments = (type: string, id: string) => request(`/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}/comments`) as Promise<{ comments: PublicComment[] }>;
export const postComment = (type: string, id: string, body: string, language: string) => request(`/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ body, language }) }) as Promise<{ comment: PublicComment }>;
export const submitReport = (contentType: string, contentId: string, reason: string, details: string) => request('/reports', { method: 'POST', body: JSON.stringify({ contentType, contentId, reason, details }) }) as Promise<{ report: { id: string; status: string; createdAt: string } }>;
export const translateText = (text: string, sourceLanguage: 'ar' | 'en', targetLanguage: 'ar' | 'en') => request('/translate', { method: 'POST', body: JSON.stringify({ text, sourceLanguage, targetLanguage }) }) as Promise<{ translation: string; cached: boolean; sourceLanguage: string; targetLanguage: string }>;

export interface Account { id: string; email?: string | null; phone?: string | null; name: string; role: string; residentVerified: boolean; permissions?: ModeratorPermission[]; }
export interface AdminUser extends Account { status: string; createdAt: string; }
export type ModeratorPermission = 'DASHBOARD' | 'REPORTS' | 'RESIDENT_VERIFICATIONS' | 'CONTENT_REVIEW';
export interface ModeratorAssignment { id: string; name: string; email?: string | null; phone?: string | null; permissions: ModeratorPermission[]; status: string; createdAt: string; matchedUser?: { id: string; name: string; email?: string | null; phone?: string | null } | null; }
export interface AdminVerificationRequest { id: string; userId: string; name: string; email?: string | null; phone?: string | null; submittedAt: string; uploads: { id: string; documentType: string }[]; }
export const getPublicConfig = () => request('/config') as Promise<{ registrationEnabled: boolean; cognitoEnabled: boolean; translationEnabled?: boolean }>;
export interface PublicSubmission { id: string; kind: 'listing' | 'service'; payload: Record<string, unknown>; uploadIds: string[]; createdAt: string; seller: string; verified: boolean; }
export const getPublishedSubmissions = () => request('/public-submissions') as Promise<{ submissions: PublicSubmission[]; hiddenContentIds?: string[] }>;
export const checkContentVisible = (type: string, id: string) => request(`/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}/visible`, { signal: AbortSignal.timeout(8000) }) as Promise<{ visible: boolean }>;
let csrfToken: string | null = null;
export async function getSession(): Promise<Account | null> {
  const result = await request('/auth/session');
  csrfToken = result.csrfToken;
  return result.user;
}
export const requestCode = (identifier: string, channel: 'phone' | 'email', name: string) => request('/auth/request-code', { method: 'POST', body: JSON.stringify({ [channel]: identifier, channel, name }) }) as Promise<{ challengeId: string }>;
export async function verifyCode(challengeId: string, code: string): Promise<Account> {
  const result = await request('/auth/verify-code', { method: 'POST', body: JSON.stringify({ challengeId, code }) });
  csrfToken = result.csrfToken;
  return result.user;
}
export async function signOut(useCognito = false) {
  const result = await request(useCognito ? '/auth/cognito/logout' : '/auth/logout', { method: 'POST' });
  csrfToken = null;
  if (typeof result.logoutUrl === 'string') window.location.assign(result.logoutUrl);
}
export interface UploadedFile { id: string; originalFileName: string; mimeType: string; byteSize: number; }
export async function uploadFile(file: File, purpose: 'photo' | 'verification', documentType?: string): Promise<UploadedFile> {
  const query = new URLSearchParams({ purpose, ...(documentType ? { documentType } : {}) });
  const result = await request(`/uploads?${query}`, { method: 'POST', headers: { 'content-type': file.type, 'x-file-name': encodeURIComponent(file.name) }, body: file });
  return result.upload;
}
export const submitVerification = (uploadIds: string[]) => request('/verifications', { method: 'POST', body: JSON.stringify({ uploadIds }) });
export async function submitPost(kind: 'listing' | 'service', payload: unknown, files: File[]) {
  const uploadIds = [];
  for (const file of files) uploadIds.push((await uploadFile(file, 'photo')).id);
  return request('/submissions', { method: 'POST', body: JSON.stringify({ kind, payload, uploadIds }) });
}
export const getAdminUsers = (query = '') => request(`/admin/users${query ? `?query=${encodeURIComponent(query)}` : ''}`) as Promise<{ users: AdminUser[] }>;
export const updateAdminUserRole = (id: string, role: string) => request(`/admin/users/${encodeURIComponent(id)}/role`, { method: 'POST', body: JSON.stringify({ role }) }) as Promise<{ user: AdminUser }>;
export const updateAdminUserStatus = (id: string, status: string, reason = '') => request(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) }) as Promise<{ user: AdminUser }>;
export const getModeratorAssignments = () => request('/admin/moderators') as Promise<{ moderators: ModeratorAssignment[] }>;
export const createModeratorAssignment = (body: { name: string; email?: string; phone?: string; permissions: ModeratorPermission[] }) => request('/admin/moderators', { method: 'POST', body: JSON.stringify(body) }) as Promise<{ moderator: ModeratorAssignment }>;
export const revokeModeratorAssignment = (id: string) => request(`/admin/moderators/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' });
export const getAdminVerifications = () => request('/admin/verifications') as Promise<{ requests: AdminVerificationRequest[] }>;
export const reviewAdminVerification = (id: string, status: 'VERIFIED' | 'REJECTED', reason = '') => request(`/admin/verifications/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify({ status, reason }) });
export interface AdminContentReport { id: string; contentType: string; contentId: string; reason: string; details?: string | null; status: string; createdAt: string; resolvedAt?: string | null; reporter?: { email?: string | null; phone?: string | null } | null; }
export const getAdminReports = () => request('/admin/reports') as Promise<{ reports: AdminContentReport[] }>;
export const reviewAdminReport = (id: string, status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED', action?: 'HIDE', reason?: string) => request(`/admin/reports/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ status, action, reason }) }) as Promise<{ report: AdminContentReport }>;
export interface ModeratedContent { id: string; kind: string; status: string; createdAt: string; title: string; description: string; category: string; commercial: boolean; owner: { id: string; name: string; email?: string | null; phone?: string | null; status: string }; uploadIds: string[]; }
export interface ContentControl { contentType: string; contentId: string; status: string; reason?: string | null; updatedAt: string; }
export interface PublicationPause { category: string; reason: string; createdAt: string; }
export interface OperationAction { id: string; action: string; targetType: string; targetId?: string | null; metadata?: { reason?: string; from?: string; to?: string } | null; createdAt: string; actor: string; }
export const getAdminOperations = () => request('/admin/operations') as Promise<{ counts: { users: number; published: number; pending: number; hidden: number; services: number; reports: number; views: number }; recent: OperationAction[] }>;
export const getAdminContent = () => request('/admin/content') as Promise<{ submissions: ModeratedContent[]; controls: ContentControl[] }>;
export const moderateContent = (contentType: string, contentId: string, action: 'HIDE' | 'RESTORE' | 'APPROVE' | 'REMOVE', reason = '') => request('/admin/content/status', { method: 'POST', body: JSON.stringify({ contentType, contentId, action, reason }) }) as Promise<{ content: { status: string } }>;
export const getPublicationPauses = () => request('/admin/publication-pause') as Promise<{ pauses: PublicationPause[] }>;
export const setPublicationPause = (category: string, paused: boolean, reason = '') => request('/admin/publication-pause', { method: 'POST', body: JSON.stringify({ category, paused, reason }) }) as Promise<{ pauses: PublicationPause[] }>;
export async function openPrivateUpload(id: string) {
  const response = await fetch(`${apiBase}/uploads/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Could not open the private document');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
