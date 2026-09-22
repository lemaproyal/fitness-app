# Fitness-App — Projektübersicht

Alles Wesentliche aus der Entwicklung an einer Stelle. Stand: Service-Worker-Version `v16`.

- **App:** https://lemaproyal.github.io/fitness-app/
- **Code bei GitHub:** https://github.com/lemaproyal/fitness-app
- **Android-App (APK):** https://github.com/lemaproyal/fitness-app/releases/download/apk/fitness.apk — siehe `APK.md`
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

**2er-Split.** Beide Tage sind gleich gebaut: Warm-Up und die schwerste
Kraftübung in Block 1, danach je ein Nebenbereich pro Block, Exit zum Schluss.

| | Tag A — Push + Explosiv | Tag B — Pull + Beine |
|---|---|---|
| Block 1 | Warm-Up + Brust + Jump | Warm-Up + Beine + Jump |
| Block 2 | Schulter + Core | Rücken + Core |
| Block 3 | Trizeps + Exit | Bizeps + Exit |

Beide Tage sind eingerahmt: **Warm-Up** am Anfang, **Exit** am Ende. Hinter
dem Bereichsnamen steht die empfohlene Satzzahl, sofern in `stammdaten.js`
eine `vorgabe` hinterlegt ist:

| Tag A | | Tag B | |
|---|---|---|---|
| Brust | 2 × 3 Sätze | Beine | 2 × 4 Sätze |
| Jump | 5 Sätze | Jump | 5 Sätze |
| Schulter | 2 × 3 Sätze | Rücken | 2 × 3 Sätze |
| Trizeps | 3 × 2 Sätze | Bizeps | 1 × 3 Sätze |

Das ist reiner Anzeigetext und steuert nichts.

**Vier Kategorien stehen auf beiden Tagen:** Warm-Up, Jump (Plyometrie),
Core und Exit. Ihr `tag` in `stammdaten.js` sagt deshalb nur noch, unter
welchem Tag sie der Verwaltungsfilter einsortiert — für die Trainingsansicht
ist er ohne Bedeutung. Der „anlegen"-Link aus einem leeren Bereich filtert
darum nach Kategorie (`verwaltung.html?kategorie=warmup`) statt nach Tag.

Jeder Block besteht in der Regel aus zwei Bereichen: einer Kraftübung und einer
Sprung- beziehungsweise Rumpfübung; Block 1 von Tag A trägt zusätzlich das
Warm-Up. In jedem Bereich stehen alle Übungen der passenden
Kategorie zur Auswahl; per Klick stellst du dir daraus das Training des Tages
zusammen.

**Warum diese Aufteilung:** Brust, Schulter und Trizeps arbeiten beim Drücken
zusammen — an einem Tag trainiert ermüdet man sie einmal richtig statt zweimal
halb. Dasselbe gilt für Rücken und Bizeps beim Ziehen. Plyometrie steht auf
beiden Tagen: Die Beinmuskulatur bekommt so jede Einheit einen explosiven
Reiz und auf Tag B zusätzlich einen unter Last.

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
| `verlauf.html` | Alle absolvierten Trainings, Export als CSV und JSON |
| `verwaltung.html` | Übungen anlegen und bearbeiten, Export/Import |

### Module in `src/`

| Datei | Zweck |
|---|---|
| `db.js` | Datenbankschicht (IndexedDB), Export/Import |
| `stammdaten.js` | Kategorien, Trainingstage, Blöcke, Seed-Übungen |
| `training.js` | Trainingsansicht: Blöcke, Auswahl, Uhr |
| `verlauf.js` | Verlauf der Trainings, Export |
| `verwaltung.js` | Übungsverwaltung |
| `start.js` | Startseite |
| `video.js` | Videodateien, Links, Abspielschleife |
| `youtube.js` | YouTube-Player hinter der Oberfläche eines `<video>`-Elements |
| `schnitt.js` | Sequenz markieren per Start/Stopp |
| `pwa.js` | Service-Worker-Anmeldung, Installation, dauerhafte Speicherung |
| `datei.js` | Export-Dateien ausgeben: im Browser als Download, in der APK über deren Brücke |

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
- `android/` — Android-Hülle für die APK, gebaut von `.github/workflows/apk.yml`; Anleitung in `APK.md`

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

