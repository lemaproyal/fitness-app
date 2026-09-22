# Fitness-App als Android-APK
Branch: feature/android-apk · Start: 2026-09-22 · Stufe: groß

## Aufgabe
Die App soll als echte Android-App (APK) installierbar sein, deren Daten im eigenen
Speicher der App liegen – nicht mehr im Speicher von Chrome. „Browserdaten löschen“ in
Chrome darf die Trainingsdaten nicht mehr treffen. Die APK ist eine schlanke Hülle
(Android-WebView), die die App von GitHub Pages lädt; Updates kommen weiter wie bisher über
GitHub Pages. Gebaut wird die APK von GitHub Actions, weil am Rechner weder Java noch
Android SDK installiert sind.

## Akzeptanzkriterien (prüfbar)
- [ ] GitHub Actions baut bei jedem Push eine signierte APK (fester Schlüssel, damit spätere
      APK-Updates ohne Deinstallieren – also ohne Datenverlust – möglich sind)
      **Teilweise:** Test-APK wird gebaut und geprüft; der Weg zur signierten APK läuft mit
      Wegwerf-Schlüssel grün (`apksigner verify`, Run 35746106408). Mit dem echten Schlüssel erst
      belegbar, wenn der Nutzer die Secrets hinterlegt hat.
- [x] Die APK startet und zeigt die Fitness-App (Screenshot aus dem Android-Emulator)
- [x] Daten liegen im App-eigenen Speicher: Chrome-Daten löschen (`pm clear com.android.chrome`)
      lässt die Datenbank der App unangetastet (Emulator-Beweis)
- [x] Import: Dateiauswahl öffnet sich in der APK (das Einlesen selbst ist unveränderter Web-Code)
- [ ] Export funktioniert in der APK: Sicherung/CSV landet im Download-Ordner des Handys
      **Teilweise:** Brücke im Emulator belegt (Datei + Antwort), Web-Seite lokal mit nachgebildeter
      Brücke belegt. Der echte Export-Knopf in der APK ist erst nach dem Merge belegbar – der Lauf auf
      main wartet auf GitHub Pages und scheitert, falls er ihn nicht prüfen kann.
- [x] Bestätigungsdialoge (`confirm`) funktionieren; YouTube-Player lädt in der APK (Abspielen und
      Vollbild nicht automatisch geprüft)
- [x] Die Web-Version im Browser verhält sich unverändert (Export per Download wie bisher)
- [x] Anleitung für den Nutzer: Schlüssel bei GitHub hinterlegen, APK installieren, Sicherung importieren

## Plan
1. `src/datei.js` (neu): eine Funktion `dateiSpeichern()` für Export/CSV – im Browser wie
   bisher Blob-Download, in der APK über die Brücke der App (WebView kennt keine Blob-Downloads).
   `verlauf.js` und `verwaltung.js` nutzen sie statt je einer eigenen Kopie. `sw.js`: Datei in
   den Cache, `VERSION` hochzählen.
2. `android/` (neu): schlankes Android-Projekt ohne Framework – eine `MainActivity` mit WebView
   (lädt GitHub Pages, Dateiauswahl, Vollbild-Video, Zurück-Taste, Offline-Hinweis) und
   `DateiBruecke` (schreibt Exporte in den Download-Ordner). Einzige Abhängigkeit
   `androidx.webkit`, damit die Brücke nur für die eigene Adresse sichtbar ist, nicht für
   YouTube-iframes.
3. `.github/workflows/apk.yml` (neu): baut Debug-APK, testet sie im Android-Emulator
   (`android/test/`), baut mit hinterlegtem Schlüssel die signierte APK und veröffentlicht sie
   auf `main` als GitHub-Release „apk“.
4. Signaturschlüssel lokal per openssl erzeugen (liegt in `FITNESS/signatur/`, nie im Repo).
5. Doku: `APK.md` für den Nutzer, `PROJEKT.md` ergänzen.

## Fortschritt
- [x] 1 Station – Worktree angelegt
- [x] 2 Montage – gebaut nach Code-Struktur (Web: `src/datei.js`; Android: `android/`;
      Build/Test: `.github/workflows/apk.yml`, `android/test/`). Neue Abhängigkeit nur
      `androidx.webkit` (Begründung im Plan, Punkt 2).
- [x] 3 Qualitätskontrolle – Vorher/Nachher-Beweis
- [ ] 4 Versand – Review 5/5, übergeben

