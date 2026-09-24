// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import AccountDashboard from './AccountDashboard';
import App from './App';
import { LanguageContext } from './i18n';
import useSavedItems from './useSavedItems';
import { changeOwnedListing, getContactActivity, getOwnedListings, getSavedItems, getSession, recordContactOpened, removeAccountItem, saveAccountItem, type Account, type OwnedListing, type PublicSubmission } from './api';

vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), getSession: vi.fn(), getSavedItems: vi.fn(), saveAccountItem: vi.fn(), removeAccountItem: vi.fn(), getContactActivity: vi.fn(), removeContactActivity: vi.fn(), getOwnedListings: vi.fn(), changeOwnedListing: vi.fn(), recordContactOpened: vi.fn(), signOut: vi.fn(), getPublicConfig: vi.fn().mockResolvedValue({ registrationEnabled: true, cognitoEnabled: false }), getPublishedSubmissions: vi.fn().mockResolvedValue({ submissions: [] }), checkContentVisible: vi.fn().mockResolvedValue({ visible: true }) }));

const account: Account = { id: 'owner', name: 'Nour', email: 'nour@example.test', role: 'RESIDENT', residentVerified: false };
const item: OwnedListing = { id: '11111111-1111-4111-8111-111111111111', kind: 'service', status: 'PUBLISHED', ownerState: 'ACTIVE', version: 1, createdAt: '2026-09-24T00:00:00Z', updatedAt: '2026-09-24T00:00:00Z', assisted: false, feeStatus: null, payload: { title: 'Mathematics lessons', subtitle: 'Individual mathematics lessons for school students.', category: 'Tutoring & education', zone: 'B1', providerName: 'Nour Hassan', whatsapp: '+201000000000', pricing: '200 EGP', availability: 'Evenings', advertiserType: 'individual' } };
const submission: PublicSubmission = { id: item.id, kind: 'service', payload: item.payload, createdAt: item.createdAt, seller: 'Nour Hassan', verified: false, uploadIds: [] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(account);
  vi.mocked(getSavedItems).mockResolvedValue({ saved: [] });
  vi.mocked(getOwnedListings).mockResolvedValue({ listings: [item], hasMore: false });
  vi.mocked(getContactActivity).mockResolvedValue({ activity: [], hasMore: false });
  localStorage.setItem('madinaty-deals-language', 'en');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, '', '/'); });

function dashboard(section: 'account' | 'saved' | 'activity' | 'my-listings') {
  return render(<LanguageContext.Provider value="en"><AccountDashboard account={account} section={section} onNavigate={vi.fn()} onPost={vi.fn()} onVerify={vi.fn()} saved={[]} savedReady savedError="" onUnsave={vi.fn()} renderResult={record => <p>{String(record.payload.title)}</p>} /></LanguageContext.Provider>);
}

it('opens My Account after sign-in and supports buying and selling navigation together', async () => {
  render(<App />);
  const header = within(screen.getByRole('banner'));
  await header.findByRole('button', { name: 'Sign out' });
  fireEvent.click(header.getByRole('button', { name: 'My Account' }));
  expect(screen.getByRole('heading', { name: 'My Account' })).toBeTruthy();
  expect(screen.getByText('nour@example.test')).toBeTruthy();
  const navigation = within(screen.getByRole('navigation', { name: 'Account navigation' }));
  fireEvent.click(navigation.getByRole('button', { name: 'My Listings' }));
  expect(await screen.findByRole('heading', { name: 'Mathematics lessons' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'My Items' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'My Services' })).toBeTruthy();
  fireEvent.click(navigation.getByRole('button', { name: 'My Activity' }));
  expect(await screen.findByText('No contact activity yet.')).toBeTruthy();
  fireEvent.click(header.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'My Activity' })).toBeNull());
  expect(screen.queryByText('nour@example.test')).toBeNull();
});

