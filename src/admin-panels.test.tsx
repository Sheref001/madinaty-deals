// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminReviewQueue from './AdminReviewQueue';
import AdminUsers from './AdminUsers';
import { LanguageContext } from './i18n';
import { getAdminUsers, getAdminVerifications, getModeratorAssignments, reviewAdminVerification, updateAdminUserRole, updateAdminUserStatus } from './api';

vi.mock('./api', async importOriginal => ({
  ...await importOriginal<typeof import('./api')>(),
  getAdminUsers: vi.fn(), getAdminVerifications: vi.fn(), reviewAdminVerification: vi.fn(),
  updateAdminUserRole: vi.fn(), updateAdminUserStatus: vi.fn(), getModeratorAssignments: vi.fn(),
}));

const user = { id: 'user-1', name: 'Neighbour', email: 'person@example.test', role: 'RESIDENT', status: 'ACTIVE', createdAt: '2026-09-20T00:00:00.000Z', residentVerified: false };
const verification = { id: 'verification-1', userId: user.id, name: user.name, email: user.email, phone: null, submittedAt: '2026-09-20T00:00:00.000Z', uploads: [{ id: 'upload-1', documentType: 'MADINATY_ID' }] };

beforeEach(() => {
  vi.mocked(getAdminUsers).mockResolvedValue({ users: [user] });
  vi.mocked(getAdminVerifications).mockResolvedValue({ requests: [verification] });
  vi.mocked(reviewAdminVerification).mockResolvedValue({ ok: true });
  vi.mocked(updateAdminUserRole).mockResolvedValue({ user: { ...user, role: 'MODERATOR' } });
  vi.mocked(updateAdminUserStatus).mockResolvedValue({ user: { ...user, status: 'SUSPENDED' } });
  vi.mocked(getModeratorAssignments).mockResolvedValue({ moderators: [] });
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('prompt', vi.fn(() => 'Policy violation'));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const renderEnglish = (element: ReactNode) => render(<LanguageContext.Provider value="en">{element}</LanguageContext.Provider>);

describe('admin board controls', () => {
  it('loads pending verification requests and records a confirmed approval', async () => {
    renderEnglish(<AdminReviewQueue />);
    expect(await screen.findByText('Neighbour')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve resident' }));
    await waitFor(() => expect(reviewAdminVerification).toHaveBeenCalledWith('verification-1', 'VERIFIED', ''));
    await waitFor(() => expect(screen.getByText('No resident verification requests are waiting for review.')).toBeTruthy());
  });

  it('persists role and suspension changes after a confirmation', async () => {
    renderEnglish(<AdminUsers />);
    const role = await screen.findByRole('combobox', { name: 'Role Neighbour' });
    fireEvent.change(role, { target: { value: 'MODERATOR' } });
    await waitFor(() => expect(updateAdminUserRole).toHaveBeenCalledWith('user-1', 'MODERATOR'));
    fireEvent.click(screen.getByRole('button', { name: 'Suspend account Neighbour' }));
    await waitFor(() => expect(updateAdminUserStatus).toHaveBeenCalledWith('user-1', 'SUSPENDED', 'Policy violation'));
  });
});
