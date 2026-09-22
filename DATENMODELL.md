# Datenmodell

Alle Daten liegen in IndexedDB unter dem Namen `fitness`, ausschließlich auf dem Gerät.
Nichts wird an einen Server gesendet.

## Speicher

| Speicher | Schlüssel | Inhalt |
|---|---|---|
| `uebungen` | `id` (Slug) | Übungskatalog — der Baukasten |
| `medien` | `id` (UUID) | Videoblobs und Standbilder, getrennt von den Übungen |
| `workouts` | `id` (UUID) | Zusammengestellte Trainingseinheiten |
| `protokoll` | `id` (UUID) | Absolvierte Sätze mit Datum |
| `einstellungen` | `schluessel` | Schlüssel/Wert-Paare |

Übungen und Medien sind getrennt, weil die Listenansicht sonst bei jedem Aufruf
alle Videos mitladen müsste. Die Übung merkt sich nur eine `medienId`.

## `uebungen`

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | String | Slug aus dem Namen, z. B. `bankdruecken-kurzhantel` |
| `name`, `nameAlt[]` | String | Anzeigename und Synonyme (beides durchsuchbar) |
| `kategorie` | String | Eine der neun aus `stammdaten.js` |
| `tag` | `"A"` \| `"B"` | Wird aus der Kategorie abgeleitet, nicht von Hand gesetzt |
| `level` | String | `einstieg` \| `mittel` \| `fortgeschritten` |
| `messtyp` | String | Bestimmt, welche Felder beim Protokollieren erscheinen |
| `equipment[]` | String[] | Freitext mit Vorschlagsliste |
| `unilateral` | Boolean | Wird pro Seite ausgeführt |
| `muskelnPrimaer[]`, `muskelnSekundaer[]` | String[] | Für Filter und Auswertung |
| `ausfuehrung[]`, `hinweise[]`, `fehler[]` | String[] | Je ein Eintrag pro Punkt |
| `notizen` | String | Freier Infotext, mehrzeilig — eigene Anmerkungen zur Übung. Wird von der Freitextsuche erfasst |
| `standard` | Objekt | Vorgabewerte: `saetze`, `wiederholungen`, `gewichtKg`, `dauerSek`, `pauseSek` |
| `medienId` | String \| null | Verweis in `medien` |
| `animation` | Objekt \| null | Strichfigur-Posen als Rückfallebene ohne Video |
| `favorit` | 0 \| 1 | Zahl statt Boolean, weil IndexedDB Booleans nicht indiziert |
| `erstelltAm`, `geaendertAm` | ISO-String | |

Indizes auf `kategorie`, `tag`, `level`, `nameKlein`, `favorit`.

## `medien`

Ein Medium kommt aus einer von drei Quellen, erkennbar am Feld `quelle`:

| `quelle` | Gefüllte Felder | Offline | Speicherbedarf |
|---|---|---|---|
| `datei` | `blob`, `poster`, `mimeType`, `groesseBytes` | ja | volle Dateigröße |
| `url` | `url` | nein | 0 |
| `youtube` | `url`, `videoId`, `posterUrl` | nein | 0 |

`loopStartMs` und `loopEndeMs` schneiden die Schleife beim Abspielen,
**ohne die Datei neu zu kodieren** — aus zehn Sekunden Rohmaterial werden drei
Sekunden Anzeige, die Datei bleibt unangetastet. Gesetzt werden sie über die
Start/Stopp-Knöpfe während der Wiedergabe.

Bei `datei` und `url` steuert das Videoelement die Grenzen. Bei `youtube` tritt
`src/youtube.js` an die Stelle des Videoelements: Es kapselt die
IFrame-Player-Schnittstelle hinter derselben Oberfläche (`duration`,
`currentTime`, `paused`, `play`, `pause`, `addEventListener`), sodass die
Schnittleiste nicht unterscheiden muss, womit sie arbeitet. Fällt das Laden der
Schnittstelle aus — etwa ohne Internet —, bleibt die Eingabe in Sekunden als
Rückfallebene.

