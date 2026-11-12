# Büroplan privat installieren – Schritt für Schritt

Version 1.0.0 · 30.09.2026

## 1. Was du brauchst

| Bestandteil | Für deinen Start |
|---|---|
| Server | Linux, vorzugsweise Ubuntu 24.04 oder 26.04 LTS, 64 Bit |
| Ausstattung | Planungsgröße: 2 virtuelle CPU-Kerne, 4 GB RAM, mindestens 20 GB SSD; kein Lasttest für diese Grenze |
| Zugriff | SSH mit einem Benutzer, der `sudo` verwenden darf |
| Software | Docker Engine und Docker Compose; Installationsskript liegt bei |
| Domain | Für Internetzugriff z. B. `plan.deine-domain.de`, deren DNS du bearbeiten kannst |
| Netzwerk | Eingehend TCP 80/443 für HTTPS; SSH nur für dich. Ausgehend Internet für Erstinstallation, Images und Zertifikate |
| Sicherung | Zusätzlich zum Server ein zweiter, geschützter Speicherort für Backups |

Ein kleiner gemieteter Linux-Server ist für dauerhaften Betrieb einfacher als ein privater PC, der nachts ausgeschaltet wird. Ein NAS geht ebenfalls, wenn es Docker Compose und ausreichenden Speicher unterstützt. Für einen ersten Test genügt dein Windows-PC mit Docker Desktop und Linux-Containern.

**Softwarearchitektur:** Browser → Caddy/HTTPS → Büroplan → lokale SQLite-Datei. Die Datenbank läuft auf demselben Server. Kein PostgreSQL-Server erforderlich. Für die kleine Gruppe spart das Verwaltung; diese Ausgabe ist ausdrücklich für eine einzelne App-Instanz ausgelegt.

## 2. Welches Paket nehme ich?

| Paket | Verwendung |
|---|---|
| `bueroplan-selfhost-1.0.0.zip` | Empfohlen. Vollständiger Quellcode, Docker-Konfiguration, Skripte und Anleitung. Für Linux AMD64 oder ARM64 auf dem Zielgerät bauen. |
| `bueroplan-runtime-linux-x64-1.0.0.tar.gz` | Optional. Fertig gebaute Anwendung für Linux x86-64 mit glibc und Node.js 24. Kein Build nötig; Betrieb ohne Docker erfordert eigene Prozess- und HTTPS-Verwaltung. Nicht für Windows, macOS oder ARM. |
| `Bueroplan-Deployment-Anleitung.md` | Diese Anleitung als separate Datei. |

Die Pakete enthalten **keine Mitarbeiterdaten und keine Passwörter**. Für Docker benötigst du Internet zum Herunterladen der Basis-Images und Abhängigkeiten. Es ist kein fertiges Docker-Image enthalten.

## 3. Zuerst lokal auf Windows testen

1. Docker Desktop nach der offiziellen Anleitung installieren und starten: https://docs.docker.com/desktop/setup/install/windows-install/ . Linux-Container verwenden.
2. ZIP über „Alle extrahieren“ entpacken. PowerShell im entpackten Ordner `bueroplan-selfhost` öffnen. Dort muss `compose.yaml` liegen.
3. Konfiguration und Sicherungsordner anlegen:

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Force backups
```

4. In `.env` bleibt `APP_ORIGIN=http://localhost:3000`. Kein Schrägstrich am Ende. DOMAIN/ACME_EMAIL sind für diesen lokalen Test noch nicht relevant.
5. Anwendung bauen und starten:

```powershell
docker compose build
docker compose up -d app backup
docker compose ps
```

Der erste Build lädt Abhängigkeiten und kann mehrere Minuten dauern. In `docker compose ps` sollte die App als `healthy` erscheinen.

6. Dein Administratorkonto erstellen:

```powershell
docker compose exec -it app node scripts/admin.mjs add ADMIN leitung admin
```

