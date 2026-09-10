// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { allResults } from './data';
import { matchesQuery } from './domain';
import { languageKey, translate } from './i18n';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('Arabic and English experience', () => {
  it('defaults to Arabic, switches without losing saved state, and remembers English on reload', () => {
    const { unmount } = render(<App />);
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getAllByRole('button', { name: /المحفوظات/ })[0]);
    expect(screen.getByRole('heading', { name: 'إعلاناتك المحفوظة' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByRole('heading', { name: 'Your saved shortlist' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Stokke Tripp Trapp chair' })).toBeTruthy();
    expect(localStorage.getItem(languageKey)).toBe('en');
    unmount();
    render(<App />);
    expect(document.documentElement.lang).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'التبديل إلى العربية' }));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('keeps canonical zone and category values in Arabic forms', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'أضف إعلانًا مجانيًا' }));
    fireEvent.click(screen.getByRole('button', { name: /بيع منتج/ }));
    const category = screen.getByLabelText('القسم') as HTMLSelectElement;
    expect(category.value).toBe('Furniture & home');
    fireEvent.change(category, { target: { value: 'Electronics' } });
    expect(category.value).toBe('Electronics');
    const zone = screen.getByLabelText('المنطقة') as HTMLSelectElement;
    expect(zone.value).toBe('B1');
    expect(zone.selectedOptions[0].textContent).toBe('B1');
  });

  it('searches Arabic and English seed content, including Arabic diacritics', () => {
    expect(allResults.some(result => matchesQuery(result, 'تَكْيِيف'))).toBe(true);
    expect(allResults.some(result => matchesQuery(result, 'صيانة'))).toBe(true);
    expect(allResults.some(result => matchesQuery(result, 'maintenance'))).toBe(true);
    expect(allResults.some(result => matchesQuery(result, 'إلكترونيات'))).toBe(true);
  });

  it('preserves user text and translates dynamic labels and currency', () => {
    expect(translate('ترابيزة أحمد', 'ar')).toBe('ترابيزة أحمد');
    expect(translate('Save Solid oak dining table', 'ar')).toBe('حفظ ترابيزة سفرة من خشب البلوط');
    expect(translate('EGP 9,800', 'ar')).toContain('ج.م.');
    expect(translate('EGP 1,450.5', 'ar')).toBe('١٬٤٥٠٫٥ ج.م.');
    expect(translate('Home', 'en')).toBe('Home');
  });
});
