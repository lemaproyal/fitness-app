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

- Emulator-Lauf auf GitHub Actions (Android 14, Test-APK `de.lemaproyal.fitness.test`), Run 35755833929 auf
  Commit 5a781ce, derselbe Stand zusätzlich grün in Run 35755847743 (beide ohne Neuversuch) –
  [protokoll.txt](beweise/android-apk/emulator/protokoll.txt), jede Prüfung als `OK:`-Zeile:
  - [1 Start](beweise/android-apk/emulator/1-start.png) – APK zeigt die App von GitHub Pages
  - Brücke: Antwort `{"id":7,"ok":true,"name":"fitness-emulator-test.json"}`, Datei in `/sdcard/Download` mit korrektem Inhalt
  - [2 Dialog](beweise/android-apk/emulator/2-dialog.png) – `confirm()` mit App-Namen als Titel, OK liefert `true`
  - [3 YouTube](beweise/android-apk/emulator/3-youtube.png) – Player lädt; im YouTube-iframe ist `FitnessAndroid` `undefined`
  - [4 Dateiauswahl](beweise/android-apk/emulator/4-dateiauswahl.png) – Import öffnet die Android-Dateiauswahl
  - Hintergrundwechsel: Seite erhält `hidden`, dann `visible`, bleibt auf derselben Seite
  - [6 Chrome gelöscht](beweise/android-apk/emulator/6-nach-chrome-loeschen.png) – nach `pm clear com.android.chrome`
    und Neustart ist die gespeicherte Übung noch da (Beweis ist die `OK:`-Zeile; die Startseite zählt Übungen ohne Trainingstag nicht)
  - [7 nach Absturz](beweise/android-apk/emulator/7-nach-absturz.png) – Darstellung per `Page.crash` abgestürzt: Prozess läuft
    weiter, App baut sich neu auf, Daten da
  - [8 Offline](beweise/android-apk/emulator/8-offline.png) → [9 nach „Erneut versuchen“](beweise/android-apk/emulator/9-nach-erneut-versuchen.png)
    – erster Start im Flugmodus: Offline-Seite mit Grund; nach Flugmodus aus lädt die App nach 2 Tipps
  - **Noch nicht im Emulator belegbar, weil die APK die Live-Seite (main) lädt:** Export-Knopf der Web-App
    und ausgeblendeter Installationshinweis (Screenshots zeigen ihn noch). Der Test prüft beides automatisch,
    sobald der neue Web-Code live ist – auf main ist Überspringen ein Fehler.
- Stabilität: Umgebungsfehler des Emulators, alle mit Beleg: `ERR_NAME_NOT_RESOLVED` direkt nach dem Start
  (→ feste DNS-Server, App-Neuversuch, Test tippt „Erneut versuchen“); Android beendet die App, wenn sich die
  Google-Play-Dienste aktualisieren (logcat: „depends on provider com.google.android.gms…FontsProvider in dying
  proc“, Run 35754763882 – betrifft jede WebView-App, Daten bleiben) → `emulator-lauf.sh` wiederholt den Test
  genau dann einmal, mit Warnung und erstem Versuch unter `versuch-1/`. Außerdem ein Testfehler: die
  unsichtbare Fehlerseite der WebView galt als „geladen“ → Prüfung verlangt jetzt das Programm-Skript der App.
- [nachher-web-lokal.txt](beweise/android-apk/nachher-web-lokal.txt) – alle Export-Fälle der Web-Seite.
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

