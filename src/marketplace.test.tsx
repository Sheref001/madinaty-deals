// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { filterResults } from './domain';
import { listings } from './data';
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), getPublishedSubmissions: vi.fn().mockResolvedValue({ submissions: [], hiddenContentIds: [] }) }));

async function renderReady() {
  const result = render(<App />);
  await screen.findByRole('heading', { name: 'Solid oak dining table' });
  return result;
}

afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

it('searches all sections from the header and opens result details', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  const search = screen.getByLabelText('Search items, services or places');
  fireEvent.change(search, { target: { value: 'maintenance' } });
  fireEvent.submit(search.closest('form')!);
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cool Point AC Services' }));
  expect(within(screen.getByRole('dialog')).getByText('Installation, maintenance & repair')).toBeTruthy();
});

it('filters by condition and switches between list and grid without losing the filter', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Browse items' }));
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Fair' } });
  expect(screen.getByRole('heading', { name: 'IKEA Hemnes shoe cabinet' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'LG 55” 4K Smart TV' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
  expect(screen.getByRole('button', { name: 'Grid view' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('heading', { name: 'IKEA Hemnes shoe cabinet' })).toBeTruthy();
});

it('persists favouriting a homepage item on this browser', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  const first = await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Save Solid oak dining table' }));
  first.unmount();
  await renderReady();
  fireEvent.click(screen.getAllByRole('button', { name: 'Saved' })[0]);
  expect(screen.getByRole('heading', { name: 'Solid oak dining table' })).toBeTruthy();
});

it('shows vehicle and transport choices within the Cars & motorcycles collection', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: /Cars & motorcycles\s*Explore/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Refine results' }));
  const filter = screen.getByLabelText('Vehicle & transport') as HTMLSelectElement;
  expect(Array.from(filter.options).map(option => option.value)).toEqual(['', 'Cars', 'Motorcycles', 'Moving furniture', 'Private transportation']);
  fireEvent.change(filter, { target: { value: 'Moving furniture' } });
  expect(screen.getByRole('heading', { name: 'Madinaty Move' })).toBeTruthy();
  expect(screen.queryByLabelText('Condition')).toBeNull();
});

it('orders prices with unknown values last and applies inclusive price limits', () => {
  const fixtures = listings.slice(0,3).map((item,index) => ({ ...item, price: [100,200,null][index] }));
  const base = { query:'', zone:'All zones', verifiedOnly:false, sort:'price-high' as const };
  expect(filterResults(fixtures,base).map(item => item.id)).toEqual([fixtures[1].id,fixtures[0].id,fixtures[2].id]);
  expect(filterResults(fixtures,{...base,minPrice:100,maxPrice:100}).map(item => item.id)).toEqual([fixtures[0].id]);
  expect(filterResults(listings,{...base,sort:'newest'}).map(item => item.createdAt)).toEqual(['2 hours ago','5 hours ago','Yesterday','Yesterday','2 days ago']);
});


it('filters tutoring individuals and centres without an audience banner', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: /Tutoring & education\s*Explore/ }));
  expect(screen.getByRole('heading', { name: 'Tutoring & education' })).toBeTruthy();
  expect(screen.queryByText('Choose individuals or small businesses in this category.')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Subcategories' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Refine results' }));
  expect(screen.getByLabelText('Provider type')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Sheref · Math Tutor · DEMO' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Kite Learning Studio' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Provider type'), { target: { value: 'small_business' } });
  expect(screen.getByRole('heading', { name: 'Kite Learning Studio' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Sheref · Math Tutor · DEMO' })).toBeNull();
});

it.each(['Electronics'])('shows both subcategories for %s even with no matching ads', async category => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: `${category}Explore` }));
  expect(screen.getByRole('heading', { name: category })).toBeTruthy();
  expect(screen.queryByText('Choose individuals or small businesses in this category.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Refine results' }));
  expect(screen.getByLabelText('Provider type')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Provider type'), { target: { value: 'small_business' } });
  expect((screen.getByLabelText('Provider type') as HTMLSelectElement).value).toBe('small_business');
});


it('shows gym providers without an individual and business audience panel', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Health & fitnessExplore' }));
  expect(screen.getByRole('heading', { name: 'Health & fitness' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Studio 8 Pilates' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Subcategories' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Individuals' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Small businesses' })).toBeNull();
  expect(screen.queryByText('Choose individuals or small businesses in this category.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Refine results' }));
  expect(screen.queryByLabelText('Provider type')).toBeNull();
  expect(screen.getByLabelText('Fitness provider')).toBeTruthy();
});
