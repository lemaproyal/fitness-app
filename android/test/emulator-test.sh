#!/usr/bin/env bash
# Prüft die Debug-APK in einem laufenden Android-Emulator und hält jeden Schritt
# mit Screenshot und Protokoll fest. Läuft in GitHub Actions (.github/workflows/apk.yml).
#
#   bash android/test/emulator-test.sh <app-debug.apk> <ausgabeordner>
#
# Kernfrage: Überleben die Trainingsdaten, wenn Chrome seine Daten löscht?

set -euo pipefail

APK="$1"
AUS="$2"
PAKET="de.lemaproyal.fitness"
CDP="node $(dirname "$0")/cdp.mjs"
MARKER_ID="emulator-test"
MARKER_NAME="Emulator-Test Übung"
# Das Demo-Video der YouTube-Schnittstelle – öffentlich und einbettbar.
YOUTUBE_ID="M7lc1UVf-VE"

mkdir -p "$AUS"
PROTOKOLL="$AUS/protokoll.txt"
: > "$PROTOKOLL"

schritt() { echo; echo "== $*" | tee -a "$PROTOKOLL"; }
notiz()   { echo "$*" | tee -a "$PROTOKOLL"; }
bild()    { adb exec-out screencap -p > "$AUS/$1.png"; notiz "Screenshot: $1.png"; }
fehler()  { notiz "FEHLER: $*"; bild "fehler"; exit 1; }
js()      { $CDP "$1"; }

# Die DevTools der WebView hängen an der Prozessnummer – nach jedem Neustart neu verbinden.
devtools_verbinden() {
  local pid=""
  for _ in $(seq 1 30); do
    pid=$(adb shell pidof "$PAKET" | tr -d '\r') && [ -n "$pid" ] && break
    sleep 1
  done
  [ -n "$pid" ] || fehler "App-Prozess läuft nicht"
  adb forward --remove-all
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid" > /dev/null
}

seite_abwarten() {
  for _ in $(seq 1 60); do
    if [ "$(js 'return document.readyState' 2>/dev/null || true)" = '"complete"' ]; then return 0; fi
    sleep 2
  done
  fehler "Seite lädt nicht"
}

app_starten() {
  adb shell am start -W -n "$PAKET/.MainActivity" >> "$PROTOKOLL"
  devtools_verbinden
  seite_abwarten
}

schritt "1. APK installieren und starten"
adb install -r "$APK" | tee -a "$PROTOKOLL"
app_starten
sleep 3
notiz "Adresse: $(js 'return location.href')"
notiz "Titel:   $(js 'return document.title')"
bild "1-start"

schritt "2. Datei-Brücke nur auf der eigenen Adresse"
[ "$(js 'return typeof window.FitnessAndroid')" = '"object"' ] || fehler "window.FitnessAndroid fehlt"
notiz "window.FitnessAndroid ist vorhanden"

schritt "3. Übung als Markierung speichern"
js "const db = await import(new URL('src/db.js', location.href).href);
    await db.uebungen.speichern({ id: '$MARKER_ID', name: '$MARKER_NAME' });
    return (await db.uebungen.nachId('$MARKER_ID')).name" | tee -a "$PROTOKOLL"

schritt "4. Export in den Download-Ordner"
js "window.FitnessAndroid.postMessage(JSON.stringify({ aktion: 'dateiSpeichern',
      dateiname: 'fitness-emulator-test.json', inhalt: '{\"test\":true}', typ: 'application/json' }));
    return 'gesendet'" > /dev/null
sleep 1
bild "2-export-meldung"
sleep 2
adb shell ls -l /sdcard/Download/ | tee -a "$PROTOKOLL"
inhalt=$(adb shell cat /sdcard/Download/fitness-emulator-test.json | tr -d '\r')
notiz "Inhalt: $inhalt"
[ "$inhalt" = '{"test":true}' ] || fehler "Exportdatei fehlt oder ist falsch"

schritt "5. Bestätigungsdialog (confirm)"
js "setTimeout(() => { window.dialogAntwort = confirm('Emulator-Test: Dialog sichtbar?'); }, 0); return true" > /dev/null
sleep 2
bild "3-dialog"
adb shell input keyevent KEYCODE_BACK
sleep 1
[ "$(js 'return window.dialogAntwort')" = "false" ] || fehler "Dialog kam nicht zurück"
notiz "Dialog erschienen und mit Zurück abgebrochen (Antwort false)"

schritt "6. YouTube-Video eingebettet"
js "const f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/$YOUTUBE_ID';
    f.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:56vw;z-index:9999;border:0';
    document.body.append(f); return true" > /dev/null
sleep 10
bild "4-youtube"

schritt "7. Dateiauswahl für den Import"
js "location.href = new URL('verwaltung.html', location.href).href; return true" > /dev/null
sleep 2
seite_abwarten
js "document.getElementById('fImport').click(); return true" > /dev/null
sleep 4
bild "5-dateiauswahl"
oben=$(adb shell dumpsys activity activities | grep -m1 "topResumedActivity\|mResumedActivity" | tr -d '\r')
notiz "Vorderste Ansicht: $oben"
echo "$oben" | grep -qi "documentsui" || fehler "Dateiauswahl hat sich nicht geöffnet"
adb shell input keyevent KEYCODE_BACK
sleep 2

schritt "8. Chrome-Daten löschen, App neu starten"
notiz "Speicherort der App-Datenbank (privat, nur für diese App):"
adb shell run-as "$PAKET" ls app_webview/Default | tee -a "$PROTOKOLL"
adb shell am force-stop "$PAKET"
adb shell pm list packages com.android.chrome | grep -q chrome || fehler "Chrome ist im Emulator nicht installiert"
notiz "pm clear com.android.chrome: $(adb shell pm clear com.android.chrome | tr -d '\r')"
app_starten
sleep 3
name=$(js "const db = await import(new URL('src/db.js', location.href).href);
           return (await db.uebungen.nachId('$MARKER_ID'))?.name ?? null")
notiz "Markierung nach dem Löschen: $name"
[ "$name" = "\"$MARKER_NAME\"" ] || fehler "Daten nach dem Löschen der Chrome-Daten verschwunden"
bild "6-nach-chrome-loeschen"

schritt "ALLE PRÜFUNGEN BESTANDEN"