Das Passwort zweimal eingeben (mindestens 12 Zeichen). Während der Eingabe werden absichtlich keine Zeichen angezeigt.

7. Im Browser **http://localhost:3000** öffnen. Mit ADMIN und deinem Passwort anmelden.
8. Zum Beenden: `docker compose stop`. Erneut starten: `docker compose up -d app backup`. Gespeicherte Daten bleiben erhalten.

**Nicht** `docker compose down -v` verwenden: `-v` würde die Datenbank-Volumes löschen. Lokal ist die Anwendung nur von diesem PC erreichbar; Handyzugriff kommt mit der Servervariante.

## 4. Server und Domain vorbereiten

1. Einen Linux-Server mit SSH-Zugang bereitstellen; Updates installieren. Als Beispiel wird Ubuntu genutzt.
2. Beim Domainanbieter einen **A-Record** für z. B. `plan.deine-domain.de` auf die öffentliche IPv4-Adresse des Servers setzen. Einen AAAA-Record nur setzen, wenn IPv6 tatsächlich zu diesem Server funktioniert.
3. In der Firewall des Serveranbieters TCP 80 und 443 erlauben. SSH/22 möglichst nur für deine IP erlauben. Port 3000 nicht öffentlich öffnen.
4. Kontrollieren, dass noch kein anderer Webserver 80/443 belegt.

Hinweis: Docker kann veröffentlichte Ports an UFW-Regeln vorbeiführen. Deshalb Portfreigaben bewusst über die Provider-Firewall und die Compose-Konfiguration kontrollieren. Caddy kümmert sich anschließend um Zertifikat und HTTP-zu-HTTPS-Weiterleitung.

## 5. Paket auf den Server kopieren

In PowerShell auf deinem PC, im Downloadordner; BENUTZER und SERVER-IP ersetzen:

```powershell
scp .\bueroplan-selfhost-1.0.0.zip BENUTZER@SERVER-IP:/tmp/
ssh BENUTZER@SERVER-IP
```

Auf dem Server:

```sh
sudo apt-get update
sudo apt-get install -y unzip
sudo unzip /tmp/bueroplan-selfhost-1.0.0.zip -d /opt
cd /opt/bueroplan-selfhost
```

## 6. Docker installieren

Wenn Docker noch fehlt:

```sh
sudo bash scripts/install-docker-ubuntu.sh
```

Das Skript nutzt das offizielle Docker-Paketrepository und ist nur für Ubuntu 24.04/26.04 vorgesehen. Auf anderen Systemen die Herstelleranleitung verwenden. Bereits vorhandene Docker-Installationen werden nicht ersetzt.

Kontrolle:

```sh
sudo docker version
sudo docker compose version
```

## 7. Produktionskonfiguration einstellen

```sh
sudo cp .env.example .env
sudo nano .env
```

Diese Werte anpassen (Beispiele ersetzen):

```dotenv
APP_ORIGIN=https://plan.deine-domain.de
APP_VERSION=1.0.0
DOMAIN=plan.deine-domain.de
ACME_EMAIL=deine-email@deine-domain.de
BACKUP_PATH=/opt/bueroplan-state/backups
```

APP_ORIGIN muss exakt der späteren Browseradresse entsprechen: `https://`, Domain, gegebenenfalls Port, **kein abschließender Schrägstrich**. DOMAIN enthält nur den Hostnamen. ACME_EMAIL wird für den Zertifikatsdienst verwendet, nicht für Benutzer-Reminder.

Konfiguration schützen und Sicherungsordner vorbereiten:

```sh
sudo chmod 600 .env
sudo mkdir -p /opt/bueroplan-state/backups
sudo chown 1000:1000 /opt/bueroplan-state/backups
sudo chmod 700 /opt/bueroplan-state/backups
sudo docker compose --profile production config --quiet
```

## 8. Bauen und starten

```sh
sudo docker compose build
sudo docker compose --profile production up -d
sudo docker compose --profile production ps
```

