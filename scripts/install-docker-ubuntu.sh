#!/usr/bin/env bash
# Installs Docker from its official Ubuntu repository. Run only on a chosen server.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo 'Bitte mit sudo ausführen.'; exit 1; fi
. /etc/os-release
if [ "$ID" != ubuntu ]; then echo 'Dieses Skript ist nur für Ubuntu.'; exit 1; fi
case "$VERSION_ID" in 24.04|26.04) ;; *) echo 'Bitte Ubuntu 24.04 oder 26.04 LTS verwenden.'; exit 1;; esac
if command -v docker >/dev/null; then docker --version; docker compose version; echo 'Docker bereits vorhanden; keine Neuinstallation.'; exit 0; fi
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
arch=$(dpkg --print-architecture)
cat > /etc/apt/sources.list.d/docker.sources <<SOURCES
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: ${arch}
Signed-By: /etc/apt/keyrings/docker.asc
SOURCES
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker --version
docker compose version
