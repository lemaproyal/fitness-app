# Die App aufs Handy bringen

Ohne Play Store, ohne APK, ohne Android Studio. Der Weg führt über GitHub Pages:
Dateien hochladen, Adresse am Handy öffnen, zum Startbildschirm hinzufügen.

## Warum überhaupt hochladen?

Damit die App offline im Gym läuft, braucht sie einen Service Worker. Den lässt
Chrome nur über **https** oder **localhost** zu — über die WLAN-Adresse deines
Rechners (`http://192.168.…`) verweigert er ihn. GitHub Pages liefert https
kostenlos.

Nach der Installation ist die App vollständig auf dem Handy. Der Server wird
danach nur noch für Aktualisierungen gebraucht.

## Was hochgeladen wird

```
index.html
verwaltung.html
manifest.webmanifest
sw.js
.nojekyll
src/          (alle .js-Dateien)
icons/        (alle .png-Dateien)
```

**Nicht** nötig: `server.js`, `Fitness starten.bat`, `werkzeuge/`, `demo/`,
`data/`, `.claude/`. Die stören nicht, gehören aber nicht zur App.

Deine Übungen, Notizen und Videolinks werden **nicht** hochgeladen — die liegen
in der Datenbank des Browsers, also auf dem jeweiligen Gerät.

## Einmalige Einrichtung

1. Konto auf [github.com](https://github.com) anlegen, falls noch keins da ist.
2. **New repository** → Name z. B. `fitness` → **Public** → *Create*.
   (Im kostenlosen Tarif muss das Repository öffentlich sein, damit Pages
   funktioniert. Hochgeladen wird nur Programmcode.)
3. Im leeren Repository auf **uploading an existing file** klicken und die oben
   genannten Dateien und Ordner ins Browserfenster ziehen. Ordnerstruktur bleibt
   erhalten. Unten **Commit changes**.
4. **Settings → Pages** → unter *Source* „Deploy from a branch", Branch `main`,
   Ordner `/ (root)` → *Save*.
5. Ein bis zwei Minuten warten. Oben auf derselben Seite erscheint die Adresse:
   `https://DEINNAME.github.io/fitness/`

## Auf dem Handy installieren

1. Adresse in **Chrome** öffnen.
2. Menü (drei Punkte) → **Zum Startbildschirm hinzufügen** oder **App installieren**.
3. Symbol erscheint auf dem Startbildschirm, die App startet im Vollbild.
4. Einmal die App öffnen, solange noch Internet da ist — dann legt der Service
   Worker alles ab. Danach läuft sie ohne Netz.

Ausnahme: **YouTube-Videos brauchen weiterhin Internet.** Die Übungstexte,
Notizen und alles andere funktionieren offline.

## Aktualisieren

1. Geänderte Dateien im Repository ersetzen (erneut hochladen oder direkt im
   Browser bearbeiten).
2. **Wichtig:** In `sw.js` die Zeile `const VERSION = "v1";` hochzählen —
   `"v2"`, `"v3"` und so weiter.

   Ohne das behalten bereits installierte Geräte den alten Stand, weil der
   Service Worker seine gespeicherte Fassung bevorzugt.
3. App am Handy öffnen. Sie meldet „Neue Fassung verfügbar" mit einem Knopf zum
   Aktualisieren.

## Daten zwischen Geräten

Die Datenbank liegt pro Browser getrennt. Was du am Rechner anlegst, erscheint
nicht automatisch am Handy.

Übertragen geht über **⋯ → Exportieren** am einen Gerät und **Importieren** am
anderen. Der Export enthält Übungen, Workouts und Protokoll als JSON — bei
YouTube-Links also alles, was zählt. Nur selbst hochgeladene Videodateien sind
nicht enthalten, die müssten separat gesichert werden.

## Vor dem Hochladen prüfen

```
node werkzeuge/pwa-pruefen.js
```

Prüft Manifest, Symbole und ob jede vom Service Worker vorgemerkte Datei
tatsächlich existiert. Nach jeder Änderung an der Dateiliste sinnvoll.
