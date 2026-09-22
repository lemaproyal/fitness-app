#!/usr/bin/env bash
# Startet den Emulator-Test und wiederholt ihn höchstens einmal – aber nur, wenn ihn
# nachweislich nicht die App, sondern Android selbst abgebrochen hat.
#
#   bash android/test/emulator-lauf.sh <app-debug.apk> <ausgabeordner>
#
# Belegt (Lauf 35754763882): Im frisch gestarteten Emulator aktualisieren sich die
# Google-Play-Dienste. Android beendet dabei jede App, die gerade deren Schriftarten
# nutzt – also jede WebView-App: „Killing … depends on provider
# com.google.android.gms/.fonts.provider.FontsProvider in dying proc …“.

set -uo pipefail

APK="$1"
AUS="$2"
TEST="$(dirname "$0")/emulator-test.sh"
# Nur wenn genau die Test-App so beendet wurde – andere Apps trifft es im Emulator auch.
SYSTEM_ABBRUCH="Killing [0-9]+:de\.lemaproyal\.fitness\.test/.*depends on provider com\.google\.android\.gms"

bash "$TEST" "$APK" "$AUS" && exit 0

if ! grep -qE "$SYSTEM_ABBRUCH" "$AUS/logcat.txt" 2>/dev/null; then
  exit 1 # ein echter Fehler – nicht wiederholen
fi

echo "::warning::Emulator-Test von Android abgebrochen (Google-Play-Dienste neu gestartet) – einmaliger zweiter Versuch. Der erste liegt unter versuch-1/."
mkdir -p "$AUS/versuch-1"
find "$AUS" -maxdepth 1 -type f -exec mv {} "$AUS/versuch-1/" \;
bash "$TEST" "$APK" "$AUS"
