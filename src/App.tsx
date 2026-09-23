import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Sofa, Monitor, Baby, Utensils, HeartPulse, ArrowLeft, ArrowRight, ArrowUp, BadgeCheck, Bookmark, Building2, ChevronDown, ChevronRight, CircleCheck,
  Flag, Grid2X2, Heart, Home, ListFilter, MapPin, Menu, Package, CarFront, ShoppingBasket,
  Plus, Search, ShieldCheck, SlidersHorizontal, Star, Store, Tag, GraduationCap, Share2, CircleHelp,
  Wrench, X, Zap, BarChart3, Eye, MessageCircle, Sparkles, Bike, UserRound, PawPrint,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { allResults, categories, formatPrice, zones } from './data';
import { track } from './analytics';
import { filterResults, getViewResults, type BrowseFilters } from './domain';
import type { Listing, SearchResult, Service, View } from './types';
import { initialLanguage, LanguageContext, languageKey, useTranslation } from './i18n';
import type { Language } from './i18n';
import { featureFlags } from './featureFlags';
import { checkContentVisible, getComments, getPublishedSubmissions, getPublicConfig, postComment, recordView, submitReport, translateText, type PublicComment, type PublicSubmission } from './api';
import { CommunityGuide, CommunityFooter } from './CommunityGuide';
import ListingForm from './ListingForm';
import ServiceForm from './ServiceForm';
import MarketplaceFilters from './MarketplaceFilters';
import type { CollectionFilters } from './MarketplaceFilters';
import RevenueDesk from './RevenueDesk';
import AdminUsers from './AdminUsers';
import AdminReviewQueue from './AdminReviewQueue';
import AdminReports from './AdminReports';
import AdminOperations from './AdminOperations';
import AdminModeration from './AdminModeration';
import EliteAdSpace from './EliteAdSpace';
import { splitCategories, businessOnlyCategories } from './categoryPolicy';
import AuthForm from './AuthForm';
import VerificationForm from './VerificationForm';
import { getSession, signOut, type Account } from './api';
const emptyFilters: CollectionFilters = { category: '', advertiserType: '', condition: '', furnishing: '', vehicleType: '', min: '', max: '', educationLevel: '', subject: '', groceryActivity: '', homeServiceType: '', housekeepingType: '', fitnessProviderType: '', petBusinessType: '' };

const getViewCount = (result: SearchResult) => result.viewCount ?? ({ listing: 64, service: 38, business: 91, offer: 47 }[result.type] + result.id.length * 3);

