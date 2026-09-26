// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { listings, results } from './testFixtures';
import { matchesQuery } from './domain';
import { languageKey, translate } from './i18n';
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), getSavedItems: vi.fn().mockResolvedValue({ saved: (await import('./testFixtures')).submissions.filter(item => item.id === 'test-chair').map(submission => ({ id: submission.id, submission })) }), getSession: vi.fn().mockResolvedValue({ id: 'user', name: 'Neighbour', email: 'test@example.test', role: 'RESIDENT', residentVerified: false }), getPublishedSubmissions: vi.fn().mockResolvedValue({ submissions: (await import('./testFixtures')).submissions }) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

describe('Arabic and English experience', () => {
  it('preserves the current view when switching languages and remembers the choice on reload', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    localStorage.setItem('madinaty-favorites', JSON.stringify(['submission-test-chair']));
    window.history.replaceState({}, '', '/?lang=ar');
    const { unmount } = render(<App />);
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    await screen.findByRole('button', { name: 'تسجيل الخروج' });
    fireEvent.click(screen.getAllByRole('button', { name: /المحفوظات/ })[0]);
    expect(screen.getByRole('heading', { name: 'المحفوظات' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByRole('heading', { name: 'Saved' })).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Saved' }));
    expect(screen.getByRole('heading', { name: 'Saved' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Test child chair' })).toBeTruthy();
    expect(localStorage.getItem(languageKey)).toBe('en');
    unmount();
    render(<App />);
    expect(document.documentElement.lang).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'التبديل إلى العربية' }));
    expect(document.documentElement.dir).toBe('rtl');
    await screen.findByRole('button', { name: 'تسجيل الخروج' });
    expect(screen.getByRole('heading', { name: translate('Saved', 'ar') })).toBeTruthy();
  }, 15000);

  it('keeps canonical zone and category values in Arabic forms', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'تسجيل الخروج' });
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'أضف إعلانًا' }));
    fireEvent.click(screen.getByRole('button', { name: /بيع منتج/ }));
    const category = screen.getByLabelText('القسم') as HTMLSelectElement;
    expect(category.value).toBe('');
    fireEvent.change(category, { target: { value: 'Electronics' } });
    expect(category.value).toBe('Electronics');
    fireEvent.click(screen.getByRole('radio', { name: /أنشر بصفتي فردًا/ }));
    fireEvent.click(screen.getByRole('button', { name: 'تابع إلى التفاصيل' }));
    const zone = screen.getByLabelText('المنطقة') as HTMLSelectElement;
    expect(zone.value).toBe('B1');
    expect(zone.selectedOptions[0].textContent).toBe('B1');
  }, 15000);

  it('searches Arabic and English user content, including Arabic diacritics', () => {
    const service = { ...results.find(result => result.id === 'test-ac')!, subtitle: 'صيانة تكييف · maintenance' };
    expect(matchesQuery(service, 'تَكْيِيف')).toBe(true);
    expect(matchesQuery(service, 'صيانة')).toBe(true);
    expect(matchesQuery(service, 'maintenance')).toBe(true);
    expect(matchesQuery(listings[1], 'إلكترونيات')).toBe(true);
  });

  it('preserves user text and translates dynamic labels and currency', () => {
    expect(translate('ترابيزة أحمد', 'ar')).toBe('ترابيزة أحمد');
    expect(translate('Save Home', 'ar')).toBe('حفظ الرئيسية');
    expect(translate('EGP 9,800', 'ar')).toContain('ج.م.');
    expect(translate('EGP 1,450.5', 'ar')).toBe('١٬٤٥٠٫٥ ج.م.');
    expect(translate('Home', 'en')).toBe('Home');
  });
});
