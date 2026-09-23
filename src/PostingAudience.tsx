import { useTranslation } from './i18n';
import type { AdvertiserType, BusinessRequest } from './types';

import { businessOnlyCategories, businessTerms, individualOnlyCategories, tutoringCategories } from './categoryPolicy';

export default function PostingAudience({ category, value, request, onChange, onRequestChange }: { category: string; value: AdvertiserType | ''; request: BusinessRequest; onChange: (value: AdvertiserType) => void; onRequestChange: (value: BusinessRequest) => void }) {
  const { t } = useTranslation();
  if (!category) return null;
  const businessOnly = businessOnlyCategories.includes(category);
  const individualOnly = individualOnlyCategories.includes(category);
  const tutoring = tutoringCategories.includes(category);
  const effectiveValue = businessOnly ? 'small_business' : individualOnly ? 'individual' : value;
  return <section className="posting-audience">
    <h3>{t('Who is posting?')}</h3>
    {businessOnly ? <p>{t('This category is for businesses. Posting is held until the agreed fee and checks are complete.')}</p>
      : individualOnly ? <p>{t('This category is for individual residents. Business and broker posts are not allowed.')}</p>
        : <div className="posting-audience-options" role="radiogroup" aria-label={t('Who is posting?')}>
          <label className={value === 'individual' ? 'selected' : ''}><input type="radio" name="advertiserType" value="individual" checked={value === 'individual'} onChange={() => onChange('individual')} /><span><b>{t('I am an individual')}</b><small>{t('I am posting for myself.')}</small></span></label>
          <label className={value === 'small_business' ? 'selected' : ''}><input type="radio" name="advertiserType" value="small_business" checked={value === 'small_business'} onChange={() => onChange('small_business')} /><span><b>{t(tutoring ? 'I represent a tutoring centre' : 'I represent a business')}</b><small>{t('I am posting on behalf of a shop, centre or company.')}</small></span></label>
        </div>}
    {effectiveValue === 'small_business' && !businessOnly && <><p>{t(tutoring ? 'Tutoring centres require an agreed fee and approval before their posts appear.' : businessTerms)}</p>{!tutoring && <label>{t('Business request')}<select value={request} onChange={event => onRequestChange(event.target.value as BusinessRequest)}><option value="posting">{t('Paid posting')}</option><option value="authentication">{t('Business authentication')}</option><option value="both">{t('Posting and authentication')}</option></select></label>}</>}
    {effectiveValue === 'individual' && !individualOnly && <p>{t(category === 'Health & fitness' ? 'Health and fitness posts require an agreed fee, including individual trainers.' : 'Individual posts in this category are free.')}</p>}
  </section>;
}
