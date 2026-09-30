#!/usr/bin/env bash
# Einmaliger Neuversuch nur, wenn emulator-test.sh den konkreten Prozessverlust
# durch einen Neustart der Google-Play-Dienste mit Exit-Code 75 belegt hat.

set -uo pipefail

APK="$1"
AUS="$2"
TEST="$(dirname "$0")/emulator-test.sh"

bash "$TEST" "$APK" "$AUS"
code=$?
[ "$code" -eq 0 ] && exit 0
[ "$code" -eq 75 ] || exit "$code"

echo "::warning::Android beendete die Test-App wegen Google-Play-Diensten – ein belegter Neuversuch. Der erste Lauf liegt unter versuch-1/."
mkdir -p "$AUS/versuch-1"
find "$AUS" -maxdepth 1 -type f -exec mv {} "$AUS/versuch-1/" \;
bash "$TEST" "$APK" "$AUS"