### Runde 3 – Score 4/5 (Android-App 4, Workflow/Tests 4, Web/Doku 4)
Zwischen Runde 2 und 3: Ein Lauf scheiterte an `ERR_NAME_NOT_RESOLVED` (Fehlergrund dank der neuen
Anzeige auf der Offline-Seite sichtbar) – der Emulator konnte direkt nach dem Start keine Namen
auflösen. Gegenmittel: feste DNS-Server (`emulator-options … -dns-server`) und Warten auf
Namensauflösung vor dem App-Start; Lauf 35748976476 danach grün. Außerdem war die Workflow-Datei
einmal ungültig (Steuerzeichen durch ein Ersetzungsskript) – behoben, seitdem vor jedem Push per
`npx js-yaml` geprüft.
Behoben:
- App: Nachricht der Brücke wird im Hintergrund zerlegt; nur die Namensabfrage gescheitert ≠
  Speichern gescheitert; Absturz des Darstellungsprozesses baut die App neu auf statt sie zu
  beenden (`onRenderProcessGone`); `launchMode="singleTask"` gegen ein zweites Fenster nach
  „Darüber installieren → Öffnen“; wiederhergestellte Offline-Seite lädt stattdessen die App.
- Workflow/Test: `shell: bash` (pipefail) beim Signieren; DNS-Bereitschaft positiv geprüft
  (`PING name (IP)`); iframe-Prüfung nur im Hauptkontext; `curl --max-time`.
- Web: In der APK zeigt das Menü „Die Daten liegen im eigenen Speicher der App.“ statt
  „Dauerhafte Speicherung ist nicht aktiv“, der Knopf mit dem Rat „zum Startbildschirm
  hinzufügen“ ist dort ausgeblendet (lokal belegt, nachher-web-lokal.txt).
- Doku: `APK.md` – eigene Videodateien sind nicht in der Sicherung, Import erst prüfen, dann alte
  Web-App entfernen, Release-Datum steht in der Beschreibung; `anleitung.html` Kennzahlen 21
  Dateien / 180 KB.
Bewusst hingenommen:
- Zwei schnelle Pushes auf main mit Android-Änderungen: der ältere Lauf wartet vergeblich auf
  Pages und wird rot – kein falsches Release, nur ein roter Lauf.
- `inAndroidApp()` bleibt in `datei.js` (Entscheidung aus Runde 1).

Nach Runde 3: Die DNS-Prüfung per `ping` (Vorschlag aus Runde 3) ließ den Lauf 35749461915 scheitern –
`ping` liefert im Emulator nicht die erwartete Ausgabe; damit war auch die vorige Negativ-Prüfung
wirkungslos (wie der Prüfer vermutet hatte). Ersetzt durch den Nutzerweg über die Offline-Seite (s. Beweise).

### Runde 4 – Score 3/5 (Android-App 4, Workflow/Tests 3, Web/Doku 4)
Behoben:
- Test: Neuversuch über die Offline-Seite hatte eine Zeitlücke (nur einmal nach 3 s geprüft) und
  war nie ausgelöst, also unbewiesen. Jetzt eine Warteschleife (2 min), die bei Offline-Seite
  tippt; `tippen_auf` liest das Abbild bis zu dreimal und meldet Fehler mit Fehlerzeile. Neuer
  Schritt 12 erzwingt den Weg: Flugmodus an, App-Daten leeren, starten → Offline-Seite mit Grund,
  Flugmodus aus → „Erneut versuchen“ → App lädt (mindestens ein Tipp nötig).
- App: Neuaufbau nach Absturz der Darstellung nur im Vordergrund (sonst beim Zurückkommen) und
  höchstens einmal in 10 s (danach schließt die App, statt endlos neu zu starten). Neuer Schritt 11
  löst den Absturz per DevTools (`Page.crash`) aus und prüft: Prozess läuft weiter, Startseite
  lädt, Daten da. Offline-Seite wird nicht mehr gesichert (kein veralteter Eintrag im Verlauf).
  Kommentare zu singleTask (Nebenwirkung) und zum Datenstand beim Absturz präzisiert.
- Web: Hilfetext „Ohne diese Erlaubnis darf der Browser …“ in der APK mit ausgeblendet (lokal:
  Browser zeigt Knopf + Text, APK keins von beiden).

Nach Runde 4 (zwischen den Läufen): `uiautomator` scheiterte an der WebView-Offline-Seite („uiautomator-Abbild
gescheitert“) → Klick auf den Link per DevTools. Zwei rote Läufe mit derselben App-Version (App verschwand) –
per logcat als System-Abbruch durch Neustart der Google-Play-Dienste belegt, s. Stabilität.

