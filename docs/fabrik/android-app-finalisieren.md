# Android-App fertigstellen

Branch: `codex/feature/android-app-finalisieren` · Start: 2026-09-30

## Aufgabe
Den vorhandenen Android-Stand so prüfen und übergeben, dass der echte Export aus
dem aktuellen Web-Code in der APK belegt ist und CI-Fehler nicht verdeckt werden.
Der bisherige Branch `feature/android-apk` bleibt als Ausgangspunkt erhalten.

## Akzeptanzkriterien
- [ ] Die Debug-APK startet die veröffentlichte App und behält Daten nach dem Löschen der Chrome-Daten.
- [ ] Ein Emulator-Test klickt den echten Export-Knopf des aktuellen Branch-Web-Codes in der APK und prüft die JSON-Datei im Download-Ordner.
- [ ] Ein fehlgeschlagener Emulator-Test bleibt fehlgeschlagen; kein automatischer Neuversuch verdeckt einen Fehler.
- [ ] Ein aktueller CI-Lauf belegt den Stand; Anleitung und Übergabe benennen den noch nötigen Signaturschritt.

## Plan
- Bestehenden Android-WebView und die Datei-Brücke nur für Debug-Tests um eine lokale Herkunft erweitern (`MainActivity.java`, `DateiBruecke.java`, Debug-Manifest).
- Den Branch-Web-Code im Emulator über `adb reverse` und `server.js` laden und den Export-Knopf samt Dateiinhalt prüfen (`emulator-test.sh`, `cdp.mjs`).
- Den zu großzügigen Neuversuch aus dem CI-Pfad entfernen (`apk.yml`, altes Wrapper-Skript).
- Frischen Actions-Lauf und die Belege dokumentieren; die signierte Produktions-APK benötigt weiterhin die GitHub-Secrets und den Merge durch den Nutzer.

## Fortschritt
- [x] 1 Station – bestehenden sauberen Worktree und Branch als Basis übernommen, neuen Branch angelegt
- [x] 2 Montage – Debug-App prüft den Branch-Web-Code, CI startet keinen verdeckenden Neuversuch
- [ ] 3 Qualitätskontrolle – belegt
- [ ] 4 Versand – Review 5/5, übergeben

## Beweise
- [Vorher: aktueller Android-Stand](beweise/android-app-finalisieren/vorher-1-ausgangszustand.txt)

## Review-Runden

## Später
- Die signierte APK mit dauerhaftem Schlüssel und der Export auf GitHub Pages werden erst nach Hinterlegen der Secrets und Merge auf `main` vollständig belegbar.
