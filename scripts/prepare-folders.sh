#!/usr/bin/env sh
set -eu
mkdir -p backups
# The application image runs as UID 1000. This changes only the backup folder.
if [ "$(id -u)" = 0 ]; then chown 1000:1000 backups; fi
chmod 700 backups
printf '%s\n' 'Backup-Ordner vorbereitet. Bei einem anderen Benutzer: sudo chown 1000:1000 backups'