const getPublicAdId = (result: SearchResult) => result.publicAdId || `MD-${result.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
const getAdLink = (result: SearchResult) => { const url = new URL(window.location.href); url.searchParams.set('ad', result.id); return url.toString(); };
const hasArabicText = (value: string) => /[\u0600-\u06FF]/.test(value);

const iconMap: Record<string, LucideIcon> = {
  sofa: Sofa,
  monitor: Monitor,
  baby: Baby,
  wrench: Wrench,
  utensils: Utensils,
  'heart-pulse': HeartPulse,
  'car-front': CarFront,
  building: Building2,
  sparkles: Sparkles,
  bike: Bike,
  'shopping-basket': ShoppingBasket,
  'graduation-cap': GraduationCap,
  'circle-help': CircleHelp,
  tag: Tag,
  'paw-print': PawPrint,
};

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'browse', label: 'Buy & sell', icon: Package },
  { id: 'services', label: 'Services', icon: Wrench },
  { id: 'businesses', label: 'Businesses', icon: Store },
];
const searchScopes = (['search', 'browse', 'services', 'businesses', ...(featureFlags.offers ? ['offers'] : [])] as View[]);
const searchScopeLabels = ['All categories', 'Buy & sell', 'Services', 'Businesses', ...(featureFlags.offers ? ['Offers'] : [])];

function publicSubmissionResult(record: PublicSubmission): SearchResult | null {
  const payload = record.payload;
  if (record.kind === 'listing') {
    if (typeof payload.title !== 'string' || typeof payload.subtitle !== 'string' || typeof payload.category !== 'string' || typeof payload.zone !== 'string') return null;
    return { id: `submission-${record.id}`, publicAdId: `MD-${record.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`, type: 'listing', title: payload.title, subtitle: payload.subtitle, category: payload.category, zone: payload.zone, createdAt: 'Just now', image: 'new', accent: 'lime', imageUrl: record.uploadIds[0] ? `/api/public-uploads/${record.uploadIds[0]}` : undefined, price: typeof payload.price === 'number' ? payload.price : null, condition: (typeof payload.condition === 'string' ? payload.condition : 'Good') as Listing['condition'], seller: record.seller, sellerVerified: record.verified, status: 'active', ...(payload.advertiserType === 'small_business' || payload.advertiserType === 'individual' ? { advertiserType: payload.advertiserType } : {}), ...(typeof payload.furnishing === 'string' ? { furnishing: payload.furnishing as Listing['furnishing'] } : {}), ...(typeof payload.vehicleType === 'string' && ['Cars', 'Motorcycles'].includes(payload.vehicleType) ? { vehicleType: payload.vehicleType as Listing['vehicleType'] } : {}) };
  }
  if (typeof payload.title !== 'string' || typeof payload.subtitle !== 'string' || typeof payload.category !== 'string' || typeof payload.zone !== 'string') return null;
  return { id: `submission-${record.id}`, publicAdId: `MD-${record.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`, type: 'service', title: payload.title, subtitle: payload.subtitle, category: payload.category, zone: payload.zone, createdAt: 'Just now', image: 'new-service', accent: 'mint', imageUrl: record.uploadIds[0] ? `/api/public-uploads/${record.uploadIds[0]}` : undefined, rating: 0, reviewCount: 0, serviceArea: typeof payload.serviceArea === 'string' ? payload.serviceArea : payload.zone, phone: '', whatsapp: typeof payload.whatsapp === 'string' ? payload.whatsapp : undefined, response: 'Response time to be configured', verified: record.verified, ...(payload.advertiserType === 'small_business' || payload.advertiserType === 'individual' ? { advertiserType: payload.advertiserType } : {}), pricing: typeof payload.pricing === 'string' ? payload.pricing : undefined, availability: typeof payload.availability === 'string' ? payload.availability : undefined };
}

function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = language === 'ar' ? 'مدينتي ديلز | بيع وشراء وخدمات وعروض قريبة منك' : 'Madinaty Deals · Your neighbourhood, better organized';
    const description = language === 'ar' ? 'بيع واشتري واكتشف الخدمات والأنشطة والعروض القريبة منك في مدينتي، القاهرة، مصر.' : 'Madinaty Deals — buy, sell and discover trusted local services and businesses in Madinaty, Cairo, Egypt.';
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', language === 'ar' ? 'ar_EG' : 'en_US');
    document.querySelector('meta[property="og:locale:alternate"]')?.setAttribute('content', language === 'ar' ? 'en_US' : 'ar_EG');
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://madinatydeals.com/?lang=' + language);
    try { localStorage.setItem(languageKey, language); } catch { /* Preference still works for this visit. */ }
  }, [language]);
  return <LanguageContext.Provider value={language}><AppContent onLanguageChange={setLanguage} /></LanguageContext.Provider>;
}

function AppContent({ onLanguageChange }: { onLanguageChange: (language: Language) => void }) {
  const { t, language } = useTranslation();
  const [view, setView] = useState<View>(() => { const sharedId = new URLSearchParams(window.location.search).get('ad'); const sharedResult = allResults.find(result => result.id === sharedId); return sharedResult?.type === 'service' ? 'services' : sharedResult?.type === 'business' ? 'businesses' : sharedResult?.type === 'offer' ? 'offers' : sharedResult ? 'browse' : 'home'; });
  const scrollToCategories = useRef(false);
  useEffect(() => {
    if (view !== 'home' || !scrollToCategories.current) return;
    scrollToCategories.current = false;
    const categoriesSection = document.getElementById('categories');
    categoriesSection?.scrollIntoView({ behavior: 'instant', block: 'start' });
    categoriesSection?.focus({ preventScroll: true });
  }, [view]);
  const [query, setQuery] = useState('');
  const [zone, setZone] = useState('All zones');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<BrowseFilters['sort']>('recommended');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [feedUnavailable, setFeedUnavailable] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { const saved = JSON.parse(localStorage.getItem('madinaty-favorites') ?? 'null'); if (Array.isArray(saved)) return new Set(saved.filter((id): id is string => typeof id === 'string')); } catch { /* Start with demo favourites if storage is unavailable. */ }
    return new Set(['listing-3']);
  });
  const [searchType, setSearchType] = useState<View>('search');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryNavigation, setCategoryNavigation] = useState(false);
  useEffect(() => { try { localStorage.setItem('madinaty-favorites', JSON.stringify([...favorites])); } catch { /* Session state remains available. */ } }, [favorites]);
  const [modal, setModal] = useState<'post' | 'register' | 'report' | 'verify' | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [cognitoEnabled, setCognitoEnabled] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const registered = Boolean(account);
  const isAdmin = account?.role === 'ADMIN';
  const moderatorPermissions = account?.permissions || [];
  const canAccessAdmin = isAdmin || (account?.role === 'MODERATOR' && moderatorPermissions.length > 0);
  const residentVerified = account?.residentVerified || false;
  const rentalPostsThisMonth = 0;
  useEffect(() => {
    let cancelled = false;
    getSession().then(user => { if (!cancelled) setAccount(user); }).catch(() => {}).finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { const load = () => getPublicConfig().then(value => { setRegistrationEnabled(value.registrationEnabled); setMaintenanceMode(value.maintenanceMode === true); setCognitoEnabled(value.cognitoEnabled); setTranslationEnabled(value.translationEnabled === true); }).catch(() => { setRegistrationEnabled(false); setMaintenanceMode(false); setCognitoEnabled(false); setTranslationEnabled(false); }); load(); window.addEventListener('madinaty-config-refresh', load); return () => window.removeEventListener('madinaty-config-refresh', load); }, []);
  useEffect(() => {
    let active = true;
    let latest = 0;
    const load = () => {
      const sequence = ++latest;
      return getPublishedSubmissions().then(({ submissions, hiddenContentIds }) => {
      if (!active || sequence !== latest) return;
      const hidden = new Set(hiddenContentIds || []);
      setFeedUnavailable(false);
      setResults([...allResults.filter(item => !hidden.has(`${item.type}:${item.id}`)), ...submissions.map(publicSubmissionResult).filter((result): result is SearchResult => Boolean(result))]);
      }).catch(() => { if (active && sequence === latest) { setResults([]); setFeedUnavailable(true); } });
    };
    void load();
    const timer = window.setInterval(load, 15000);
    window.addEventListener('focus', load);
    window.addEventListener('madinaty-feed-refresh', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('madinaty-feed-refresh', load); };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const authError = url.searchParams.get('auth_error');
      if (!authError) return;
      const messages: Record<string, string> = {
        signin_failed: 'Sign-in could not be completed. Please try again.',
        email_not_verified: 'Your sign-in provider did not confirm your email address. Please contact hello@madinatydeals.com for help.',
        signin_state_invalid: 'Your sign-in attempt expired or could not be verified. Please start again using Continue to account.',
        provider_rejected: 'Your account provider could not complete sign-in. Please try again or contact hello@madinatydeals.com.',
        invalid_identity: 'Your sign-in provider did not return the account details needed to sign in. Please contact hello@madinatydeals.com.',
        registration_paused: 'Account creation is temporarily paused. Please try again later.',
        account_unavailable: 'This account is unavailable. Please contact support.',
      };
      setSignInError(messages[authError] || messages.signin_failed);
      setModal('register');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [t]);

  const openPost = () => { if (!authLoading) setModal(registered ? 'post' : 'register'); };

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const updateScrollTopVisibility = () => setShowScrollTop(view !== 'home' && view !== 'admin' && window.scrollY > 520);
    updateScrollTopVisibility();
    window.addEventListener('scroll', updateScrollTopVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollTopVisibility);
  }, [view]);

  const visibleResults = useMemo(() => isAdmin ? results : results.filter(result => result.category !== 'Pet care'), [isAdmin, results]);
  const activeResults = useMemo(() => {
    const scopedResults = view === 'saved' ? visibleResults.filter((result) => favorites.has(result.id)) : getViewResults(view, visibleResults);
    return filterResults(scopedResults, { query, zone, verifiedOnly, sort, category: selectedCategory });
  }, [favorites, query, visibleResults, sort, verifiedOnly, view, zone, selectedCategory]);

  const goTo = (nextView: View) => {
    if (nextView === 'offers' && !featureFlags.offers) return;
    if (nextView === 'admin' && !canAccessAdmin) {
      setToast('Admin access required');
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.has('ad')) {
      url.searchParams.delete('ad');
      window.history.replaceState({}, '', url);
    }
    setView(nextView);
    setQuery('');
    setSelectedCategory('');
    setCategoryNavigation(false);
    setMobileNavOpen(false);
    if (nextView === 'browse') track('search_performed', { source: 'navigation', type: 'listing' });
  };

  const clearFilters = () => {
    setZone('All zones');
    setVerifiedOnly(false);
    setSort('recommended');
    setSearchType('search');
    setQuery('');
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const changeLanguage = () => {
    const nextLanguage = language === 'ar' ? 'en' : 'ar';
    const url = new URL(window.location.href);
    url.searchParams.set('lang', nextLanguage);
    url.hash = '';
    window.history.replaceState({}, '', url);
    onLanguageChange(nextLanguage);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const openCategory = (nextView: View, category: string) => {
    if (category === 'Pet care' && !isAdmin) { setToast('Admin access required'); return; }
    window.history.pushState({ madinatyDealsCategory: true }, '');
    setCategoryNavigation(true);
    setSelectedCategory(category);
    setView(splitCategories.includes(category) || businessOnlyCategories.includes(category) ? 'search' : nextView);
    setQuery('');
    setMobileNavOpen(false);
  };

  useEffect(() => {
    const handlePopState = () => {
      if (!categoryNavigation) return;
      setView('home');
      setQuery('');
      setSelectedCategory('');
      setCategoryNavigation(false);
      setMobileNavOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [categoryNavigation]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setSelectedCategory('');
    setCategoryNavigation(false);
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

  const contactResult = async (result: SearchResult, method: 'whatsapp' | 'phone' | 'quote') => {
    const number = method === 'whatsapp' ? result.type === 'business' ? result.whatsapp || result.phone : result.type === 'service' ? result.whatsapp || result.phone : '' : '';
    // Reserve the tab inside the click gesture so Safari still allows the verified link to open.
    const tab = number ? window.open('about:blank', '_blank') : null;
    if (tab) tab.opener = null;
    try { await checkContentVisible(result.type, result.id); } catch { tab?.close(); setToast(language === 'ar' ? 'هذا الإعلان غير متاح الآن' : 'This ad is no longer available'); window.dispatchEvent(new Event('madinaty-feed-refresh')); return; }
    const eventName = method === 'whatsapp' ? 'whatsapp_clicked' : method === 'phone' ? 'phone_clicked' : 'quote_requested';
      track(eventName, { result_type: result.type, result_id: result.id });
      if (method === 'whatsapp') {
      if (number) {
        const message = language === 'ar'
          ? '🏷️ مدينتي ديلز\nالسلام عليكم، لقيت رقمك علي مدينتي ديلز. عايز اعرف الاسعار و المواعيد'
          : `🏷️ Madinaty Deals\nHello, I found ${result.title} on Madinaty Deals and would like to ask about your services.`;
        const normalized = number.replace(/[^\d]/g, '').replace(/^0/, '20');
        const href = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
        if (tab && !tab.closed) tab.location.replace(href);
        else window.location.assign(href);
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

  const publishListing = (listing: Listing, published: boolean) => {
    setModal(null);
    window.dispatchEvent(new Event('madinaty-feed-refresh'));
    track('listing_submitted', { category: listing.category });
    setToast(published ? 'Your listing is published and visible to the community' : 'Your listing is held for a safety or commercial check');
  };
  const publishService = (service: Service, published: boolean) => {
    setModal(null);
    window.dispatchEvent(new Event('madinaty-feed-refresh'));
    track('service_submitted', { category: service.category });
    setToast(published ? 'Your service is published and visible to the community' : 'Your service is held for a safety or commercial check');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label={t("Open navigation")} onClick={() => setMobileNavOpen(true)}><Menu size={21} /></button>
        <button className="brand" onClick={() => goTo('home')} aria-label={t("Madinaty Deals home")}>
          <MadinatyLogo />
        </button>
        <form className="top-search" onSubmit={handleSearch} role="search">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search items, services or places")} aria-label={t("Search items, services or places")} />
          <select className="search-scope" aria-label={t('Search in')} value={searchType} onChange={event => setSearchType(event.target.value as View)}>{searchScopes.map((scope,index) => <option value={scope} key={scope}>{t(searchScopeLabels[index])}</option>)}</select>
          <select className="search-zone" aria-label={t('Search location')} value={zone} onChange={event => setZone(event.target.value)}>{zones.map(value => <option value={value} key={value}>{t(value)}</option>)}</select>
          <button className="search-submit" type="submit" aria-label={t('Search')}><Search size={18} /></button>
        </form>
        <div className="top-actions">
          <button className="header-contact" onClick={() => document.getElementById('contact-us')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><MessageCircle size={16} />{t('Contact us')}</button>
          <button className="header-saved" aria-label={t('Saved')} onClick={() => goTo('saved')}><Heart size={19} /><span>{t('Saved')}</span></button>
          <button className="button button-accent header-post" onClick={openPost}><Plus size={18} />{t('Post ad')}</button>
          {maintenanceMode && !registered ? <button className="account-link maintenance-account-link" onClick={() => setModal('register')}><ShieldCheck size={17} /><span>{t('Administrator sign-in')}</span></button> : <button className="account-link" onClick={() => setModal(registered ? 'verify' : 'register')}><UserRound size={17} /><span>{t(registered ? 'Your account' : registrationEnabled ? 'Sign in or create account' : 'Sign in')}</span></button>}{registered && <button className="text-link" onClick={async () => { try { await signOut(cognitoEnabled); setAccount(null); setModal(null); } catch { setToast('Sign-out failed. Please try again.'); } }}>{t('Sign out')}</button>}
          <button className="language-switch" lang={language === 'ar' ? 'en' : 'ar'} onClick={changeLanguage} aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>{language === 'ar' ? 'English' : 'العربية'}</button>
        </div>
      </header>
      <div className="market-nav"><Navigation view={view} goTo={goTo} favoriteCount={favorites.size} isAdmin={canAccessAdmin} onAdmin={() => goTo('admin')} onVerify={() => setModal(registered ? 'verify' : 'register')} /></div>

      <div className={`mobile-drawer ${mobileNavOpen ? 'is-open' : ''}`}>
        <button className="drawer-backdrop" aria-label={t("Close navigation")} onClick={() => setMobileNavOpen(false)} />
        <aside className="drawer-panel">
          <div className="drawer-head"><span className="brand-small"><MadinatyLogo compact /></span><button className="icon-button" onClick={() => setMobileNavOpen(false)} aria-label={t("Close navigation")}><X size={20} /></button></div>
          {!registered && registrationEnabled && !maintenanceMode && <button className="drawer-register" type="button" onClick={() => { setMobileNavOpen(false); setModal('register'); }}><UserRound size={18} /><span><b>{t('Create your account')}</b><small>{t('Register before posting')}</small></span><ArrowRight size={16} /></button>}
          <Navigation view={view} goTo={goTo} favoriteCount={favorites.size} isAdmin={canAccessAdmin} onAdmin={() => { setMobileNavOpen(false); goTo('admin'); }} onVerify={() => { setMobileNavOpen(false); setModal(registered ? 'verify' : 'register'); }} />
        </aside>
      </div>

      <main className="main-content">
        {feedUnavailable && <p className="form-error" role="alert">{t('Listings are temporarily unavailable. Please refresh this page shortly.')}</p>}
        {view === 'home' ? (
          <HomeView isAdmin={isAdmin} residentVerified={residentVerified} translationEnabled={translationEnabled} results={visibleResults} favorites={favorites} onFavorite={toggleFavorite} goTo={goTo} onPost={openPost} onSearch={(value) => { setQuery(value); setView('search'); track('search_performed', { query: value }); }} onCategorySearch={(value) => value === 'Deals & promotions' ? goTo('offers') : openCategory('search', value)} onServiceCategory={value => openCategory('services', value)} onBusinessCategory={value => { openCategory('businesses', value); track('category_opened', { category: value, type: 'business' }); }} />
        ) : view === 'admin' ? (
          canAccessAdmin ? <AdminView isAdmin={isAdmin} permissions={moderatorPermissions} onBack={() => goTo('home')} /> : <AdminAccessDenied onBack={() => goTo('home')} />
        ) : (
          <BrowseView key={`${view}-${selectedCategory}`} selectedCategory={selectedCategory}
            view={view}
            query={query}
            zone={zone}
            verifiedOnly={verifiedOnly}
            sort={sort}
            results={activeResults}
            residentVerified={residentVerified}
            translationEnabled={translationEnabled}
            favorites={favorites}
            onQueryChange={setQuery}
            onZoneChange={setZone}
            onVerifiedChange={(value) => { setVerifiedOnly(value); track('filter_applied', { filter: 'verified', value }); }}
            onSortChange={setSort}
            onTabChange={goTo}
            onClearFilters={clearFilters}
            onFavorite={toggleFavorite}
            onContact={contactResult}
            onReport={reportResult}
            onPost={openPost}
            showBackHome={categoryNavigation}
            onBackHome={() => window.history.back()}
          />
        )}
        <CommunityFooter goTo={goTo} onPost={openPost} />
      </main>

      <div className="mobile-bottom-nav">
        {navItems.slice(0, 4).map((item) => <NavItem key={item.id} item={item} active={view === item.id} onClick={() => goTo(item.id)} />)}
        <button className="mobile-post" onClick={openPost} aria-label={t("Post a listing")}><Plus size={22} /></button>
      </div>

      {showScrollTop && <button className="scroll-top-button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t('Back to top')} title={t('Back to top')}><ArrowUp size={19} /></button>}

      {maintenanceMode && !registered && <div className="maintenance-banner" role="status"><ShieldCheck size={18} /><span><b>{t('Madinaty Deals is under maintenance')}</b><small>{t('Browsing remains available. Public sign-in and registration are temporarily paused.')}</small></span></div>}
      {toast && <div className="toast" role="status"><CircleCheck size={18} /> {t(toast)}</div>}
      {modal === 'post' && <PostModal onClose={() => setModal(null)} onVerify={() => setModal('verify')} onPublish={publishListing} onPublishService={publishService} accountId={account?.id ?? ''} residentVerified={residentVerified} rentalPostsThisMonth={rentalPostsThisMonth} />}
      {modal === 'register' && <RegistrationModal signInError={signInError} registrationEnabled={registrationEnabled} cognitoEnabled={cognitoEnabled} onClose={() => setModal(null)} onRegistered={user => { setAccount(user); setSignInError(''); setModal('post'); track('account_signed_in'); }} />}
      {modal === 'report' && selectedResult && <ReportModal result={selectedResult} onClose={() => setModal(null)} onSubmit={async (reason, details) => { await submitReport(selectedResult.type, selectedResult.id, reason, details); setModal(null); track('report_submitted', { result_type: selectedResult.type }); setToast('Thanks — our trust team will take a look'); }} />}
      {modal === 'verify' && <ModalShell title="Become a verified resident" eyebrow="A LITTLE MORE TRUST" onClose={() => setModal(null)}><VerificationForm onSkip={() => setModal(null)} onSubmitted={() => { setModal(null); setToast('Your verification request is awaiting review'); }} /></ModalShell>}
    </div>
  );
}

function Navigation({ view, goTo, favoriteCount, isAdmin, onAdmin, onVerify }: { view: View; goTo: (view: View) => void; favoriteCount: number; isAdmin: boolean; onAdmin: () => void; onVerify: () => void }) {
  const { t } = useTranslation();
  return <nav className="nav-list" aria-label={t("Main navigation")}>
    {navItems.map((item) => <NavItem key={item.id} item={item} active={view === item.id} onClick={() => goTo(item.id)} />)}
    <NavItem item={{ id: 'saved', label: 'Saved', icon: Bookmark }} active={view === 'saved'} onClick={() => goTo('saved')} count={favoriteCount} />
    {isAdmin && <button className="admin-nav-link" type="button" onClick={onAdmin}><BarChart3 size={18} /><span>{t('Admin dashboard')}</span></button>}
    <div className="nav-divider" />
    <span className="section-label nav-section-label">{t("For businesses")}</span>
    <button className="mobile-verify-cta" type="button" onClick={onVerify}><ShieldCheck size={18} /><span><b>{t('Become a verified resident')}</b><small>{t('Get verified in 2 mins')}</small></span><ArrowRight size={16} /></button>
  </nav>;
}

function MadinatyLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark reference-logo ${compact ? 'brand-mark-compact' : ''}`} aria-hidden="true">
    <img src="/madinaty-deals-newlogo1-transparent.png" alt="" />
    <span className="reference-latin-wordmark"><strong>MADINATY</strong><em>DEALS</em></span>
    <span className="reference-arabic-wordmark" lang="ar" dir="rtl"><strong>مدينتي</strong><em>ديلز</em></span>
  </span>;
}