Die Datenbank wird beim ersten Start eingerichtet. Caddy beschafft das HTTPS-Zertifikat, sobald DNS und Ports stimmen. Die Sicherung startet nach erfolgreichem Gesundheitscheck der App.

Bei Problemen:

```sh
sudo docker compose logs --tail=100 app
sudo docker compose logs --tail=100 caddy
sudo docker compose logs --tail=100 backup
```

## 9. Administrator und Mitarbeiter anlegen

Erstes Konto:

```sh
sudo docker compose exec -it app node scripts/admin.mjs add ADMIN leitung admin
```

Weitere Mitarbeiter, hier mit Beispielkürzeln:

```sh
sudo docker compose exec -it app node scripts/admin.mjs add BBB nostro member
sudo docker compose exec -it app node scripts/admin.mjs add CCC wp member
```

| Teamwert für den Befehl | Anzeige |
|---|---|
| `nostro` | Nostro |
| `lagerstellen` | Lagerstellen |
| `wp` | WP-Stammdaten |
| `networks` | Networks |
| `leitung` | Gruppenleitung |

`leitung` ist nur eine Zuordnung; Administratorrechte entstehen ausschließlich durch die Rolle `admin`. Nutze im Normalfall die Rolle `member`.

Benutzer erhalten die URL, ihr Kürzel und ein individuelles Anfangspasswort. Passwort über einen geeigneten getrennten Kanal weitergeben. Über „Passwort“ in der App können sie es selbst ändern. Ein automatischer Zwang zur Änderung bei der ersten Anmeldung ist nicht enthalten.

Es gibt **keine offene Registrierung** und keinen benötigten Teamcode in dieser Hosting-Version. Du steuerst die Konten über die Serverkonsole.

## 10. Anwendung einrichten und testen

1. Unter deiner HTTPS-Adresse als ADMIN anmelden.
2. Unter „Verwalten“ die Kapazitäten prüfen: standardmäßig 6 Wecker und 6 Strassen.
3. Feiertage und gewünschte Monatsquoten einstellen.
4. Unter „Mein Profil“ Team, Symbol und optional Geburtstag eintragen.
5. Unter „Mein Urlaub“ das verfügbare Jahreskontingent eintragen. Ohne Kontingent sind neue Urlaubstage gesperrt.
6. Testweise einen Bürotag und einen Team-Tag planen.
7. Mit einem normalen Testkonto prüfen, dass nur eigene Buchungen geändert werden können. Administratoren dürfen gemäß der wiederhergestellten Version auch fremde Einträge ändern.
8. Mit Handy/Tablet dieselbe HTTPS-Adresse öffnen und Anmeldung prüfen.
9. Unter `https://DEINE-DOMAIN/api/health` sollte `{"status":"ok"}` erscheinen. Dieser Endpunkt zeigt keine Mitarbeiterdaten.
10. Eine Sicherung erstellen und ihre Wiederherstellung zunächst in einer getrennten Testinstanz ausprobieren.

Die lokale Testdatenbank wird nicht automatisch auf den Server übertragen. Ein Start mit leeren Daten ist vorgesehen.

## 11. Konten verwalten

```sh
# Übersicht ohne Passwörter
sudo docker compose exec app node scripts/admin.mjs list

# Passwort vergessen: neues Passwort interaktiv setzen; Sitzungen werden ungültig
sudo docker compose exec -it app node scripts/admin.mjs reset BBB

# Zugang sperren / wieder freigeben
sudo docker compose exec app node scripts/admin.mjs disable BBB
sudo docker compose exec app node scripts/admin.mjs enable BBB
```

Sperren entfernt keine bisherigen Kalenderdaten. Das letzte aktive Administratorkonto lässt sich nicht sperren. Vollständige Datenlöschung und Aufbewahrungsfristen sind organisatorisch noch festzulegen; das Paket enthält keine automatische Mitarbeiterlöschung.

## 12. Backups

