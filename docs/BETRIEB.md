# Betrieb und technische Grenzen

## Daten und Rollen

Konten bestehen aus Kürzel, interner zufälliger ID, Team, Rolle, Passwort-Hash und Sperrstatus. Es werden keine E-Mail-Adressen für die Anmeldung benötigt. Das Kontoprofil kann ein Symbol und freiwillig Geburtstag (Tag/Monat) enthalten. Geschäftsdatentabellen speichern Kalenderstatus, Urlaubskonto, Feiertage, Kapazitäten, Quotenregeln, Team-Tage, Termine und Zusagen.

Die wiederhergestellte Funktionalität enthält Krankheit und Urlaub. Normale Mitglieder sehen Krankheit anderer als „Abwesend“; Administratoren können Details sehen und Buchungen anderer bearbeiten. Alle registrierten Mitglieder sehen die Team-Quoten. Das ist bewusst der vom Nutzer wieder gewünschten Vorversion entsprechend.

Es gibt keine automatische Löschfrist für Kalenderdaten oder Konten. Abgelaufene Sitzungen und Anmeldeversuche werden bei entsprechenden Zugriffen aufgeräumt. Backups werden separat rotiert und können ältere Datensätze weiterhin enthalten. Serveradministratoren können technisch auf die Datenbank zugreifen. Passwort-Hashes ersetzen keine Festplattenverschlüsselung; diese wird bei Bedarf vom Hosting/Server bereitgestellt.

## Anmeldung

- Lokale Sitzungen mit zufälligen 256-Bit-Tokens; nur der SHA-256-Hash des Tokens liegt in der Datenbank.
- HttpOnly- und SameSite=Lax-Cookie; Secure bei HTTPS, Laufzeit 12 Stunden.
- Schreibende API-Aufrufe müssen die konfigurierte APP_ORIGIN im Origin-Header verwenden.
- Passwort-Hashing über Node.js scrypt mit zufälligem Salt, Passwortlänge 12–256 Zeichen.
- Login-Begrenzung: 10 Versuche je Kürzel / 15 Minuten, zusätzlich 50 je Quell-IP / 15 Minuten. Caddy setzt die Quell-IP; der App-Port ist nur lokal veröffentlicht. Nicht hinter einen weiteren Proxy stellen, ohne die Weitergabe der IP zu prüfen.
- Passwortänderung/Reset und Sperrung widerrufen bestehende Sitzungen.
- Kein MFA, kein Firmen-SSO, kein E-Mail-Passwortreset. Vor einem größeren produktiven Einsatz empfiehlt sich eine gesonderte Sicherheitsprüfung.

## Datenbank und Ausfallsicherheit

SQLite im lokalen Docker-Volume `bueroplan_app_data`. WAL-Modus, Fremdschlüssel und atomare Transaktionen. Die Platzbegrenzung und Urlaubskontingente werden zusätzlich durch Datenbank-Trigger abgesichert. Ein zusammenhängender Zeitraum wird bei einem Konflikt insgesamt zurückgewiesen.

Der Adapter führt eine Batch synchron in einer SQLite-Transaktion aus. Es gibt nur eine App-Instanz; nicht auf mehrere Server skalieren oder die Datei auf SMB/NFS ablegen. Der zusätzliche Backup-Prozess nutzt die SQLite-Backup-API, die konsistente Snapshots trotz laufendem Betrieb erlaubt.

Beim Start werden die mitgelieferten SQL-Migrationen einzeln angewendet und ihre SHA-256-Prüfsummen gespeichert. Bereits angewendete Dateien nicht ändern. Bei einer Fehlermeldung nicht blind die Migrationstabelle löschen. Vor Versionswechseln sichern.

## Externe Verbindungen

Beim Build werden Node-/npm-Pakete und Docker-Images bezogen. Caddy kontaktiert Zertifizierungsstellen für HTTPS. Der Browser lädt seine UI-Dateien vom eigenen Server; keine externen Fonts/Analytics sind für den Appbetrieb vorgesehen. Next.js-Telemetrie ist im Docker-Image abgeschaltet. Der Appbetrieb benötigt weder OpenAI noch Cloudflare oder LIZ.

## Betrieb überwachen

`docker compose ps` und `docker compose logs` regelmäßig prüfen, ebenso Alter und Größe der Sicherungen. Docker startet abgestürzte Container neu, aber ein Healthcheck allein startet einen noch laufenden fehlerhaften Prozess nicht automatisch neu. Die Backups schlagen bei vollem Speicher fehl; entsprechende Meldungen stehen im Backup-Log. Keine externe Überwachungs- oder Alarmierungsplattform enthalten.

Sowohl die Anwendung als auch die Container-Basisimages müssen aktuell gehalten werden. Die Release-Version der App ist 1.0.0; Node-24- und Caddy-2-Images werden beim Build/Pull bezogen. Die exakten Image-Digests des Zielservers können nach dem ersten Build für eine streng reproduzierbare Installation festgehalten werden.

## Herkunft und Migration

Ausgangscode: wiederhergestellter Büroplan, Sites-Quellstand `ec32f7ae39404a599d603d7eda4e12b928919b71`. Die selbst gehostete Ausgabe ist eine unabhängige Kopie mit lokaler Anmeldung und eigener Datenbank. Die vorhandene private Site wird weder umgestellt noch abgeschaltet.

Die historische SQL-Migrationskette ist für eine **frische** selbst gehostete Datenbank enthalten und wird vor der Anlage erster Konten ausgeführt. Eine existierende Sites-Datenbank darf nicht einfach darüberkopiert werden: Migrationsstand und Zuordnung alter Identitäten zu lokalen Konten müssten separat geprüft werden. Ein Datenimport ist kein Bestandteil dieser Version.