function NavItem({ item, active, onClick, count }: { item: { id: View; label: string; icon: LucideIcon }; active: boolean; onClick: () => void; count?: number }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} /><span>{t(item.label)}</span>{count ? <small>{count}</small> : null}</button>;
}

function HomeView({ isAdmin, residentVerified, translationEnabled, goTo, onPost, onSearch, onCategorySearch, onServiceCategory, onBusinessCategory, results, favorites, onFavorite }: { isAdmin: boolean; residentVerified: boolean; translationEnabled: boolean; goTo: (view: View) => void; onPost: () => void; onSearch: (value: string) => void; onCategorySearch: (value: string) => void; onServiceCategory: (value: string) => void; onBusinessCategory: (value: string) => void; results: SearchResult[]; favorites: Set<string>; onFavorite: (result: SearchResult) => void }) {
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

    <EliteAdSpace />

    <section id="categories" tabIndex={-1} className="section-block category-section">
      <SectionHeading eyebrow="BROWSE THE NEIGHBOURHOOD" title="What brings you here?" action="See everything" onAction={() => goTo('browse')} />
      <div className="category-grid">{categories.filter(category => !category.adminOnly || isAdmin).map((category) => { const Icon = iconMap[category.icon] ?? Grid2X2; return <button key={category.label} className="category-card" onClick={() => { const nextView = ['wrench', 'sparkles', 'bike', 'graduation-cap', 'circle-help'].includes(category.icon) ? 'services' : ['utensils', 'heart-pulse', 'shopping-basket', 'paw-print'].includes(category.icon) ? 'businesses' : 'browse'; if (nextView === 'browse') onCategorySearch(category.label); else if (nextView === 'services') onServiceCategory(category.label); else onBusinessCategory(category.label); }}><span className={`category-icon ${category.icon}`}>{category.photo && <img src={category.photo} alt="" loading={category.label === 'Apartment rentals' ? 'eager' : 'lazy'} decoding="async" onError={event => { event.currentTarget.style.display = 'none'; const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.opacity = '1'; }} />}<span className="category-fallback"><Icon size={21} /></span></span><span><b>{t(category.label)}</b><small>{t(category.adminOnly ? 'Admin research preview' : 'Explore')} <ArrowRight size={12} /></small></span><ChevronRight size={16} /></button>; })}</div>
    </section>

    <section className="section-block featured-section">
      <SectionHeading eyebrow="FRESH FROM YOUR COMMUNITY" title="Fresh finds near you" action="View marketplace" onAction={() => goTo('browse')} />
      <div className="card-grid home-listings">{results.filter(result => result.type === 'listing').slice(0, 8).map((result) => <ResultCard key={result.id} result={result} compact translationEnabled={translationEnabled} favorite={favorites.has(result.id)} onFavorite={onFavorite} verifiedResident={residentVerified} />)}</div>
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

function BrowseView({ onClearFilters, selectedCategory, view, query, zone, verifiedOnly, sort, results, favorites, onQueryChange, onZoneChange, onVerifiedChange, onSortChange, onTabChange, onFavorite, onContact, onReport, onPost, showBackHome, onBackHome, residentVerified, translationEnabled }: {
  onClearFilters: () => void; selectedCategory: string; view: View; query: string; zone: string; verifiedOnly: boolean; sort: BrowseFilters['sort']; results: SearchResult[]; favorites: Set<string>;
  onQueryChange: (value: string) => void; onZoneChange: (value: string) => void; onVerifiedChange: (value: boolean) => void; onSortChange: (value: BrowseFilters['sort']) => void; onTabChange: (view: View) => void; onFavorite: (result: SearchResult) => void; onContact: (result: SearchResult, method: 'whatsapp' | 'phone' | 'quote') => void; onReport: (result: SearchResult) => void; onPost: () => void; showBackHome: boolean; onBackHome: () => void; residentVerified: boolean; translationEnabled: boolean;
}) {
  const { t } = useTranslation();
  const [collection, setCollection] = useState<CollectionFilters>(emptyFilters);
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const clearCollectionFilters = () => { setCollection(emptyFilters); onClearFilters(); };
  const displayed = filterResults(results, { query: '', zone: 'All zones', verifiedOnly: false, sort, advertiserType: businessOnlyCategories.includes(selectedCategory) ? 'small_business' : (collection.advertiserType || undefined) as 'individual' | 'small_business' | undefined, category: collection.category, condition: collection.condition, furnishing: collection.furnishing, vehicleType: collection.vehicleType, minPrice: collection.min === '' ? undefined : Number(collection.min), maxPrice: collection.max === '' ? undefined : Number(collection.max), educationLevel: collection.educationLevel, subject: collection.subject, groceryActivity: collection.groceryActivity, homeServiceType: collection.homeServiceType, housekeepingType: collection.housekeepingType, fitnessProviderType: collection.fitnessProviderType, petBusinessType: collection.petBusinessType });
  const categoryHeading = splitCategories.includes(selectedCategory) || businessOnlyCategories.includes(selectedCategory) || selectedCategory === 'Apartment rentals' || selectedCategory === 'Groceries' || selectedCategory === 'Pet care';
  const heading = categoryHeading ? selectedCategory : (view === 'search' ? 'Search results' : view === 'saved' ? 'Your saved shortlist' : view === 'services' ? 'Trusted services nearby' : view === 'businesses' ? 'Good places around you' : view === 'offers' ? 'Offers worth stepping out for' : 'Find your next good thing');
  const subheading = view === 'saved' ? 'The things you want to come back to.' : view === 'services' ? 'Providers with context, reviews and a way to reach them.' : view === 'businesses' ? 'Local businesses with hours, reviews and useful details.' : view === 'offers' ? 'Time-limited deals from businesses in Madinaty.' : 'Buy and sell with people in the neighbourhood.';
  const tabs: { id: View; label: string }[] = [{ id: 'browse', label: 'All items' }, { id: 'services', label: 'Services' }, { id: 'businesses', label: 'Businesses' }, ...(featureFlags.offers ? [{ id: 'offers' as View, label: 'Offers' }] : [])];
  return <div className="browse-view">
    <div className="page-intro"><div>{showBackHome && <button className="text-link back-home-link" onClick={onBackHome}><ArrowLeft size={15} /> {t('Back to home')}</button>}<span className="eyebrow">{t(view === 'saved' ? 'YOUR SPACE' : 'DISCOVER IN MADINATY')}</span><h1>{t(heading)}</h1><p>{t(subheading)}</p></div><button className="button button-accent" onClick={onPost}><Plus size={17} /> {t(" Post a listing")}</button></div>
    <div className="browse-tabs" role="tablist" aria-label={t("Discovery type")}>{tabs.map((tab) => <button key={tab.id} className={view === tab.id || (view === 'browse' && tab.id === 'browse') ? 'active' : ''} onClick={() => onTabChange(tab.id)} role="tab" aria-selected={view === tab.id}>{t(tab.label)}</button>)}{view === 'saved' && <span className="saved-tab-label"><Bookmark size={15} fill="currentColor" /> {t(" Saved only")}</span>}</div>
    <div className="browse-toolbar"><div className="inline-search"><Search size={17} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("Search this collection")} aria-label={t("Search this collection")} /></div><div className="filter-actions"><label className="select-wrap"><MapPin size={15} /><select value={zone} onChange={(event) => onZoneChange(event.target.value)} aria-label={t("Filter by zone")}>{zones.map((option) => <option key={option} value={option}>{t(option)}</option>)}</select><ChevronDown size={14} /></label><label className={`verified-toggle ${verifiedOnly ? 'checked' : ''}`}><input type="checkbox" checked={verifiedOnly} onChange={(event) => onVerifiedChange(event.target.checked)} /><BadgeCheck size={15} /> {t(" Verified only")}</label><label className="select-wrap sort-select"><SlidersHorizontal size={15} /><select value={sort} onChange={(event) => onSortChange(event.target.value as BrowseFilters['sort'])} aria-label={t("Sort results")}><option value="recommended">{t("Recommended")}</option><option value="newest">{t("Newest first")}</option><option value="price-low">{t("Price: low to high")}</option><option value="price-high">{t("Price: high to low")}</option></select><ChevronDown size={14} /></label></div></div>
    <div className="results-meta"><span><b>{displayed.length}</b> {t(displayed.length === 1 ? 'result' : 'results')} <span className="meta-dot" /> {t(zone)}</span><div className="results-controls"><button className="filter-button" aria-expanded={filtersOpen} aria-controls="collection-filters" onClick={() => setFiltersOpen(!filtersOpen)}><ListFilter size={15} />{t('Refine results')}</button><div className="layout-switch" aria-label={t('Results layout')}><button aria-label={t('List view')} aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><ListFilter size={16} /></button><button aria-label={t('Grid view')} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Grid2X2 size={16} /></button></div></div></div>
    <div className="market-results-layout"><div id="collection-filters" className={filtersOpen ? 'collection-filters is-open' : 'collection-filters'}><MarketplaceFilters onClear={clearCollectionFilters} value={collection} onChange={setCollection} results={results} showPrice={['browse','search','saved'].includes(view)} showFurnishing={selectedCategory === 'Apartment rentals'} showAdvertiserType={splitCategories.includes(selectedCategory) && selectedCategory !== 'Health & fitness'} conditionCategory={selectedCategory} /></div><div className="results-column">
    {displayed.length ? <div className={`card-grid results-grid ${layout === 'list' ? 'list-layout' : ''}`}>{displayed.map((result) => <ResultCard key={result.id} result={result} translationEnabled={translationEnabled} verifiedResident={residentVerified} favorite={favorites.has(result.id)} onFavorite={onFavorite} onContact={onContact} onReport={onReport} />)}</div> : <EmptyState view={view} query={query} onReset={clearCollectionFilters} />}
    </div></div>
  </div>;
}

