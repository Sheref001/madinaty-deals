import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Sofa, Monitor, Baby, Utensils, HeartPulse, ArrowRight, BadgeCheck, Bookmark, Building2, ChevronDown, ChevronRight, CircleCheck,
  Flag, Grid2X2, Heart, Home, ListFilter, MapPin, Menu, Package, CarFront, ShoppingBasket,
  Plus, Search, ShieldCheck, SlidersHorizontal, Star, Store, Tag, TrendingUp,
  Wrench, X, Zap, Activity, BarChart3, Eye, MessageCircle, RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { allResults, categories, formatPrice, zones } from './data';
import { getTrackedEvents, track } from './analytics';
import { filterResults, getViewResults, type BrowseFilters } from './domain';
import type { Listing, SearchResult, Service, View } from './types';
import { initialLanguage, LanguageContext, languageKey, useTranslation } from './i18n';
import type { Language } from './i18n';
import { featureFlags } from './featureFlags';
import { CommunityGuide, CommunityFooter } from './CommunityGuide';
import ListingForm from './ListingForm';
import ServiceForm from './ServiceForm';
import MarketplaceFilters from './MarketplaceFilters';
import type { CollectionFilters } from './MarketplaceFilters';
const emptyFilters: CollectionFilters = { category: '', condition: '', min: '', max: '' };

const iconMap: Record<string, LucideIcon> = {
  sofa: Sofa,
  monitor: Monitor,
  baby: Baby,
  wrench: Wrench,
  utensils: Utensils,
  'heart-pulse': HeartPulse,
  'car-front': CarFront,
  'shopping-basket': ShoppingBasket,
};

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'browse', label: 'Buy & sell', icon: Package },
  { id: 'services', label: 'Services', icon: Wrench },
  { id: 'businesses', label: 'Businesses', icon: Store },
  { id: 'offers', label: 'Offers', icon: Tag },
];
const visibleNavItems = navItems.filter(item => item.id !== 'offers' || featureFlags.offers);
const searchScopes = (['search', 'browse', 'services', 'businesses', ...(featureFlags.offers ? ['offers'] : [])] as View[]);
const searchScopeLabels = ['All categories', 'Buy & sell', 'Services', 'Businesses', ...(featureFlags.offers ? ['Offers'] : [])];

function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = language === 'ar' ? 'مدينتي ديلز | بيع وشراء وخدمات وعروض قريبة منك' : 'Madinaty Deals · Your neighbourhood, better organized';
    document.querySelector('meta[name="description"]')?.setAttribute('content', language === 'ar' ? 'بيع واشتري واكتشف الخدمات والأنشطة والعروض القريبة منك في مدينتي.' : 'Madinaty Deals — trusted marketplace, local services and businesses for your neighbourhood.');
    try { localStorage.setItem(languageKey, language); } catch { /* Preference still works for this visit. */ }
  }, [language]);
  return <LanguageContext.Provider value={language}><AppContent onLanguageChange={setLanguage} /></LanguageContext.Provider>;
}

