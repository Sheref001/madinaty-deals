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
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Request failed');
  return response.json();
};

export const recordView = (type: string, id: string) => request(`/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}/view`, { method: 'POST' }) as Promise<{ viewCount: number }>;
export const getComments = (type: string, id: string) => request(`/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}/comments`) as Promise<{ comments: PublicComment[] }>;
export const postComment = (type: string, id: string, body: string, language: string) => request(`/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ body, language }) }) as Promise<{ comment: PublicComment }>;

export interface Account { id: string; email?: string | null; phone?: string | null; name: string; role: string; residentVerified: boolean; }
export interface AdminUser extends Account { status: string; createdAt: string; }
export const getPublicConfig = () => request('/config') as Promise<{ registrationEnabled: boolean }>;
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
export async function signOut() {
  await request('/auth/logout', { method: 'POST' });
  csrfToken = null;
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
export const getAdminUsers = () => request('/admin/users') as Promise<{ users: AdminUser[] }>;
export const updateAdminUserRole = (id: string, role: string) => request(`/admin/users/${encodeURIComponent(id)}/role`, { method: 'POST', body: JSON.stringify({ role }) }) as Promise<{ user: AdminUser }>;
export const updateAdminUserStatus = (id: string, status: string) => request(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) }) as Promise<{ user: AdminUser }>;
