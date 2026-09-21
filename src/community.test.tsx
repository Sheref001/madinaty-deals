// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import ListingForm from './ListingForm';
import ServiceForm from './ServiceForm';
import { LanguageContext } from './i18n';
import { getPublicConfig, getSession, submitPost } from './api';
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), getPublicConfig: vi.fn(), getSession: vi.fn(), submitPost: vi.fn().mockResolvedValue({ id: 'submission', status: 'PENDING_REVIEW' }) }));
beforeEach(() => { vi.mocked(getSession).mockResolvedValue(null); vi.mocked(getPublicConfig).mockResolvedValue({ registrationEnabled: true, cognitoEnabled: false }); });

afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

it('previews details without publishing and preserves them when editing', async () => {
  const publish = vi.fn();
  render(<LanguageContext.Provider value="en"><ListingForm onPublish={publish} /></LanguageContext.Provider>);
  fireEvent.change(screen.getByLabelText('What are you selling?'), { target: { value: 'Small oak desk' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'One year old, a small scratch on the top.' } });
  fireEvent.change(screen.getByLabelText('Price (EGP)'), { target: { value: '1450.50' } });
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Fair' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview listing' }));
  expect(publish).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: 'Small oak desk' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toContain('small scratch');
  expect((screen.getByLabelText('Condition') as HTMLSelectElement).value).toBe('Fair');
  fireEvent.click(screen.getByRole('button', { name: 'Preview listing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(publish).toHaveBeenCalledWith(expect.objectContaining({ title: 'Small oak desk', condition: 'Fair', price: 1450.5, subtitle: 'One year old, a small scratch on the top.' })));
  expect(submitPost).toHaveBeenCalled();
});

it('submits a service with area and WhatsApp contact for review', async () => {
  const publish = vi.fn();
  render(<LanguageContext.Provider value="en"><ServiceForm onPublish={publish} /></LanguageContext.Provider>);
  expect(screen.getByText('No residency verification required')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('What service are you offering?'), { target: { value: 'Math tutoring for students' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Private lessons for school students and exam preparation.' } });
  fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '+20 100 000 0000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview service' }));
  expect(screen.getByRole('heading', { name: 'Math tutoring for students' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(publish).toHaveBeenCalledWith(expect.objectContaining({ title: 'Math tutoring for students', category: 'Tutoring & education', advertiserType: 'individual', whatsapp: '+20 100 000 0000' })));
});

it('routes the home services category to providers in Arabic', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'إزاي تستخدم مدينتي ديلز؟' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /خدمات منزلية/ }));
  expect(screen.getByRole('heading', { name: 'خدمات موثوقة قريبة منك' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'كول بوينت للتكييف' })).toBeTruthy();
});

it('opens the posting form for a server-authenticated user', async () => {
  vi.mocked(getSession).mockResolvedValue({ id: 'user-1', name: 'Neighbour', email: 'test@example.test', role: 'RESIDENT', residentVerified: false });
  render(<App />);
  await screen.findByRole('button', { name: 'تسجيل الخروج' });
  fireEvent.click(screen.getByRole('button', { name: 'عندك حاجة للبيع؟' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /بيع منتج/ }));
  expect(screen.getByLabelText('الوصف')).toBeTruthy();
});

it('ignores a forged local registration flag and requires real sign-in', async () => {
  localStorage.setItem('madinaty-account-registered', 'true');
  localStorage.setItem('madinaty-deals-language', 'en');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in or create account' }));
  expect(screen.getByRole('dialog', { name: 'Sign in or create account' })).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Send sign-in code' })).toBeTruthy();
  expect(screen.queryByLabelText('What are you selling?')).toBeNull();
});

it('hides account creation and presents sign-in while registrations are paused', async () => {
  vi.mocked(getPublicConfig).mockResolvedValue({ registrationEnabled: false, cognitoEnabled: false });
  localStorage.setItem('madinaty-deals-language', 'en');
  render(<App />);
  const signIn = await screen.findByRole('button', { name: 'Sign in' });
  expect(screen.queryByRole('button', { name: 'Create your account Register before posting' })).toBeNull();
  fireEvent.click(signIn);
  expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeTruthy();
  expect(await screen.findByText(/New account creation is temporarily paused/)).toBeTruthy();
  expect(screen.queryByLabelText('Your name')).toBeNull();
});


it('preserves a small business authentication request through preview and submission', async () => {
  const publish = vi.fn();
  render(<LanguageContext.Provider value="en"><ServiceForm onPublish={publish} /></LanguageContext.Provider>);
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Health & fitness' } });
  expect(screen.getByLabelText('Advertiser type')).toBeTruthy();
  expect(screen.queryByText('Individual ads are free.')).toBeNull();
  fireEvent.change(screen.getByLabelText('Advertiser type'), { target: { value: 'small_business' } });
  fireEvent.change(screen.getByLabelText('Business request'), { target: { value: 'both' } });
  fireEvent.change(screen.getByLabelText('What service are you offering?'), { target: { value: 'Neighbourhood fitness studio' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Group fitness classes and personal training.' } });
  fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '+201001234567' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview service' }));
  expect(screen.getByText(/Small business fees are agreed/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  expect((screen.getByLabelText('Business request') as HTMLSelectElement).value).toBe('both');
  fireEvent.click(screen.getByRole('button', { name: 'Preview service' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(publish).toHaveBeenCalledWith(expect.objectContaining({ advertiserType: 'small_business', businessRequest: 'both', category: 'Health & fitness', verified: false })));
});
