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
  const { t } = useTranslation();
  return <footer className="community-footer">
    <div className="footer-intro"><b>{t('Madinaty')} {t('Deals')}</b><p>{t('A place for neighbours to buy, sell and discover local services.')}</p></div>
    <nav aria-label={t('Explore the community')}>
      <h3>{t('Explore')}</h3>
      <button onClick={() => goTo('browse')}>{t('Buy & sell')} <ArrowRight size={14} /></button>
      <button onClick={() => goTo('services')}>{t('Services')} <ArrowRight size={14} /></button>
      <button onClick={() => goTo('businesses')}>{t('Businesses')} <ArrowRight size={14} /></button>
      <button onClick={onPost}>{t('Post a listing')} <ArrowRight size={14} /></button>
    </nav>
    <section className="footer-help" aria-label={t('Help and safety')}>
      <h3>{t('Help and safety')}</h3>
      <details><summary>{t('Meeting safely')}</summary><p>{t('Choose a busy public place. Inspect the item before paying, and never share an OTP or send a deposit to an unknown seller.')}</p></details>
      <details><summary>{t('How do I report a problem?')}</summary><p>{t('Open a collection, find the item or provider, and use the flag button to report it for review.')}</p></details>
      <details><summary>{t('Is posting free?')}</summary><p>{t('Ordinary resident listings are free during the validation period.')}</p></details>
    </section>
    <p className="footer-note">{t('Built for the Madinaty community.')} · {new Date().getFullYear()}</p>
  </footer>;
}
