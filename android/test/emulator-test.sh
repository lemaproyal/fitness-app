#!/usr/bin/env bash
# Prüft die Debug-APK in einem laufenden Android-Emulator und hält jeden Schritt
# mit Screenshot und Protokoll fest. Läuft in GitHub Actions (.github/workflows/apk.yml).
#
#   bash android/test/emulator-test.sh <app-debug.apk> <ausgabeordner>
#
# Kernfrage: Überleben die Trainingsdaten, wenn Chrome seine Daten löscht?
#
# Die App lädt zunächst die Live-Seite von GitHub Pages. Der echte Export-Knopf
# des aktuellen Branches wird zusätzlich über den lokalen Entwicklungsserver
# und adb reverse in derselben Debug-WebView geprüft. Auf main muss auch der
# neue Web-Code auf GitHub Pages live sein (WEBCODE_PFLICHT=true).

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

WEBCODE_PFLICHT="${WEBCODE_PFLICHT:-false}"

schritt() { echo; echo "== $*" | tee -a "$PROTOKOLL"; }
notiz()   { echo "$*" | tee -a "$PROTOKOLL"; }
bild()    { adb exec-out screencap -p > "$AUS/$1.png"; notiz "Screenshot: $1.png"; }
fehler()  { notiz "FEHLER: $*"; bild "fehler" || true; exit 1; }

# Bei jedem Abbruch – auch durch set -e ohne fehler() – das Android-Protokoll sichern.
logcat_sichern() {
  local code=$?
  if [ -n "${server_pid:-}" ]; then kill "$server_pid" 2>/dev/null || true; fi
  if [ "$code" -ne 0 ]; then
    adb logcat -d -b crash > "$AUS/logcat-abstuerze.txt" 2>&1 || true
    adb logcat -d -t 1500 > "$AUS/logcat.txt" 2>&1 || true
  fi
}
trap logcat_sichern EXIT

# Reste eines abgebrochenen ersten Versuchs (emulator-lauf.sh) entfernen: Flugmodus aus
# Schritt 12 und Testdateien, die sonst als „… (1).json“ neu angelegt würden.
adb shell cmd connectivity airplane-mode disable > /dev/null 2>&1 || true
adb shell 'rm -f /sdcard/Download/fitness-*' > /dev/null 2>&1 || true
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

# Ist die Seite mit diesem Dateinamen fertig geladen – und wirklich die App? Scheitert ein
# Aufruf, zeigt die WebView kurz ihre eigene Fehlerseite unter derselben Adresse; die hat
# kein Programm-Skript der App (belegt: so rutschte ein Lauf auf die Offline-Seite durch).
app_seite_fertig() {
  [ "$(js "return location.pathname.endsWith('/$1') && document.readyState === 'complete'
             && !!document.querySelector('script[type=module][src]')" 2>/dev/null || true)" = "true" ]
}