**Block-Zuordnung:** Das Feld `block` einer Jump- oder Core-Übung stammt aus
der Zeit mit drei nummerierten Nebenslots je Tag. Seit jede Kategorie nur noch
einen Bereich hat, wirkt es nirgends mehr — die Verwaltung bietet es weiter an,
die Trainingsansicht wertet es nicht mehr aus.

---

## 5. Werte erfassen

Klappt man eine Übung auf, steht **über dem Video** eine Tabelle: **je Satz eine
Zeile** mit `WDH`, `Gewicht` (kg) und `Dauer` (s). Darunter `+ Satz` für eine
weitere Zeile und je Zeile ein `✕` zum Entfernen; die letzte Zeile bleibt immer
stehen. Ganz unten ein freies **Notizfeld**.

```
      WDH   GEWICHT   DAUER
 1     12     22,5             ✕
 2     12     22,5             ✕
 3     10       25             ✕
 4      8       25             ✕
            + Satz
```

Eine eigene Zeile je Satz, weil sich Sätze unterscheiden: Der dritte fällt ab,
beim vierten geht das Gewicht runter. Ein gemeinsamer Wert für alle Sätze konnte
das nicht festhalten.

Wie viele Zeilen zu Beginn dastehen, sagt die Satzvorgabe der Übung. `+ Satz`
übernimmt die Zahlen der vorherigen Zeile — von Satz zu Satz ändert sich meist
nur eine, und die tippt sich schneller als drei. Was leer bleibt, bleibt leer;
die Standardvorgaben stehen nur als grauer Platzhalter in den Feldern.

Die Notiz gilt dem heutigen Training („Sitz auf 4", „rechts zieht"), nicht der
Übung an sich. Dauerhafte Anmerkungen gehören weiterhin in die Verwaltung —
die stehen unten im aufgeklappten Kasten im grauen Feld.

In der zugeklappten Zeile steht die Kurzfassung des selbst Eingetragenen. Gleich
bleibende Zahlen stehen einmal da, wechselnde als Spanne vom ersten zum letzten
Satz: `4 × 12–8 · 22,5–25 kg`.

Die Werte gehören zum Trainingstag, nicht zur Einheit: Sie liegen unter dem
Schlüssel `werte-A` beziehungsweise `werte-B` in `einstellungen` und stehen beim
nächsten Öffnen wieder da. So sieht man beim Antreten sofort, womit man zuletzt
gearbeitet hat, und ändert nur, was sich ändert.

Ältere Bestände, in denen eine Zeile für alle Sätze galt, werden beim Laden
aufgefächert — aus `3 Sätze · 10 WDH · 20 kg` werden drei gleiche Zeilen.

