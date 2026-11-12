import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { rawDatabase } from './database.mjs';
import { resolveNotification } from './notification-catalog.mjs';

const now = () => new Date().toISOString();
export function vapidPublicKey() {
  const d = rawDatabase();
  let pair = d.prepare("SELECT value FROM push_meta WHERE key='vapid'").get()?.value;
  if (!pair) {
    const generated = webpush.generateVAPIDKeys();
    const candidate = JSON.stringify(generated);
    d.prepare("INSERT OR IGNORE INTO push_meta(key,value) VALUES('vapid',?)").run(candidate);
    pair = d.prepare("SELECT value FROM push_meta WHERE key='vapid'").get().value;
  }
  return JSON.parse(pair).publicKey;
}
function allMembers(except = '') {
  return rawDatabase().prepare('SELECT id FROM members WHERE id<>?').all(except).map(x => x.id);
}
export function notifyUsers(userIds, { eventKey, code, title = '', body, url = '/', createdBy = null }) {
  const notification = resolveNotification(code, { title, body, url });
  const d = rawDatabase(), created = now();
  d.exec('BEGIN IMMEDIATE');
  try {
    for (const userId of [...new Set(userIds)]) {
      const id = randomUUID();
      const result = d.prepare(`INSERT OR IGNORE INTO notifications(id,event_key,user_id,created_by,kind,title,body,url,created)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(id, eventKey, userId, createdBy, notification.kind, notification.title.slice(0, 100), notification.body.slice(0, 240), notification.url || '/', created);
      if (!Number(result.changes)) continue;
      d.prepare(`INSERT OR IGNORE INTO notification_deliveries(notification_id,subscription_id)
        SELECT ?,s.id FROM push_subscriptions s JOIN push_preferences p ON p.user_id=s.user_id
        WHERE s.user_id=? AND p.enabled=1`).run(id, userId);
    }
    d.exec('COMMIT');
  } catch (error) { d.exec('ROLLBACK'); throw error; }
}
export function notifyEveryone(options, except = '') {
  notifyUsers(allMembers(except), options);
}
export function notifyTeam(team, options) {
  const users = rawDatabase().prepare('SELECT id FROM members WHERE team=?').all(team).map(x => x.id);
  notifyUsers(users, options);
}
export async function dispatchPending(limit = 50) {
  const d = rawDatabase();
  const rows = d.prepare(`SELECT nd.notification_id,nd.subscription_id,nd.attempts,
      s.endpoint,s.p256dh,s.auth,n.title,n.body,n.url,n.id
    FROM notification_deliveries nd
    JOIN push_subscriptions s ON s.id=nd.subscription_id
    JOIN notifications n ON n.id=nd.notification_id
    JOIN push_preferences p ON p.user_id=s.user_id AND p.enabled=1
    WHERE nd.status='pending' AND nd.next_attempt<=? ORDER BY n.created LIMIT ?`).all(Date.now(), limit);
  if (!rows.length) return 0;
  const vapid = JSON.parse(d.prepare("SELECT value FROM push_meta WHERE key='vapid'").get().value);
  const contact = process.env.PUSH_CONTACT || `mailto:postmaster@${new URL(process.env.APP_ORIGIN).hostname}`;
  webpush.setVapidDetails(contact, vapid.publicKey, vapid.privateKey);
  let sent = 0;
  for (const row of rows) {
    const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    const payload = JSON.stringify({ title: row.title, body: row.body, url: row.url, id: row.id });
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 3600 });
      d.prepare("UPDATE notification_deliveries SET status='sent',attempts=attempts+1 WHERE notification_id=? AND subscription_id=?")
        .run(row.notification_id, row.subscription_id);
      sent++;
    } catch (error) {
      const status = Number(error?.statusCode || 0);
      if (status === 404 || status === 410) {
        d.prepare('DELETE FROM push_subscriptions WHERE id=?').run(row.subscription_id);
        continue;
      }
      const attempts = Number(row.attempts) + 1;
      d.prepare(`UPDATE notification_deliveries SET attempts=?,next_attempt=?,status=?
        WHERE notification_id=? AND subscription_id=?`).run(attempts, Date.now() + Math.min(6 * 3600_000, 30_000 * (2 ** Math.min(attempts, 10))), attempts >= 8 ? 'failed' : 'pending', row.notification_id, row.subscription_id);
      console.error('Push-Zustellung fehlgeschlagen:', status || error?.message || 'unbekannter Fehler');
    }
  }
  return sent;
}
