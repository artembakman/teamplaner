'use client';
import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Team } from '@/lib/calendar';

type Notification = { id: string; title: string; body: string; created: string; read_at: string | null; url: string };
function decodeKey(value: string) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function post(body: unknown) {
  const response = await fetch('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Aktion fehlgeschlagen.'); return result;
}
export default function PushCenter({ admin, teams }: { admin: boolean; teams: Team[] }) {
  const [open, setOpen] = useState(false), [enabled, setEnabled] = useState(false), [supported, setSupported] = useState(false);
  const [items, setItems] = useState<Notification[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [audience, setAudience] = useState('all');
  const unread = items.filter(item => !item.read_at).length;
  async function refresh() {
    const r = await fetch('/api/notifications', { cache: 'no-store' }), data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Mitteilungen konnten nicht geladen werden.');
    setEnabled(data.enabled); setItems(data.notifications);
  }
  useEffect(() => { setSupported('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window); refresh().catch(e => setError(e.message)); }, []);
  async function toggle() {
    setBusy(true); setError('');
    try {
      if (enabled) { await post({ action: 'preference', enabled: false }); setEnabled(false); return; }
      if (!supported) throw new Error('Push-Mitteilungen werden von diesem Browser nicht unterstützt.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Bitte erlaube Mitteilungen in den Browser-Einstellungen.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      const response = await fetch('/api/notifications', { cache: 'no-store' }), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registrierung fehlgeschlagen.');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(data.publicKey) });
      await post({ action: 'subscribe', subscription: subscription.toJSON() });
      await post({ action: 'preference', enabled: true }); setEnabled(true);
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function broadcast(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await post({ action: 'broadcast', title, body, audience }); setTitle(''); setBody(''); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function markRead(item: Notification) {
    if (!item.read_at) { await post({ action: 'read', id: item.id }); await refresh(); }
    if (item.url && item.url !== '/') window.location.href = item.url;
  }
  return <>
    <button className="iconbutton push-open" aria-label={`Mitteilungen${unread ? `, ${unread} ungelesen` : ''}`} onClick={() => { setOpen(true); refresh().catch(e => setError(e.message)); }}><Bell size={18}/>{unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="push-dialog"><DialogHeader><DialogTitle>Mitteilungen</DialogTitle><DialogDescription>Ein Schalter für Push auf diesem Gerät. Hinweise bleiben zusätzlich hier gespeichert.</DialogDescription></DialogHeader>
      <div className="push-toggle"><span><strong>Push-Mitteilungen</strong><small>{enabled ? 'Für dein Konto eingeschaltet' : 'Für dein Konto ausgeschaltet'}</small></span><button className={enabled ? 'primary' : 'secondary'} disabled={busy || !supported} onClick={toggle}>{busy ? 'Bitte warten …' : enabled ? 'Ausschalten' : 'Einschalten'}</button></div>
      {error && <p className="notice error" role="alert">{error}</p>}
      {admin && <form className="push-broadcast" onSubmit={broadcast}><h3>Mitteilung senden</h3><label>Empfänger<select value={audience} onChange={e => setAudience(e.target.value)}><option value="all">Alle</option>{teams.filter(t=>t.is_assignable&&t.id!=='leitung').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Titel<input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder="z. B. Kurzer Hinweis"/></label><label>Nachricht<textarea required maxLength={240} rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Deine Nachricht an das Team"/></label><button className="primary" disabled={busy}><Send size={16}/>Senden</button></form>}
      <section className="push-inbox"><h3>Letzte Mitteilungen</h3>{items.length ? items.map(item => <button key={item.id} className={'push-item '+(!item.read_at ? 'unread' : '')} onClick={() => markRead(item)}><strong>{item.title}</strong><span>{item.body}</span><small>{new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created))}</small></button>) : <p className="muted">Noch keine Mitteilungen.</p>}</section>
    </DialogContent></Dialog>
  </>;
}