Beim **Stopp** wandert die Einheit ins `protokoll` — ein Eintrag je erfasstem
Satz, mit genau den Zahlen, die in der Tabelle stehen. Leere Zeilen fallen weg;
eine Übung ganz ohne Zahlen bleibt mit einem leeren Satz stehen, damit sichtbar
ist, dass sie drankam. Genau diese Form erwartet `protokoll.verlauf(uebungId)`
für spätere Verlaufsgrafiken. Die Notizen hängen sich an die Notiz der Einheit
(„1 Übung — Cable: Sitz auf 4"), sonst wären sie beim nächsten Training
überschrieben und für immer weg.

---

## 6. Verlauf und Export

Jede beendete Einheit steht unter **Verlauf** (`verlauf.html`, von der
Startseite aus erreichbar): Datum, Trainingstag, Dauer, Anzahl Übungen und
Sätze. Aufgeklappt zeigt sie je Übung eine Tabelle mit allen Sätzen und die
Notiz der Einheit. Einzelne Einträge lassen sich dort löschen, filtern kann man
nach Tag A und Tag B.

Zwei Wege hinaus:

- **Als CSV** — eine Zeile je Satz mit Datum, Uhrzeit, Tag, Trainingsdauer,
  Übung, Satznummer, WDH, Gewicht und Dauer. Semikolon als Trenner, Komma als
  Dezimalzeichen und ein BOM voran, damit Excel und LibreOffice die Datei ohne
  Nachfrage und mit richtigen Umlauten öffnen. Zum Auswerten gedacht, nicht zum
  Zurückspielen.
- **Vollständige Sicherung** — dieselbe JSON-Datei wie unter Einstellungen. Sie
  enthält das Protokoll mit und ist die einzige, die sich wieder einlesen lässt.

---

## 7. Sequenz markieren

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

## 8. Abläufe

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
  Blockzuordnungen, Notizen, Auswahl je Tag, Workouts und Protokoll. Dieselbe
  Datei gibt es auch unter **Verlauf**, dort zusätzlich als CSV zum Auswerten
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

## 9. Wichtige Entscheidungen und warum

**PWA statt nativer App** — kein Java und kein Android SDK auf dem Rechner. Eine
APK über Bubblewrap oder Capacitor hätte trotzdem erst HTTPS-Hosting gebraucht
**und** zusätzlich Android Studio.

**Dazu eine APK als Hülle (ab September 2026)** — Anlass: „Browserdaten löschen“ in
Chrome hatte alle Trainingsdaten der installierten PWA gelöscht. Die APK lädt
dieselbe Seite von GitHub Pages, hält die Datenbank aber im privaten Speicher der
App. Gebaut wird sie von GitHub Actions, deshalb weiter kein Java am Rechner. Keine
Trusted Web Activity (Bubblewrap/PWABuilder): Die nutzt den Speicher von Chrome und
hätte das Problem nicht gelöst.

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

## 10. Fallstricke

| Symptom | Ursache | Abhilfe |
|---|---|---|
| Änderung kommt am Handy nicht an | `VERSION` in `sw.js` nicht hochgezählt | Nummer erhöhen, neu hochladen |
| „Neue Fassung verfügbar" erscheint nicht | Die installierte App wird aus dem Hintergrund geholt, nicht neu geladen — dann fragt der Browser von sich aus nie nach | App aus der Übersicht wischen und neu starten. Ab `v12` sieht die App beim Zurückkommen selbst nach |
| Upload scheint zu fehlen | `Commit changes` nicht gedrückt — der Knopf sitzt weit unter der Dateiliste | Ans Seitenende scrollen |
| Alles landet eine Ebene zu tief | Ordner `veroeffentlichen` statt seines Inhalts gezogen | Inhalt markieren (Strg+A) und ziehen |
| „Offline-Betrieb nicht aktiv" bleibt stehen | Seite nicht über https aufgerufen | Adresse prüfen |
| Übungen verschwunden | Android hat den Speicher freigeräumt | Sicherung importieren, danach `⋯` → **Dauerhaft speichern anfordern** |
| Am Handy taucht eine neue Funktion nicht auf | Code noch nicht hochgeladen | `node werkzeuge/online-pruefen.js` |

**Vor größeren Änderungen exportieren.** Die JSON-Datei ist die einzige
Sicherung.

---

## 11. Was noch offen ist

- **Verlaufsgrafiken** — `protokoll.verlauf(uebungId)` liefert die Daten bereits
  chronologisch, der Verlauf zeigt sie bisher nur als Tabelle.
- **Pausentimer** zwischen den Sätzen.
- **Körpergewicht und Maße** mitloggen.
- **Eigene Videos** — Datenmodell und Speicherpfad sind vorhanden, die beiden
  Knöpfe „Datei wählen" und „Aufnehmen" wurden bewusst entfernt und wären mit
  wenigen Zeilen wieder einzubauen.
