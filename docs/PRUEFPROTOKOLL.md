# Prüfprotokoll – Büroplan Self-Hosting 1.0.0

Stand 30.09.2026. Tests verwenden ausschließlich künstliche Daten.

## Ausgeführt

- Produktionsbuild mit Next.js 16.3.7, React 19.2.6, Node.js 24.19.0 unter Linux x86-64.
- TypeScript-Prüfung im Produktionsbuild.
- Alle Datenbankmigrationen auf einer neuen SQLite-Datenbank, Wiederholung ohne doppelte Anwendung.
- Interaktive Kontoanlage mit unsichtbarer Passwortabfrage; Administratorrolle, Team und Standardkapazitäten geprüft.
- Lokale Passwort-Hashes, falsche Passwörter, Session-Hashing, ungültige Sessions, Abmeldung.
- Origin-/CSRF-Prüfung und Begrenzung der Loginversuche.
- Mehrtägige Buchung mit Kapazitätskonflikt wird vollständig zurückgerollt.
- Urlaubskontingent wird serverseitig und per Datenbank-Trigger begrenzt.
- Konsistente Sicherung mit SQLite-Backup-API, Integritätsprüfung, Wiederherstellung mit dem mitgelieferten Skript und Widerruf von Sitzungen.
- HTTP-Tests gegen den tatsächlich gestarteten, fertig gebauten Node-Server: Anmeldung, keine Identitätsübernahme über die alten Sites-Header, Registrierung gesperrt, fremde Buchung für normale Benutzer gesperrt, CSRF abgewiesen, Kapazität, Krankheit, Urlaub, Geburtstag, Team-Tag, Passwortwechsel und Logout.
- Compose-YAML geparst und lokale Portbindung kontrolliert; Shell-Skripte auf Syntax geprüft.
- Bekannte Meldungen der npm-Produktionsabhängigkeiten geprüft und betroffene Bibliotheken im Lockfile aktualisiert. Die abschließende Prüfung meldet keine bekannten Schwachstellen. Das ist kein vollständiges Sicherheitsaudit.

## Nicht in dieser Umgebung ausgeführt

- Docker-Image-Build und Containerstart: hier ist keine Docker Engine verfügbar. Getestet wurde stattdessen der echte Standalone-Node-Produktionsserver.
- Zertifikatsausstellung und HTTPS unter deiner Domain: Domain und Zielserver sind noch nicht festgelegt.
- Windows/Docker-Desktop-Installation und ARM64-Build.
- Manuelle Browserprüfung auf realem Handy/Tablet und Lasttest.
- Datenmigration aus der bestehenden Sites-App; kein Zugriff auf deren Mitarbeiterdaten erfolgt.

Der erste Start auf deinem Server umfasst deshalb bewusst den Gesundheitscheck, die Kontoanlage und eine Probebuchung. Es wurden keine Pakete auf deiner Infrastruktur installiert und keine externen Ports geöffnet.

## Hotfix 1.4.15 (12.11.2026)

- Kalendertage für die Team-Monatsansicht: Tests für Februar 2026/2028, 30-/31-Tage-Monate, Datumsreihenfolge und ungültige Monatswerte bestanden.
- `pnpm test`: 4 Tests bestanden.
- `pnpm check`: TypeScript-Prüfung bestanden.
- `pnpm build`: optimierter Next.js-Produktionsbuild erfolgreich.
- Keine manuelle Browserprüfung auf realen Geräten in dieser Umgebung.
