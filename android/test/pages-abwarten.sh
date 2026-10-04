#!/usr/bin/env bash
# Wartet, bis GitHub Pages genau den Web-Code dieses Commits ausliefert.
# Nötig auf main: Die APK lädt die Live-Seite, und Pages braucht nach einem
# Merge einige Minuten (Bau + Zwischenspeicher), bis der neue Stand ankommt.
#
#   bash android/test/pages-abwarten.sh
#
# Verglichen werden die Dateien, die der Service Worker zwischenspeichert.

set -euo pipefail

ADRESSE="https://lemaproyal.github.io/fitness-app/"
WARTEZEIT_S=900
DATEIEN=(sw.js index.html verwaltung.html training.html verlauf.html src/*.js)

abweichend() {
  local datei
  for datei in "${DATEIEN[@]}"; do
    # Zeitstempel in der Adresse umgeht Zwischenspeicher auf dem Weg.
    if ! curl -sf --max-time 20 "$ADRESSE$datei?t=$(date +%s)" | cmp -s - "$datei"; then
      echo "$datei"
      return 0
    fi
  done
  return 1
}

ende=$(( $(date +%s) + WARTEZEIT_S ))
while datei=$(abweichend); do
  if [ "$(date +%s)" -ge "$ende" ]; then
    echo "::error::GitHub Pages liefert nach $((WARTEZEIT_S / 60)) Minuten noch nicht den Stand dieses Commits ($datei weicht ab)."
    exit 1
  fi
  echo "Pages noch nicht aktuell ($datei) – warte …"
  sleep 20
done
echo "GitHub Pages liefert den Stand dieses Commits aus."
