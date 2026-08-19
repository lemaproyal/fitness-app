// Stammdaten: feste Listen, die die App an vielen Stellen braucht.
// Bewusst als Code und nicht in der Datenbank — das sind Struktur, keine Inhalte.

export const KATEGORIEN = [
  { id: "plyometrie", name: "Plyometrie",  tag: "A", farbe: "#d4462a" },
  { id: "brust",      name: "Brust",       tag: "A", farbe: "#c2521f" },
  { id: "schulter",   name: "Schulter",    tag: "A", farbe: "#b06010" },
  { id: "trizeps",    name: "Trizeps",     tag: "A", farbe: "#946a1c" },
  { id: "ruecken",    name: "Rücken",      tag: "B", farbe: "#2f6f5e" },
  { id: "beine",      name: "Beine",       tag: "B", farbe: "#2a6079" },
  { id: "bizeps",     name: "Bizeps",      tag: "B", farbe: "#3a5a8c" },
  { id: "core",       name: "Core",        tag: "B", farbe: "#5a4a8c" },
];

// Jeder Trainingstag besteht aus drei Blöcken, jeder Block aus zwei Bereichen:
// einer Kraftübung und einer Sprung- beziehungsweise Rumpfübung. Die Bereichsnamen
// sind innerhalb eines Tages eindeutig und dienen als Schlüssel für die Auswahl.
export const TAGE = [
  {
    id: "A", name: "Tag A", untertitel: "Push + Explosiv", farbe: "#d4462a",
    bloecke: [
      { name: "Block 1", bereiche: [
        { name: "Brust",    kategorie: "brust" },
        { name: "Jump 1",   kategorie: "plyometrie", slot: true },
      ]},
      { name: "Block 2", bereiche: [
        { name: "Schulter", kategorie: "schulter" },
        { name: "Jump 2",   kategorie: "plyometrie", slot: true },
      ]},
      { name: "Block 3", bereiche: [
        { name: "Trizeps",  kategorie: "trizeps" },
        { name: "Jump 3",   kategorie: "plyometrie", slot: true },
      ]},
    ],
  },
  {
    id: "B", name: "Tag B", untertitel: "Pull + Beine", farbe: "#2a6079",
    bloecke: [
      { name: "Block 1", bereiche: [
        { name: "Beine",    kategorie: "beine" },
        { name: "Core 1",   kategorie: "core", slot: true },
      ]},
      { name: "Block 2", bereiche: [
        { name: "Rücken",   kategorie: "ruecken" },
        { name: "Core 2",   kategorie: "core", slot: true },
      ]},
      { name: "Block 3", bereiche: [
        { name: "Bizeps",   kategorie: "bizeps" },
        { name: "Core 3",   kategorie: "core", slot: true },
      ]},
    ],
  },
];

// Abgeleitet, damit die Zuordnung nur an einer Stelle gepflegt wird.
for (const tag of TAGE) {
  tag.kategorien = [...new Set(tag.bloecke.flatMap(b => b.bereiche.map(x => x.kategorie)))];
}

export const tagNach = id => TAGE.find(t => t.id === id);

export const LEVEL = [
  { id: "einstieg",        name: "Einstieg" },
  { id: "mittel",          name: "Mittel" },
  { id: "fortgeschritten", name: "Fortgeschritten" },
];

// Bestimmt, welche Felder beim Protokollieren eines Satzes abgefragt werden.
export const MESSTYPEN = [
  { id: "gewicht-wdh", name: "Gewicht × Wiederholungen", felder: ["gewichtKg", "wiederholungen"] },
  { id: "wdh",         name: "Nur Wiederholungen",       felder: ["wiederholungen"] },
  { id: "zeit",        name: "Zeit (Sekunden)",          felder: ["dauerSek"] },
  { id: "distanz",     name: "Distanz (Meter)",          felder: ["distanzM"] },
];

export const EQUIPMENT = [
  "ohne Gerät", "Kurzhantel", "Langhantel", "Kabelzug", "Maschine",
  "Klimmzugstange", "Kettlebell", "Widerstandsband", "Medizinball",
  "Kiste/Stufe", "Springseil", "Bank", "Matte",
];

export const kategorieNach = id => KATEGORIEN.find(k => k.id === id);
export const tagVonKategorie = id => kategorieNach(id)?.tag ?? null;