## Beweise
- [vorher-1-keine-apk.txt](beweise/android-apk/vorher-1-keine-apk.txt) – kein Android-Projekt,
  kein Build, Export nur als Browser-Download

- Emulator-Lauf auf GitHub Actions (Android 14, Test-APK `de.lemaproyal.fitness.test`), Run 35746106408 –
  [protokoll.txt](beweise/android-apk/emulator/protokoll.txt), jede Prüfung als `OK:`-Zeile:
  - [nachher-1 Start](beweise/android-apk/emulator/1-start.png) – APK zeigt die App von GitHub Pages
  - Brücke: Antwort `{"id":7,"ok":true,"name":"fitness-emulator-test.json"}`, Datei in `/sdcard/Download` mit korrektem Inhalt
  - [nachher-2 Dialog](beweise/android-apk/emulator/2-dialog.png) – `confirm()` mit App-Namen als Titel, OK liefert `true`
  - [nachher-3 YouTube](beweise/android-apk/emulator/3-youtube.png) – eingebetteter Player lädt; im YouTube-iframe ist `FitnessAndroid` `undefined`
  - [nachher-4 Dateiauswahl](beweise/android-apk/emulator/4-dateiauswahl.png) – Import öffnet die Android-Dateiauswahl
  - Hintergrundwechsel: Seite erhält `hidden`, dann `visible`, bleibt auf derselben Seite
  - [nachher-6 Chrome gelöscht](beweise/android-apk/emulator/6-nach-chrome-loeschen.png) – nach `pm clear com.android.chrome`
    und Neustart ist die gespeicherte Übung noch da (Beweis ist die `OK:`-Zeile; die Startseite zählt Übungen ohne Trainingstag nicht)
  - **Noch nicht im Emulator belegbar, weil die APK die Live-Seite (main) lädt:** Export-Knopf der Web-App
    und ausgeblendeter Installationshinweis. Der Test prüft beides automatisch, sobald der neue Web-Code live ist
    (vorher meldet er „übersprungen“) – nach dem Merge läuft der Workflow auf main und belegt es.
- Stabilität: Zwei Läufe scheiterten, weil der allererste Seitenaufruf im frisch gestarteten Emulator
  fehlschlug (Offline-Seite, obwohl Android „online“ meldete). Die App versucht es seitdem einmal still
  erneut, bevor sie die Offline-Seite zeigt; die Offline-Seite nennt den Fehlergrund.
- Web-Version lokal (localhost, Browser-Pane): Export im Browser weiter als Blob-Download
  (`fitness-sicherung-2026-09-22.json`), mit `window.FitnessAndroid` stattdessen über die Brücke
  (verwaltung.html und verlauf.html); Installationshinweis im Browser weiter sichtbar, in der APK
  als „bereits installiert“ erkannt. `node werkzeuge/pwa-pruefen.js`: alles vollständig.
- Signierte APK: Schritt läuft, sobald die Secrets hinterlegt sind (Anleitung APK.md) – bis
  dahin nur Debug-APK (Warnung im Lauf, gewollt).

## Später
- Zur Web-Version: Startseiten-Hinweis und Brücken-Export wirken in der APK erst, wenn der Branch
  auf `main` (GitHub Pages) ist.

## Review-Runden

### Runde 1 – Score 3/5 (drei getrennte Prüfer: Android-App 3, Workflow/Tests 3, Web/Doku 3)
Behoben:
- Update-Pfad: `versionCode` = Commit-Zahl statt Laufnummer (Abbruch bei flachem Checkout);
  Test-APK als eigene App `de.lemaproyal.fitness.test` („Fitness (Test)“), damit ihr
  wechselnder Schlüssel nie die echte App blockiert; Fingerabdruck des echten Schlüssels in
  `android/signatur-fingerabdruck.txt`, der Lauf vergleicht ihn.
- Signierter Build läuft jetzt in jedem Lauf (ohne Secrets mit Wegwerf-Schlüssel + `apksigner verify`),
  Release in eigenem Job mit Schreibrechten, `concurrency`, Release wird nur aktualisiert
  (`upload --clobber`) statt gelöscht.
- App: WebView `onPause/onResume/destroy` (Hintergrundwechsel erreicht die Seite → Training sichert),
  iframe-Navigation bleibt im iframe, nur http/https nach außen, Zurück-Schleife auf Offline-Seite,
  Systemleisten im Video-Vollbild aus, Schreiben im Hintergrund-Thread, halbe Dateien werden auch bei
  RuntimeException entfernt, `allowBackup` bewusst gesetzt, Hinweis zu targetSdk 36.
