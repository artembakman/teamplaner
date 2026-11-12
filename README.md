# Teamplaner – privates Hosting, Version 1.4.14

Stand: 6. November 2026. Enthält die wiederhergestellten Funktionen der bisherigen App.

**Empfohlener Weg:** Quellpaket entpacken und mit Docker Compose betreiben. Du benötigst kein ChatGPT-Konto, keine Cloudflare-Datenbank und kein OpenAI-API-Abonnement. Die Anwendung verwendet keine KI zur Verarbeitung deiner Einträge.

- [Vollständige Schritt-für-Schritt-Anleitung](docs/DEPLOYMENT.md)
- [Technik, Sicherung und Grenzen](docs/BETRIEB.md)
- [Prüfprotokoll](docs/PRUEFPROTOKOLL.md)

## Lokaler Schnellstart mit installiertem Docker

```sh
cp .env.example .env
mkdir -p backups
docker compose build
docker compose up -d app backup
docker compose exec -it app node scripts/admin.mjs add ADMIN leitung admin
```

Auf Linux muss der Backupordner für UID 1000 beschreibbar sein: `sudo chown 1000:1000 backups && sudo chmod 700 backups`.

Öffne **http://localhost:3000**, melde dich mit ADMIN und dem gerade vergebenen Passwort an. Der Port wird nur auf dem eigenen Rechner geöffnet. Die lokale Variante ist kein öffentlicher Server.

Weitere Konten werden von dir über `scripts/admin.mjs` angelegt. Passwörter werden interaktiv und unsichtbar abgefragt. Keine Standardpasswörter oder Beispielkonten enthalten.


## Auf dem Handy installieren

Die Web-App kann auf dem Startbildschirm als App-Verknüpfung geöffnet werden. Sie benötigt weiterhin eine Internetverbindung; Offline-Nutzung und Push-Nachrichten sind in dieser Version nicht aktiviert.

- **Android:** deine Teamplaner-Adresse in Chrome öffnen, Menü `⋮` wählen und `App installieren` oder `Zum Startbildschirm hinzufügen` antippen.
- **iPhone/iPad:** die Seite in Safari öffnen, `Teilen` wählen, `Zum Home-Bildschirm` antippen und hinzufügen.

## Enthalten

- Next.js-App mit Kalender, 6 Plätzen je Büro als Voreinstellung, Kapazitätsregeln, Monatsquote, Urlaubskonto, Feiertagen, Dienstfrei, Krankheit, Geburtstagen, Team-Tagen und gemeinsamen Terminen.
- Eigene lokale Anmeldung, Passwortänderung, Kontensperrung und serverseitige Berechtigungen.
- SQLite-Datenbank im dauerhaften Docker-Volume; automatische Schemaeinrichtung.
- Dockerfile, Compose-Konfiguration und Caddy für HTTPS unter eigener Domain.
- Automatische tägliche Sicherung und Werkzeuge für Wiederherstellung und Passwort-Reset.
- Testdateien, festgeschriebene npm-Abhängigkeiten im `pnpm-lock.yaml`.

**Die Datenbank startet leer.** Die bisherige ChatGPT-Sites-Installation und ihre Daten werden nicht verändert oder automatisch übernommen. Es besteht keine LIZ-Anbindung und kein E-Mail-/Push-Versand.
