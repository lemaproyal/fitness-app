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
- [Nachher: lokale Syntax- und Web-Prüfung](beweise/android-app-finalisieren/nachher-1-lokale-pruefung.txt)

Der Push von Commit `32802e1` zum öffentlichen Repository wurde am 2026-09-30
von der automatischen Freigabeprüfung abgelehnt: Die Nutzeranweisung zur
Implementierung wurde nicht als ausdrückliche Freigabe zur Veröffentlichung
eines neuen Branches gewertet. Kein alternativer Push wurde versucht. Der
GitHub-Actions-Emulatorlauf und die echte signierte APK sind dadurch noch offen.

## Review-Runden

### Runde 1 – 3/5 (unabhängiger Subagent)
Keine eindeutige Code-Regression im Diff. Offener mittlerer Befund: Der
Nachher-Beleg enthält keinen aktuellen APK-Build, Manifest-Merge oder
Emulatorlauf. Die Wirkung des neuen Testablaufs ist daher noch nicht belegt.
Abhilfe nach Push-Freigabe: GitHub Actions ausführen, `test-ergebnis` prüfen,
Belege und Kriterien aktualisieren, erneut unabhängig reviewen.

## Übergabe nach Freigabe
1. Branch `codex/feature/android-app-finalisieren` nach `origin` pushen.
2. Actions-Lauf „Android-APK“ für genau diesen Commit prüfen und Emulator-Belege
   für Export, Chrome-Löschung sowie APK-Build im Protokoll verlinken.
3. Bei bestandenem Review Pull Request von diesem Branch nach `main` erstellen.
4. Vor Merge die Secrets `SIGNATUR_BASE64` und `SIGNATUR_PASSWORT` hinterlegen
   (Anleitung `APK.md`); Merge und Release-Abnahme bleiben beim Nutzer.

## Später
- Die signierte APK mit dauerhaftem Schlüssel und der Export auf GitHub Pages werden erst nach Hinterlegen der Secrets und Merge auf `main` vollständig belegbar.