- Export meldet ehrlich: die App antwortet {ok, name | fehler}; Web zeigt „in „Downloads“ gespeichert (…)“
  bzw. „fehlgeschlagen: …“; Zeitlimit 15 s; WebView ohne Brücke meldet Fehler statt „heruntergeladen“.
  `inAndroidApp()` einmal in `datei.js`, von `pwa.js` genutzt.
- Tests: OK im Dialog antippen und `true` erwarten; Brücke im YouTube-iframe muss fehlen;
  Antwort der Brücke geprüft; Hintergrundwechsel geprüft; Export-Knopf und Installationshinweis
  laufen, sobald der neue Web-Code live ist (vorher ausdrücklich „übersprungen“); Seitenwechsel
  wartet auf den richtigen Pfad; Zeitlimit in `cdp.mjs`.
- Doku: `anleitung.html` Upload-Liste mit `src/datei.js` (21 Einträge), `VEROEFFENTLICHEN.md`
  verweist auf APK, `APK.md` mit Voraussetzungen vor der Installation; Schlüssel nach
  `Desktop\AI Cloud\Fitness-Signatur` (außerhalb des Projektordners – der Nutzer lädt per
  Browser hoch, da hilft `.gitignore` nicht); `.gitignore` um `*.pem`, `passwort.txt`,
  `signatur-base64.txt` ergänzt; `veroeffentlichen/` neu gebaut.
Bewusst nicht umgesetzt:
- Dateiname mit Datum doppelt (`verlauf.js`/`verwaltung.js`) – bestand schon vorher, nicht Teil der Aufgabe.
- Actions auf Commit-SHA pinnen – Geschmacksfrage, Schreibrechte sind bereits auf den Release-Job begrenzt.
- `setup-gradle` bleibt auf v4 (nur Hinweis zu Node 20, keine Funktionsstörung).
- Erlaubte Herkunft `https://lemaproyal.github.io` gilt für alle Pages-Repos des Nutzers – alle gehören ihm.

### Runde 2 – Score 3/5 (Android-App 4, Workflow/Tests 4, Web/Doku 3)
Behoben:
- Anleitung hätte zu Datenverlust geführt: `aktualisieren.html` riet „Symbol löschen, neu
  installieren – Datenbank bleibt“. Für die APK jetzt ausdrücklich „nie deinstallieren, darüber
  installieren“ (auch `anleitung.html`, `PROJEKT.md`, `APK.md`); „Dauerhaft speichern“ als
  „nur Web-Version“ gekennzeichnet; veraltetes „ohne APK“ korrigiert; `APK.md`: Secrets vor dem
  Merge, Release statt „Lauf grün“ prüfen.
- Meldungen: WebView ohne Brücke („in dieser Ansicht nicht möglich …“), Zeitüberschreitung
  („… bitte im Ordner Downloads nachsehen“).
- App: Fertigstellen der Datei geprüft (sonst kein „ok“), Aufräumen robust, verzögertes Neuladen
  wird beim Schließen entfernt, WebView vor `destroy()` gelöst, ein Schreib-Thread für die ganze App,
  weitere `configChanges`, nur https für die eigene Adresse, Systemleisten per Wisch, Dialog nicht
  bei schließender App, `resValues` entfernt (Standard).
- Workflow: signierte APK nur von main als Artefakt; Fingerabdruck-Datei wird auf Gültigkeit
  geprüft; Secret ohne Zeilenumbrüche dekodiert; keine Läufe für Tags; auf main wartet der Lauf,
  bis GitHub Pages den Commit ausliefert (`android/test/pages-abwarten.sh`), und „übersprungen“
  ist dort ein Fehler (`WEBCODE_PFLICHT`).
- Test: jede Aktion mit Fehlerzeile im Protokoll; uiautomator-Abbild nicht mehr in `/sdcard`.
- Protokoll: Export- und YouTube-Kriterium ehrlich eingeschränkt.
Bewusst nicht umgesetzt:
- YouTube abspielen / Vollbild automatisch testen – im Emulator ohne Nutzertipp unzuverlässig;
  Kriterium entsprechend eingeschränkt.
- Kurzes Aufblitzen der WebView-Fehlerseite beim zweiten Fehlschlag – rein kosmetisch.

