import { Camera, MessageCircle, Handshake, ArrowRight } from 'lucide-react';
import { useTranslation } from './i18n';
import type { View } from './types';

export function CommunityGuide() {
  const { t } = useTranslation();
  const steps = [
    { icon: Camera, title: 'Describe what you’re selling', body: 'Add a clear title, an honest description and your asking price.' },
    { icon: MessageCircle, title: 'Connect with a neighbour', body: 'Use WhatsApp or a call to ask questions and arrange the details.' },
    { icon: Handshake, title: 'Meet and check the item', body: 'Meet in a public place, inspect the item and agree on payment together.' },
  ];
  return <section className="community-guide" aria-labelledby="how-it-works">
    <span className="eyebrow">{t('NEIGHBOURS HELPING NEIGHBOURS')}</span>
    <h2 id="how-it-works">{t('How it works')}</h2>
    <p>{t('Give good things a new home, close to yours.')}</p>
    <ol className="guide-grid">{steps.map(({ icon: Icon, title, body }, index) => <li key={title}>
      <span className="guide-step"><Icon size={24} /><span>{index + 1}</span></span>
      <h3>{t(title)}</h3><p>{t(body)}</p>
    </li>)}</ol>
  </section>;
}

export function CommunityFooter({ goTo, onPost }: { goTo: (view: View) => void; onPost: () => void }) {
  const { t, language } = useTranslation();
  return <footer className="community-footer" id="contact-us">
    <div className="footer-intro"><b>{t('Madinaty')} {t('Deals')}</b><p>{t('A place for neighbours to buy, sell and discover local services.')}</p></div>
    <nav aria-label={t('Explore the community')}>
      <h3>{t('Explore')}</h3>
      <button onClick={() => goTo('browse')}>{t('Buy & sell')} <ArrowRight size={14} /></button>
      <button onClick={() => goTo('services')}>{t('Services')} <ArrowRight size={14} /></button>
      <button onClick={() => goTo('businesses')}>{t('Businesses')} <ArrowRight size={14} /></button>
      <button onClick={onPost}>{t('Post a listing')} <ArrowRight size={14} /></button>
    </nav>
    <section className="footer-info" aria-label={t('Info')}>
      <h3>{t('Info')}</h3>
      <details><summary>{t('About Madinaty Deals')}</summary><p>{t('A local place for Madinaty residents, businesses and service providers to be discovered.')}</p></details>
      <details><summary>{t('Verification')}</summary><p>{t('Verification adds context to a profile; it does not guarantee a transaction or replace your own checks.')}</p></details>
      <details><summary>{t('Posting rules')}</summary><p>{t('Post one real item or service at a time, choose the correct category and write clear, honest details.')}</p></details>
      <details><summary>{t('Apartment rentals')}</summary><p>{t('Apartment rentals are for verified Madinaty residents only. Brokers and dealers are not allowed.')}</p></details>
    </section>
    <section className="footer-help" aria-label={t('Help and safety')}>
      <h3>{t('Help and safety')}</h3>
      <details><summary>{t('Meeting safely')}</summary><p>{t('Choose a busy public place. Inspect the item before paying, and never share an OTP or send a deposit to an unknown seller.')}</p></details>
      <details><summary>{t('How do I report a problem?')}</summary><p>{t('Open a collection, find the item or provider, and use the flag button to report it for review.')}</p></details>
      <details><summary>{t('Is posting free?')}</summary><p>{t('Ordinary resident listings are free during the validation period.')}</p></details>
      <p className="footer-contact"><b>{t('Contact Madinaty Deals')}</b><br /><a href="mailto:hello@madinatydeals.com" dir="ltr">hello@madinatydeals.com</a></p>
      <p className="footer-legal-link"><a href={language === 'ar' ? '/terms-of-use-ar.html' : '/terms-of-use.html'}>{t('Terms of Use')}</a></p>
    </section>
    <p className="footer-note">{t('Built for the Madinaty community.')} · {new Date().getFullYear()} <span className="company-signature">{t('A Connected Community Solutions Product')}</span></p>
  </footer>;
}