function ResultCard({ result, compact = false, favorite = false, verifiedResident = false, translationEnabled = false, onFavorite, onContact, onReport }: { result: SearchResult; compact?: boolean; favorite?: boolean; verifiedResident?: boolean; translationEnabled?: boolean; onFavorite?: (result: SearchResult) => void; onContact?: (result: SearchResult, method: 'whatsapp' | 'phone' | 'quote') => void; onReport?: (result: SearchResult) => void }) {
  const { t, language } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(() => new URLSearchParams(window.location.search).get('ad') === result.id);
  const [shareFeedback, setShareFeedback] = useState('');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<{ title: string; subtitle: string } | null>(null);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const isListing = result.type === 'listing';
  const isService = result.type === 'service';
  const isBusiness = result.type === 'business';
  const isOffer = result.type === 'offer';
  const sourceLanguage = hasArabicText(`${result.title} ${result.subtitle}`) ? 'ar' : 'en';
  const canTranslate = translationEnabled && language !== sourceLanguage && (isListing || isService || isBusiness || isOffer);
  const closeDetails = () => {
    setDetailsOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('ad')) {
      url.searchParams.delete('ad');
      window.history.replaceState({}, '', url);
    }
  };
  const [liveViewCount, setLiveViewCount] = useState(() => getViewCount(result));
  const isPoultryDemo = result.id === 'business-poultry-demo';
  const shareUrl = getAdLink(result);
  const shareText = `${t('See this ad on Madinaty Deals')} — ${t(result.title)}`;
  const supportsNativeShare = 'share' in navigator;
  const copyShareLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback(t('Link copied'));
      } else {
        window.prompt(t('Copy this link'), shareUrl);
        setShareFeedback(t('Link ready to share'));
      }
    } catch { setShareFeedback(t('Share cancelled')); }
    setShareMenuOpen(false);
  };
  const shareTo = (platform: 'whatsapp' | 'messenger' | 'facebook' | 'telegram') => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`${shareText} ${shareUrl}`);
    const links = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      messenger: `https://m.me/?link=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`,
    };
    window.open(links[platform], '_blank', 'noopener,noreferrer');
    setShareFeedback(t('Share link opened'));
    setShareMenuOpen(false);
  };
  const shareWithDevice = async () => {
    try {
      if (supportsNativeShare) await navigator.share({ title: t(result.title), text: shareText, url: shareUrl });
      else await copyShareLink();
    } catch { setShareFeedback(t('Share cancelled')); }
    setShareMenuOpen(false);
  };
  const toggleTranslation = async () => {
    if (translatedContent) { setTranslatedContent(null); setTranslationError(''); return; }
    setTranslationBusy(true); setTranslationError('');
    try {
      const targetLanguage = language;
      const [title, subtitle] = await Promise.all([translateText(result.title, sourceLanguage, targetLanguage), translateText(result.subtitle, sourceLanguage, targetLanguage)]);
      setTranslatedContent({ title: title.translation, subtitle: subtitle.translation });
    } catch { setTranslationError('Translation is temporarily unavailable.'); }
    finally { setTranslationBusy(false); }
  };
  useEffect(() => {
    if (!detailsOpen) return;
    recordView(result.type, result.id).then(({ viewCount }) => setLiveViewCount(viewCount)).catch(() => { /* The static demo count remains visible until the API is configured. */ });
  }, [detailsOpen, result.id, result.type]);
  useEffect(() => {
    const syncFromUrl = () => setDetailsOpen(new URLSearchParams(window.location.search).get('ad') === result.id);
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [result.id]);
  return <article className={`result-card ${compact ? 'compact-card' : ''} type-${result.type}`}>
    <div className={`result-image image-${result.image} art-${result.accent}`}><ResultArt result={result} /><span className="result-type">{isOffer ? <Zap size={11} fill="currentColor" /> : isBusiness ? <Store size={11} /> : isService ? <Wrench size={11} /> : <Package size={11} />} {t(isOffer ? 'Local offer' : isBusiness ? 'Business' : isService ? 'Service' : 'For sale')}</span>{isOffer && result.featured ? <span className="featured-label">{t("Featured")}</span> : null}</div>
    <div className="result-body">
      <div className="result-topline"><span>{t(result.zone)} <span className="meta-dot" /> {t(result.createdAt)}</span>{onFavorite && <button className={`save-button ${favorite ? 'saved' : ''}`} onClick={() => onFavorite(result)} aria-label={t(favorite ? `Remove ${result.title} from saved` : `Save ${result.title}`)}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button>}</div>
      <h3><button className="listing-title" onClick={() => { const url = new URL(window.location.href); url.searchParams.set('ad', result.id); window.history.pushState({ madinatyDealsAd: result.id }, '', url); setDetailsOpen(true); }}>{t(result.title)}</button></h3><p className="result-subtitle">{t(result.subtitle)}</p>
      {isListing && <div className="result-detail"><strong>{t(formatPrice(result.price))}</strong><span>{t(result.condition)}</span></div>}
      {isService && <div className="result-detail"><strong><Star size={14} fill="currentColor" /> {result.rating}</strong><span>{result.reviewCount} {t(" reviews")}</span></div>}
      {isBusiness && <div className="result-detail"><strong><Star size={14} fill="currentColor" /> {result.rating}</strong><span>{t(result.hours)}</span></div>}
      {isOffer && <div className="result-detail"><strong className="discount-text">{t(result.discount)}</strong><span>{t(result.validUntil)}</span></div>}
      <div className="view-count"><Eye size={13} /> {t('Seen by')} {liveViewCount.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-EG')} {t('people')}</div>
      {!compact && <div className="result-footer">{isListing ? <span className="seller-line">{t(result.seller)}{result.sellerVerified && <BadgeCheck size={14} />} </span> : isOffer ? <span className="seller-line"><Store size={13} /> {t(result.business)}</span> : <span className="seller-line">{result.verified && <BadgeCheck size={14} />} {t(isPoultryDemo ? 'Demo profile' : ' Trusted profile')}</span>}<div className="card-actions">{(isListing || isService || isBusiness) && onContact && <button className="small-action primary-action" onClick={() => onContact(result, isService ? 'whatsapp' : 'whatsapp')}>{t(isService ? 'Contact on WhatsApp' : isPoultryDemo ? 'Order on WhatsApp' : 'Contact')} <ArrowRight size={14} /></button>}{isOffer && <button className="small-action primary-action" onClick={() => onContact?.(result, 'quote')}>{t("View offer ")}<ArrowRight size={14} /></button>}<button className="report-action" onClick={() => onReport?.(result)} aria-label={t(`Report ${result.title}`)}><Flag size={14} /></button></div></div>}
    </div>
    {detailsOpen && <ModalShell title={translatedContent?.title || result.title} eyebrow={result.category} onClose={closeDetails}><div className="ad-details">
      <nav className="ad-breadcrumbs" aria-label={t('Ad breadcrumbs')}><span>{t('Home')}</span><ChevronRight size={13} /><span>{t(result.category)}</span><ChevronRight size={13} /><b>{t(result.title)}</b></nav>
      <div className="ad-gallery"><div className={`result-image image-${result.image} art-${result.accent}`}><ResultArt result={result} /><span className="gallery-count">1 / 1</span></div><small>{t('Photos supplied by the advertiser')}</small></div>
      <div className="ad-primary-info"><div><span className="ad-status-label">{t(isOffer ? 'Local offer' : isBusiness ? 'Business profile' : isService ? 'Service listing' : 'For sale')}</span><h3>{t(result.title)}</h3></div>{isListing && <strong>{t(formatPrice(result.price))}</strong>}</div>
      <div className="ad-meta-row"><span><MapPin size={15} />{t(result.zone)}</span><span>{t(result.createdAt)}</span><span><Eye size={14} />{liveViewCount.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-EG')} {t('views')}</span><span className="ad-id">{t('Ad ID')}: <bdi dir="ltr">{getPublicAdId(result)}</bdi></span></div>
      <section className="ad-section"><div className="translation-row"><h4>{t('Description')}</h4>{canTranslate && <button type="button" className="text-link translation-action" onClick={toggleTranslation} disabled={translationBusy}>{translationBusy ? t('Translating…') : t(translatedContent ? 'Show original' : language === 'ar' ? 'Translate to Arabic' : 'Translate to English')}</button>}</div><p dir="auto">{translatedContent?.subtitle || t(result.subtitle)}</p>{translatedContent && <small className="translation-note">{t('Machine translation')}</small>}{translationError && <p className="form-error" role="alert">{t(translationError)}</p>}{isListing && <p><b>{t('Condition')}:</b> {t(result.condition)}{result.furnishing && <> · <b>{t('Furnishing')}:</b> {t(result.furnishing)}</>}</p>}</section>
      {isListing && <section className="ad-section"><h4>{t('Transaction options')}</h4><div className="transaction-options"><span><CircleCheck size={15} /> {t('Cash accepted')}</span><span><CircleCheck size={15} /> {t('Arrange pickup or delivery')}</span><span><CircleCheck size={15} /> {t('Confirm final price before payment')}</span></div></section>}
      <section className="seller-panel"><div className="seller-avatar">{(isListing ? result.seller : isOffer ? result.business : result.title).charAt(0)}</div><div><span className="eyebrow">{t('Listed by')}</span><h4>{t(isListing ? result.seller : isOffer ? result.business : isBusiness ? 'Local business' : 'Trusted provider')}</h4><p>{t(result.verified || ('sellerVerified' in result && result.sellerVerified) ? 'Verified profile' : 'Community profile')}</p></div><button className="button button-accent" onClick={() => onContact?.(result, isService || isBusiness ? 'whatsapp' : 'quote')}><MessageCircle size={16} />{t(isService || isBusiness ? 'Contact on WhatsApp' : 'Send message')}</button></section>
      <div className="ad-actions"><button className="button button-outline" onClick={() => onFavorite?.(result)}><Heart size={16} fill={favorite ? 'currentColor' : 'none'} />{t(favorite ? 'Remove from saved' : 'Save listing')}</button><div className="share-wrap"><button className="share-action" aria-expanded={shareMenuOpen} aria-haspopup="menu" onClick={() => setShareMenuOpen(value => !value)}><Share2 size={14} /> {t('Share')}</button>{shareMenuOpen && <div className="share-menu" role="menu" aria-label={t('Share this ad')}><button role="menuitem" onClick={() => shareTo('whatsapp')}><span className="share-menu-icon whatsapp">W</span>{t('WhatsApp')}</button><button role="menuitem" onClick={() => shareTo('messenger')}><span className="share-menu-icon messenger"><MessageCircle size={15} /></span>{t('Messenger')}</button><button role="menuitem" onClick={() => shareTo('facebook')}><span className="share-menu-icon facebook">f</span>{t('Facebook')}</button><button role="menuitem" onClick={() => shareTo('telegram')}><span className="share-menu-icon telegram">➤</span>{t('Telegram')}</button><button role="menuitem" onClick={copyShareLink}><span className="share-menu-icon copy">↗</span>{t('Copy link')}</button>{supportsNativeShare && <button role="menuitem" onClick={shareWithDevice}><span className="share-menu-icon device"><Share2 size={15} /></span>{t('More sharing options')}</button>}</div>}</div><button className="report-action" onClick={() => onReport?.(result)}><Flag size={14} /> {t('Report listing')}</button></div>
      {shareFeedback && <small className="share-feedback" role="status">{shareFeedback}</small>}
      <aside className="ad-safety"><ShieldCheck size={18} /><div><h4>{t('Stay safe')}</h4><p>{t(getSafetyMessage(result))}</p></div></aside>
      <p className="modal-intro">{t('Demo content: contact and transactions are not connected yet.')}</p>
      <CommentBox contentType={result.type} contentId={result.id} language={language} verifiedResident={verifiedResident} />
    </div></ModalShell>}
  </article>;
}

function CommentBox({ contentType, contentId, language, verifiedResident }: { contentType: string; contentId: string; language: Language; verifiedResident: boolean }) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { getComments(contentType, contentId).then(({ comments: stored }) => setComments(stored)).catch(() => setError('Comments are available after the backend is connected.')); }, [contentId, contentType]);
  const submit = async () => {
    const body = comment.trim();
    if (!body) return;
    setError('');
    try {
      await postComment(contentType, contentId, body, language);
      setComment('');
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Comment could not be posted.');
    }
  };
  return <section className="comment-box" aria-label={t('Comments')}><div className="comment-heading"><MessageCircle size={16} /><b>{t('Community comments')}</b></div>{comments.map(item => <div className="public-comment" key={item.id}><b>{item.displayName} {item.verifiedResident && <BadgeCheck size={13} aria-label={t('Verified resident')} />}</b><p>{item.body}</p></div>)}{verifiedResident ? <><textarea value={comment} onChange={event => { setComment(event.target.value); setSubmitted(false); }} placeholder={t('Leave a helpful comment')} rows={3} maxLength={500} /><div className="comment-actions"><small>{t('Be respectful and share useful local context.')}</small><button className="button button-outline" disabled={!comment.trim()} onClick={submit}>{t('Post comment')}</button></div></> : <p className="comment-gate">{t('Only verified residents can leave comments.')}</p>}{submitted && <p className="comment-success">{t('Your comment is awaiting review')}</p>}{error && <p className="comment-error">{t(error)}</p>}</section>;
}

