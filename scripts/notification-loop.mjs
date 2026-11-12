import { migrate, rawDatabase } from '../server/database.mjs';
import { dispatchPending, notifyUsers, vapidPublicKey } from '../server/notifications.mjs';

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Luxembourg', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}
function tomorrowOf(day) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
function isWorkday(day, holidays) { return ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()) && !holidays.has(day); }
function displayDate(day) { return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Luxembourg', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00Z`)); }

async function scheduleDaily() {
  const now = localParts();
  if (Number(now.hour) < 16) return;
  const day = `${now.year}-${now.month}-${now.day}`, tomorrow = tomorrowOf(day), d = rawDatabase();
  if (!isWorkday(tomorrow, new Set(d.prepare('SELECT day FROM holidays').all().map(x => x.day)))) return;
  const missing = d.prepare(`SELECT m.id FROM members m WHERE NOT EXISTS
    (SELECT 1 FROM bookings b WHERE b.user_id=m.id AND b.day=? )`).all(tomorrow);
  for (const member of missing) notifyUsers([member.id], { eventKey: `missing-plan:${tomorrow}:${member.id}`, code: 'missing_plan', body: `Für ${displayDate(tomorrow)} hast du noch keinen Eintrag geplant.` });

  const teamDays = d.prepare('SELECT team,site FROM team_days WHERE day=?').all(tomorrow);
  for (const item of teamDays) {
    const teamName = d.prepare('SELECT name FROM teams WHERE id=?').get(item.team)?.name || item.team;
    notifyTeam(item.team, { eventKey: `teamday-reminder:${item.team}:${tomorrow}`, code: 'teamday_reminder', body: `${teamName} trifft sich in ${item.site === 'wecker' ? 'Wecker' : 'Strassen'}.` });
  }

  const events = d.prepare('SELECT id,title,time FROM events WHERE day=?').all(tomorrow);
  for (const event of events) {
    const attendees = d.prepare('SELECT user_id FROM attendees WHERE event_id=?').all(event.id).map(x => x.user_id);
    notifyUsers(attendees, { eventKey: `event-reminder:${event.id}:${tomorrow}`, code: 'event_reminder', body: `${event.title} · ${event.time} Uhr` });
  }
}

migrate();
vapidPublicKey();
console.log('Push-Worker gestartet (Europe/Luxembourg).');
while (true) {
  try { await scheduleDaily(); await dispatchPending(50); }
  catch (error) { console.error('Push-Worker-Fehler:', error?.message || error); }
  await new Promise(resolve => setTimeout(resolve, 60_000));
}
