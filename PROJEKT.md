# Fitness-App — Projektübersicht

Alles Wesentliche aus der Entwicklung an einer Stelle. Stand: Service-Worker-Version `v11`.

- **App:** https://lemaproyal.github.io/fitness-app/
- **Code bei GitHub:** https://github.com/lemaproyal/fitness-app
- **Projektordner:** `C:\Users\Le Map Royal\Desktop\AI Cloud\FITNESS`

---

## 1. Was das ist

Eine private Trainings-App als **PWA** — eine Webseite, die sich auf dem
Android-Startbildschirm ablegen lässt und dort wie eine App startet: Vollbild,
eigenes Symbol, offline lauffähig.

**Kein Play Store, keine APK, kein Android Studio.** Das war die Entscheidung
ganz am Anfang, und sie hat sich gehalten: Auf dem Rechner sind nur Node und
Python installiert — kein Java, kein Android SDK. Eine native App hätte eine
Einmal-Installation von rund 1,5 GB bedeutet.

**Ziel:** bestmöglich fit im Alter bleiben. Deshalb liegt ein Schwerpunkt auf
Plyometrie — Schnellkraft baut mit dem Alter deutlich schneller ab als
Maximalkraft, und genau sie braucht man zum Treppensteigen, Aufstehen und zum
Abfangen beim Stolpern.

---

## 2. Der Trainingsplan

**2er-Split.** Acht Elemente gleichmäßig auf zwei Tage verteilt.

| | Tag A — Push + Explosiv | Tag B — Pull + Beine |
|---|---|---|
| Block 1 | Brust + Jump 1 | Beine + Core 1 |
| Block 2 | Schulter + Jump 2 | Rücken + Core 2 |
| Block 3 | Trizeps + Jump 3 | Bizeps + Core 3 |

Jeder Block besteht aus zwei Bereichen: einer Kraftübung und einer Sprung-
beziehungsweise Rumpfübung. In jedem Bereich stehen alle Übungen der passenden
Kategorie zur Auswahl; per Klick stellst du dir daraus das Training des Tages
zusammen.

**Warum diese Aufteilung:** Brust, Schulter und Trizeps arbeiten beim Drücken
zusammen — an einem Tag trainiert ermüdet man sie einmal richtig statt zweimal
halb. Dasselbe gilt für Rücken und Bizeps beim Ziehen. Plyometrie liegt auf
Tag A, damit sie nicht mit dem schweren Beintraining zusammenfällt; die
Beinmuskulatur bekommt so zweimal pro Woche einen Reiz, einmal explosiv und
einmal unter Last.

**Reihenfolge im Training:** Plyometrie gehört an den Anfang, solange das
Nervensystem frisch ist. Core ans Ende — ein vorermüdeter Rumpf macht
Kniebeugen und Kreuzheben unsicher.

### Plyometrie-Empfehlungen

Zehn Übungen, gestaffelt nach Belastung. Sehnen passen sich langsamer an als
Muskeln, deshalb steigert man hier vorsichtiger als beim Krafttraining.

**Einstieg:** Seilspringen · Pogo Hops · Landungen üben (Drop Landing) ·
Step-Up mit Absprung
**Mittelstufe:** Squat Jump · Skater Jumps · Box Jumps · Split Jumps
**Oberkörper:** Plyo-Liegestütz · Medizinball-Würfe

**Dosierung:** 3–4 Übungen pro Einheit, 3–4 Sätze à 4–8 Wiederholungen, 60–90 s
Pause, immer am Anfang der Einheit. **Leise landen** ist der beste Selbsttest —
knallt es, ist die Landung unkontrolliert oder du bist zu müde. Die ersten 3–4
Wochen bewusst nur mit der Einstiegsgruppe arbeiten: Muskeln sind nach zwei
Wochen bereit, Sehnen nach acht.

Bei Vorbelastungen an Knie, Hüfte oder Achillessehne vorher ärztlich abklären.

---

## 3. Aufbau der App

### Seiten

| Datei | Zweck |
|---|---|
| `index.html` | Startseite: zwei Kacheln Tag A / Tag B, darunter Einstellungen |
| `training.html` | Training eines Tages: Blöcke, Auswahl, Werte, Videos, Stoppuhr |
| `verwaltung.html` | Übungen anlegen und bearbeiten, Export/Import |

### Module in `src/`

| Datei | Zweck |
|---|---|
| `db.js` | Datenbankschicht (IndexedDB), Export/Import |
| `stammdaten.js` | Kategorien, Trainingstage, Blöcke, Seed-Übungen |
| `training.js` | Trainingsansicht: Blöcke, Auswahl, Uhr |
| `verwaltung.js` | Übungsverwaltung |
| `start.js` | Startseite |
| `video.js` | Videodateien, Links, Abspielschleife |
| `youtube.js` | YouTube-Player hinter der Oberfläche eines `<video>`-Elements |
| `schnitt.js` | Sequenz markieren per Start/Stopp |
| `pwa.js` | Service-Worker-Anmeldung, Installation, dauerhafte Speicherung |