# Wartet, bis die Seite mit diesem Dateinamen fertig geladen ist – nicht die vorige.
seite_abwarten() {
  local datei="$1"
  for _ in $(seq 1 60); do
    if app_seite_fertig "$datei"; then
      return 0
    fi
    sleep 2
  done
  notiz "Offene Seiten der App: $(curl -s http://localhost:9222/json | grep -o '"url": *"[^"]*"' | tr '\n' ' ')"
  fehler "Seite $datei lädt nicht"
}

# Wie ein Tipp aufs App-Symbol. Läuft die App schon, kommt sie so nach vorn,
# statt dass Android ein zweites Fenster öffnet.
symbol_antippen() {
  adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER \
    -n "$PAKET/de.lemaproyal.fitness.MainActivity"
}

# Adresse der Offline-Seite, falls die App sie gerade zeigt (sonst leer).
offline_seite() {
  curl -s http://localhost:9222/json | grep -o '"url": *"file:///android_asset/offline.html[^"]*"' | head -1 || true
}

app_starten() {
  symbol_antippen >> "$PROTOKOLL"
  devtools_verbinden
  startseite_abwarten
}

# Wartet bis zu 2 Minuten auf die Startseite der App. Direkt nach dem Emulator-Start
# scheitert der erste Aufruf gelegentlich (belegt: ERR_NAME_NOT_RESOLVED) – erscheint
# die Offline-Seite, tippt der Test wie ein Nutzer „Erneut versuchen“ (höchstens
# dreimal, jeder Versuch mit Grund im Protokoll). Schritt 12 erzwingt diesen Weg.
# TIPPS zählt die Tipps auf „Erneut versuchen“ – Schritt 12 prüft, dass es welche gab.
startseite_abwarten() {
  local offline
  TIPPS=0
  for _ in $(seq 1 60); do
    if app_seite_fertig ""; then
      return 0
    fi
    offline=$(offline_seite)
    if [ -n "$offline" ] && [ "$TIPPS" -lt 3 ]; then
      TIPPS=$((TIPPS + 1))
      notiz "Offline-Seite ($TIPPS. Mal): $offline – tippe „Erneut versuchen“"
      # Über die DevTools statt uiautomator: dessen Abbild scheitert an WebView-Seiten oft
      # („could not get idle state“). Ein Klick auf den Link ist derselbe Weg wie ein Tipp.
      CDP_SEITE="file:///android_asset/offline.html" \
        js "document.querySelector('a').click(); return true" > /dev/null \
        || fehler "„Erneut versuchen“ ließ sich nicht antippen"
      # Erst weiterzählen, wenn die Offline-Seite verlassen wurde – sonst träfe der
      # nächste Durchlauf noch dieselbe Seite und verbrauchte einen Tipp doppelt.
      for _ in $(seq 1 10); do
        [ -z "$(offline_seite)" ] && break
        sleep 1
      done
    fi
    sleep 2
  done
  notiz "Offene Seiten der App: $(curl -s http://localhost:9222/json | grep -o '"url": *"[^"]*"' | tr '\n' ' ')"
  fehler "Startseite lädt nicht"
}

# Tippt auf das Element mit diesem Merkmal, z. B. tippen_auf resource-id android:id/button1
# (OK im Dialog). Beide Argumente sind Teil eines grep -E-Musters – Sonderzeichen wie
# . ( + im Wert wären zu maskieren. Für Seiteninhalte der WebView nicht geeignet – deren
# Abbild scheitert oft; dort per DevTools klicken.
tippen_auf() {
  local grenzen="" versuch
  # Die WebView baut ihren Bedienungshilfen-Baum erst beim ersten Abbild auf – daher
  # bis zu dreimal nachsehen.
  for versuch in 1 2 3; do
    # Nicht nach /sdcard – dort tauchte die Datei in der Dateiauswahl auf.
    adb shell uiautomator dump /data/local/tmp/ansicht.xml > /dev/null \
      || fehler "uiautomator-Abbild gescheitert"
    grenzen=$(adb shell cat /data/local/tmp/ansicht.xml | tr -d '\r' \
      | grep -oE "$1=\"$2\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" \
      | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -1 || true)
    [ -n "$grenzen" ] && break
    sleep 1
  done
  [ -n "$grenzen" ] || fehler "Element $1=$2 nicht gefunden"
  read -r x1 y1 x2 y2 <<< "$(echo "$grenzen" | tr -c '0-9' ' ')"
  adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
}

neuer_webcode_live() {
  [ "$(js "try { return (await (await fetch('src/datei.js', { cache: 'no-store' })).text()).includes('dateiAusgeben') } catch { return false }")" = "true" ]
}

sicherung_datei() {
  adb shell ls -1 /sdcard/Download/ | tr -d '\r' \
    | grep -E '^fitness-sicherung-.*\.json$' | head -1 || true
}

uebersprungen() {
  [ "$WEBCODE_PFLICHT" = "true" ] && fehler "$1 – neuer Web-Code ist nicht live, obwohl er es sein müsste"
  notiz "übersprungen: $1 – Live-Seite noch ohne neuen Web-Code"
}

# Ein frisch gestarteter Emulator ist manchmal noch offline. Scheitert danach noch
# die Namensauflösung, fängt startseite_abwarten das über die Offline-Seite ab.
internet_abwarten() {
  local versuch
  for versuch in $(seq 1 60); do
    # VALIDATED setzt Android erst, wenn seine eigene Prüfung ins Internet geklappt hat.
    if adb shell dumpsys connectivity | grep -qE "Capabilities: [A-Z_&]*VALIDATED"; then
      notiz "online nach $versuch Versuch(en)"
      return 0
    fi
    sleep 2
  done
  fehler "Emulator bekommt kein Internet"
}

schritt "0. Warten, bis der Emulator Internet hat"
internet_abwarten

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
  uebersprungen "Installationshinweis"
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
js "setTimeout(() => { window.dialogAntwort = confirm('Emulator-Test: Dialog sichtbar?'); }, 0); return true" > /dev/null || fehler "Dialog ließ sich nicht öffnen"
sleep 2
bild "2-dialog"
tippen_auf resource-id "android:id/button1"
sleep 1
erwarte "confirm() liefert nach OK true" "$(js 'return window.dialogAntwort')" "true"

schritt "6. YouTube-Video eingebettet, ohne Zugriff auf die Brücke"
js "const f = document.createElement('iframe');
    f.src = '$YOUTUBE_HERKUNFT/embed/$YOUTUBE_ID';
    f.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:56vw;z-index:9999;border:0';
    document.body.append(f); return true" > /dev/null || fehler "YouTube-iframe ließ sich nicht einfügen"
sleep 10
bild "3-youtube"
erwarte "Brücke im YouTube-iframe nicht sichtbar" \
  "$(js 'return typeof window.FitnessAndroid' "$YOUTUBE_HERKUNFT")" '"undefined"'

schritt "7. Dateiauswahl für den Import"
js "location.href = new URL('verwaltung.html', location.href).href; return true" > /dev/null || fehler "Wechsel zur Verwaltung gescheitert"
seite_abwarten "verwaltung.html"
js "document.getElementById('fImport').click(); return true" > /dev/null || fehler "Import-Feld nicht gefunden"
sleep 4
bild "4-dateiauswahl"
oben=$(adb shell dumpsys activity activities | grep -m1 "topResumedActivity\|mResumedActivity" | tr -d '\r' || true)
notiz "Vorderste Ansicht: $oben"
echo "$oben" | grep -qi "documentsui" || fehler "Dateiauswahl hat sich nicht geöffnet"
adb shell input keyevent KEYCODE_BACK
sleep 2

schritt "8. Echter Export-Knopf des Branch-Web-Codes in der APK"
if neuer_webcode_live; then
  js "document.getElementById('btnExport').click(); return true" > /dev/null \
    || fehler "Export-Knopf der Live-Seite ließ sich nicht antippen"
  sleep 3
  meldung=$(js "return document.getElementById('meldung').textContent" || true)
  echo "$meldung" | grep -q "in „Downloads“ gespeichert" \
    || fehler "Live-Seite meldet keinen Export-Erfolg: $meldung"
  live_datei=$(sicherung_datei)
  [ -n "$live_datei" ] || fehler "Live-Seite hat keine Sicherung angelegt"
  adb exec-out cat "/sdcard/Download/$live_datei" | grep -q "$MARKER_ID" \
    || fehler "Live-Seite hat die Test-Übung nicht exportiert"
  notiz "OK: Live-Seite exportiert die Test-Übung über die APK-Brücke"
  adb shell rm -f "/sdcard/Download/$live_datei" > /dev/null
else
  uebersprungen "Export-Knopf der Live-Seite"
fi
node server.js > "$AUS/server.log" 2>&1 &
server_pid=$!
for _ in $(seq 1 20); do
  curl -fsS http://localhost:5173/verwaltung.html > /dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://localhost:5173/verwaltung.html > /dev/null || fehler "Branch-Web-Code lokal nicht erreichbar"
adb reverse tcp:5173 tcp:5173 > /dev/null || fehler "adb reverse gescheitert"
js "location.href = 'http://localhost:5173/verwaltung.html'; return true" > /dev/null \
  || fehler "Wechsel zum Branch-Web-Code gescheitert"
export CDP_SEITE="http://localhost:5173/"
seite_abwarten "verwaltung.html"
erwarte "Datei-Brücke auch auf Debug-Testadresse vorhanden" \
  "$(js 'return typeof window.FitnessAndroid')" '"object"'
erwarte "aktueller Branch-Web-Code geladen" "$(js 'return !!document.getElementById("btnExport")')" "true"
js "const db = await import(new URL('src/db.js', location.href).href);
    await db.uebungen.speichern({ id: '$MARKER_ID', name: '$MARKER_NAME' });
    document.getElementById('btnExport').click(); return true" > /dev/null \
  || fehler "Export-Knopf ließ sich nicht antippen"
dateiname=""
for _ in $(seq 1 15); do
  dateiname=$(sicherung_datei)
  [ -n "$dateiname" ] && break
  sleep 1
done
[ -n "$dateiname" ] || fehler "Sicherung fehlt im Download-Ordner"
adb exec-out cat "/sdcard/Download/$dateiname" > "$AUS/sicherung-aus-apk.json" \
  || fehler "Sicherung lässt sich nicht lesen"
node -e "const s=JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); if (s.format !== 'fitness-app-sicherung' ||
  !s.uebungen.some(u => u.id === '$MARKER_ID' && u.name === '$MARKER_NAME')) process.exit(1)" \
  "$AUS/sicherung-aus-apk.json" || fehler "Export enthält die Test-Übung nicht"
meldung=$(js "return document.getElementById('meldung').textContent" || true)
echo "$meldung" | grep -q "in „Downloads“ gespeichert" || fehler "Export-Knopf meldet keinen Erfolg: $meldung"
notiz "OK: Export-Knopf speichert $dateiname mit Test-Übung; Meldung: $meldung"
bild "5-export-knopf"
js "location.href = 'https://lemaproyal.github.io/fitness-app/verwaltung.html'; return true" > /dev/null \
  || fehler "Rückkehr zur Live-Seite gescheitert"
unset CDP_SEITE
seite_abwarten "verwaltung.html"

schritt "9. Wechsel in den Hintergrund erreicht die Seite sofort"
js "localStorage.setItem('sichtbarkeit', '');
    document.addEventListener('visibilitychange', () =>
      localStorage.setItem('sichtbarkeit', localStorage.getItem('sichtbarkeit') + document.visibilityState + ' '));
    return true" > /dev/null || fehler "Beobachter für den Hintergrundwechsel ließ sich nicht setzen"
adb shell input keyevent KEYCODE_HOME
sleep 1
symbol_antippen > /dev/null
sleep 2
erwarte "dieselbe Seite wie vor dem Wechsel" "$(js 'return location.pathname.endsWith("/verwaltung.html")')" "true"
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

schritt "11. Absturz der Darstellung: App baut sich neu auf, statt sich zu schließen"
pid_vorher=$(adb shell pidof "$PAKET" | tr -d '\r' || true)
js "@darstellung-abstuerzen" > /dev/null || fehler "Absturz ließ sich nicht auslösen"
sleep 5
erwarte "App-Prozess läuft weiter" "$(adb shell pidof "$PAKET" | tr -d '\r' || true)" "$pid_vorher"
devtools_verbinden
startseite_abwarten
erwarte "Daten nach dem Neuaufbau noch da" \
  "$(js "const db = await import(new URL('src/db.js', location.href).href);
         return (await db.uebungen.nachId('$MARKER_ID'))?.name ?? null")" "\"$MARKER_NAME\""
bild "7-nach-absturz"

schritt "12. Allererster Start ohne Internet: Offline-Seite, dann „Erneut versuchen“"
# App-Daten leeren, damit auch der Service Worker weg ist – wie bei einer Neuinstallation.
adb shell cmd connectivity airplane-mode enable
sleep 3
adb shell pm clear "$PAKET" > /dev/null
symbol_antippen >> "$PROTOKOLL"
devtools_verbinden
offline=""
for _ in $(seq 1 30); do
  offline=$(offline_seite)
  [ -n "$offline" ] && break
  sleep 2
done
[ -n "$offline" ] || fehler "Offline-Seite erscheint nicht"
notiz "OK: Offline-Seite: $offline"
echo "$offline" | grep -q "grund=net" || fehler "Offline-Seite nennt keinen Grund"
bild "8-offline"
adb shell cmd connectivity airplane-mode disable
internet_abwarten
startseite_abwarten
[ "$TIPPS" -ge 1 ] || fehler "„Erneut versuchen“ wurde nicht gebraucht – Offline-Weg nicht geprüft"
notiz "OK: nach $TIPPS Tipp(s) auf „Erneut versuchen“ lädt die App"
bild "9-nach-erneut-versuchen"

schritt "ALLE PRÜFUNGEN BESTANDEN"
