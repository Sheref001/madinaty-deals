import { CalendarDays, GraduationCap, Megaphone } from 'lucide-react';
import { useTranslation } from './i18n';

export default function EliteAdSpace({ onAdvertise, compact = false }: { onAdvertise: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  return <section className={`elite-ad-space ${compact ? 'elite-ad-preview' : ''}`} aria-label={t('Elite daily advertising space')}>
    <div className="elite-ad-intro"><span className="elite-icon"><Megaphone size={18} /></span><div><span className="eyebrow">{t('ELITE DAILY SPOT')}</span><h2>{t('Put your business first in the neighbourhood.')}</h2><p>{t('One premium homepage placement, sold by the day.')}</p></div><span className="elite-rate"><strong>300 EGP</strong><small>{t('per day')}</small></span></div>
    <div className="elite-ad-card"><div className="elite-ad-art tutor-art"><GraduationCap size={30} /><span>{t('Demo ad')}</span></div><div className="elite-ad-copy"><span className="elite-date"><CalendarDays size={14} /> {t('TODAY · ELITE FEATURE')}</span><h3>{t('Ms. Salma · English Tutor')}</h3><p>{t('Experienced English tutor for International and Thanaweya Amma schools.')}</p><div className="elite-tags"><span>{t('IGCSE & American Diploma')}</span><span>{t('1-to-1 and small groups')}</span></div></div><button className="button button-warm" onClick={onAdvertise}>{t('Book this day')}</button></div>
  </section>;
}