### Werkzeuge in `werkzeuge/`

```
node werkzeuge/paket-bauen.js      # stellt den Upload-Ordner zusammen
node werkzeuge/online-pruefen.js   # ist meine Änderung schon live?
node werkzeuge/pwa-pruefen.js      # Manifest, Symbole, Dateiliste vollständig?
node werkzeuge/icons-erzeugen.js   # App-Symbole neu erzeugen
```

### Sonstiges

- `server.js` — lokaler Entwicklungsserver (`node server.js` → http://localhost:5173)
- `Fitness starten.bat` — startet Server und Browser per Doppelklick
- `veroeffentlichen/` — was hochgeladen wird, wird vom Paket-Skript gefüllt
- `anleitung.html` — Ersteinrichtung, `aktualisieren.html` — Update-Routine
- `DATENMODELL.md` — Details zum Datenbankschema

---

## 4. Datenmodell in Kürze

IndexedDB unter dem Namen `fitness`, fünf Speicher: `uebungen`, `medien`,
`workouts`, `protokoll`, `einstellungen`. Ausführlich in `DATENMODELL.md`.

**Übung:** Name, Kategorie, Tag (abgeleitet), Block (nur Jump/Core), Messtyp,
Equipment, Muskeln, Ausführung, Hinweise, Fehler, Standardvorgaben, Notizen,
Verweis auf das Medium.

**Medium:** drei Quellen — `datei` (Blob auf dem Gerät, offline nutzbar),
`url` (Direktlink) und `youtube` (Einbettung). `loopStartMs` und `loopEndeMs`
schneiden die angezeigte Sequenz, **ohne die Datei anzufassen**.

**Block-Zuordnung:** Eine Jump- oder Core-Übung mit `block: 2` erscheint nur in
Jump 2 beziehungsweise Core 2. Ohne Zuordnung steht sie in allen drei Slots.

---

## 5. Werte erfassen

Klappt man eine Übung auf, stehen **über dem Video** vier Felder: `Sätze`,
`WDH`, `Gewicht` (kg) und `Dauer` (s), darunter ein freies **Notizfeld**. Was
leer bleibt, bleibt leer — die Standardvorgaben der Übung stehen nur als grauer
Platzhalter in den Zahlenfeldern.

Die Notiz gilt dem heutigen Training („Sitz auf 4", „rechts zieht"), nicht der
Übung an sich. Dauerhafte Anmerkungen gehören weiterhin in die Verwaltung —
die stehen unten im aufgeklappten Kasten im grauen Feld.

In der zugeklappten Zeile steht danach die Kurzfassung des selbst Eingetragenen
(`4 × 12 · 22,5 kg`), nicht mehr die Vorgabe aus der Verwaltung.

Die Werte gehören zum Trainingstag, nicht zur Einheit: Sie liegen unter dem
Schlüssel `werte-A` beziehungsweise `werte-B` in `einstellungen` und stehen beim
nächsten Öffnen wieder da. So sieht man beim Antreten sofort, womit man zuletzt
gearbeitet hat, und ändert nur, was sich ändert.

Beim **Stopp** wandern sie ins `protokoll` — ein Eintrag je Satz, also aus
`4 × 12 · 22,5 kg` vier Sätze mit je 12 Wiederholungen und 22,5 kg. Genau diese
Form erwartet `protokoll.verlauf(uebungId)` für spätere Verlaufsgrafiken. Die
Notizen hängen sich an die Notiz der Einheit („1 Übung — Cable: Sitz auf 4"),
sonst wären sie beim nächsten Training überschrieben und für immer weg.

---

## 6. Sequenz markieren

Video läuft, du drückst **Start** wenn die Bewegung beginnt und **Stopp** wenn
sie endet. Danach spielt die Vorschau nur noch diesen Abschnitt in Schleife.

Das schneidet die Datei nicht — gespeichert werden nur zwei Zahlen. Vorteil:
nichts geht verloren, nichts wird neu kodiert, jederzeit änderbar. Nachteil:
**die Datei wird nicht kleiner.** Wer bei vielen Videos Platz sparen will,
kürzt sie vorher am Rechner mit ffmpeg.

Bei YouTube übernimmt `src/youtube.js` die Rolle des Videoelements — es kapselt
YouTubes IFrame-Player hinter derselben Oberfläche (`duration`, `currentTime`,
`paused`, `play`, `pause`), sodass Start und Stopp dort genauso funktionieren.

---

## 7. Abläufe

### Entwickeln

```
node server.js
```
→ http://localhost:5173/index.html

Nur zum Entwickeln. Der Alltag läuft über die veröffentlichte Adresse, sonst
pflegt man zwei Datenbestände parallel.

### Code aufs Handy bringen

Ausführlich in `aktualisieren.html`. Kurz:

1. `VERSION` in `sw.js` hochzählen — **der Schritt, den man vergisst**
2. `node werkzeuge/paket-bauen.js`
3. Bei GitHub `Add file` → `Upload files`, Inhalt von `veroeffentlichen`
   hineinziehen, **bis ans Seitenende scrollen**, `Commit changes`
4. `node werkzeuge/online-pruefen.js` bis „Aktuell" erscheint
5. Am Handy die App öffnen → `Jetzt aktualisieren`

### Daten zwischen Geräten übertragen

Jedes Gerät und jede Adresse hat eine **eigene Datenbank**. `localhost:5173`,
`lemaproyal.github.io` am Rechner und dasselbe am Handy sind drei getrennte
Bestände.

Übertragen über `Einstellungen` → `⋯`:

- **Exportieren** — schreibt eine JSON-Datei mit Übungen, Videolinks,
  Blockzuordnungen, Notizen, Auswahl je Tag, Workouts und Protokoll
- **Importieren** — liest sie wieder ein
- **Kästchen „vorhandene Daten ersetzen"** — ohne Haken werden die Bestände
  zusammengeführt, mit Haken wird der hiesige gelöscht und exakt durch die
  Sicherung ersetzt

Selbst hochgeladene Videodateien sind nicht enthalten (Blobs passen nicht in
JSON), verlinkte Videos vollständig. Ein laufendes Training bleibt bewusst außen
vor.

**Das ist keine automatische Synchronisierung.** Sie läuft immer in eine
Richtung und überschreibt die Gegenseite. Am einfachsten: alles am Handy
pflegen, weil dort trainiert wird.

---

## 8. Wichtige Entscheidungen und warum

**PWA statt nativer App** — kein Java und kein Android SDK auf dem Rechner. Eine
APK über Bubblewrap oder Capacitor hätte trotzdem erst HTTPS-Hosting gebraucht
**und** zusätzlich Android Studio.

**Hosting nötig, nicht optional** — der Service Worker, ohne den es keinen
Offline-Betrieb gibt, funktioniert nur über **https** oder **localhost**. Über
die WLAN-Adresse des Rechners verweigert Chrome ihn. Deshalb GitHub Pages.

**Öffentliches Repository** — im kostenlosen Tarif Voraussetzung für Pages.
Unkritisch: Hochgeladen wird nur Programmcode. Übungen, Notizen und
Trainingsdaten liegen in der Datenbank des Geräts und verlassen es nie.

**YouTube-Links statt eigener Aufnahmen** — Links belegen null Speicher und
enthalten nichts Persönliches. Der Preis: sie brauchen Internet. Im Gym ohne
Empfang bleiben die Videos schwarz, alles andere funktioniert.

**IndexedDB statt localStorage** — localStorage kann nur Text und ist auf wenige
Megabyte begrenzt. Videos als Blob brauchen IndexedDB.

**Uhr rechnet aus dem Startzeitpunkt**, statt Sekunden mitzuzählen. Am Handy
wandert die App beim Sperren in den Hintergrund und wird womöglich beendet —
so stimmt die Zeit beim Wiederöffnen trotzdem.

---

## 9. Fallstricke

| Symptom | Ursache | Abhilfe |
|---|---|---|
| Änderung kommt am Handy nicht an | `VERSION` in `sw.js` nicht hochgezählt | Nummer erhöhen, neu hochladen |
| Upload scheint zu fehlen | `Commit changes` nicht gedrückt — der Knopf sitzt weit unter der Dateiliste | Ans Seitenende scrollen |
| Alles landet eine Ebene zu tief | Ordner `veroeffentlichen` statt seines Inhalts gezogen | Inhalt markieren (Strg+A) und ziehen |
| „Offline-Betrieb nicht aktiv" bleibt stehen | Seite nicht über https aufgerufen | Adresse prüfen |
| Übungen verschwunden | Android hat den Speicher freigeräumt | Sicherung importieren, danach `⋯` → **Dauerhaft speichern anfordern** |
| Am Handy taucht eine neue Funktion nicht auf | Code noch nicht hochgeladen | `node werkzeuge/online-pruefen.js` |

**Vor größeren Änderungen exportieren.** Die JSON-Datei ist die einzige
Sicherung.

---

## 10. Was noch offen ist

- **Einzelne Sätze getrennt erfassen** — bisher gelten Wiederholungen und
  Gewicht für alle Sätze einer Übung gleich (siehe Abschnitt 5). Wer im dritten
  Satz abfällt, kann das noch nicht festhalten.
- **Verlaufsgrafiken** — `protokoll.verlauf(uebungId)` liefert die Daten bereits
  chronologisch.
- **Pausentimer** zwischen den Sätzen.
- **Körpergewicht und Maße** mitloggen.
- **Eigene Videos** — Datenmodell und Speicherpfad sind vorhanden, die beiden
  Knöpfe „Datei wählen" und „Aufnehmen" wurden bewusst entfernt und wären mit
  wenigen Zeilen wieder einzubauen.
