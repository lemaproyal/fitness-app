#!/usr/bin/env bash
# Prüft die Debug-APK in einem laufenden Android-Emulator und hält jeden Schritt
# mit Screenshot und Protokoll fest. Läuft in GitHub Actions (.github/workflows/apk.yml).
#
#   bash android/test/emulator-test.sh <app-debug.apk> <ausgabeordner>
#
# Kernfrage: Überleben die Trainingsdaten, wenn Chrome seine Daten löscht?
#
# Die App lädt die Live-Seite von GitHub Pages. Schritte, die neuen Web-Code
# brauchen, prüfen erst, ob er schon live ist, und sagen sonst ausdrücklich
# „übersprungen“ – auf main laufen sie dann nach dem Hochladen mit.

set -euo pipefail

APK="$1"
AUS="$2"
PAKET="de.lemaproyal.fitness.test"   # Debug-APK, siehe applicationIdSuffix in app/build.gradle
CDP="node $(dirname "$0")/cdp.mjs"
MARKER_ID="emulator-test"
MARKER_NAME="Emulator-Test Übung"
# Das Demo-Video der YouTube-Schnittstelle – öffentlich und einbettbar.
YOUTUBE_ID="M7lc1UVf-VE"
YOUTUBE_HERKUNFT="https://www.youtube-nocookie.com"

mkdir -p "$AUS"
PROTOKOLL="$AUS/protokoll.txt"
: > "$PROTOKOLL"

schritt() { echo; echo "== $*" | tee -a "$PROTOKOLL"; }
notiz()   { echo "$*" | tee -a "$PROTOKOLL"; }
bild()    { adb exec-out screencap -p > "$AUS/$1.png"; notiz "Screenshot: $1.png"; }
fehler()  { notiz "FEHLER: $*"; bild "fehler"; exit 1; }
js()      { $CDP "$@"; }
erwarte() { [ "$2" = "$3" ] || fehler "$1 – erwartet $3, erhalten ${2:-(nichts)}"; notiz "OK: $1"; }

# Die DevTools der WebView hängen an der Prozessnummer – nach jedem Neustart neu verbinden.
devtools_verbinden() {
  local pid=""
  for _ in $(seq 1 30); do
    pid=$(adb shell pidof "$PAKET" | tr -d '\r' || true)
    [ -n "$pid" ] && break
    sleep 1
  done
  [ -n "$pid" ] || fehler "App-Prozess läuft nicht"
  adb forward --remove-all
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid" > /dev/null
}

# Wartet, bis die Seite mit diesem Dateinamen fertig geladen ist – nicht die vorige.
seite_abwarten() {
  local datei="$1"
  for _ in $(seq 1 60); do
    if [ "$(js "return location.pathname.endsWith('/$datei') && document.readyState" 2>/dev/null || true)" = '"complete"' ]; then
      return 0
    fi
    sleep 2
  done
  fehler "Seite $datei lädt nicht"
}

app_starten() {
  adb shell am start -W -n "$PAKET/de.lemaproyal.fitness.MainActivity" >> "$PROTOKOLL"
  devtools_verbinden
  seite_abwarten ""
}

# Tippt auf die Schaltfläche mit dieser Kennung (z. B. android:id/button1 = OK).
tippen_auf() {
  adb shell uiautomator dump /sdcard/ansicht.xml > /dev/null
  local grenzen
  grenzen=$(adb shell cat /sdcard/ansicht.xml | tr -d '\r' \
    | grep -o "resource-id=\"$1\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" \
    | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -1 || true)
  [ -n "$grenzen" ] || fehler "Schaltfläche $1 nicht gefunden"
  read -r x1 y1 x2 y2 <<< "$(echo "$grenzen" | tr -c '0-9' ' ')"
  adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
}

neuer_webcode_live() {
  [ "$(js "try { return (await (await fetch('src/datei.js', { cache: 'no-store' })).text()).includes('dateiAusgeben') } catch { return false }")" = "true" ]
}

schritt "1. APK installieren und starten"
adb install -r "$APK" | tee -a "$PROTOKOLL"
app_starten
sleep 3
notiz "Adresse: $(js 'return location.href')"
notiz "Titel:   $(js 'return document.title')"
bild "1-start"
if neuer_webcode_live; then
  erwarte "Installationshinweis in der APK ausgeblendet" \
    "$(js "return document.getElementById('installHinweis').hidden")" "true"
else
  notiz "übersprungen: Installationshinweis – Live-Seite noch ohne neuen Web-Code"
fi

schritt "2. Datei-Brücke auf der eigenen Adresse vorhanden"
erwarte "window.FitnessAndroid vorhanden" "$(js 'return typeof window.FitnessAndroid')" '"object"'

schritt "3. Übung als Markierung speichern"
erwarte "Übung gespeichert" "$(js "const db = await import(new URL('src/db.js', location.href).href);
    await db.uebungen.speichern({ id: '$MARKER_ID', name: '$MARKER_NAME' });
    return (await db.uebungen.nachId('$MARKER_ID')).name")" "\"$MARKER_NAME\""

