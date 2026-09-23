// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminModeration from './AdminModeration';
import { LanguageContext } from './i18n';
import { getAdminContent, getAdminReports, getPublicationPauses, moderateContent, setPublicationPause } from './api';

vi.mock('./api', async original => ({
  ...await original<typeof import('./api')>(),
  getAdminContent: vi.fn(), getAdminReports: vi.fn(), getPublicationPauses: vi.fn(), moderateContent: vi.fn(), setPublicationPause: vi.fn(),
}));

const submission = { id: 'submission-11111111-1111-4111-8111-111111111111', kind: 'listing', status: 'PENDING_REVIEW', createdAt: '2026-09-23T00:00:00Z', title: 'Review this table', description: 'A table in good condition', category: 'Furniture & home', commercial: false, owner: { id: 'owner-1', name: 'Neighbour', email: 'person@example.test', status: 'ACTIVE' }, uploadIds: [] };
beforeEach(() => {
  vi.mocked(getAdminContent).mockResolvedValue({ submissions: [submission], controls: [] });
  vi.mocked(getAdminReports).mockResolvedValue({ reports: [] });
  vi.mocked(getPublicationPauses).mockResolvedValue({ pauses: [] });
  vi.mocked(moderateContent).mockResolvedValue({ content: { status: 'HIDDEN' } });
  vi.mocked(setPublicationPause).mockResolvedValue({ pauses: [{ category: '*', reason: 'Emergency review', createdAt: '2026-09-23T00:00:00Z' }] });
  vi.stubGlobal('prompt', vi.fn(() => 'Emergency review'));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const renderPanel = () => render(<LanguageContext.Provider value="en"><AdminModeration isAdmin canReadReports /></LanguageContext.Provider>);

describe('owner content controls', () => {
  it('approves a held ad through the review workspace', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting review' }));
    expect(await screen.findByText('Review this table')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(moderateContent).toHaveBeenCalledWith('listing', submission.id, 'APPROVE', ''));
  });
  it('pauses publication with a recorded reason', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Pause publication' }));
    await waitFor(() => expect(setPublicationPause).toHaveBeenCalledWith('*', true, 'Emergency review'));
  });
});
