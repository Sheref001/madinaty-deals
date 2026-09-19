import { useTranslation } from './i18n';
import type { AdvertiserType, BusinessRequest } from './types';

import { splitCategories, businessOnlyCategories, businessTerms, tutoringCategories } from './categoryPolicy';

export default function PostingAudience({ category, value, request, onChange, onRequestChange, preview = false }: { category: string; value: AdvertiserType; request: BusinessRequest; onChange: (value: AdvertiserType) => void; onRequestChange: (value: BusinessRequest) => void; preview?: boolean }) {
  const { t } = useTranslation();
  const businessOnly = businessOnlyCategories.includes(category);
  const tutoring = tutoringCategories.includes(category);
  const effectiveValue = businessOnly ? 'small_business' : value;
  if (!businessOnly && !splitCategories.includes(category)) return null;
  return <section className="posting-audience">
    {!businessOnly && (preview ? <p><b>{t(tutoring ? 'Tutoring subcategory' : 'Advertiser type')}: </b>{t(value === 'individual' ? 'Individuals' : tutoring ? 'Tutoring centres' : 'Small businesses')}</p> : <label>{t(tutoring ? 'Tutoring subcategory' : 'Advertiser type')}<select value={value} onChange={event => onChange(event.target.value as AdvertiserType)}><option value="individual">{t('Individuals')}</option><option value="small_business">{t(tutoring ? 'Tutoring centres' : 'Small businesses')}</option></select></label>)}
    {!tutoring && <p>{t(effectiveValue === 'individual' ? 'Individual ads are free.' : businessTerms)}</p>}
    {effectiveValue === 'small_business' && !tutoring && (preview ? <p>{t('Business request')}: {t(request === 'posting' ? 'Paid posting' : request === 'authentication' ? 'Business authentication' : 'Posting and authentication')}</p> : <label>{t('Business request')}<select value={request} onChange={event => onRequestChange(event.target.value as BusinessRequest)}><option value="posting">{t('Paid posting')}</option><option value="authentication">{t('Business authentication')}</option><option value="both">{t('Posting and authentication')}</option></select></label>)}
  </section>;
}