function AppContent({ onLanguageChange }: { onLanguageChange: (language: Language) => void }) {
  const { t, language } = useTranslation();
  const [view, setView] = useState<View>('home');
  const [query, setQuery] = useState('');
  const [zone, setZone] = useState('All zones');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<BrowseFilters['sort']>('recommended');
  const [results, setResults] = useState<SearchResult[]>(allResults);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { const saved = JSON.parse(localStorage.getItem('madinaty-favorites') ?? 'null'); if (Array.isArray(saved)) return new Set(saved.filter((id): id is string => typeof id === 'string')); } catch { /* Start with demo favourites if storage is unavailable. */ }
    return new Set(['listing-3']);
  });
  const [searchType, setSearchType] = useState<View>('search');
  useEffect(() => { try { localStorage.setItem('madinaty-favorites', JSON.stringify([...favorites])); } catch { /* Session state remains available. */ } }, [favorites]);
  const [modal, setModal] = useState<'post' | 'report' | 'verify' | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeResults = useMemo(() => {
    const scopedResults = view === 'saved' ? results.filter((result) => favorites.has(result.id)) : getViewResults(view, results);
    return filterResults(scopedResults, { query, zone, verifiedOnly, sort });
  }, [favorites, query, results, sort, verifiedOnly, view, zone]);

  const goTo = (nextView: View) => {
    if (nextView === 'offers' && !featureFlags.offers) return;
    setView(nextView);
    setQuery('');
    setMobileNavOpen(false);
    if (nextView === 'browse') track('search_performed', { source: 'navigation', type: 'listing' });
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setView(searchType);
    track('search_performed', { query: query || 'empty', zone });
  };

  const toggleFavorite = (result: SearchResult) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(result.id)) {
        next.delete(result.id);
      } else {
        next.add(result.id);
        track('favorite_added', { result_type: result.type });
      }
      return next;
    });
    setToast(favorites.has(result.id) ? 'Removed from saved' : 'Saved to your shortlist');
  };

  const contactResult = (result: SearchResult, method: 'whatsapp' | 'phone' | 'quote') => {
    const eventName = method === 'whatsapp' ? 'whatsapp_clicked' : method === 'phone' ? 'phone_clicked' : 'quote_requested';
    track(eventName, { result_type: result.type, result_id: result.id });
    if (method === 'whatsapp') {
      const number = result.type === 'business' ? result.whatsapp || result.phone : result.type === 'service' ? result.whatsapp || result.phone : '';
      if (number) {
        const message = language === 'ar' ? `السلام عليكم، وصلت لكم من مدينتي ديلز. أريد الطلب من ${result.title}.` : `Hello, I found ${result.title} on Madinaty Deals and would like to place an order.`;
        const normalized = number.replace(/[^\d]/g, '').replace(/^0/, '20');
        window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        return;
      }
      setToast(language === 'ar' ? 'هذا إعلان تجريبي — أضف رقم واتساب صاحب المحل أولًا' : 'Demo ad — add the shop owner’s WhatsApp number first');
      return;
    }
    setToast(method === 'phone' ? 'Call action recorded' : 'Quote request started');
  };

  const reportResult = (result: SearchResult) => {
    setSelectedResult(result);
    setModal('report');
  };

  const publishListing = (listing: Listing) => {
    setResults((current) => [listing, ...current]);
    setModal(null);
    setView('browse');
    track('listing_created', { category: listing.category });
    setToast('Listing added for this visit');
  };

  const publishService = (service: Service) => {
    setResults((current) => [service, ...current]);
    setModal(null);
    setView('services');
    track('service_created', { category: service.category });
    setToast('Service added for this visit');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label={t("Open navigation")} onClick={() => setMobileNavOpen(true)}><Menu size={21} /></button>
        <button className="brand" onClick={() => goTo('home')} aria-label={t("Madinaty Deals home")}>
          <MadinatyLogo />
          <span><b>{t("Madinaty")}</b><em>{t("Deals")}</em></span>
        </button>
        <form className="top-search" onSubmit={handleSearch} role="search">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search items, services or places")} aria-label={t("Search items, services or places")} />
          <select className="search-scope" aria-label={t('Search in')} value={searchType} onChange={event => setSearchType(event.target.value as View)}>{searchScopes.map((scope,index) => <option value={scope} key={scope}>{t(searchScopeLabels[index])}</option>)}</select>
          <select className="search-zone" aria-label={t('Search location')} value={zone} onChange={event => setZone(event.target.value)}>{zones.map(value => <option value={value} key={value}>{t(value)}</option>)}</select>
          <button className="search-submit" type="submit" aria-label={t('Search')}><Search size={18} /></button>
        </form>
        <div className="top-actions">
          <button className="language-switch" lang={language === 'ar' ? 'en' : 'ar'} onClick={() => onLanguageChange(language === 'ar' ? 'en' : 'ar')} aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>{language === 'ar' ? 'English' : 'العربية'}</button>
          <button className="header-saved" aria-label={t('Saved')} onClick={() => goTo('saved')}><Heart size={19} /><span>{t('Saved')}</span></button>
          <button className="button button-accent header-post" onClick={() => setModal('post')}><Plus size={18} />{t('Post ad')}</button>
          <button className="avatar-button" onClick={() => setModal('verify')} aria-label={t("Open profile")}><span>{t("SH")}</span></button>
        </div>
      </header>
      <div className="market-nav"><Navigation view={view} goTo={goTo} favoriteCount={favorites.size} /></div>

      <div className={`mobile-drawer ${mobileNavOpen ? 'is-open' : ''}`}>
        <button className="drawer-backdrop" aria-label={t("Close navigation")} onClick={() => setMobileNavOpen(false)} />
        <aside className="drawer-panel">
          <div className="drawer-head"><span className="brand-small"><MadinatyLogo compact /><b>{t("Madinaty ")}<em>{t("Deals")}</em></b></span><button className="icon-button" onClick={() => setMobileNavOpen(false)} aria-label={t("Close navigation")}><X size={20} /></button></div>
          <Navigation view={view} goTo={goTo} favoriteCount={favorites.size} />
        </aside>
      </div>

      <main className="main-content">
        {view === 'home' ? (
          <HomeView results={results} favorites={favorites} onFavorite={toggleFavorite} goTo={goTo} onPost={() => setModal('post')} onSearch={(value) => { setQuery(value); setView('search'); track('search_performed', { query: value }); }} />
        ) : view === 'admin' ? (
          <AdminView onBack={() => goTo('home')} />
        ) : (
          <BrowseView key={view}
            view={view}
            query={query}
            zone={zone}
            verifiedOnly={verifiedOnly}
            sort={sort}
            results={activeResults}
            favorites={favorites}
            onQueryChange={setQuery}
            onZoneChange={setZone}
            onVerifiedChange={(value) => { setVerifiedOnly(value); track('filter_applied', { filter: 'verified', value }); }}
            onSortChange={setSort}
            onTabChange={goTo}
            onFavorite={toggleFavorite}
            onContact={contactResult}
            onReport={reportResult}
            onPost={() => setModal('post')}
          />
        )}
        <CommunityFooter goTo={goTo} onPost={() => setModal('post')} />
      </main>

      <div className="mobile-bottom-nav">
        {visibleNavItems.slice(0, 4).map((item) => <NavItem key={item.id} item={item} active={view === item.id} onClick={() => goTo(item.id)} />)}
        <button className="mobile-post" onClick={() => setModal('post')} aria-label={t("Post a listing")}><Plus size={22} /></button>
      </div>

      {toast && <div className="toast" role="status"><CircleCheck size={18} /> {t(toast)}</div>}
      {modal === 'post' && <PostModal onClose={() => setModal(null)} onPublish={publishListing} onPublishService={publishService} />}
      {modal === 'report' && selectedResult && <ReportModal result={selectedResult} onClose={() => setModal(null)} onSubmit={() => { setModal(null); track('report_submitted', { result_type: selectedResult.type }); setToast('Thanks — our trust team will take a look'); }} />}
      {modal === 'verify' && <VerifyModal onClose={() => setModal(null)} onSubmit={() => { setModal(null); track('verification_submitted'); setToast('Verification submitted for manual review'); }} />}
    </div>
  );
}

