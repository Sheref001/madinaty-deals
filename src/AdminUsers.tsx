import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ShieldCheck, UserPlus, UserRound, UserX, X } from 'lucide-react';
import { createModeratorAssignment, getAdminUsers, getModeratorAssignments, revokeModeratorAssignment, updateAdminUserRole, updateAdminUserStatus, type AdminUser, type ModeratorAssignment, type ModeratorPermission } from './api';
import { useTranslation } from './i18n';

const roles = ['RESIDENT', 'SERVICE_PROVIDER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN'];
const permissionOptions: { value: ModeratorPermission; label: string }[] = [
  { value: 'DASHBOARD', label: 'Dashboard and analytics' },
  { value: 'REPORTS', label: 'Reports and content safety' },
  { value: 'RESIDENT_VERIFICATIONS', label: 'Resident verification' },
  { value: 'CONTENT_REVIEW', label: 'Content review' },
];

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [moderators, setModerators] = useState<ModeratorAssignment[]>([]);
  const [showModeratorForm, setShowModeratorForm] = useState(false);
  const [moderatorName, setModeratorName] = useState('');
  const [moderatorEmail, setModeratorEmail] = useState('');
  const [moderatorPhone, setModeratorPhone] = useState('');
  const [moderatorPermissions, setModeratorPermissions] = useState<ModeratorPermission[]>(['REPORTS']);
  const fetchUsers = () => Promise.all([getAdminUsers(), getModeratorAssignments()]).then(([userResult, moderatorResult]) => { setUsers(userResult.users); setModerators(moderatorResult.moderators); setError(''); }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load users')).finally(() => setLoading(false));
  const refresh = () => { setLoading(true); void fetchUsers(); };
  useEffect(() => { void fetchUsers(); }, []);
  const change = async (user: AdminUser, action: 'role' | 'status', value: string) => {
    const prompt = action === 'role'
      ? value === 'ADMIN' ? t('Give this user administrator access?') : t('Change this user’s role?')
      : value === 'SUSPENDED' ? t('Suspend this account?') : t('Reactivate this account?');
    if (!window.confirm(prompt)) return;
    setBusy(`${action}:${user.id}`); setError('');
    try {
      const result = action === 'role' ? await updateAdminUserRole(user.id, value) : await updateAdminUserStatus(user.id, value);
      setUsers(current => current.map(item => item.id === user.id ? result.user : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update user'); }
    finally { setBusy(''); }
  };
  const addModerator = async (event: FormEvent) => {
    event.preventDefault();
    if (!moderatorName.trim() || (!moderatorEmail.trim() && !moderatorPhone.trim()) || !moderatorPermissions.length) return;
    setBusy('moderator'); setError('');
    try {
      const result = await createModeratorAssignment({ name: moderatorName.trim(), ...(moderatorEmail.trim() ? { email: moderatorEmail.trim() } : {}), ...(moderatorPhone.trim() ? { phone: moderatorPhone.trim() } : {}), permissions: moderatorPermissions });
      setModerators(current => [result.moderator, ...current]); setModeratorName(''); setModeratorEmail(''); setModeratorPhone(''); setModeratorPermissions(['REPORTS']); setShowModeratorForm(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not assign moderator'); }
    finally { setBusy(''); }
  };
  const revokeModerator = async (moderator: ModeratorAssignment) => {
    if (!window.confirm(t('Revoke this moderator assignment?'))) return;
    setBusy(`revoke:${moderator.id}`); setError('');
    try { await revokeModeratorAssignment(moderator.id); setModerators(current => current.map(item => item.id === moderator.id ? { ...item, status: 'REVOKED' } : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not revoke moderator'); }
    finally { setBusy(''); }
  };
  return <section className="admin-panel admin-users-panel">
    <div className="panel-heading"><div><span className="eyebrow">{t('ACCESS · COLLABORATORS')}</span><h2>{t('Users and collaborators')}</h2><p className="admin-panel-copy">{t('Manage accounts and assign limited moderator tasks. A moderator receives access after signing in with the assigned email or phone.')}</p></div><div className="dashboard-actions"><button className="button button-outline" onClick={() => setShowModeratorForm(value => !value)}><UserPlus size={15} />{t('Add a moderator')}</button><button className="button button-outline" onClick={refresh} disabled={loading}>{t('Refresh')}</button></div></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {showModeratorForm && <form className="moderator-assignment-form" onSubmit={addModerator}><h3>{t('Assign a moderator')}</h3><p>{t('Use one verified contact method. No invitation is sent; the assignment activates when the person signs in.')}</p><label>{t('Name')}<input value={moderatorName} onChange={event => setModeratorName(event.target.value)} minLength={2} maxLength={80} required /></label><div className="form-row"><label>{t('Email or Gmail')}<input type="email" value={moderatorEmail} onChange={event => setModeratorEmail(event.target.value)} placeholder="name@gmail.com" /></label><label>{t('Telephone number')}<input type="tel" value={moderatorPhone} onChange={event => setModeratorPhone(event.target.value)} placeholder="+20 1X XXX XXXX" /></label></div><fieldset><legend>{t('Assigned tasks')}</legend>{permissionOptions.map(option => <label key={option.value}><input type="checkbox" checked={moderatorPermissions.includes(option.value)} onChange={event => setModeratorPermissions(current => event.target.checked ? [...new Set([...current, option.value])] : current.filter(item => item !== option.value))} />{t(option.label)}</label>)}</fieldset><div className="modal-foot"><button type="button" className="button button-outline" onClick={() => setShowModeratorForm(false)}>{t('Cancel')}</button><button className="button button-accent" type="submit" disabled={busy === 'moderator' || !moderatorPermissions.length}>{t(busy === 'moderator' ? 'Please wait…' : 'Assign moderator')}<Check size={15} /></button></div></form>}
    {moderators.length > 0 && <section className="moderator-assignment-list"><h3>{t('Moderator assignments')}</h3>{moderators.map(moderator => <article key={moderator.id}><div><b>{moderator.name}</b><small>{moderator.email || moderator.phone} · {moderator.status === 'ACTIVE' ? t('Active') : moderator.status === 'REVOKED' ? t('Revoked') : t('Waiting for first sign-in')}</small><small>{moderator.permissions.map(permission => t(permissionOptions.find(option => option.value === permission)?.label || permission)).join(' · ')}</small></div>{moderator.status !== 'REVOKED' && <button className="small-action danger-action" disabled={busy === `revoke:${moderator.id}`} onClick={() => revokeModerator(moderator)}><X size={13} />{t('Revoke')}</button>}</article>)}</section>}
    {loading ? <p className="dashboard-empty">{t('Loading users…')}</p> : users.length === 0 ? <p className="dashboard-empty">{t('No accounts have been created yet.')}</p> : <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th>{t('User')}</th><th>{t('Role')}</th><th>{t('Status')}</th><th>{t('Created')}</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><span className="admin-user-name"><span className="admin-user-icon"><UserRound size={15} /></span><span><b>{user.name}</b><small>{user.email || user.phone || t('No contact')}</small>{user.residentVerified && <em><ShieldCheck size={12} /> {t('Verified resident')}</em>}</span></span></td><td><select value={user.role} disabled={busy === `role:${user.id}`} onChange={event => change(user, 'role', event.target.value)} aria-label={`${t('Role')} ${user.name}`}>{roles.map(role => <option value={role} key={role}>{role}</option>)}</select></td><td><button className={`status-toggle ${user.status.toLowerCase()}`} disabled={busy === `status:${user.id}`} onClick={() => change(user, 'status', user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')} aria-label={`${t(user.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account')} ${user.name}`}><UserX size={13} />{t(user.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account')}</button></td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
  </section>;
}
