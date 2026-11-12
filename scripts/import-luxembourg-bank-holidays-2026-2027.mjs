import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { rawDatabase } from '../server/database.mjs';
import { makeBackup } from './backup.mjs';

const HOLIDAYS = [
  ['2026-01-01', 'Neujahr'],
  ['2026-04-03', 'Karfreitag (Bankfeiertag)'],
  ['2026-04-06', 'Ostermontag'],
  ['2026-05-01', 'Tag der Arbeit'],
  ['2026-05-09', 'Europatag'],
  ['2026-05-14', 'Christi Himmelfahrt'],
  ['2026-05-25', 'Pfingstmontag'],
  ['2026-06-23', 'Nationalfeiertag Luxemburg'],
  ['2026-08-15', 'Mariä Himmelfahrt'],
  ['2026-11-01', 'Allerheiligen'],
  ['2026-12-24', 'Heiligabend (Nachmittag, Bankfeiertag)'],
  ['2026-12-25', '1. Weihnachtstag'],
  ['2026-12-26', 'Stephanstag'],
  ['2027-01-01', 'Neujahr'],
  ['2027-03-26', 'Karfreitag (Bankfeiertag)'],
  ['2027-03-29', 'Ostermontag'],
  ['2027-05-01', 'Tag der Arbeit'],
  ['2027-05-06', 'Christi Himmelfahrt'],
  ['2027-05-09', 'Europatag'],
  ['2027-05-17', 'Pfingstmontag'],
  ['2027-06-23', 'Nationalfeiertag Luxemburg'],
  ['2027-08-15', 'Mariä Himmelfahrt'],
  ['2027-11-01', 'Allerheiligen'],
  ['2027-12-24', 'Heiligabend (Nachmittag, Bankfeiertag)'],
  ['2027-12-25', '1. Weihnachtstag'],
  ['2027-12-26', 'Stephanstag'],
];

const args = new Set(process.argv.slice(2));
const preview = args.has('--preview');
const dbPath = resolve(process.env.DATABASE_PATH || 'data/bueroplan.sqlite');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(dbPath)) fail(`Abbruch: Datenbank nicht gefunden: ${dbPath}`);

const db = rawDatabase();
const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
if (!tables.has('holidays')) fail('Abbruch: Die Tabelle holidays fehlt. Bitte zuerst die richtige Teamplaner-Datenbank prüfen.');

const find = db.prepare('SELECT name FROM holidays WHERE day=?');
const rows = HOLIDAYS.map(([day, name]) => ({ day, name, existing: find.get(day)?.name ?? null }));
const toAdd = rows.filter(row => row.existing === null);
const toUpdate = rows.filter(row => row.existing !== null && row.existing !== row.name);
const unchanged = rows.length - toAdd.length - toUpdate.length;

console.log(`Zieldatenbank: ${dbPath}`);
console.log(`Luxemburger Bank- und gesetzliche Feiertage: ${rows.length} Einträge (2026: 13, 2027: 13)`);
console.log(`Neu: ${toAdd.length} · Bezeichnung wird angepasst: ${toUpdate.length} · bereits korrekt: ${unchanged}`);
for (const row of rows) {
  const state = row.existing === null ? 'NEU' : row.existing === row.name ? 'OK' : `ÄNDERN: „${row.existing}“`;
  console.log(`  ${row.day}  ${row.name}  [${state}]`);
}
console.log('Das Script löscht keine Einträge. Es fügt nur diese Tage hinzu oder setzt deren Bezeichnung auf die offizielle Bezeichnung.');
console.log('Hinweis: Der 24. Dezember ist laut ABBL ein Bankfeiertag ab Mittag; die App kann nur ganze Tage abbilden.');

if (preview) {
  console.log('Vorschau: keine Daten geändert und kein Backup erstellt.');
  process.exit(0);
}
if (!args.has('--confirm-import-luxembourg-bank-holidays')) {
  fail('Keine Änderung ausgeführt. Für den Import ausdrücklich --confirm-import-luxembourg-bank-holidays angeben.');
}
if (toAdd.length + toUpdate.length === 0) {
  console.log('Alle aufgeführten Feiertage sind bereits korrekt hinterlegt. Nichts geändert; kein Backup erstellt.');
  process.exit(0);
}

const backupFile = await makeBackup();
console.log(`Geprüftes Datenbank-Backup erstellt: ${backupFile}`);
try {
  db.exec('BEGIN IMMEDIATE');
  const upsert = db.prepare('INSERT INTO holidays (day,name) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET name=excluded.name');
  for (const { day, name } of rows) upsert.run(day, name);
  db.exec('COMMIT');
} catch (error) {
  try { db.exec('ROLLBACK'); } catch {}
  throw error;
}

console.log(`Import abgeschlossen: ${toAdd.length} neue Feiertage, ${toUpdate.length} Bezeichnungen angepasst, ${unchanged} unverändert.`);