function ResultArt({ result }: { result: SearchResult }) {
  const { t } = useTranslation();
  if (result.imageUrl) return <img className="result-art-upload" src={result.imageUrl} alt="" loading="lazy" />;
  const letter = result.type === 'listing' ? result.title.charAt(0) : result.type === 'service' ? '↗' : result.type === 'business' ? '✦' : '%';
  return <><span className="art-letter">{t(letter)}</span><span className="art-line art-line-one" /><span className="art-line art-line-two" />{result.type === 'listing' && <span className="art-object">{t(result.image === 'tv' ? '▣' : result.image === 'chair' ? '⌒' : result.image === 'scooter' ? '◒' : '▰')}</span>}{result.type === 'service' && <span className="art-service-mark"><Wrench size={38} /></span>}{result.type === 'business' && <span className="art-business-mark"><Store size={38} /></span>}{result.type === 'offer' && <span className="art-offer-mark"><Tag size={36} /></span>}</>;
}

function getSafetyMessage(result: SearchResult): string {
  if (result.type === 'listing' && result.category === 'Cars & motorcycles') return 'For vehicles: inspect with a trusted mechanic, verify ownership and registration documents, and do not send a deposit before the details are confirmed.';
  if (result.type === 'listing') return 'Choose a busy public place. Inspect the item before paying, and never share an OTP or send a deposit to an unknown seller.';
  if (result.type === 'service') return 'Agree on the scope, price and timing in writing. For an in-person service, consider meeting first in Madinaty or another busy public place when practical. Check reviews and credentials where relevant, avoid full payment upfront to an unknown provider, and never share an OTP or password.';
  if (result.type === 'business') return 'Confirm the business name, hours, price and delivery details through its listed contact. Be careful with unexpected payment links and never share an OTP.';
  return 'Check the offer terms, expiry date, redemption conditions and final price before paying. Use the business’s listed contact and avoid suspicious payment links.';
}

