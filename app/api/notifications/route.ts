import { randomUUID } from 'node:crypto';
import { sameOrigin } from '@/server/security.mjs';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { db } from '@/db/raw';
import { vapidPublicKey, notifyUsers } from '@/server/notifications.mjs';

export const dynamic = 'force-dynamic';
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const pushHosts = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com']);
export async function GET() {
  try {
    const user = await getChatGPTUser(); if (!user) return fail('Bitte anmelden.', 401);
    const d = db();
    const me = await d.prepare('SELECT role FROM members WHERE id=?').bind(user.userId).first<any>();
    if (!me) return fail('Bitte zuerst registrieren.', 403);
    const [preference, subscription, notifications] = await Promise.all([
      d.prepare('SELECT enabled FROM push_preferences WHERE user_id=?').bind(user.userId).first<any>(),
      d.prepare('SELECT id FROM push_subscriptions WHERE user_id=?').bind(user.userId).all<any>(),
      d.prepare('SELECT id,kind,title,body,url,created,read_at FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 30').bind(user.userId).all<any>(),
    ]);
    return Response.json({ enabled: Boolean(preference?.enabled), subscribed: subscription.results.length > 0,
      notifications: notifications.results, publicKey: vapidPublicKey(), admin: me.role === 'admin' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error(error); return fail('Mitteilungen konnten nicht geladen werden.', 503); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return fail('Anfrage nicht erlaubt.', 403);
    const user = await getChatGPTUser(); if (!user) return fail('Bitte anmelden.', 401);
    const d = db(), me = await d.prepare('SELECT role FROM members WHERE id=?').bind(user.userId).first<any>();
    if (!me) return fail('Bitte zuerst registrieren.', 403);
    const b: any = await req.json();
    if (b.action === 'preference') {
      if (typeof b.enabled !== 'boolean') return fail('Ungültige Einstellung.');
      if (b.enabled && !await d.prepare('SELECT id FROM push_subscriptions WHERE user_id=?').bind(user.userId).first()) return fail('Auf diesem Gerät sind Push-Mitteilungen noch nicht eingerichtet.');
      const statements: any[] = [d.prepare(`INSERT INTO push_preferences(user_id,enabled,updated) VALUES(?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,updated=excluded.updated`).bind(user.userId, Number(b.enabled), new Date().toISOString())];
      if (!b.enabled) statements.push(d.prepare(`UPDATE notification_deliveries SET status='cancelled'
        WHERE status='pending' AND subscription_id IN (SELECT id FROM push_subscriptions WHERE user_id=?)`).bind(user.userId));
      await d.batch(statements);
      return Response.json({ ok: true });
    }
    if (b.action === 'subscribe') {
      const sub = b.subscription;
      let endpoint: URL | null = null; try { endpoint = new URL(sub?.endpoint); } catch {}
      if (!sub || typeof sub.endpoint !== 'string' || !endpoint || endpoint.protocol !== 'https:' || endpoint.port || endpoint.username || endpoint.password || !pushHosts.has(endpoint.hostname) || sub.endpoint.length > 2048 ||
          typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string' || sub.keys.p256dh.length > 256 || sub.keys.auth.length > 256) return fail('Ungültige Push-Registrierung.');
      const id = randomUUID(), timestamp = new Date().toISOString();
      const result = await d.prepare(`INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,created,updated) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated=excluded.updated
        WHERE push_subscriptions.user_id=excluded.user_id`)
        .bind(id, user.userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, timestamp, timestamp).run();
      if (result.meta.changes === 0) return fail('Diese Geräte-Registrierung gehört bereits zu einem anderen Konto.', 409);
      return Response.json({ ok: true });
    }
    if (b.action === 'unsubscribe') {
      if (typeof b.endpoint !== 'string') return fail('Ungültige Registrierung.');
      await d.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(b.endpoint, user.userId).run();
      await d.prepare('UPDATE push_preferences SET enabled=0,updated=? WHERE user_id=?').bind(new Date().toISOString(), user.userId).run();
      return Response.json({ ok: true });
    }
    if (b.action === 'read') {
      if (typeof b.id !== 'string') return fail('Ungültige Mitteilung.');
      await d.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(new Date().toISOString(), b.id, user.userId).run();
      return Response.json({ ok: true });
    }
    if (b.action === 'broadcast') {
      if (me.role !== 'admin') return fail('Nur die Administration kann Mitteilungen senden.', 403);
      const title = typeof b.title === 'string' ? b.title.trim() : '';
      const body = typeof b.body === 'string' ? b.body.trim() : '';
      if (!title || title.length > 80 || !body || body.length > 240) return fail('Titel (max. 80) und Nachricht (max. 240 Zeichen) erforderlich.');
      let recipients: string[];
      if (b.audience === 'all') recipients = (await d.prepare('SELECT id FROM members').all<any>()).results.map((m: any) => m.id);
      else if (typeof b.audience === 'string' && await d.prepare('SELECT id FROM teams WHERE id=? AND is_assignable=1 AND id<>\'leitung\'').bind(b.audience).first()) recipients = (await d.prepare('SELECT id FROM members WHERE team=?').bind(b.audience).all<any>()).results.map((m: any) => m.id);
      else return fail('Bitte „Alle“ oder ein Unterteam wählen.');
      notifyUsers(recipients, { eventKey: `admin:${randomUUID()}`, code: 'admin_message', title, body, createdBy: user.userId });
      return Response.json({ ok: true, count: recipients.length });
    }
    return fail('Unbekannte Aktion.');
  } catch (error) { console.error(error); return fail('Mitteilung konnte nicht gespeichert werden.', 503); }
}
