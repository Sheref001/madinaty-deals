import { CircleDollarSign } from 'lucide-react';
import { useTranslation } from './i18n';

export default function RevenueDesk() {
  const { t } = useTranslation();
  return <section className="revenue-desk revenue-unavailable">
    <div className="revenue-heading"><div><span className="eyebrow">{t('REVENUE · BILLING')}</span><h2>{t('Advertiser payments')}</h2><p>{t('Payment records and ad billing controls are not connected to live server data yet.')}</p></div></div>
    <div className="revenue-note"><CircleDollarSign size={17} /><span><b>{t('Unavailable')}</b> {t('No payment is recorded, reminder sent or advertisement paused from this panel.')}</span></div>
  </section>;
}