function EmptyState({ view, query, onReset }: { view: View; query: string; onReset: () => void }) {
  const { t } = useTranslation();
  return <div className="empty-state"><span className="empty-icon"><Search size={23} /></span><h2>{t("No matches yet")}</h2><p>{t(query ? `We couldn't find anything for “${query}”.` : `There are no saved ${view === 'saved' ? 'items' : 'results'} here yet.`)}</p><button className="button button-outline" onClick={onReset}>{t("Clear filters")}</button></div>;
}

function AdminAccessDenied({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return <div className="empty-state admin-access-denied"><span className="empty-icon"><ShieldCheck size={23} /></span><h2>{t('Admin access required')}</h2><p>{t('This dashboard is restricted to the Madinaty Deals administrator account.')}</p><button className="button button-outline" onClick={onBack}>{t('Back to app')}</button></div>;
}

function AdminView({ isAdmin, permissions, onBack }: { isAdmin: boolean; permissions: string[]; onBack: () => void }) {
  const { t } = useTranslation();
  const canViewDashboard = isAdmin || permissions.includes('DASHBOARD');
  const canViewReports = isAdmin || permissions.includes('REPORTS');
  const canViewContent = isAdmin || permissions.includes('CONTENT_REVIEW');
  const canViewVerifications = isAdmin || permissions.includes('RESIDENT_VERIFICATIONS');
  return <div className="admin-view operations-dashboard"><div className="page-intro"><div><span className="eyebrow">{t('OWNER DASHBOARD · OPERATIONS')}</span><h1>{t('Marketplace control center')}</h1><p>{t('Review content, handle reports and control publication from one place.')}</p></div><button className="button button-dark" onClick={onBack}>{t('Back to app')}</button></div>
    {canViewDashboard && <AdminOperations showHistory={isAdmin} />}
    {canViewContent && <AdminModeration isAdmin={isAdmin} canReadReports={canViewReports} />}
    {canViewReports && <AdminReports canHide={canViewContent} />}
    {canViewVerifications && <AdminReviewQueue />}
    {isAdmin && <AdminUsers />}
    {isAdmin && <RevenueDesk />}
  </div>;
}

function ModalShell({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const focusable = modal?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
    (focusable || modal)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !modal) return;
      const items = [...modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.(); };
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div ref={modalRef} className="modal" role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">{t(eyebrow)}</span><h2 id="modal-title">{t(title)}</h2></div><button className="icon-button" onClick={onClose} aria-label={t("Close dialog")}><X size={20} /></button></div>{children}</div></div>;
}

function RegistrationModal({ onClose, onRegistered, registrationEnabled, cognitoEnabled, signInError }: { onClose: () => void; onRegistered: (account: Account) => void; registrationEnabled: boolean; cognitoEnabled: boolean; signInError: string }) {
  const { t } = useTranslation();
  return <ModalShell title={registrationEnabled ? 'Sign in or create account' : 'Sign in'} eyebrow="A QUICK START" onClose={onClose}>{signInError && <p className="form-error" role="alert">{t(signInError)}</p>}<AuthForm registrationEnabled={registrationEnabled} cognitoEnabled={cognitoEnabled} onSignedIn={onRegistered} /></ModalShell>;
}

function PostModal({ onClose, onVerify, onPublish, onPublishService, accountId, residentVerified, rentalPostsThisMonth }: { onClose: () => void; onVerify: () => void; onPublish: (listing: Listing, published: boolean) => void; onPublishService: (service: Service, published: boolean) => void; accountId: string; residentVerified: boolean; rentalPostsThisMonth: number }) {
  const { t } = useTranslation();
  const [postType, setPostType] = useState<'choose' | 'listing' | 'service'>('choose');
  return <ModalShell title={postType === 'choose' ? 'Post something' : postType === 'service' ? 'Offer a service' : 'Post a listing'} eyebrow="SHARE WITH YOUR NEIGHBOURS" onClose={onClose}>
    {postType === 'choose' ? <div className="post-choice-grid">
      <button className="post-choice" onClick={() => setPostType('listing')}><span className="post-choice-icon"><Package size={23} /></span><span><b>{t('Sell an item')}</b><small>{t('Furniture, electronics and more')}</small></span><ArrowRight size={17} /></button>
      <button className="post-choice" onClick={() => setPostType('service')}><span className="post-choice-icon service-choice"><Wrench size={23} /></span><span><b>{t('Offer a service')}</b><small>{t('Tutoring, repairs and local help')}</small></span><ArrowRight size={17} /></button>
    </div> : postType === 'service' ? <><button className="back-to-choices" type="button" onClick={() => setPostType('choose')}><ArrowRight size={15} /> {t('Back to post types')}</button><ServiceForm onPublish={onPublishService} /></> : <><button className="back-to-choices" type="button" onClick={() => setPostType('choose')}><ArrowRight size={15} /> {t('Back to post types')}</button><ListingForm onPublish={onPublish} onVerify={onVerify} accountId={accountId} residentVerified={residentVerified} rentalPostsThisMonth={rentalPostsThisMonth} /></>}
  </ModalShell>;
}

function ReportModal({ result, onClose, onSubmit }: { result: SearchResult; onClose: () => void; onSubmit: (reason: string, details: string) => Promise<void> }) {
  const { t } = useTranslation();
  const reasons = ['Scam or fraud', 'Prohibited item or service', 'Duplicate or spam', 'Misleading information', 'Wrong category', 'Something else'];
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return <ModalShell title="Report this content" eyebrow="HELP KEEP IT TRUSTED" onClose={onClose}><form className="modal-form" onSubmit={async (event) => { event.preventDefault(); setError(''); setSubmitting(true); try { await onSubmit(reason, details); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'Report could not be submitted'); } finally { setSubmitting(false); } }}><p className="modal-intro">{t("You’re reporting ")}<b>{t(result.title)}</b>{t(". Reports are private and reviewed by the trust team.")}</p>{error && <p className="form-error" role="alert">{t(error)}</p>}<label>{t("What’s wrong?")}<select value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label><label>{t("Anything else? ")}<textarea rows={3} value={details} maxLength={1000} onChange={(event) => setDetails(event.target.value)} placeholder={t("Optional context for our review team")} /></label><div className="modal-foot"><span className="privacy-note"><Flag size={15} /> {t(" Your report stays private")}</span><button className="button button-dark" type="submit" disabled={submitting}>{t(submitting ? 'Submitting…' : "Submit report ")}<ArrowRight size={16} /></button></div></form></ModalShell>;
}

export default App;