schritt "4. Export über die Brücke: Datei im Download-Ordner, Antwort an die Seite"
antwort=$(js "const b = window.FitnessAndroid;
    const antwort = new Promise(r => { b.onmessage = e => r(JSON.parse(e.data)); });
    b.postMessage(JSON.stringify({ aktion: 'dateiSpeichern', id: 7,
      dateiname: 'fitness-emulator-test.json', inhalt: '{\"test\":true}', typ: 'application/json' }));
    return await antwort")
erwarte "Antwort der App" "$antwort" '{"id":7,"ok":true,"name":"fitness-emulator-test.json"}'
adb shell ls -l /sdcard/Download/ | tee -a "$PROTOKOLL"
erwarte "Dateiinhalt" "$(adb shell cat /sdcard/Download/fitness-emulator-test.json | tr -d '\r' || true)" '{"test":true}'

schritt "5. Bestätigungsdialog (confirm) mit OK"
js "setTimeout(() => { window.dialogAntwort = confirm('Emulator-Test: Dialog sichtbar?'); }, 0); return true" > /dev/null
sleep 2
bild "2-dialog"
tippen_auf "android:id/button1"
sleep 1
erwarte "confirm() liefert nach OK true" "$(js 'return window.dialogAntwort')" "true"

schritt "6. YouTube-Video eingebettet, ohne Zugriff auf die Brücke"
js "const f = document.createElement('iframe');
    f.src = '$YOUTUBE_HERKUNFT/embed/$YOUTUBE_ID';
    f.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:56vw;z-index:9999;border:0';
    document.body.append(f); return true" > /dev/null
sleep 10
bild "3-youtube"
erwarte "Brücke im YouTube-iframe nicht sichtbar" \
  "$(js 'return typeof window.FitnessAndroid' "$YOUTUBE_HERKUNFT")" '"undefined"'

schritt "7. Dateiauswahl für den Import"
js "location.href = new URL('verwaltung.html', location.href).href; return true" > /dev/null
seite_abwarten "verwaltung.html"
js "document.getElementById('fImport').click(); return true" > /dev/null
sleep 4
bild "4-dateiauswahl"
oben=$(adb shell dumpsys activity activities | grep -m1 "topResumedActivity\|mResumedActivity" | tr -d '\r' || true)
notiz "Vorderste Ansicht: $oben"
echo "$oben" | grep -qi "documentsui" || fehler "Dateiauswahl hat sich nicht geöffnet"
adb shell input keyevent KEYCODE_BACK
sleep 2

schritt "8. Export-Knopf der Web-App"
if neuer_webcode_live; then
  js "document.getElementById('btnExport').click(); return true" > /dev/null
  sleep 3
  bild "5-export-knopf"
  meldung=$(js "return document.getElementById('meldung').textContent")
  notiz "Meldung: $meldung"
  echo "$meldung" | grep -q "in „Downloads“ gespeichert" || fehler "Export-Knopf meldet keinen Erfolg"
  adb shell ls /sdcard/Download/ | tr -d '\r' | grep -q "^fitness-sicherung-" || fehler "Sicherung fehlt im Download-Ordner"
  notiz "OK: Sicherung liegt im Download-Ordner"
else
  notiz "übersprungen: Export-Knopf – Live-Seite noch ohne neuen Web-Code (Brücke selbst: Schritt 4)"
fi

schritt "9. Wechsel in den Hintergrund erreicht die Seite sofort"
js "localStorage.setItem('sichtbarkeit', '');
    document.addEventListener('visibilitychange', () =>
      localStorage.setItem('sichtbarkeit', localStorage.getItem('sichtbarkeit') + document.visibilityState + ' '));
    return true" > /dev/null
adb shell input keyevent KEYCODE_HOME
sleep 1
# Wie ein Tipp aufs App-Symbol: holt die laufende App zurück, statt ein neues Fenster zu öffnen.
adb shell monkey -p "$PAKET" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 2
erwarte "visibilitychange: hidden, dann visible" "$(js "return localStorage.getItem('sichtbarkeit').trim()")" '"hidden visible"'

schritt "10. Chrome-Daten löschen, App neu starten"
notiz "Speicherort der App-Datenbank (privat, nur für diese App):"
adb shell run-as "$PAKET" ls app_webview/Default | tee -a "$PROTOKOLL"
adb shell am force-stop "$PAKET"
adb shell pm list packages com.android.chrome | grep -q chrome || fehler "Chrome ist im Emulator nicht installiert"
notiz "pm clear com.android.chrome: $(adb shell pm clear com.android.chrome | tr -d '\r')"
app_starten
sleep 3
erwarte "Markierung nach dem Löschen der Chrome-Daten noch da" \
  "$(js "const db = await import(new URL('src/db.js', location.href).href);
         return (await db.uebungen.nachId('$MARKER_ID'))?.name ?? null")" "\"$MARKER_NAME\""
bild "6-nach-chrome-loeschen"
notiz "(Die Startseite zählt die Markierung nicht mit – sie hat keinen Trainingstag. Beweis ist die Zeile darüber.)"

schritt "ALLE PRÜFUNGEN BESTANDEN"