function Navigation({ view, goTo, favoriteCount }: { view: View; goTo: (view: View) => void; favoriteCount: number }) {
  const { t } = useTranslation();
  return <nav className="nav-list" aria-label={t("Main navigation")}>
    {visibleNavItems.map((item) => <NavItem key={item.id} item={item} active={view === item.id} onClick={() => goTo(item.id)} />)}
    <NavItem item={{ id: 'saved', label: 'Saved', icon: Bookmark }} active={view === 'saved'} onClick={() => goTo('saved')} count={favoriteCount} />
    <div className="nav-divider" />
    <span className="section-label nav-section-label">{t("For businesses")}</span>
    <NavItem item={{ id: 'admin', label: 'Trust desk', icon: ShieldCheck }} active={view === 'admin'} onClick={() => goTo('admin')} />
  </nav>;
}

function MadinatyLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 64 64" role="presentation">
      <path className="logo-m-fill" d="M13 46V18h8.6L32 32.7 42.4 18H51v28h-8V30.9L32 46 21 30.9V46z" />
      <path className="logo-m-cut" d="M32 35.2 37.4 28 40 31.7 32 42.2 24 31.7l2.6-3.7z" />
      <path className="logo-accent-bar" d="M22 51h20" />
    </svg>
  </span>;
}

function NavItem({ item, active, onClick, count }: { item: { id: View; label: string; icon: LucideIcon }; active: boolean; onClick: () => void; count?: number }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} /><span>{t(item.label)}</span>{count ? <small>{count}</small> : null}</button>;
}

function HomeView({ goTo, onPost, onSearch, results, favorites, onFavorite }: { goTo: (view: View) => void; onPost: () => void; onSearch: (value: string) => void; results: SearchResult[]; favorites: Set<string>; onFavorite: (result: SearchResult) => void }) {
  const { t } = useTranslation();
  const [homeSearch, setHomeSearch] = useState('');
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); onSearch(homeSearch); };
  return <div className="home-view">
    <section className="hero-grid">
      <div className="hero-copy">
        <span className="eyebrow"><span className="eyebrow-dot" /> {t(" MADINATY, EGYPT")}</span>
        <h1>{t("Buy, sell and discover in Madinaty")}</h1>
        <p>{t("Find great things, trusted people and the places you’ll want to come back to — all around you.")}</p>
        <div className="hero-actions"><button className="button button-warm" onClick={onPost}>{t("Sell something")}<Plus size={17} /></button><button className="button button-outline" onClick={() => goTo('browse')}>{t("Browse items")}<ArrowRight size={17} /></button></div>
        <form className="hero-search" onSubmit={handleSubmit} role="search">
          <Search size={19} aria-hidden="true" /><input value={homeSearch} onChange={(event) => setHomeSearch(event.target.value)} placeholder={t("What are you looking for?")} aria-label={t("Search Madinaty Deals")} /><button type="submit">{t("Search ")}<ArrowRight size={17} /></button>
        </form>
        <div className="popular-searches"><span>{t("Popular:")}</span><button onClick={() => onSearch('AC maintenance')}>{t("AC maintenance")}</button><button onClick={() => onSearch('sofa')}>{t("Sofas")}</button><button onClick={() => onSearch('breakfast')}>{t("Breakfast")}</button></div>
      </div>

    </section>

    <section className="trust-strip">
      <div className="trust-strip-title"><span className="trust-icon"><ShieldCheck size={18} /></span><span><b>{t("Made for a more trusted Madinaty")}</b><small>{t("Every profile, listing and business has a little more context.")}</small></span></div>
      <div className="trust-points"><span><BadgeCheck size={16} /> {t(" Verified residents")}</span><span><Star size={16} /> {t(" Community reviews")}</span><span><Flag size={16} /> {t(" Human moderation")}</span></div>
    </section>

    <section className="section-block category-section">
      <SectionHeading eyebrow="BROWSE THE NEIGHBOURHOOD" title="What brings you here?" action="See everything" onAction={() => goTo('browse')} />
      <div className="category-grid">{categories.map((category) => { const Icon = iconMap[category.icon] ?? Grid2X2; return <button key={category.label} className="category-card" onClick={() => { const nextView = category.icon === 'wrench' ? 'services' : ['utensils', 'heart-pulse'].includes(category.icon) ? 'businesses' : 'browse'; if (nextView === 'browse') onSearch(category.label); else goTo(nextView); }}><span className={`category-icon ${category.icon}`}><Icon size={21} /></span><span><b>{t(category.label)}</b><small>{t('Explore')} <ArrowRight size={12} /></small></span><ChevronRight size={16} /></button>; })}</div>
    </section>

    <section className="section-block featured-section">
      <SectionHeading eyebrow="FRESH FROM YOUR COMMUNITY" title="Fresh finds near you" action="View marketplace" onAction={() => goTo('browse')} />
      <div className="card-grid home-listings">{results.filter(result => result.type === 'listing').slice(0, 8).map((result) => <ResultCard key={result.id} result={result} compact favorite={favorites.has(result.id)} onFavorite={onFavorite} />)}</div>
    </section>

    <section className={`split-section ${featureFlags.offers ? '' : 'single-split'}`}>
      <button className="split-card split-card-dark" onClick={() => goTo('services')}><span className="eyebrow eyebrow-light">{t("NEED A HAND?")}</span><h2>{t("Trusted help,")}<br /><i>{t("close to home.")}</i></h2><p>{t("Find providers your neighbours have actually used.")}</p><span className="text-link light">{t("Explore services ")}<ArrowRight size={15} /></span><span className="split-decoration"><Wrench size={70} /></span></button>
      {featureFlags.offers && <button className="split-card split-card-light" onClick={() => goTo('offers')}><span className="eyebrow">{t("LOCAL PERKS")}</span><h2>{t("Good places.")}<br /><i>{t("Better offers.")}</i></h2><p>{t("Discover what’s happening nearby this week.")}</p><span className="text-link">{t("See local offers ")}<ArrowRight size={15} /></span><span className="offer-stamp">{t("15%")}<small>{t("OFF")}</small></span></button>}
    </section>

    <CommunityGuide />
    <section className="bottom-cta"><div><span className="eyebrow">{t("HAVE SOMETHING TO SHARE?")}</span><h2>{t("Put it in front of")}<br /><i>{t("your neighbours.")}</i></h2></div><button className="button button-dark" onClick={onPost}><Plus size={18} /> {t(" Post a free listing")}</button></section>
  </div>;
}

