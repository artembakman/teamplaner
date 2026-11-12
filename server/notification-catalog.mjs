// Zentraler Katalog der Push-Ereignisse. Neue Auslöser werden hier benannt;
// die fachliche Stelle, die ein Ereignis auslöst, bleibt im Scheduler oder API-Handler.
export const notificationCatalog = Object.freeze({
  missing_plan: { title: 'Planung für morgen fehlt', group: 'Planung' },
  teamday_planned: { title: 'Team-Tag geplant', group: 'Team-Tage' },
  teamday_cancelled: { title: 'Team-Tag abgesagt', group: 'Team-Tage' },
  teamday_reminder: { title: 'Morgen ist Team-Tag', group: 'Team-Tage' },
  event_created: { title: 'Neuer Team-Termin', group: 'Team-Termine' },
  event_updated: { title: 'Team-Termin aktualisiert', group: 'Team-Termine' },
  event_cancelled: { title: 'Team-Termin abgesagt', group: 'Team-Termine' },
  event_reminder: { title: 'Morgen im Team', group: 'Team-Termine' },
  admin_message: { title: '', group: 'Admin-Mitteilungen' },
});

export function resolveNotification(code, overrides = {}) {
  const item = notificationCatalog[code];
  if (!item) throw new Error(`Unbekannter Benachrichtigungsauslöser: ${code}`);
  const title = overrides.title || item.title;
  if (!title || typeof overrides.body !== 'string') throw new Error(`Unvollständige Mitteilung für ${code}`);
  return { ...overrides, kind: code, title, body: overrides.body };
}
