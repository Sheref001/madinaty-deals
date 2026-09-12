import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, CircleDollarSign, PauseCircle, Plus, Send, WalletCards } from 'lucide-react';
import { useTranslation } from './i18n';

type BillingStatus = 'active' | 'due' | 'overdue' | 'suspended';
type RevenueRecord = {
  id: string;
  business: string;
  contact: string;
  plan: string;
  monthlyFee: number;
  promotion: number;
  nextDue: string;
  lastPaid: string;
  paymentMethod: string;
  status: BillingStatus;
  adStatus: 'live' | 'paused';
  reminders: number;
};

const storageKey = 'madinaty-revenue-records-v1';
const seedRecords: RevenueRecord[] = [
  { id: 'MD-BUS-0012', business: 'Craft Zone Poultry', contact: 'Ahmed · 0100 000 0012', plan: 'Monthly listing', monthlyFee: 500, promotion: 0, nextDue: '2026-09-15', lastPaid: '2026-08-15', paymentMethod: 'InstaPay', status: 'active', adStatus: 'live', reminders: 0 },
  { id: 'MD-BUS-0013', business: 'Madinaty Math Tutor', contact: 'Mariam · 0100 000 0013', plan: 'Monthly listing', monthlyFee: 500, promotion: 200, nextDue: '2026-09-12', lastPaid: '2026-08-12', paymentMethod: 'Vodafone Cash', status: 'due', adStatus: 'live', reminders: 1 },
  { id: 'MD-BUS-0014', business: 'Clean Home Services', contact: 'Nour · 0100 000 0014', plan: 'Monthly listing', monthlyFee: 500, promotion: 300, nextDue: '2026-09-05', lastPaid: '2026-08-05', paymentMethod: 'Fawry', status: 'overdue', adStatus: 'paused', reminders: 2 },
];

function loadRecords(): RevenueRecord[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (Array.isArray(saved)) return saved;
  } catch { /* Use the starter ledger when storage is unavailable. */ }
  return seedRecords;
}

function money(value: number) { return `${value.toLocaleString('en-EG')} EGP`; }
function addBillingMonth(dateValue: string) {
  const date = new Date(`${dateValue || new Date().toISOString().slice(0, 10)}T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export default function RevenueDesk() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<RevenueRecord[]>(loadRecords);
  const [showForm, setShowForm] = useState(false);
  const [newBusiness, setNewBusiness] = useState('');
  const [newContact, setNewContact] = useState('');

  const persist = (next: RevenueRecord[]) => {
    setRecords(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The ledger remains available for this visit. */ }
  };
  const totals = useMemo(() => ({
    expected: records.reduce((sum, record) => sum + record.monthlyFee + record.promotion, 0),
    collected: records.filter(record => record.status === 'active').reduce((sum, record) => sum + record.monthlyFee + record.promotion, 0),
    due: records.filter(record => record.status !== 'active').reduce((sum, record) => sum + record.monthlyFee + record.promotion, 0),
    overdue: records.filter(record => record.status === 'overdue' || record.status === 'suspended').length,
  }), [records]);

  const markPaid = (id: string) => persist(records.map(record => record.id === id ? { ...record, status: 'active', adStatus: 'live', lastPaid: new Date().toISOString().slice(0, 10), nextDue: addBillingMonth(record.nextDue), reminders: 0 } : record));
  const sendReminder = (id: string) => persist(records.map(record => record.id === id ? { ...record, reminders: record.reminders + 1 } : record));
  const pauseAd = (id: string) => persist(records.map(record => record.id === id ? { ...record, adStatus: 'paused', status: record.status === 'active' ? 'suspended' : record.status } : record));
  const addRecord = () => {
    if (!newBusiness.trim()) return;
    const id = `MD-BUS-${String(records.length + 12).padStart(4, '0')}`;
    persist([...records, { id, business: newBusiness.trim(), contact: newContact.trim() || t('Contact not added'), plan: 'Monthly listing', monthlyFee: 500, promotion: 0, nextDue: new Date().toISOString().slice(0, 10), lastPaid: '', paymentMethod: 'Not selected', status: 'due', adStatus: 'paused', reminders: 0 }]);
    setNewBusiness(''); setNewContact(''); setShowForm(false);
  };

  return <section className="revenue-desk">
    <div className="revenue-heading"><div><span className="eyebrow">{t('REVENUE · BILLING')}</span><h2>{t('Advertiser payments')}</h2><p>{t('One-person ledger for subscriptions, promotions and renewal follow-up.')}</p></div><button className="button button-dark" onClick={() => setShowForm(value => !value)}><Plus size={15} /> {t('Add advertiser')}</button></div>
    {showForm && <div className="revenue-add-form"><input value={newBusiness} onChange={event => setNewBusiness(event.target.value)} placeholder={t('Business name')} aria-label={t('Business name')} /><input value={newContact} onChange={event => setNewContact(event.target.value)} placeholder={t('WhatsApp or contact')} aria-label={t('WhatsApp or contact')} /><button className="button button-warm" onClick={addRecord}>{t('Create due record')}</button></div>}
    <div className="revenue-stats"><div><CircleDollarSign size={17} /><span><b>{money(totals.expected)}</b><small>{t('Expected this cycle')}</small></span></div><div><CheckCircle2 size={17} /><span><b>{money(totals.collected)}</b><small>{t('Marked collected')}</small></span></div><div><WalletCards size={17} /><span><b>{money(totals.due)}</b><small>{t('Needs follow-up')}</small></span></div><div><AlertTriangle size={17} /><span><b>{totals.overdue}</b><small>{t('Overdue accounts')}</small></span></div></div>
    <div className="revenue-note"><Bell size={17} /><span><b>{t('Pilot workflow')}</b> {t('Verify InstaPay, Vodafone Cash or provider-dashboard payments yourself before marking an account paid. Screenshots are not proof of settlement.')}</span></div>
    <div className="revenue-table-wrap"><table className="revenue-table"><thead><tr><th>{t('Advertiser')}</th><th>{t('Due')}</th><th>{t('Amount')}</th><th>{t('Payment')}</th><th>{t('Status')}</th><th>{t('Actions')}</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><strong>{record.business}</strong><small>{record.id} · {record.contact}</small></td><td><span className="due-date"><CalendarClock size={14} />{record.nextDue}</span></td><td><strong>{money(record.monthlyFee + record.promotion)}</strong><small>{record.promotion ? `+ ${money(record.promotion)} ${t('promotion')}` : t('monthly listing')}</small></td><td>{record.paymentMethod}</td><td><span className={`billing-pill ${record.status}`}>{t(record.status)}</span><small>{record.adStatus === 'paused' ? t('Ad paused') : t('Ad live')}</small></td><td><div className="revenue-actions">{record.status !== 'active' && <button className="small-action" onClick={() => markPaid(record.id)}><CheckCircle2 size={13} /> {t('Mark paid')}</button>}<button className="small-action" onClick={() => sendReminder(record.id)}><Send size={13} /> {t('Remind')} ({record.reminders})</button>{record.adStatus === 'live' && <button className="small-action danger-action" onClick={() => pauseAd(record.id)}><PauseCircle size={13} /> {t('Pause ad')}</button>}</div></td></tr>)}</tbody></table></div>
  </section>;
}
