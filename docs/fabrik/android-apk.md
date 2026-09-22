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
      **Teilweise:** Debug-APK wird gebaut und getestet. Die signierte APK ist erst belegbar,
      wenn der Nutzer die Secrets hinterlegt hat.
- [x] Die APK startet und zeigt die Fitness-App (Screenshot aus dem Android-Emulator)
- [x] Daten liegen im App-eigenen Speicher: Chrome-Daten löschen (`pm clear com.android.chrome`)
      lässt die Datenbank der App unangetastet (Emulator-Beweis)
- [x] Import funktioniert (Dateiauswahl öffnet sich in der APK)
- [x] Export funktioniert in der APK: Sicherung/CSV landet im Download-Ordner des Handys
- [x] Bestätigungsdialoge (`confirm`) und YouTube-Videos funktionieren in der APK
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

- Emulator-Lauf auf GitHub Actions (Android 14), Run 35739103515 – [protokoll.txt](beweise/android-apk/emulator/protokoll.txt):
  - [nachher-1 Start](beweise/android-apk/emulator/1-start.png) – APK zeigt die App von GitHub Pages
  - [nachher-2 Export](beweise/android-apk/emulator/2-export-meldung.png) – Meldung „In Downloads gespeichert“, Datei in `/sdcard/Download` mit korrektem Inhalt
  - [nachher-3 Dialog](beweise/android-apk/emulator/3-dialog.png) – `confirm()` mit Titel „Fitness“, Abbrechen liefert `false`
  - [nachher-4 YouTube](beweise/android-apk/emulator/4-youtube.png) – eingebetteter Player lädt
  - [nachher-5 Dateiauswahl](beweise/android-apk/emulator/5-dateiauswahl.png) – Import öffnet die Android-Dateiauswahl
  - [nachher-6 Chrome gelöscht](beweise/android-apk/emulator/6-nach-chrome-loeschen.png) – nach `pm clear com.android.chrome` und Neustart ist die gespeicherte Übung noch da; Datenbank liegt in `app_webview/Default/IndexedDB` der App
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