Der Dienst `backup` erstellt beim Start und danach alle 24 Stunden eine konsistente SQLite-Sicherung. Er behält die letzten **14 Sicherungsdateien**; häufige Neustarts können den abgedeckten Zeitraum verkürzen.

Manuell sichern:

```sh
sudo docker compose exec app node scripts/backup.mjs
sudo ls -lh /opt/bueroplan-state/backups
```

Backups enthalten auch Passwort-Hashes und Sitzungen. Der Sicherungsordner ist kein öffentlicher Downloadordner. Die Dateien sind **nicht automatisch verschlüsselt**. Regelmäßig auf einen zweiten geschützten Speicher übertragen, vorzugsweise verschlüsselt. Ein Backup nur auf demselben Server schützt nicht vor Verlust des Servers.

Beispiel für manuelle Verschlüsselung mit installiertem GnuPG, DATEINAME ersetzen:

```sh
sudo gpg --symmetric --cipher-algo AES256 /opt/bueroplan-state/backups/DATEINAME.sqlite
```

Die erzeugte `.gpg`-Datei getrennt sichern; die Passphrase sicher und getrennt aufbewahren. Solche manuell erzeugten `.gpg`-Dateien werden vom automatischen Backupdienst nicht rotiert. Die originale lokale SQLite-Sicherung bleibt bestehen.

## 13. Backup wiederherstellen

**Die Wiederherstellung ersetzt den aktuellen Datenstand.** Zuerst eine aktuelle Sicherung erstellen. Dann im Projektordner:

```sh
sudo docker compose exec app node scripts/backup.mjs
sudo docker compose --profile production stop
sudo docker compose run --rm --no-deps app node scripts/restore.mjs /backups/DATEINAME.sqlite --confirm
sudo docker compose --profile production up -d
```

DATEINAME durch eine vorhandene Sicherung ersetzen. Verschlüsselte Backups zuerst in einen geschützten Pfad entschlüsseln. App und Backupdienst müssen während des Ersetzens gestoppt sein. Die Wiederherstellung prüft die Datei und meldet alle Benutzer ab. Danach mit einem Konto aus dem wiederhergestellten Datenstand anmelden.

## 14. Updates und Rückkehr zur vorherigen Version

Vor jedem App-Update:

1. Manuelle Sicherung erstellen und außerhalb des Servers sichern.
2. Aktuelle Image-Version, `.env` und altes Quellpaket aufbewahren. Docker-Images nicht automatisch löschen lassen.
3. Neues Paket in einen **neuen, leeren Ordner** entpacken, nicht über alte Quelldateien kopieren. Die bisherige `.env` übernehmen; `APP_VERSION` auf die neue Paketversion ändern.
4. Für Produktion bleibt `BACKUP_PATH=/opt/bueroplan-state/backups`. Der Compose-Projektname `bueroplan` bleibt gleich, damit das bestehende Datenbankvolume verwendet wird.
5. In dem neuen Ordner zuerst `sudo docker compose build`, dann im alten Ordner `sudo docker compose --profile production stop`, danach im neuen Ordner `sudo docker compose --profile production up -d` ausführen.
6. Anmeldung, Gesundheitscheck und Buchung testen.

Falls die neue Version nicht funktioniert: stoppen, das alte Paket/Image verwenden und bei geänderter Datenbankstruktur das **Backup von vor dem Update** mit den oben beschriebenen Schritten wiederherstellen. Ein altes App-Image allein macht Datenbankmigrationen nicht rückgängig.

Für Sicherheitsupdates der Basis-Images ist `sudo docker compose build --pull` nötig; danach wie oben neu starten. Bibliotheksupdates müssen im Quellcode inklusive Lockdatei gebaut und getestet werden. Kein unbeaufsichtigtes Update der Anwendung enthalten.

## 15. Häufige Fehler