function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction: () => void }) {
  const { t } = useTranslation();
  return <div className="section-heading"><div><span className="eyebrow">{t(eyebrow)}</span><h2>{t(title)}</h2></div><button className="text-link" onClick={onAction}>{t(action)} <ArrowRight size={15} /></button></div>;
}

function BrowseView({ view, query, zone, verifiedOnly, sort, results, favorites, onQueryChange, onZoneChange, onVerifiedChange, onSortChange, onTabChange, onFavorite, onContact, onReport, onPost }: {
  view: View; query: string; zone: string; verifiedOnly: boolean; sort: BrowseFilters['sort']; results: SearchResult[]; favorites: Set<string>;
  onQueryChange: (value: string) => void; onZoneChange: (value: string) => void; onVerifiedChange: (value: boolean) => void; onSortChange: (value: BrowseFilters['sort']) => void; onTabChange: (view: View) => void; onFavorite: (result: SearchResult) => void; onContact: (result: SearchResult, method: 'whatsapp' | 'phone' | 'quote') => void; onReport: (result: SearchResult) => void; onPost: () => void;
}) {
  const { t } = useTranslation();
  const [collection, setCollection] = useState<CollectionFilters>(emptyFilters);
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const displayed = filterResults(results, { query: '', zone: 'All zones', verifiedOnly: false, sort, category: collection.category, condition: collection.condition, minPrice: collection.min === '' ? undefined : Number(collection.min), maxPrice: collection.max === '' ? undefined : Number(collection.max) });
  const heading = view === 'search' ? 'Search results' : view === 'saved' ? 'Your saved shortlist' : view === 'services' ? 'Trusted services nearby' : view === 'businesses' ? 'Good places around you' : view === 'offers' ? 'Offers worth stepping out for' : 'Find your next good thing';
  const subheading = view === 'saved' ? 'The things you want to come back to.' : view === 'services' ? 'Providers with context, reviews and a way to reach them.' : view === 'businesses' ? 'Local businesses with hours, reviews and useful details.' : view === 'offers' ? 'Time-limited deals from businesses in Madinaty.' : 'Buy and sell with people in the neighbourhood.';
  const tabs: { id: View; label: string }[] = [{ id: 'browse', label: 'All items' }, { id: 'services', label: 'Services' }, { id: 'businesses', label: 'Businesses' }, ...(featureFlags.offers ? [{ id: 'offers' as View, label: 'Offers' }] : [])];
  return <div className="browse-view">
    <div className="page-intro"><div><span className="eyebrow">{t(view === 'saved' ? 'YOUR SPACE' : 'DISCOVER IN MADINATY')}</span><h1>{t(heading)}</h1><p>{t(subheading)}</p></div><button className="button button-accent" onClick={onPost}><Plus size={17} /> {t(" Post a listing")}</button></div>
    <div className="browse-tabs" role="tablist" aria-label={t("Discovery type")}>{tabs.map((tab) => <button key={tab.id} className={view === tab.id || (view === 'browse' && tab.id === 'browse') ? 'active' : ''} onClick={() => onTabChange(tab.id)} role="tab" aria-selected={view === tab.id}>{t(tab.label)}</button>)}{view === 'saved' && <span className="saved-tab-label"><Bookmark size={15} fill="currentColor" /> {t(" Saved only")}</span>}</div>
    <div className="browse-toolbar"><div className="inline-search"><Search size={17} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("Search this collection")} aria-label={t("Search this collection")} /></div><div className="filter-actions"><label className="select-wrap"><MapPin size={15} /><select value={zone} onChange={(event) => onZoneChange(event.target.value)} aria-label={t("Filter by zone")}>{zones.map((option) => <option key={option} value={option}>{t(option)}</option>)}</select><ChevronDown size={14} /></label><label className={`verified-toggle ${verifiedOnly ? 'checked' : ''}`}><input type="checkbox" checked={verifiedOnly} onChange={(event) => onVerifiedChange(event.target.checked)} /><BadgeCheck size={15} /> {t(" Verified only")}</label><label className="select-wrap sort-select"><SlidersHorizontal size={15} /><select value={sort} onChange={(event) => onSortChange(event.target.value as BrowseFilters['sort'])} aria-label={t("Sort results")}><option value="recommended">{t("Recommended")}</option><option value="newest">{t("Newest first")}</option><option value="price-low">{t("Price: low to high")}</option><option value="price-high">{t("Price: high to low")}</option></select><ChevronDown size={14} /></label></div></div>
    <div className="results-meta"><span><b>{displayed.length}</b> {t(displayed.length === 1 ? 'result' : 'results')} <span className="meta-dot" /> {t(zone)}</span><div className="results-controls"><button className="filter-button" aria-expanded={filtersOpen} aria-controls="collection-filters" onClick={() => setFiltersOpen(!filtersOpen)}><ListFilter size={15} />{t('Refine results')}</button><div className="layout-switch" aria-label={t('Results layout')}><button aria-label={t('List view')} aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><ListFilter size={16} /></button><button aria-label={t('Grid view')} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Grid2X2 size={16} /></button></div></div></div>
    <div className="market-results-layout"><div id="collection-filters" className={filtersOpen ? 'collection-filters is-open' : 'collection-filters'}><MarketplaceFilters value={collection} onChange={setCollection} results={results} showPrice={['browse','search','saved'].includes(view)} /></div><div className="results-column">
    {displayed.length ? <div className={`card-grid results-grid ${layout === 'list' ? 'list-layout' : ''}`}>{displayed.map((result) => <ResultCard key={result.id} result={result} favorite={favorites.has(result.id)} onFavorite={onFavorite} onContact={onContact} onReport={onReport} />)}</div> : <EmptyState view={view} query={query} onReset={() => { setCollection(emptyFilters); onVerifiedChange(false); onQueryChange(''); onZoneChange('All zones'); }} />}
    </div></div>
  </div>;
}