/**
 * Optionale Starthilfe: die zehn plyometrischen Übungen aus der Planung.
 * Wird nicht automatisch geladen, sondern nur auf Knopfdruck — alles danach
 * frei editierbar oder löschbar.
 */
export const SEED_PLYOMETRIE = [
  {
    id: "seilspringen", name: "Seilspringen", nameAlt: ["Rope Skipping"],
    kategorie: "plyometrie", level: "einstieg", messtyp: "zeit",
    equipment: ["Springseil"], unilateral: false,
    muskelnPrimaer: ["waden", "achillessehne"], muskelnSekundaer: ["rumpf", "schulter"],
    ausfuehrung: [
      "Aufrecht stehen, Ellbogen nah am Körper, das Seil kreist aus den Handgelenken.",
      "Niedrig springen — wenige Zentimeter reichen, um das Seil durchzulassen.",
      "Auf dem Fußballen landen, die Ferse tippt nur kurz auf.",
      "Gleichmäßiger Rhythmus, Blick geradeaus statt auf die Füße.",
    ],
    hinweise: [
      "Bester Einstieg in die Plyometrie: niedrige Höhe, viele Wiederholungen.",
      "Auch ohne Seil am Platz möglich, wenn der Platz nicht reicht.",
    ],
    fehler: ["Zu hoch springen", "Mit den ganzen Armen kreisen statt aus dem Handgelenk"],
    standard: { saetze: 3, wiederholungen: 0, dauerSek: 60, pauseSek: 60 },
  },
  {
    id: "pogo-hops", name: "Pogo Hops", nameAlt: ["Sprunggelenk-Hüpfer", "Ankle Hops"],
    kategorie: "plyometrie", level: "einstieg", messtyp: "wdh",
    equipment: ["ohne Gerät"], unilateral: false,
    muskelnPrimaer: ["waden", "achillessehne"], muskelnSekundaer: ["fussgewoelbe", "rumpf"],
    ausfuehrung: [
      "Aufrecht stehen, Füße hüftbreit, Knie fast gestreckt und dort halten.",
      "Nur aus dem Sprunggelenk kleine, schnelle Hüpfer ausführen.",
      "Auf dem Fußballen landen, die Ferse berührt den Boden nur kurz und leicht.",
      "Rumpf bleibt fest, der Oberkörper federt nicht mit.",
    ],
    hinweise: [
      "Ziel ist kurzer Bodenkontakt, nicht Höhe.",
      "Trainiert die Federwirkung der Achillessehne — das, was im Alter zuerst verloren geht.",
    ],
    fehler: ["In die Knie gehen — dann wird daraus ein Squat Jump", "Zu hoch springen und den Rhythmus verlieren"],
    standard: { saetze: 3, wiederholungen: 20, pauseSek: 60 },
  },
  {
    id: "drop-landing", name: "Landungen üben", nameAlt: ["Drop Landing", "Landetechnik"],
    kategorie: "plyometrie", level: "einstieg", messtyp: "wdh",
    equipment: ["Kiste/Stufe"], unilateral: false,
    muskelnPrimaer: ["quadrizeps", "gesaess"], muskelnSekundaer: ["waden", "rumpf"],
    ausfuehrung: [
      "Auf eine niedrige Stufe stellen (20–30 cm).",
      "Heruntersteigen, nicht springen, und beidbeinig landen.",
      "Landung abfangen: Hüfte nach hinten, Knie über den Zehen, weich nachgeben.",
      "Zwei Sekunden in der Landeposition stabilisieren, dann zurück auf die Stufe.",
    ],
    hinweise: [
      "Nur die Landung — das ist die Grundlage für alle weiteren Sprünge.",
      "Exzentrisches Abfangen ist genau die Fähigkeit, die Stürze verhindert.",
      "Leise landen ist der beste Selbsttest.",
    ],
    fehler: ["Knie fallen nach innen", "Steifbeinig landen", "Stufe zu hoch wählen"],
    standard: { saetze: 3, wiederholungen: 6, pauseSek: 60 },
  },
  {
    id: "step-up-absprung", name: "Step-Up mit Absprung", nameAlt: ["Explosive Step-Up"],
    kategorie: "plyometrie", level: "einstieg", messtyp: "wdh",
    equipment: ["Kiste/Stufe"], unilateral: true,
    muskelnPrimaer: ["quadrizeps", "gesaess"], muskelnSekundaer: ["waden", "rumpf"],
    ausfuehrung: [
      "Einen Fuß vollflächig auf eine niedrige Stufe setzen.",
      "Über das vordere Bein explosiv abdrücken, bis der Körper kurz abhebt.",
      "Mit demselben Fuß wieder auf der Stufe landen und weich abfedern.",
      "Alle Wiederholungen auf einer Seite, dann wechseln.",
    ],
    hinweise: [
      "Einbeinig — und einbeinig ist im Alltag die Regel, nicht die Ausnahme.",
      "Das hintere Bein hilft nicht mit, es hängt nur mit.",
    ],
    fehler: ["Mit dem hinteren Bein abstoßen", "Ferse hebt vom Kasten ab"],
    standard: { saetze: 3, wiederholungen: 6, pauseSek: 75 },
  },
  {
    id: "squat-jump", name: "Squat Jump", nameAlt: ["Countermovement Jump", "Hocksprung"],
    kategorie: "plyometrie", level: "mittel", messtyp: "wdh",
    equipment: ["ohne Gerät"], unilateral: false,
    muskelnPrimaer: ["quadrizeps", "gesaess", "waden"], muskelnSekundaer: ["rumpf", "ischiocrurale"],
    ausfuehrung: [
      "Aufrecht stehen, Füße etwa hüftbreit, Gewicht auf dem ganzen Fuß.",
      "Zügig in die halbe Kniebeuge absenken, Hüfte nach hinten, Arme schwingen nach hinten.",
      "Ohne Pause explosiv nach oben abdrücken, Arme schwingen nach vorne oben mit.",
      "Mit dem Fußballen zuerst landen, dann Ferse, Knie und Hüfte weich nachgeben lassen.",
      "Kurz stabilisieren, erst dann die nächste Wiederholung.",
    ],
    hinweise: [
      "Absenken und Absprung sind eine Bewegung, keine zwei.",
      "Knie zeigen in Richtung der Fußspitzen, nicht nach innen.",
      "Sprunghöhe ist ein guter Fitness-Indikator über die Jahre — lohnt sich zu protokollieren.",
    ],
    fehler: ["Zu tief absenken", "Steifbeinig landen", "Sätze bis zur Erschöpfung ziehen"],
    standard: { saetze: 4, wiederholungen: 5, pauseSek: 90 },
  },
  {
    id: "skater-jumps", name: "Skater Jumps", nameAlt: ["Lateral Bounds", "Seitliche Sprünge"],
    kategorie: "plyometrie", level: "mittel", messtyp: "wdh",
    equipment: ["ohne Gerät"], unilateral: true,
    muskelnPrimaer: ["gesaess", "quadrizeps"], muskelnSekundaer: ["huftstabilisatoren", "waden"],
    ausfuehrung: [
      "Auf einem Bein stehen, leicht in die Hüfte gebeugt.",
      "Seitlich auf das andere Bein abspringen, das hintere Bein kreuzt dahinter.",
      "Einbeinig landen und die Landung eine Sekunde stabilisieren.",
      "Direkt zurück auf die andere Seite springen.",
    ],
    hinweise: [
      "Deckt die seitliche Bewegungsebene ab, die im Training sonst völlig fehlt.",
      "Erreicht die Hüftstabilisatoren, an die sonst keine Übung herankommt.",
      "Am Anfang kleine Distanz, erst mit sicherer Landung weiter springen.",
    ],
    fehler: ["Landebein knickt nach innen", "Zu weit springen und wackelig landen"],
    standard: { saetze: 3, wiederholungen: 8, pauseSek: 75 },
  },
  {
    id: "box-jumps", name: "Box Jumps", nameAlt: ["Kastensprünge"],
    kategorie: "plyometrie", level: "mittel", messtyp: "wdh",
    equipment: ["Kiste/Stufe"], unilateral: false,
    muskelnPrimaer: ["quadrizeps", "gesaess", "waden"], muskelnSekundaer: ["rumpf"],
    ausfuehrung: [
      "Etwa eine Fußlänge vor der Kiste stehen.",
      "Kurz in die halbe Kniebeuge, Arme nach hinten schwingen.",
      "Explosiv abspringen und weich auf der Kiste landen, Knie geben nach.",
      "Aufrichten und heruntersteigen — nicht herunterspringen.",
    ],
    hinweise: [
      "Heruntersteigen ist Pflicht: Das Herunterspringen bringt keinen Reiz, nur Belastung.",
      "Kistenhöhe so wählen, dass die Landung sauber ist, nicht so hoch wie möglich.",
    ],
    fehler: ["Herunterspringen", "Kiste zu hoch, Landung in tiefer Hocke", "Kante streifen"],
    standard: { saetze: 4, wiederholungen: 5, pauseSek: 90 },
  },
  {
    id: "split-jumps", name: "Split Jumps", nameAlt: ["Wechselsprünge", "Jumping Lunges"],
    kategorie: "plyometrie", level: "mittel", messtyp: "wdh",
    equipment: ["ohne Gerät"], unilateral: true,
    muskelnPrimaer: ["quadrizeps", "gesaess"], muskelnSekundaer: ["waden", "rumpf", "hueftbeuger"],
    ausfuehrung: [
      "In den Ausfallschritt gehen, beide Knie etwa 90 Grad.",
      "Explosiv nach oben abspringen.",
      "In der Luft die Beine wechseln.",
      "Im Ausfallschritt weich landen und direkt in die nächste Wiederholung.",
    ],
    hinweise: [
      "Fordert Koordination und Gleichgewicht zusätzlich zur Explosivität.",
      "Oberkörper bleibt aufrecht, nicht nach vorne kippen.",
    ],
    fehler: ["Hinteres Knie schlägt auf dem Boden auf", "Zu kurzer Ausfallschritt"],
    standard: { saetze: 3, wiederholungen: 8, pauseSek: 75 },
  },
  {
    id: "plyo-liegestuetz", name: "Plyo-Liegestütz", nameAlt: ["Plyometric Push-up", "Klatsch-Liegestütz"],
    kategorie: "plyometrie", level: "fortgeschritten", messtyp: "wdh",
    equipment: ["ohne Gerät"], unilateral: false,
    muskelnPrimaer: ["brust", "trizeps", "vordere-schulter"], muskelnSekundaer: ["rumpf", "saegemuskel"],
    ausfuehrung: [
      "Liegestützposition, Hände schulterbreit, Körper bildet eine Linie von Kopf bis Ferse.",
      "Kontrolliert absenken, bis die Brust knapp über dem Boden ist.",
      "Explosiv hochdrücken, bis die Hände vom Boden abheben.",
      "Weich mit leicht gebeugten Armen auffangen und direkt weiter absenken.",
    ],
    hinweise: [
      "Progression: an einer Erhöhung → am Boden mit Handabheben → mit Klatschen.",
      "Hüfte darf nicht durchhängen, Gesäß und Bauch bleiben angespannt.",
      "Bei Handgelenksbeschwerden Hanteln oder Parallettes als Griffe nutzen.",
    ],
    fehler: ["Hüfte sackt ab", "Mit gestreckten Armen landen", "Zu viele Wiederholungen"],
    standard: { saetze: 3, wiederholungen: 5, pauseSek: 90 },
  },
  {
    id: "medizinball-wurf", name: "Medizinball-Würfe", nameAlt: ["Med Ball Slam", "Rotationswurf"],
    kategorie: "plyometrie", level: "mittel", messtyp: "wdh",
    equipment: ["Medizinball"], unilateral: false,
    muskelnPrimaer: ["rumpf", "latissimus", "schulter"], muskelnSekundaer: ["gesaess", "brust"],
    ausfuehrung: [
      "Variante Slam: Ball über den Kopf heben und mit voller Kraft vor die Füße schmettern.",
      "Variante Chest Pass: Ball vor der Brust halten und explosiv gegen eine Wand stoßen.",
      "Variante Rotationswurf: seitlich zur Wand stehen, aus der Hüfte rotieren und werfen.",
      "Ball auffangen oder aufnehmen und ohne Hetze zur nächsten Wiederholung.",
    ],
    hinweise: [
      "Der Rotationswurf ist besonders wertvoll: explosive Rumpfrotation kommt sonst nirgends vor.",
      "Kraft kommt aus Hüfte und Rumpf, nicht aus den Armen.",
    ],
    fehler: ["Nur mit den Armen werfen", "Ball zu schwer wählen — dann wird es langsam statt explosiv"],
    standard: { saetze: 3, wiederholungen: 8, pauseSek: 75 },
  },
];