Beim Speichern eines neuen Mediums werden alte derselben Übung gelöscht;
beim Löschen einer Übung ebenso. Es können keine verwaisten Blobs zurückbleiben.

## `workouts`

```js
{
  id, name, tag: "A" | "B", beschreibung,
  eintraege: [
    { uebungId, reihenfolge, saetze, wiederholungen, gewichtKg, dauerSek, pauseSek, notiz }
  ]
}
```

Ein Eintrag verweist per `uebungId` auf den Katalog und darf die Vorgaben der
Übung überschreiben — dieselbe Übung kann in verschiedenen Workouts mit
unterschiedlichen Sätzen stehen. `workouts.mitUebungen(id)` löst die Verweise auf
und liefert die vollständigen Übungsobjekte mit.

## `einstellungen`

Schlüssel/Wert-Paare. Die Trainingsansicht legt hier drei Sorten ab:

| Schlüssel | Wert |
|---|---|
| `laufendesTraining` | `{ tag, startMs }` — die gestoppte Einheit, oder `null` |
| `auswahl-A`, `auswahl-B` | `{ "Jump": ["box-jumps"], … }` — was heute drankommt |
| `werte-A`, `werte-B` | `{ "Brust::cable": { saetze: [ { wiederholungen, gewichtKg, dauerSek }, … ], notiz }, … }` |

`saetze` ist ein Array mit einer Zeile je Satz — der dritte Satz darf andere
Zahlen tragen als der erste. Ältere Bestände hielten dort eine Zahl und daneben
`wiederholungen`, `gewichtKg` und `dauerSek` für alle Sätze gemeinsam; die
Trainingsansicht fächert das beim Laden auf, geschrieben wird nur noch die
neue Form.

Geschlüsselt wird nach `Bereich::uebungId`, nicht nach `uebungId` allein:
Der Schlüssel stammt aus der Zeit mit drei nummerierten Nebenslots je Tag, in
denen dieselbe Übung mit unterschiedlichen Werten stehen konnte. Er bleibt, weil
er die Werte an den Bereich bindet und eine spätere Rückkehr zu mehreren Slots
offen hält.

`laufendesTraining` bleibt bei der Sicherung außen vor, Auswahl und Werte
wandern mit.

## `protokoll`

Ein Eintrag pro Trainingseinheit mit einem Array absolvierter Sätze. Beim
Beenden wandert jede erfasste Zeile der Trainingsansicht als eigener Satz
hinein, mit `satzNr` in der angezeigten Reihenfolge. Zeilen ohne jede Zahl
fallen weg; eine gewählte Übung, in der gar nichts steht, bleibt mit einem
leeren Satz erhalten, damit sichtbar ist, dass sie drankam. Die freien Notizen
der einzelnen Übungen werden an `notiz` des Eintrags angehängt — das Satzobjekt
hat kein Textfeld, und `protokoll.eintragen()` würde eines verwerfen.
`protokoll.verlauf(uebungId)` liefert alle Sätze einer Übung chronologisch —
das ist die Datengrundlage für spätere Verlaufsgrafiken.

## Schemaänderungen

`DB_VERSION` in `db.js` erhöhen und in `onupgradeneeded` einen weiteren
`if (alteVersion < N)`-Block ergänzen. Bestehende Blöcke bleiben unverändert
stehen, damit auch alte Installationen sauber durchmigrieren.

## Sicherung

`exportieren()` schreibt Übungen, Workouts und Protokoll als JSON — das ist das
Format zum Zurückspielen. Daneben liefert `protokollCsv()` das Protokoll als
CSV mit einer Zeile je Satz: Semikolon als Trenner, Komma als Dezimalzeichen
und ein BOM voran, damit Excel und LibreOffice in deutscher Einstellung die
Datei ohne Nachfrage und mit richtigen Umlauten öffnen. Zurücklesen lässt sich
die CSV nicht.
**Videos sind bewusst nicht enthalten** — base64-kodiert wären sie ein Drittel
größer und würden jede Datei sprengen. Die Originalclips gehören auf einen
zweiten Datenträger.