function ResultCard({ result, compact = false, favorite = false, onFavorite, onContact, onReport }: { result: SearchResult; compact?: boolean; favorite?: boolean; onFavorite?: (result: SearchResult) => void; onContact?: (result: SearchResult, method: 'whatsapp' | 'phone' | 'quote') => void; onReport?: (result: SearchResult) => void }) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isListing = result.type === 'listing';
  const isService = result.type === 'service';
  const isBusiness = result.type === 'business';
  const isOffer = result.type === 'offer';
  const isPoultryDemo = result.id === 'business-poultry-demo';
  return <article className={`result-card ${compact ? 'compact-card' : ''} type-${result.type}`}>
    <div className={`result-image image-${result.image} art-${result.accent}`}><ResultArt result={result} /><span className="result-type">{isOffer ? <Zap size={11} fill="currentColor" /> : isBusiness ? <Store size={11} /> : isService ? <Wrench size={11} /> : <Package size={11} />} {t(isOffer ? 'Local offer' : isBusiness ? 'Business' : isService ? 'Service' : 'For sale')}</span>{isOffer && result.featured ? <span className="featured-label">{t("Featured")}</span> : null}</div>
    <div className="result-body">
      <div className="result-topline"><span>{t(result.zone)} <span className="meta-dot" /> {t(result.createdAt)}</span>{onFavorite && <button className={`save-button ${favorite ? 'saved' : ''}`} onClick={() => onFavorite(result)} aria-label={t(favorite ? `Remove ${result.title} from saved` : `Save ${result.title}`)}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button>}</div>
      <h3><button className="listing-title" onClick={() => setDetailsOpen(true)}>{t(result.title)}</button></h3><p className="result-subtitle">{t(result.subtitle)}</p>
      {isListing && <div className="result-detail"><strong>{t(formatPrice(result.price))}</strong><span>{t(result.condition)}</span></div>}
      {isService && <div className="result-detail"><strong><Star size={14} fill="currentColor" /> {result.rating}</strong><span>{result.reviewCount} {t(" reviews")}</span></div>}
      {isBusiness && <div className="result-detail"><strong><Star size={14} fill="currentColor" /> {result.rating}</strong><span>{t(result.hours)}</span></div>}
      {isOffer && <div className="result-detail"><strong className="discount-text">{t(result.discount)}</strong><span>{t(result.validUntil)}</span></div>}
      {!compact && <div className="result-footer">{isListing ? <span className="seller-line">{t(result.seller)}{result.sellerVerified && <BadgeCheck size={14} />} </span> : isOffer ? <span className="seller-line"><Store size={13} /> {t(result.business)}</span> : <span className="seller-line">{result.verified && <BadgeCheck size={14} />} {t(isPoultryDemo ? 'Demo profile' : ' Trusted profile')}</span>}<div className="card-actions">{(isListing || isService || isBusiness) && onContact && <button className="small-action primary-action" onClick={() => onContact(result, isService ? 'quote' : 'whatsapp')}>{t(isService ? 'Request quote' : isPoultryDemo ? 'Order on WhatsApp' : 'Contact')} <ArrowRight size={14} /></button>}{isOffer && <button className="small-action primary-action" onClick={() => onContact?.(result, 'quote')}>{t("View offer ")}<ArrowRight size={14} /></button>}<button className="report-action" onClick={() => onReport?.(result)} aria-label={t(`Report ${result.title}`)}><Flag size={14} /></button></div></div>}
    </div>
    {detailsOpen && <ModalShell title={result.title} eyebrow={result.category} onClose={() => setDetailsOpen(false)}><div className="ad-details">
      <p dir="auto">{t(result.subtitle)}</p>
      {isListing && <strong>{t(formatPrice(result.price))}</strong>}
      <p><MapPin size={15} />{t(result.zone)} · {t(result.createdAt)}</p>
      {isListing && <p>{t('Condition')}: {t(result.condition)} · {t(result.seller)}</p>}
      <aside><ShieldCheck size={18} /><p>{t(getSafetyMessage(result))}</p></aside>
      <p className="modal-intro">{t('Demo content: contact and transactions are not connected yet.')}</p>
      {onFavorite && <button className="button button-outline" onClick={() => onFavorite(result)}><Heart size={16} fill={favorite ? 'currentColor' : 'none'} />{t(favorite ? 'Remove from saved' : 'Save listing')}</button>}
    </div></ModalShell>}
  </article>;
}

