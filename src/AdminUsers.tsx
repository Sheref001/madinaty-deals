import { useEffect, useState } from 'react';
import { ShieldCheck, UserRound, UserX } from 'lucide-react';
import { getAdminUsers, updateAdminUserRole, updateAdminUserStatus, type AdminUser } from './api';
import { useTranslation } from './i18n';

const roles = ['RESIDENT', 'SERVICE_PROVIDER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN'];

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const fetchUsers = () => getAdminUsers().then(result => { setUsers(result.users); setError(''); }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load users')).finally(() => setLoading(false));
  const refresh = () => { setLoading(true); void fetchUsers(); };
  useEffect(() => { void fetchUsers(); }, []);
  const change = async (user: AdminUser, action: 'role' | 'status', value: string) => {
    setBusy(`${action}:${user.id}`); setError('');
    try {
      const result = action === 'role' ? await updateAdminUserRole(user.id, value) : await updateAdminUserStatus(user.id, value);
      setUsers(current => current.map(item => item.id === user.id ? result.user : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update user'); }
    finally { setBusy(''); }
  };
  return <section className="admin-panel admin-users-panel">
    <div className="panel-heading"><div><span className="eyebrow">{t('ACCESS · COLLABORATORS')}</span><h2>{t('Users and collaborators')}</h2><p className="admin-panel-copy">{t('Assign staff roles, suspend access and keep the owner account protected.')}</p></div><button className="button button-outline" onClick={refresh} disabled={loading}>{t('Refresh')}</button></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {loading ? <p className="dashboard-empty">{t('Loading users…')}</p> : <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th>{t('User')}</th><th>{t('Role')}</th><th>{t('Status')}</th><th>{t('Created')}</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><span className="admin-user-name"><span className="admin-user-icon"><UserRound size={15} /></span><span><b>{user.name}</b><small>{user.email || user.phone || t('No contact')}</small>{user.residentVerified && <em><ShieldCheck size={12} /> {t('Verified resident')}</em>}</span></span></td><td><select value={user.role} disabled={busy === `role:${user.id}`} onChange={event => change(user, 'role', event.target.value)} aria-label={`${t('Role')} ${user.name}`}>{roles.map(role => <option value={role} key={role}>{role}</option>)}</select></td><td><button className={`status-toggle ${user.status.toLowerCase()}`} disabled={busy === `status:${user.id}`} onClick={() => change(user, 'status', user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}><UserX size={13} />{user.status === 'ACTIVE' ? t('Active') : t('Suspended')}</button></td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
  </section>;
}
