// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import ListingForm from './ListingForm';
import ServiceForm from './ServiceForm';
import { LanguageContext } from './i18n';

afterEach(() => { cleanup(); localStorage.clear(); });

it('previews details without publishing and preserves them when editing', () => {
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
  fireEvent.click(screen.getByRole('button', { name: 'Add to this demo' }));
  expect(publish).toHaveBeenCalledWith(expect.objectContaining({ title: 'Small oak desk', condition: 'Fair', price: 1450.5, subtitle: 'One year old, a small scratch on the top.' }));
});

it('previews and publishes a service with area and WhatsApp contact', () => {
  const publish = vi.fn();
  render(<LanguageContext.Provider value="en"><ServiceForm onPublish={publish} /></LanguageContext.Provider>);
  fireEvent.change(screen.getByLabelText('What service are you offering?'), { target: { value: 'Math tutoring for students' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Private lessons for school students and exam preparation.' } });
  fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '+20 100 000 0000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview service' }));
  expect(screen.getByRole('heading', { name: 'Math tutoring for students' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add service to this demo' }));
  expect(publish).toHaveBeenCalledWith(expect.objectContaining({ title: 'Math tutoring for students', category: 'Tutoring', whatsapp: '+20 100 000 0000' }));
});

it('routes the home services category to providers in Arabic', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'إزاي تستخدم مدينتي ديلز؟' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /خدمات منزلية/ }));
  expect(screen.getByRole('heading', { name: 'خدمات موثوقة قريبة منك' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'كول بوينت للتكييف' })).toBeTruthy();
});

it('opens the posting form from the new hero action', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'عندك حاجة للبيع؟' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /بيع منتج/ }));
  expect(screen.getByLabelText('الوصف')).toBeTruthy();
});
