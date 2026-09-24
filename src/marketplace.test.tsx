// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { getPublishedSubmissions } from './api';
import { filterResults } from './domain';
import { listings } from './testFixtures';
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), getPublishedSubmissions: vi.fn().mockResolvedValue({ submissions: (await import('./testFixtures')).submissions }) }));

async function renderReady() {
  const result = render(<App />);
  await screen.findByRole('heading', { name: 'Test dining table' });
  return result;
}

afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

it('opens Online Finds as a business collection with store-type filters', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  const category = screen.getByRole('button', { name: /Online Finds\s*Explore/ });
  expect(category.querySelector('img')?.getAttribute('src')).toContain('images.pexels.com/photos/7667442/pexels-photo-7667442.jpeg');
  fireEvent.click(category);
  expect(screen.getByRole('heading', { name: 'Online Finds' })).toBeTruthy();
  const filter = screen.getByLabelText('Store type') as HTMLSelectElement;
  expect(Array.from(filter.options).map(option => option.value)).toContain('Beauty & personal care');
  expect(screen.getByRole('tab', { name: 'Businesses' }).getAttribute('aria-selected')).toBe('true');
});

it('searches all sections from the header and opens result details', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  const search = screen.getByLabelText('Search items, services or places');
  fireEvent.change(search, { target: { value: 'maintenance' } });
  fireEvent.submit(search.closest('form')!);
  expect(screen.getByRole('heading', { name: 'Search results' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Test AC service' }));
  expect(within(screen.getByRole('dialog')).getByText('Installation, maintenance & repair')).toBeTruthy();
});

it('filters by condition and switches between list and grid without losing the filter', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Browse items' }));
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Fair' } });
  expect(screen.getByRole('heading', { name: 'Test shoe cabinet' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Test television' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
  expect(screen.getByRole('button', { name: 'Grid view' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('heading', { name: 'Test shoe cabinet' })).toBeTruthy();
});

it('persists favouriting a homepage item on this browser', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  const first = await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Save Test dining table' }));
  first.unmount();
  await renderReady();
  fireEvent.click(screen.getAllByRole('button', { name: 'Saved' })[0]);
  expect(screen.getByRole('heading', { name: 'Test dining table' })).toBeTruthy();
});

it('shows vehicle and transport choices within the Cars & motorcycles collection', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: /Cars & motorcycles\s*Explore/ }));
  const filter = screen.getByLabelText('Vehicle & transport') as HTMLSelectElement;
  expect(Array.from(filter.options).map(option => option.value)).toEqual(['', 'Cars', 'Motorcycles', 'Moving furniture', 'Private transportation']);
  fireEvent.change(filter, { target: { value: 'Moving furniture' } });
  expect(screen.getByRole('heading', { name: 'Test moving service' })).toBeTruthy();
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
  expect(screen.getByLabelText('Provider type')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Test math tutor' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Test learning center' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Provider type'), { target: { value: 'small_business' } });
  expect(screen.getByRole('heading', { name: 'Test learning center' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Test math tutor' })).toBeNull();
});

it.each(['Electronics'])('shows both subcategories for %s even with no matching ads', async category => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: `${category}Explore` }));
  expect(screen.getByRole('heading', { name: category })).toBeTruthy();
  expect(screen.queryByText('Choose individuals or small businesses in this category.')).toBeNull();
  expect(screen.getByLabelText('Provider type')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Provider type'), { target: { value: 'small_business' } });
  expect((screen.getByLabelText('Provider type') as HTMLSelectElement).value).toBe('small_business');
});


it('shows health and fitness filters without inventing gym providers', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Health & fitnessExplore' }));
  expect(screen.getByRole('heading', { name: 'Health & fitness' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'No matches yet' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Subcategories' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Individuals' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Small businesses' })).toBeNull();
  expect(screen.queryByText('Choose individuals or small businesses in this category.')).toBeNull();
  expect(screen.queryByLabelText('Provider type')).toBeNull();
  expect(screen.getByLabelText('Fitness provider')).toBeTruthy();
});

it('shows an honest empty state when the API has no published ads', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  vi.mocked(getPublishedSubmissions).mockResolvedValueOnce({ submissions: [] });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'No listings yet' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Test dining table' })).toBeNull();
});

it('clears saved IDs belonging to removed sample ads', async () => {
  localStorage.setItem('madinaty-deals-language', 'en');
  localStorage.setItem('madinaty-favorites', JSON.stringify(['listing-3']));
  await renderReady();
  expect(JSON.parse(localStorage.getItem('madinaty-favorites') || 'null')).toEqual([]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Saved' })[0]);
  expect(screen.getByRole('heading', { name: 'No matches yet' })).toBeTruthy();
});