it('preserves the posting destination after returning from managed sign-in', async () => {
  sessionStorage.setItem('madinaty-signin-destination', 'post');
  render(<App />);
  expect(await screen.findByRole('dialog')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Post something' })).toBeTruthy();
  expect(sessionStorage.getItem('madinaty-signin-destination')).toBeNull();
});

it('keeps the same focused input node while editing a service', async () => {
  dashboard('my-listings');
  fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  const input = screen.getByLabelText('Availability');
  input.focus();
  for (const value of ['M', 'Mo', 'Morning']) {
    fireEvent.change(input, { target: { value } });
    expect(screen.getByLabelText('Availability')).toBe(input);
    expect(document.activeElement).toBe(input);
  }
  vi.mocked(changeOwnedListing).mockResolvedValue({ listing: { ...item, version: 2, payload: { ...item.payload, availability: 'Morning' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(changeOwnedListing).toHaveBeenCalledWith(item.id, 1, 'edit', { availability: 'Morning' }));
  expect(await screen.findByText('Availability: Morning')).toBeTruthy();
});

it('flags forbidden links in the editing form without sending them', async () => {
  dashboard('my-listings');
  fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Find my classes at https://example.com' } });
  expect(screen.getByRole('alert').textContent).toContain('Community Content Policy violation');
  expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  expect(changeOwnedListing).not.toHaveBeenCalled();
});

it('requires confirmation before closing a service and sends its version', async () => {
  dashboard('my-listings');
  fireEvent.click(await screen.findByRole('button', { name: 'Close service' }));
  expect(changeOwnedListing).not.toHaveBeenCalled();
  vi.mocked(changeOwnedListing).mockResolvedValue({ listing: { ...item, version: 2, ownerState: 'CLOSED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(changeOwnedListing).toHaveBeenCalledWith(item.id, 1, 'close', undefined));
  expect(await screen.findByText('Closed')).toBeTruthy();
});

it('labels contact history honestly and keeps the provider name on unavailable ads', async () => {
  vi.mocked(getContactActivity).mockResolvedValue({ activity: [{ id: item.id, title: 'Mathematics lessons', providerName: 'Nour Hassan', kind: 'service', openedAt: item.createdAt, submission: null }], hasMore: false });
  dashboard('activity');
  expect(await screen.findByText('Nour Hassan')).toBeTruthy();
  expect(screen.getByText('Contact opened')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'View listing' })).toBeNull();
  expect(screen.getByText('Contact opened means you opened a WhatsApp link. It does not confirm a message, booking or purchase.')).toBeTruthy();
});

it('records a signed-in WhatsApp opening from an account-saved service', async () => {
  vi.mocked(getSavedItems).mockResolvedValue({ saved: [{ id: item.id, submission }] });
  const replace = vi.fn();
  vi.spyOn(window, 'open').mockReturnValue({ opener: null, closed: false, location: { replace }, close: vi.fn() } as unknown as Window);
  render(<App />);
  await screen.findByRole('button', { name: 'Sign out' });
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Saved' }));
  fireEvent.click(await screen.findByRole('button', { name: /Contact on WhatsApp/ }));
  await waitFor(() => expect(recordContactOpened).toHaveBeenCalledWith(item.id));
  expect(replace).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/201000000000'));
});

it('loads account saves independently of the public feed and guest shortlist', async () => {
  localStorage.setItem('madinaty-favorites', JSON.stringify(['submission-guest']));
  vi.mocked(getSavedItems).mockResolvedValue({ saved: [{ id: item.id, submission }] });
  const { result } = renderHook(() => useSavedItems(account.id));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.favorites.has(`submission-${item.id}`)).toBe(true);
  expect(result.current.favorites.has('submission-guest')).toBe(false);
  expect(localStorage.getItem('madinaty-favorites')).toBe(JSON.stringify(['submission-guest']));
  vi.mocked(getSavedItems).mockResolvedValue({ saved: [] });
  await act(async () => { await result.current.toggle(`submission-${item.id}`); });
  expect(removeAccountItem).toHaveBeenCalledWith(item.id);
  expect(saveAccountItem).not.toHaveBeenCalled();
});

it('does not leak a delayed saved response after switching accounts or signing out', async () => {
  let resolveFirst: (value: { saved: { id: string; submission: PublicSubmission }[] }) => void = () => {};
  vi.mocked(getSavedItems).mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }));
  const { result, rerender } = renderHook(({ accountId }: { accountId?: string }) => useSavedItems(accountId), { initialProps: { accountId: 'first' } as { accountId?: string } });
  rerender({ accountId: 'second' });
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { resolveFirst({ saved: [{ id: item.id, submission }] }); });
  expect(result.current.favorites.size).toBe(0);
  rerender({ accountId: undefined });
  expect(result.current.favorites.size).toBe(0);
});
