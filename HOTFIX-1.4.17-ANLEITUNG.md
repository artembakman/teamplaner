# Teamplaner Hotfix 1.4.17

## Änderung

Beim Zurücksetzen eines Passworts wird das einmalige Startpasswort jetzt direkt beim betroffenen Mitglied in der Mitgliederliste angezeigt. Dort kann es kopiert oder ausgeblendet werden. Das Passwort für neu angelegte Konten erscheint weiterhin beim Formular „Mitglied anlegen“.

## Installation auf dem Server

1. Vor dem Update ein Backup erstellen:

```bash
cd /opt/bueroplan/bueroplan-selfhost
docker compose --profile production exec app node scripts/backup.mjs
```

2. ZIP-Datei in den Projektordner entpacken und Version setzen:

```bash
unzip -o /root/ospw-teamplaner-hotfix-1.4.17.zip -d /opt/bueroplan/bueroplan-selfhost
cd /opt/bueroplan/bueroplan-selfhost
sed -i '/^APP_VERSION=/d' .env
printf '\nAPP_VERSION=1.4.17\n' >> .env
```

3. App und Hintergrunddienste neu bauen und starten:

```bash
docker compose --profile production up -d --build --force-recreate app notifications backup
docker compose --profile production ps
docker compose --profile production logs --tail=50 app notifications
```

Die SQLite-Datenbank bleibt im persistenten Docker-Volume erhalten. Es gibt keine Datenbankmigration.