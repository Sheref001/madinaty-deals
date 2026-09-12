import { CalendarDays, Megaphone, Sparkles } from 'lucide-react';
import { useTranslation } from './i18n';

export default function EliteAdSpace({ onAdvertise }: { onAdvertise: () => void }) {
  const { t } = useTranslation();
  return <section className="elite-ad-space" aria-label={t('Elite daily advertising space')}>
    <div className="elite-ad-intro"><span className="elite-icon"><Megaphone size={18} /></span><div><span className="eyebrow">{t('ELITE DAILY SPOT')}</span><h2>{t('Put your business first in the neighbourhood.')}</h2><p>{t('One premium homepage placement, sold by the day.')}</p></div><span className="elite-rate"><strong>300 EGP</strong><small>{t('per day')}</small></span></div>
    <div className="elite-ad-card"><div className="elite-ad-art"><Sparkles size={28} /><span>{t('Sponsored')}</span></div><div className="elite-ad-copy"><span className="elite-date"><CalendarDays size={14} /> {t('TODAY · AVAILABLE')}</span><h3>{t('Your business could be here')}</h3><p>{t('Reach neighbours at the moment they open Madinaty Deals.')}</p></div><button className="button button-warm" onClick={onAdvertise}>{t('Book this day')}</button></div>
  </section>;
}
