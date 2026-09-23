import { ArrowUpRight, CalendarDays, Mail, Megaphone } from 'lucide-react';
import { useTranslation } from './i18n';

const contactEmail = 'hello@madinatydeals.com';

export default function EliteAdSpace() {
  const { t } = useTranslation();
  return <section className="elite-ad-space" aria-label={t('Featured listing promotion')}>
    <div className="elite-ad-copy">
      <span className="elite-icon"><Megaphone size={19} /></span>
      <div>
        <span className="eyebrow">{t('FEATURED LISTING')}</span>
        <h2>{t('Make your business the neighbourhood’s daily feature.')}</h2>
        <p>{t('One premium place on the homepage, reserved one day at a time.')}</p>
      </div>
    </div>
    <div className="elite-email-panel">
      <div className="elite-email-details">
        <span className="elite-availability"><CalendarDays size={15} />{t('A featured spot, every day')}</span>
        <p>{t('Email us to ask about available dates and pricing.')}</p>
      </div>
      <a className="elite-email-button" href={`mailto:${contactEmail}?subject=Featured%20listing%20inquiry`} aria-label={`${t('Email us about the featured spot')} — ${contactEmail}`}>
        <span className="elite-email-icon"><Mail size={19} /></span>
        <span><b>{t('Send us an email')}</b><small>{contactEmail}</small></span>
        <ArrowUpRight size={18} className="elite-email-arrow" />
      </a>
    </div>
  </section>;
}
