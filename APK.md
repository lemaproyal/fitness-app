# Die Fitness-App als Android-App (APK)

Die APK zeigt dieselbe App wie die Web-Version, speichert die Daten aber im
**eigenen Speicher der App**. „Browserdaten löschen“ in Chrome erreicht sie
nicht mehr. Weg sind die Daten nur, wenn die App deinstalliert wird oder in den
Android-Einstellungen bei der App „Speicher leeren“ getippt wird.

Den Programmcode holt die APK von GitHub Pages. Änderungen lädst du also wie
bisher zu GitHub hoch, die App holt sie sich selbst („Jetzt aktualisieren“).
Eine neue APK braucht es nur, wenn sich im Ordner `android/` etwas ändert.

**Die App nie deinstallieren** – das löscht ihre Daten. Eine neue APK wird
einfach darüber installiert.

## Einmalig: Signaturschlüssel bei GitHub hinterlegen

Jede APK wird mit einem Schlüssel unterschrieben. Android installiert ein Update
nur, wenn es mit **demselben** Schlüssel unterschrieben ist. Mit einem anderen
Schlüssel ginge es nur über Deinstallieren, und dabei gehen alle Daten verloren.

Der Schlüssel liegt am Rechner in `Desktop\AI Cloud\Fitness-Signatur\`, also
bewusst **außerhalb** des Projektordners. So kann er beim Hochladen nicht aus
Versehen im öffentlichen Repository landen. **Diesen Ordner nie zu GitHub
hochladen.**

1. github.com/lemaproyal/fitness-app → **Settings** → **Secrets and variables**
   → **Actions** → **New repository secret**
2. Name `SIGNATUR_BASE64`, Wert: kompletter Inhalt von `signatur-base64.txt`
3. Noch einmal **New repository secret**: Name `SIGNATUR_PASSWORT`, Wert: Inhalt
   von `passwort.txt`

**Den Ordner `Fitness-Signatur` zusätzlich sichern**, z. B. auf einem USB-Stick.
Geht er verloren, lässt sich die App nicht mehr aktualisieren, ohne sie neu zu
installieren.

## Bevor die APK aufs Handy kommt

1. Die Secrets sind hinterlegt (siehe oben) – am besten **vor** dem Merge.
2. Der Pull Request mit der APK ist gemergt. Dadurch sind auch die angepassten
   Web-Dateien (`src/datei.js`, `src/pwa.js`, `sw.js`) auf GitHub Pages. Ohne
   sie kann die APK nicht exportieren.
3. Unter **Releases** (rechte Spalte auf der Repository-Seite) steht „Fitness-App
   für Android“ mit heutigem Datum. Ein grüner Lauf allein reicht nicht – ohne
   Secrets ist er auch grün, veröffentlicht aber nichts. Fehlt das Release:
   **Actions → Android-APK → Run workflow** (Branch `main`).

## Am Handy installieren

1. **Erst in der alten App sichern:** Einstellungen → `⋯` → **Exportieren**.
   Die APK beginnt mit einer leeren Datenbank.
2. Am Handy öffnen:
   https://github.com/lemaproyal/fitness-app/releases/download/apk/fitness.apk
3. Die heruntergeladene Datei antippen. Beim ersten Mal fragt Android, ob der
   Browser Apps installieren darf → **Zulassen**. Danach **Installieren**.
   Google Play Protect warnt möglicherweise vor einer unbekannten App → **Trotzdem
   installieren**. Die App stammt von dir selbst.
4. App „Fitness“ öffnen → Einstellungen → `⋯` → **Importieren** → Sicherung wählen.
5. Die alte Web-App vom Startbildschirm entfernen, damit nicht aus Versehen dort
   weitertrainiert wird.

## Sichern bleibt sinnvoll

Exporte landen in der APK direkt im Ordner **Downloads** des Handys. Gegen ein
verlorenes oder kaputtes Handy hilft nur eine Kopie woanders, z. B. Google Drive.

## Für Entwickler

- Gebaut und geprüft wird von `.github/workflows/apk.yml`: Test-APK bauen, im
  Android-Emulator prüfen (`android/test/emulator-test.sh`, Screenshots unter
  **Artifacts → test-ergebnis**), dann die signierte APK bauen.
- Der Lauf vergleicht den Schlüssel mit `android/signatur-fingerabdruck.txt`. So
  fällt ein falsch hinterlegtes Secret auf, bevor eine unpassende APK erscheint.
- Die Versionsnummer ist die Zahl der Commits und steigt deshalb immer. Die Historie
  von `main` nie umschreiben (kein Force-Push), sonst könnte sie sinken.
