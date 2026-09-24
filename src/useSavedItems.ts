import { useEffect, useRef, useState } from 'react';
import { getSavedItems, removeAccountItem, saveAccountItem, type SavedItem } from './api';

export default function useSavedItems(accountId?: string) {
  const [guestSaved, setGuestSaved] = useState<Set<string>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('madinaty-favorites') || 'null');
      if (Array.isArray(saved)) return new Set(saved.filter((id): id is string => typeof id === 'string' && id.startsWith('submission-')));
    } catch { return new Set(); }
    return new Set();
  });
  const [remote, setRemote] = useState<{ accountId?: string; items: SavedItem[]; ready: boolean; error: string }>({ items: [], ready: false, error: '' });
  const pending = useRef(new Set<string>());
  const sequence = useRef(0);
  useEffect(() => {
    try { localStorage.setItem('madinaty-favorites', JSON.stringify([...guestSaved])); } catch { return; }
  }, [guestSaved]);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const load = async () => {
      const requestSequence = ++sequence.current;
      try {
        const result = await getSavedItems();
        if (active && requestSequence === sequence.current) setRemote({ accountId, items: result.saved, ready: true, error: '' });
      } catch {
        if (active && requestSequence === sequence.current) setRemote(current => ({ accountId, items: current.accountId === accountId ? current.items : [], ready: false, error: 'Could not load your saved items. Please retry.' }));
      }
    };
    void load();
    window.addEventListener('focus', load);
    window.addEventListener('madinaty-saved-refresh', load);
    return () => { active = false; window.removeEventListener('focus', load); window.removeEventListener('madinaty-saved-refresh', load); };
  }, [accountId]);
  const items = remote.accountId === accountId ? remote.items : [];
  const ready = !accountId || (remote.accountId === accountId && remote.ready);
  const favorites = accountId ? new Set(items.map(item => `submission-${item.id}`)) : guestSaved;
  async function toggle(id: string) {
    if (!accountId) {
      setGuestSaved(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
      return;
    }
    if (!ready) throw new Error('Wait for your saved items to load, then retry.');
    const key = `${accountId}:${id}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    ++sequence.current;
    try {
      const submissionId = id.replace(/^submission-/, '');
      if (favorites.has(id)) await removeAccountItem(submissionId);
      else await saveAccountItem(submissionId);
      const result = await getSavedItems();
      setRemote(current => current.accountId === accountId ? { accountId, items: result.saved, ready: true, error: '' } : current);
    } finally {
      pending.current.delete(key);
      window.dispatchEvent(new Event('madinaty-saved-refresh'));
    }
  }
  return { favorites, items, ready, error: remote.accountId === accountId ? remote.error : '', toggle };
}