function ResultArt({ result }: { result: SearchResult }) {
  const { t } = useTranslation();
  const letter = result.type === 'listing' ? result.title.charAt(0) : result.type === 'service' ? '↗' : result.type === 'business' ? '✦' : '%';
  return <><span className="art-letter">{t(letter)}</span><span className="art-line art-line-one" /><span className="art-line art-line-two" />{result.type === 'listing' && <span className="art-object">{t(result.image === 'tv' ? '▣' : result.image === 'chair' ? '⌒' : result.image === 'scooter' ? '◒' : '▰')}</span>}{result.type === 'service' && <span className="art-service-mark"><Wrench size={38} /></span>}{result.type === 'business' && <span className="art-business-mark"><Store size={38} /></span>}{result.type === 'offer' && <span className="art-offer-mark"><Tag size={36} /></span>}</>;
}

function getSafetyMessage(result: SearchResult): string {
  if (result.type === 'listing' && result.category === 'Cars & motorcycles') return 'For vehicles: inspect with a trusted mechanic, verify ownership and registration documents, and do not send a deposit before the details are confirmed.';
  if (result.type === 'listing') return 'Choose a busy public place. Inspect the item before paying, and never share an OTP or send a deposit to an unknown seller.';
  if (result.type === 'service') return 'Agree on the scope, price and timing in writing. Check reviews and credentials where relevant, avoid full payment upfront to an unknown provider, and never share an OTP or password.';
  if (result.type === 'business') return 'Confirm the business name, hours, price and delivery details through its listed contact. Be careful with unexpected payment links and never share an OTP.';
  return 'Check the offer terms, expiry date, redemption conditions and final price before paying. Use the business’s listed contact and avoid suspicious payment links.';
}

function EmptyState({ view, query, onReset }: { view: View; query: string; onReset: () => void }) {
  const { t } = useTranslation();
  return <div className="empty-state"><span className="empty-icon"><Search size={23} /></span><h2>{t("No matches yet")}</h2><p>{t(query ? `We couldn't find anything for “${query}”.` : `There are no saved ${view === 'saved' ? 'items' : 'results'} here yet.`)}</p><button className="button button-outline" onClick={onReset}>{t("Clear filters")}</button></div>;
}

