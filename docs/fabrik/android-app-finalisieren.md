# Android-App fertigstellen

Branch: `codex/feature/android-app-finalisieren` · Start: 2026-09-30

## Aufgabe
Den vorhandenen Android-Stand so prüfen und übergeben, dass der echte Export aus
dem aktuellen Web-Code in der APK belegt ist und CI-Fehler nicht verdeckt werden.
Der bisherige Branch `feature/android-apk` bleibt als Ausgangspunkt erhalten.

## Akzeptanzkriterien
- [x] Die Debug-APK startet die veröffentlichte App und behält Daten nach dem Löschen der Chrome-Daten.
- [x] Ein Emulator-Test klickt den echten Export-Knopf des aktuellen Branch-Web-Codes in der APK und prüft die JSON-Datei im Download-Ordner.
- [x] Ein fehlgeschlagener Emulator-Test bleibt fehlgeschlagen; nur ein nachgewiesener Abbruch der Test-App durch Google-Play-Dienste erlaubt genau einen Neuversuch.
- [x] Ein aktueller CI-Lauf belegt den Stand; Anleitung und Übergabe benennen den noch nötigen Signaturschritt.

## Plan
- Bestehenden Android-WebView und die Datei-Brücke nur für Debug-Tests um eine lokale Herkunft erweitern (`MainActivity.java`, `DateiBruecke.java`, Debug-Manifest).
- Den Branch-Web-Code im Emulator über `adb reverse` und `server.js` laden und den Export-Knopf samt Dateiinhalt prüfen (`emulator-test.sh`, `cdp.mjs`).
- Den zu großzügigen Neuversuch durch eine Prüfung der konkreten Android-Systemmeldung und der betroffenen Prozessnummer ersetzen (`apk.yml`, `emulator-test.sh`, `emulator-lauf.sh`).
- Frischen Actions-Lauf und die Belege dokumentieren; die signierte Produktions-APK benötigt weiterhin die GitHub-Secrets und den Merge durch den Nutzer.

## Fortschritt
- [x] 1 Station – bestehenden sauberen Worktree und Branch als Basis übernommen, neuen Branch angelegt
- [x] 2 Montage – Debug-App prüft den Branch-Web-Code, CI wiederholt nur einen belegten Systemabbruch einmal
- [x] 3 Qualitätskontrolle – CI-Lauf 36715862229 erfolgreich, Protokoll und Screenshots gesichert
- [x] 4 Versand – unabhängiges Review 5/5 in Runde 2, Branch zur Abnahme vorbereitet

## Beweise
- [Vorher: aktueller Android-Stand](beweise/android-app-finalisieren/vorher-1-ausgangszustand.txt)
- [Nachher: lokale Syntax- und Web-Prüfung](beweise/android-app-finalisieren/nachher-1-lokale-pruefung.txt)
- [CI-Versuch 1: Export, Chrome-Daten und Offline-Seite](beweise/android-app-finalisieren/ci-36712856840-versuch-1/protokoll.txt)
- [CI-Versuch 2: protokollierter Systemabbruch](beweise/android-app-finalisieren/ci-36712856840-versuch-2/system-abbruch.txt)
- [Nachher: erfolgreicher Emulatorlauf](beweise/android-app-finalisieren/ci-36715862229-erfolgreich/protokoll.txt)
- [Nachher: exportierte JSON-Sicherung](beweise/android-app-finalisieren/ci-36715862229-erfolgreich/sicherung-aus-apk.json)
- [Nachher: Screenshot des echten Export-Knopfs](beweise/android-app-finalisieren/ci-36715862229-erfolgreich/5-export-knopf.png)
- [Nachher: Screenshot nach Chrome-Datenlöschung](beweise/android-app-finalisieren/ci-36715862229-erfolgreich/6-nach-chrome-loeschen.png)

Der Nutzer hat den Push des Branches ausdrücklich angewiesen. Die Commits
`32802e1` und `9e6d4b8` wurden nach `origin/codex/feature/android-app-finalisieren`
gepusht. [Actions-Lauf 36712856840](https://github.com/lemaproyal/fitness-app/actions/runs/36712856840)
hat die Debug-APK gebaut. Im ersten Versuch bestanden der echte Export mit
Branch-Web-Code, JSON-Inhaltsprüfung, Chrome-Datenlöschung und Offline-Anzeige;
der Lauf scheiterte anschließend beim Online-Wiederanlauf. Im zweiten Versuch
bestanden Export und Chrome-Datenlöschung erneut; Android beendete den
Test-App-Prozess wegen des sterbenden Google-Play-Dienste-Providers. Dafür wird
nun nur bei passender Prozessnummer und Systemmeldung einmal wiederholt.

[Actions-Lauf 36715862229](https://github.com/lemaproyal/fitness-app/actions/runs/36715862229)
für Commit `3f6bee1` ist vollständig grün. Debug-APK-Bau, Emulator-Test,
Artefakt-Upload und signierter Probelauf mit Wegwerf-Schlüssel waren erfolgreich.
Das Emulator-Protokoll endet mit „ALLE PRÜFUNGEN BESTANDEN“; die JSON-Sicherung
enthält die Test-Übung, und die Markierung blieb nach `pm clear com.android.chrome`
erhalten. Die Veröffentlichung wurde für den Feature-Branch erwartungsgemäß
übersprungen. Der gezielte Retry-Pfad war in diesem grünen Lauf nicht nötig;
sein Regex wurde mit der originalen Systemmeldung lokal geprüft.

## Review-Runden

### Runde 1 – 3/5 (unabhängiger Subagent)
Keine eindeutige Code-Regression im Diff. Offener mittlerer Befund: Der
Nachher-Beleg enthält keinen aktuellen APK-Build, Manifest-Merge oder
Emulatorlauf. Die Wirkung des neuen Testablaufs ist daher noch nicht belegt.
Nach dem freigegebenen Push lagen die genannten CI-Belege vor. Der folgende
grüne Lauf schloss den fehlenden Nachher-Beleg.

### Runde 2 – 5/5 (frischer unabhängiger Subagent)
Diff seit `ed1112d`, Fabrik-Protokoll, CI-Protokoll, JSON und Screenshots geprüft.
Keine relevanten offenen Befunde. Debug-HTTP und lokale Herkunft gelten nur für
die Debug-APK; der echte Export aus dem Branch-Code wurde in derselben WebView
mit JSON-Inhaltsprüfung belegt. Der Neuversuch ist auf die konkrete
ActivityManager-Meldung für den betroffenen App-Prozess begrenzt. Der Prüfer
bestätigte die Bash-Syntax. Den GitHub-Status prüfte der Hauptagent per API:
Lauf 36715862229 war erfolgreich; der unabhängige Prüfer nutzte die lokal
gesicherten CI-Artefakte.

## Übergabe
1. Branch `codex/feature/android-app-finalisieren` zur Nutzerabnahme bereitstellen;
   der erfolgreiche Actions-Lauf und die Emulator-Belege sind oben verlinkt.
2. Vor Merge die Secrets `SIGNATUR_BASE64` und `SIGNATUR_PASSWORT` hinterlegen
   (Anleitung `APK.md`); Merge und Release-Abnahme bleiben beim Nutzer.

## Später
- Die signierte APK mit dauerhaftem Schlüssel und der Export auf GitHub Pages werden erst nach Hinterlegen der Secrets und Merge auf `main` vollständig belegbar.
