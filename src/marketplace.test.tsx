// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { filterResults } from './domain';
import { listings } from './data';

afterEach(() => { cleanup(); localStorage.clear(); });

it('searches all sections from the header and opens result details', () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  render(<App />);
  const search = screen.getByLabelText('Search items, services or places');
  fireEvent.change(search, { target: { value: 'maintenance' } });
  fireEvent.submit(search.closest('form')!);
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cool Point AC Services' }));
  expect(within(screen.getByRole('dialog')).getByText('Installation, maintenance & repair')).toBeTruthy();
});

it('filters by condition and switches between list and grid without losing the filter', () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Browse items' }));
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Fair' } });
  expect(screen.getByRole('heading', { name: 'IKEA Hemnes shoe cabinet' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'LG 55” 4K Smart TV' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
  expect(screen.getByRole('button', { name: 'Grid view' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('heading', { name: 'IKEA Hemnes shoe cabinet' })).toBeTruthy();
});

it('persists favouriting a homepage item on this browser', () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  const first = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Save Solid oak dining table' }));
  first.unmount();
  render(<App />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Saved' })[0]);
  expect(screen.getByRole('heading', { name: 'Solid oak dining table' })).toBeTruthy();
});

it('orders prices with unknown values last and applies inclusive price limits', () => {
  const fixtures = listings.slice(0,3).map((item,index) => ({ ...item, price: [100,200,null][index] }));
  const base = { query:'', zone:'All zones', verifiedOnly:false, sort:'price-high' as const };
  expect(filterResults(fixtures,base).map(item => item.id)).toEqual([fixtures[1].id,fixtures[0].id,fixtures[2].id]);
  expect(filterResults(fixtures,{...base,minPrice:100,maxPrice:100}).map(item => item.id)).toEqual([fixtures[0].id]);
  expect(filterResults(listings,{...base,sort:'newest'}).map(item => item.createdAt)).toEqual(['2 hours ago','5 hours ago','Yesterday','Yesterday','2 days ago']);
});