| Symptom | Prüfen |
|---|---|
| „Anfrage nicht erlaubt“ | APP_ORIGIN stimmt nicht exakt mit der Browseradresse überein. Nach Änderung `docker compose up -d app` ausführen. |
| Zertifikat fehlt | DNS, A/AAAA-Records, Ports 80/443, Caddy-Logs und eingetragene Domain prüfen. |
| „Permission denied“ beim Backup | Besitzer UID 1000 und Rechte des in BACKUP_PATH angegebenen Ordners prüfen. |
| Anmeldung gesperrt | Nach zu vielen Versuchen 15 Minuten warten. Alternativ Passwort über Serverkonsole zurücksetzen; die Begrenzung läuft trotzdem regulär ab. |
| Urlaub wird abgelehnt | Jahreskontingent fehlt oder ist ausgeschöpft. |
| App auf Handy nicht erreichbar | Lokaler Test bindet absichtlich nur an den eigenen Rechner. Für Gerätezugriff Server mit HTTPS verwenden. |
| Port bereits belegt | Andere Anwendung auf 3000 bzw. Webserver auf 80/443 prüfen. |
| Build bricht wegen Speicher ab | Mehr RAM oder temporär Swap bereitstellen; alternativ das passende fertig gebaute Linux-x64-Paket nutzen. |

## 16. Optional: fertig gebautes Linux-x64-Paket ohne Docker

Für erfahrenere Betreiber. Node.js **24 LTS**, Linux x86-64 mit glibc vorausgesetzt. Kein `npm install` nötig. Das Paket enthält Abhängigkeiten und den Produktionsbuild. Es ersetzt nicht die Einrichtung von HTTPS, Prozessüberwachung oder Backups.

```sh
tar -xzf bueroplan-runtime-linux-x64-1.0.0.tar.gz
cd bueroplan-runtime-linux-x64
cp .env.example .env
# Für lokalen Test APP_ORIGIN=http://localhost:3000 beibehalten.
export HOSTNAME=127.0.0.1
export PORT=3000
export NODE_ENV=production
node scripts/admin.mjs add ADMIN leitung admin
node --env-file=.env scripts/entrypoint.mjs
```

Der Server muss laufen, während du `http://localhost:3000` verwendest. Auf einem entfernten Server kann für einen persönlichen Test ein SSH-Tunnel genutzt werden: `ssh -L 3000:127.0.0.1:3000 BENUTZER@SERVER-IP`. Danach lokal `http://localhost:3000` öffnen.

Für dauerhaften Betrieb ohne Docker brauchst du einen eigenen Dienstmanager (z. B. systemd), einen HTTPS-Reverse-Proxy und einen Zeitplan für `node scripts/backup.mjs`. Die vollständig vorbereitete Variante dafür ist das Docker-Compose-Paket.

## 17. Was bleibt außerhalb dieses Pakets?

- Buchung in LIZ Booker: keine Anbindung.
- E-Mail/Push: keine externe Zustellung, nur Hinweise in der geöffneten App.
- Firmen-SSO, MFA und automatische Passwort-Wiederherstellung per E-Mail: nicht enthalten.
- Daten aus der bisherigen Sites-App: kein Export/Import enthalten; insbesondere alte Konto-IDs müssen bei einer Migration bewusst zugeordnet werden.
- Hochverfügbarkeit/mehrere App-Instanzen: nicht vorgesehen; SQLite benötigt ein lokales, zuverlässiges Dateisystem. Kein gemeinsam gemountetes Netzlaufwerk verwenden.
- Verbindliche Datenschutztexte, Löschfristen und der betriebliche Freigabeprozess werden nicht durch dieses technische Paket ersetzt.

## Offizielle technische Quellen

Bei der Paketvorbereitung am 30.09.2026 geprüft:

- Docker/Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- Docker/Next.js: https://docs.docker.com/guides/nextjs/
- Next.js Self-Hosting: https://nextjs.org/docs/app/guides/self-hosting
- Next.js Standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Node.js SQLite/Backup: https://nodejs.org/api/sqlite.html
- Caddy HTTPS: https://caddyserver.com/docs/automatic-https