function AdminView({ onBack }: { onBack: () => void }) {
  const { t, language } = useTranslation();
  const [, setRefresh] = useState(0);
  const events = getTrackedEvents();
  const count = (names: string[]) => events.filter(event => names.includes(event.name)).length;
  const totalListings = listingsCount + count(['listing_created']);
  const totalServices = servicesCount + count(['service_created']);
  const contacts = count(['whatsapp_clicked', 'phone_clicked', 'quote_requested']);
  const searches = count(['search_performed']);
  const saves = count(['favorite_added']);
  const reports = count(['report_submitted']);
  const recentEvents = [...events].reverse().slice(0, 8);
  const eventName = (name: string) => ({ search_performed: 'Search', favorite_added: 'Saved item', whatsapp_clicked: 'WhatsApp contact', phone_clicked: 'Phone contact', quote_requested: 'Quote request', listing_created: 'New listing', service_created: 'New service', report_submitted: 'Report submitted' }[name] ?? name);
  const eventIcon = (name: string) => name === 'search_performed' ? <Eye size={15} /> : name.includes('contact') || name === 'quote_requested' ? <MessageCircle size={15} /> : name.includes('created') ? <Plus size={15} /> : <Activity size={15} />;
  return <div className="admin-view operations-dashboard"><div className="page-intro"><div><span className="eyebrow">{t('OWNER DASHBOARD · OPERATIONS')}</span><h1>{t('Understand what is happening.')}</h1><p>{t('Track marketplace activity, demand and the actions that need your attention.')}</p></div><div className="dashboard-actions"><span className="demo-status"><span /> {t('Demo analytics')}</span><button className="button button-outline" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} /> {t('Refresh')}</button><button className="button button-dark" onClick={onBack}>{t('Back to app')}</button></div></div>
    <div className="admin-stats dashboard-stats"><div><span className="admin-stat-icon blue"><BarChart3 size={17} /></span><span><b>{totalListings}</b><small>{t('Active listings')}</small></span></div><div><span className="admin-stat-icon mint"><Wrench size={17} /></span><span><b>{totalServices}</b><small>{t('Services listed')}</small></span></div><div><span className="admin-stat-icon amber"><MessageCircle size={17} /></span><span><b>{contacts}</b><small>{t('Contact actions')}</small></span></div><div><span className="admin-stat-icon plum"><Eye size={17} /></span><span><b>{searches}</b><small>{t('Searches')}</small></span></div><div><span className="admin-stat-icon blue"><Bookmark size={17} /></span><span><b>{saves}</b><small>{t('Saved items')}</small></span></div><div><span className="admin-stat-icon amber"><Flag size={17} /></span><span><b>{reports}</b><small>{t('Reports received')}</small></span></div></div>
    <div className="dashboard-grid"><section className="admin-panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">{t('LIVE SESSION')}</span><h2>{t('Recent activity')}</h2></div><span className="live-pill light-live"><span /> {t('Tracking')}</span></div>{recentEvents.length ? <div className="activity-list">{recentEvents.map((event, index) => <div className="activity-row" key={`${event.occurredAt}-${index}`}><span className="activity-icon">{eventIcon(event.name)}</span><span><b>{t(eventName(event.name))}</b><small>{new Date(event.occurredAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-EG', { hour: 'numeric', minute: '2-digit' })}{event.properties?.result_type ? ` · ${event.properties.result_type}` : ''}</small></span><strong>{event.properties?.category ? String(event.properties.category) : ''}</strong></div>)}</div> : <div className="dashboard-empty"><Activity size={21} /><p>{t('Activity will appear here as people browse, save, contact and post.')}</p></div>}</section><section className="admin-panel channel-panel"><div className="panel-heading"><div><span className="eyebrow">{t('DEMAND SIGNALS')}</span><h2>{t('What people do')}</h2></div><BarChart3 size={18} className="panel-icon" /></div><div className="channel-row"><span>{t('Searches')}</span><div className="mini-track"><i style={{ width: `${Math.min(100, searches * 18 + 12)}%` }} /></div><b>{searches}</b></div><div className="channel-row"><span>{t('Contact actions')}</span><div className="mini-track"><i style={{ width: `${Math.min(100, contacts * 20 + 8)}%` }} /></div><b>{contacts}</b></div><div className="channel-row"><span>{t('Saved items')}</span><div className="mini-track"><i style={{ width: `${Math.min(100, saves * 20 + 8)}%` }} /></div><b>{saves}</b></div><div className="channel-insight"><TrendingUp size={16} /><span><b>{t('Next insight')}</b><small>{t('Watch which service categories get searches but few contact actions.')}</small></span></div></section></div>
    <div className="dashboard-note"><ShieldCheck size={18} /><p><b>{t('Analytics status')}</b><br />{t('This demo records activity in the current browser session only. Production analytics should be stored server-side with consent, role-based access and privacy controls.')}</p></div><TrustDeskView onBack={onBack} />
  </div>;
}

const listingsCount = 5;
const servicesCount = 4;

function TrustDeskView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return <div className="admin-view"><div className="page-intro"><div><span className="eyebrow">{t("OPERATIONS · TRUST DESK")}</span><h1>{t("Keep Madinaty useful.")}</h1><p>{t("A focused queue for the people and content that need a human decision.")}</p></div><button className="button button-outline" onClick={onBack}>{t("Back to app")}</button></div><div className="admin-stats"><div><span className="admin-stat-icon amber"><Flag size={17} /></span><span><b>{t("12")}</b><small>{t("Open reports")}</small></span></div><div><span className="admin-stat-icon blue"><ShieldCheck size={17} /></span><span><b>{t("8")}</b><small>{t("Verification reviews")}</small></span></div><div><span className="admin-stat-icon mint"><Building2 size={17} /></span><span><b>{t("4")}</b><small>{t("Business claims")}</small></span></div><div><span className="admin-stat-icon plum"><TrendingUp size={17} /></span><span><b>{t("94%")}</b><small>{t("Within 24h SLA")}</small></span></div></div><div className="admin-grid"><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">{t("NEEDS ATTENTION")}</span><h2>{t("Review queue")}</h2></div><button className="text-link">{t("View all ")}<ArrowRight size={15} /></button></div>{[['Verification request', 'Resident in B1 · submitted recently', 'Review'], ['Listing reported', 'Flagged listing · reports pending review', 'Open report'], ['Business claim', 'Local business · details to configure', 'Review']].map(([title, copy, action]) => <div className="queue-row" key={title}><span className="queue-avatar"><ShieldCheck size={16} /></span><span><b>{t(title)}</b><small>{t(copy)}</small></span><button className="small-action">{t(action)} <ChevronRight size={14} /></button></div>)}</section><section className="admin-panel health-panel"><div className="panel-heading"><div><span className="eyebrow">{t("TODAY, 09 SEP")}</span><h2>{t("Marketplace health")}</h2></div><span className="live-pill"><span /> {t(" Live")}</span></div><div className="health-number"><b>{t("148")}</b><span>{t("meaningful contacts")}<br />{t("this week")}</span></div><div className="progress-track"><span style={{ width: '72%' }} /></div><div className="health-foot"><span><strong>{t("+18%")}</strong> {t(" vs last week")}</span><span>{t("Target 200")}</span></div></section></div><div className="admin-note"><ShieldCheck size={18} /><p><b>{t("Privacy reminder")}</b><br />{t("Verification evidence is private by design. Review the result, never expose source documents or apartment details.")}</p><button aria-label={t("Dismiss reminder")}><X size={16} /></button></div></div>;
}

function ModalShell({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  const { t } = useTranslation();
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">{t(eyebrow)}</span><h2 id="modal-title">{t(title)}</h2></div><button className="icon-button" onClick={onClose} aria-label={t("Close dialog")}><X size={20} /></button></div>{children}</div></div>;
}

function PostModal({ onClose, onPublish, onPublishService }: { onClose: () => void; onPublish: (listing: Listing) => void; onPublishService: (service: Service) => void }) {
  const { t } = useTranslation();
  const [postType, setPostType] = useState<'choose' | 'listing' | 'service'>('choose');
  return <ModalShell title={postType === 'choose' ? 'Post something' : postType === 'service' ? 'Offer a service' : 'Post a free listing'} eyebrow="SHARE WITH YOUR NEIGHBOURS" onClose={onClose}>
    {postType === 'choose' ? <div className="post-choice-grid">
      <button className="post-choice" onClick={() => setPostType('listing')}><span className="post-choice-icon"><Package size={23} /></span><span><b>{t('Sell an item')}</b><small>{t('Furniture, electronics and more')}</small></span><ArrowRight size={17} /></button>
      <button className="post-choice" onClick={() => setPostType('service')}><span className="post-choice-icon service-choice"><Wrench size={23} /></span><span><b>{t('Offer a service')}</b><small>{t('Tutoring, repairs and local help')}</small></span><ArrowRight size={17} /></button>
      <button className="post-choice disabled-choice" disabled><span className="post-choice-icon business-choice"><Store size={23} /></span><span><b>{t('Add a business')}</b><small>{t('Business profiles coming next')}</small></span><ArrowRight size={17} /></button>
    </div> : postType === 'service' ? <><button className="back-to-choices" type="button" onClick={() => setPostType('choose')}><ArrowRight size={15} /> {t('Back to post types')}</button><ServiceForm onPublish={onPublishService} /></> : <><button className="back-to-choices" type="button" onClick={() => setPostType('choose')}><ArrowRight size={15} /> {t('Back to post types')}</button><ListingForm onPublish={onPublish} /></>}
  </ModalShell>;
}

function ReportModal({ result, onClose, onSubmit }: { result: SearchResult; onClose: () => void; onSubmit: () => void }) {
  const { t } = useTranslation();
  const reasons = ['Scam or fraud', 'Prohibited item or service', 'Duplicate or spam', 'Misleading information', 'Wrong category', 'Something else'];
  const [reason, setReason] = useState(reasons[0]);
  return <ModalShell title="Report this content" eyebrow="HELP KEEP IT TRUSTED" onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><p className="modal-intro">{t("You’re reporting ")}<b>{t(result.title)}</b>{t(". Reports are private and reviewed by the trust team.")}</p><label>{t("What’s wrong?")}<select value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label><label>{t("Anything else? ")}<textarea rows={3} placeholder={t("Optional context for our review team")} /></label><div className="modal-foot"><span className="privacy-note"><Flag size={15} /> {t(" Your report stays private")}</span><button className="button button-dark" type="submit">{t("Submit report ")}<ArrowRight size={16} /></button></div></form></ModalShell>;
}

function VerifyModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const { t } = useTranslation();
  return <ModalShell title="Become a verified resident" eyebrow="A LITTLE MORE TRUST" onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="verification-callout"><span className="trust-icon"><ShieldCheck size={20} /></span><span><b>{t("Verified Madinaty Resident")}</b><small>{t("Shown on your profile and listings once approved.")}</small></span></div><p className="modal-intro">{t("We’ll review the minimum information needed to confirm that you live in Madinaty. We never show verification evidence publicly.")}</p><label>{t("Phone number")}<input type="tel" placeholder={t("+20 1X XXX XXXX")} required /></label><label>{t("Preferred broad zone")}<select defaultValue={zones[1]}>{zones.slice(1).map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label><div className="upload-placeholder"><ShieldCheck size={19} /><span><b>{t("Verification evidence")}</b><small>{t("Manual review · source documents stay private")}</small></span><ChevronRight size={17} /></div><div className="modal-foot"><span className="privacy-note"><LockIcon /> {t(" Privacy first")}</span><button className="button button-accent" type="submit">{t("Submit for review ")}<ArrowRight size={16} /></button></div></form></ModalShell>;
}

function LockIcon() { return <ShieldCheck size={15} />; }

export default App;
