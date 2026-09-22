# Die Fitness-App als Android-App (APK)

Die APK zeigt dieselbe App wie die Web-Version, speichert die Daten aber im
**eigenen Speicher der App**. „Browserdaten löschen“ in Chrome erreicht sie
nicht mehr. Weg sind die Daten nur, wenn die App deinstalliert wird oder in den
Android-Einstellungen bei der App „Speicher leeren“ getippt wird.

Neuer Programmcode kommt wie bisher über GitHub Pages: hochladen, fertig. Eine
neue APK braucht es nur, wenn sich im Ordner `android/` etwas ändert.

## Einmalig: Signaturschlüssel bei GitHub hinterlegen

Jede APK wird mit einem Schlüssel unterschrieben. Android installiert ein Update
nur, wenn es mit **demselben** Schlüssel unterschrieben ist. Mit einem anderen
Schlüssel ginge es nur über Deinstallieren, und dabei gehen alle Daten verloren.

Der Schlüssel liegt am Rechner in `FITNESS\signatur\`. Er gehört nie ins
Repository, das ist öffentlich.

1. github.com/lemaproyal/fitness-app → **Settings** → **Secrets and variables**
   → **Actions** → **New repository secret**
2. Name `SIGNATUR_BASE64`, Wert: kompletter Inhalt von `signatur\signatur-base64.txt`
3. Noch einmal **New repository secret**: Name `SIGNATUR_PASSWORT`, Wert: Inhalt
   von `signatur\passwort.txt`

**Den Ordner `signatur\` zusätzlich sichern**, z. B. auf Google Drive oder einem
USB-Stick. Geht er verloren, lässt sich die App nicht mehr aktualisieren, ohne
sie neu zu installieren.

## APK bauen lassen

Das passiert automatisch, sobald eine Änderung am Ordner `android/` auf GitHub
ankommt. Von Hand: Repository → **Actions** → **Android-APK** → **Run workflow**.

Jeder Lauf testet die App vorher im Android-Emulator. Die Screenshots liegen im
Lauf unter **Artifacts → test-ergebnis**.

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
