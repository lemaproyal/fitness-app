/**
 * Datenbankschicht der Fitness-App.
 *
 * IndexedDB, weil Videos als Blob gespeichert werden müssen — localStorage kann
 * nur Text und ist auf wenige Megabyte begrenzt. Alles bleibt auf dem Gerät,
 * nichts wird irgendwohin gesendet.
 *
 * Speicher sind bewusst getrennt: Übungen bleiben klein und schnell ladbar,
 * die schweren Videoblobs liegen daneben und werden nur bei Bedarf geholt.
 */

const DB_NAME = "fitness";
const DB_VERSION = 1;

let dbPromise = null;

/** Wandelt eine IDBRequest in ein Promise. */
function anfrage(req) {
  return new Promise((erfuellen, ablehnen) => {
    req.onsuccess = () => erfuellen(req.result);
    req.onerror = () => ablehnen(req.error);
  });
}

export function oeffnen() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((erfuellen, ablehnen) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = ev => {
      const db = req.result;
      const alteVersion = ev.oldVersion;

      // Version 1 — Grundgerüst
      if (alteVersion < 1) {
        const uebungen = db.createObjectStore("uebungen", { keyPath: "id" });
        uebungen.createIndex("kategorie", "kategorie");
        uebungen.createIndex("tag", "tag");
        uebungen.createIndex("level", "level");
        uebungen.createIndex("nameKlein", "nameKlein");
        uebungen.createIndex("favorit", "favorit");

        const medien = db.createObjectStore("medien", { keyPath: "id" });
        medien.createIndex("uebungId", "uebungId");

        const workouts = db.createObjectStore("workouts", { keyPath: "id" });
        workouts.createIndex("tag", "tag");
        workouts.createIndex("geaendertAm", "geaendertAm");

        const protokoll = db.createObjectStore("protokoll", { keyPath: "id" });
        protokoll.createIndex("datum", "datum");
        protokoll.createIndex("workoutId", "workoutId");

        db.createObjectStore("einstellungen", { keyPath: "schluessel" });
      }

      // Spätere Schemaänderungen kommen hier als weitere if-Blöcke dazu.
    };

    req.onsuccess = () => erfuellen(req.result);
    req.onerror = () => ablehnen(req.error);
    req.onblocked = () => ablehnen(new Error("Datenbank blockiert — bitte andere Tabs der App schließen."));
  });

  return dbPromise;
}

/** Führt eine Transaktion aus und erfüllt erst, wenn sie wirklich abgeschlossen ist. */
async function transaktion(speicher, modus, arbeit) {
  const db = await oeffnen();
  const tx = db.transaction(speicher, modus);
  const namen = Array.isArray(speicher) ? speicher : [speicher];
  const stores = Object.fromEntries(namen.map(n => [n, tx.objectStore(n)]));

  const ergebnis = await arbeit(namen.length === 1 ? stores[namen[0]] : stores);

  await new Promise((erfuellen, ablehnen) => {
    tx.oncomplete = () => erfuellen();
    tx.onerror = () => ablehnen(tx.error);
    tx.onabort = () => ablehnen(tx.error ?? new Error("Transaktion abgebrochen"));
  });

  return ergebnis;
}

const jetzt = () => new Date().toISOString();

/**
 * Heutiges Datum als YYYY-MM-DD in der Zeitzone des Geräts.
 * Bewusst nicht über toISOString(): Das rechnet in UTC um und würde ein
 * Training am späten Abend auf den falschen Tag buchen.
 */
const heute = () => {
  const d = new Date();
  const zwei = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
};

const uuid = () =>
  crypto.randomUUID ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

/** Macht aus "Fliegende Kurzhantel" die id "fliegende-kurzhantel". */
export function slug(text) {
  return String(text).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------- Übungen

/** Füllt fehlende Felder auf, damit die Oberfläche nie auf undefined trifft. */
function normalisiereUebung(u) {
  const name = (u.name ?? "").trim();
  return {
    id: u.id || slug(name) || uuid(),
    name,
    nameKlein: name.toLowerCase(),
    nameAlt: u.nameAlt ?? [],
    kategorie: u.kategorie ?? null,
    tag: u.tag ?? null,           // wird beim Speichern aus der Kategorie abgeleitet
    level: u.level ?? "mittel",
    messtyp: u.messtyp ?? "gewicht-wdh",
    equipment: u.equipment ?? [],
    unilateral: !!u.unilateral,
    muskelnPrimaer: u.muskelnPrimaer ?? [],
    muskelnSekundaer: u.muskelnSekundaer ?? [],
    ausfuehrung: u.ausfuehrung ?? [],
    hinweise: u.hinweise ?? [],
    fehler: u.fehler ?? [],
    standard: {
      saetze: u.standard?.saetze ?? 3,
      wiederholungen: u.standard?.wiederholungen ?? 10,
      gewichtKg: u.standard?.gewichtKg ?? null,
      dauerSek: u.standard?.dauerSek ?? null,
      pauseSek: u.standard?.pauseSek ?? 90,
    },
    medienId: u.medienId ?? null,   // Verweis in den medien-Speicher
    animation: u.animation ?? null, // Strichfigur-Posen als Rückfallebene
    notizen: u.notizen ?? "",
    favorit: u.favorit ? 1 : 0,     // 1/0 statt true/false, weil IndexedDB Booleans nicht indiziert
    aktiv: u.aktiv === false ? false : true,
    erstelltAm: u.erstelltAm ?? jetzt(),
    geaendertAm: jetzt(),
  };
}

export const uebungen = {
  async speichern(u) {
    const datensatz = normalisiereUebung(u);
    await transaktion("uebungen", "readwrite", s => anfrage(s.put(datensatz)));
    return datensatz;
  },

  async vieleSpeichern(liste) {
    const datensaetze = liste.map(normalisiereUebung);
    await transaktion("uebungen", "readwrite", s =>
      Promise.all(datensaetze.map(d => anfrage(s.put(d))))
    );
    return datensaetze;
  },

  nachId(id) {
    return transaktion("uebungen", "readonly", s => anfrage(s.get(id)));
  },

  async alle() {
    const liste = await transaktion("uebungen", "readonly", s => anfrage(s.getAll()));
    return liste.sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  nachKategorie(kategorie) {
    return transaktion("uebungen", "readonly", s =>
      anfrage(s.index("kategorie").getAll(kategorie))
    );
  },

  nachTag(tag) {
    return transaktion("uebungen", "readonly", s => anfrage(s.index("tag").getAll(tag)));
  },

  /** Freitextsuche über Name, Alternativnamen und Muskeln. */
  async suchen(text) {
    const q = text.trim().toLowerCase();
    if (!q) return this.alle();
    const alle = await this.alle();
    return alle.filter(u =>
      u.nameKlein.includes(q) ||
      u.nameAlt.some(n => n.toLowerCase().includes(q)) ||
      u.muskelnPrimaer.some(m => m.includes(q)) ||
      u.equipment.some(e => e.toLowerCase().includes(q)) ||
      (u.notizen ?? "").toLowerCase().includes(q)
    );
  },

  /** Löscht die Übung samt zugehöriger Medien — sonst bleiben verwaiste Videos liegen. */
  async loeschen(id) {
    const medienIds = (await medien.nachUebung(id)).map(m => m.id);
    await transaktion(["uebungen", "medien"], "readwrite", async ({ uebungen: u, medien: m }) => {
      await anfrage(u.delete(id));
      await Promise.all(medienIds.map(mid => anfrage(m.delete(mid))));
    });
  },

  anzahl() {
    return transaktion("uebungen", "readonly", s => anfrage(s.count()));
  },
};

// ----------------------------------------------------------------- Medien

export const medien = {
  /**
   * Legt ein Video ab und verknüpft es mit der Übung.
   *
   * Drei Quellen sind möglich:
   *   "datei"   — Blob liegt in der Datenbank, funktioniert offline
   *   "url"     — direkter Link auf eine Videodatei, braucht Internet
   *   "youtube" — wird als Einbettung angezeigt, braucht Internet
   *
   * loopStartMs/loopEndeMs schneiden die Schleife, ohne die Datei neu zu kodieren.
   */
  async speichern({ uebungId, blob = null, quelle = null, url = null, videoId = null,
                    mimeType = null, dauerMs = null, breite = null, hoehe = null,
                    poster = null, posterUrl = null, loopStartMs = 0, loopEndeMs = null }) {
    const artDerQuelle = quelle ?? (blob ? "datei" : "url");
    if (artDerQuelle === "datei" && !blob) throw new Error("Kein Video übergeben.");
    if (artDerQuelle !== "datei" && !url) throw new Error("Kein Link übergeben.");

    const datensatz = {
      id: uuid(),
      uebungId,
      quelle: artDerQuelle,
      typ: blob && !blob.type.startsWith("video") ? "bild" : "video",
      blob,
      url,
      videoId,
      mimeType: mimeType ?? blob?.type ?? null,
      groesseBytes: blob?.size ?? 0, // Links belegen keinen Speicher
      dauerMs, breite, hoehe,
      poster,
      posterUrl,
      loopStartMs, loopEndeMs,
      erstelltAm: jetzt(),
    };

    // Alte Medien derselben Übung ersetzen, damit nichts verwaist zurückbleibt.
    const alte = await this.nachUebung(uebungId);
    await transaktion(["medien", "uebungen"], "readwrite", async ({ medien: m, uebungen: u }) => {
      await Promise.all(alte.map(a => anfrage(m.delete(a.id))));
      await anfrage(m.put(datensatz));
      const uebung = await anfrage(u.get(uebungId));
      if (uebung) {
        uebung.medienId = datensatz.id;
        uebung.geaendertAm = jetzt();
        await anfrage(u.put(uebung));
      }
    });

    return datensatz;
  },

  nachId(id) {
    return transaktion("medien", "readonly", s => anfrage(s.get(id)));
  },

  nachUebung(uebungId) {
    return transaktion("medien", "readonly", s => anfrage(s.index("uebungId").getAll(uebungId)));
  },

  async loeschen(id) {
    const datensatz = await this.nachId(id);
    await transaktion(["medien", "uebungen"], "readwrite", async ({ medien: m, uebungen: u }) => {
      await anfrage(m.delete(id));
      if (datensatz) {
        const uebung = await anfrage(u.get(datensatz.uebungId));
        if (uebung && uebung.medienId === id) {
          uebung.medienId = null;
          uebung.geaendertAm = jetzt();
          await anfrage(u.put(uebung));
        }
      }
    });
  },

  /** Nur die Metadaten aller Medien — ohne die Blobs, damit es günstig bleibt. */
  async uebersicht() {
    const alle = await transaktion("medien", "readonly", s => anfrage(s.getAll()));
    return alle.map(({ blob, poster, ...rest }) => rest);
  },
};

// --------------------------------------------------------------- Workouts

export const workouts = {
  async speichern(w) {
    const datensatz = {
      id: w.id || uuid(),
      name: (w.name ?? "").trim(),
      tag: w.tag ?? null,
      beschreibung: w.beschreibung ?? "",
      // Jeder Eintrag verweist per uebungId; Vorgaben können pro Workout abweichen.
      eintraege: (w.eintraege ?? []).map((e, i) => ({
        uebungId: e.uebungId,
        reihenfolge: e.reihenfolge ?? i,
        saetze: e.saetze ?? null,
        wiederholungen: e.wiederholungen ?? null,
        gewichtKg: e.gewichtKg ?? null,
        dauerSek: e.dauerSek ?? null,
        pauseSek: e.pauseSek ?? null,
        notiz: e.notiz ?? "",
      })).sort((a, b) => a.reihenfolge - b.reihenfolge),
      erstelltAm: w.erstelltAm ?? jetzt(),
      geaendertAm: jetzt(),
    };
    await transaktion("workouts", "readwrite", s => anfrage(s.put(datensatz)));
    return datensatz;
  },

  nachId(id) {
    return transaktion("workouts", "readonly", s => anfrage(s.get(id)));
  },

  alle() {
    return transaktion("workouts", "readonly", s => anfrage(s.getAll()));
  },

  nachTag(tag) {
    return transaktion("workouts", "readonly", s => anfrage(s.index("tag").getAll(tag)));
  },

  loeschen(id) {
    return transaktion("workouts", "readwrite", s => anfrage(s.delete(id)));
  },

  /** Lädt ein Workout mit den vollständigen Übungsobjekten statt nur den ids. */
  async mitUebungen(id) {
    const w = await this.nachId(id);
    if (!w) return null;
    const geladen = await Promise.all(w.eintraege.map(e => uebungen.nachId(e.uebungId)));
    return {
      ...w,
      eintraege: w.eintraege.map((e, i) => ({ ...e, uebung: geladen[i] ?? null })),
    };
  },
};

// -------------------------------------------------------------- Protokoll

export const protokoll = {
  async eintragen({ workoutId = null, tag = null, datum = null, saetze = [],
                    dauerSek = null, notiz = "" }) {
    const datensatz = {
      id: uuid(),
      workoutId,
      tag,          // "A" oder "B" — welcher Trainingstag absolviert wurde
      dauerSek,     // gestoppte Trainingsdauer
      datum: datum ?? heute(), // YYYY-MM-DD, damit sich nach Tag sortieren lässt
      saetze: saetze.map((s, i) => ({
        uebungId: s.uebungId,
        satzNr: s.satzNr ?? i + 1,
        wiederholungen: s.wiederholungen ?? null,
        gewichtKg: s.gewichtKg ?? null,
        dauerSek: s.dauerSek ?? null,
        distanzM: s.distanzM ?? null,
        rpe: s.rpe ?? null,
      })),
      notiz,
      erstelltAm: jetzt(),
    };
    await transaktion("protokoll", "readwrite", s => anfrage(s.put(datensatz)));
    return datensatz;
  },

  alle() {
    return transaktion("protokoll", "readonly", s => anfrage(s.getAll()));
  },

  /** Die zuletzt absolvierten Einheiten, neueste zuerst. */
  async letzte(anzahl = 5, tag = null) {
    const alle = await this.alle();
    return alle
      .filter(e => !tag || e.tag === tag)
      .sort((a, b) => (b.erstelltAm ?? "").localeCompare(a.erstelltAm ?? ""))
      .slice(0, anzahl);
  },

  zeitraum(vonDatum, bisDatum) {
    return transaktion("protokoll", "readonly", s =>
      anfrage(s.index("datum").getAll(IDBKeyRange.bound(vonDatum, bisDatum)))
    );
  },

  /** Alle protokollierten Sätze einer Übung, chronologisch — Grundlage für Verlaufsgrafiken. */
  async verlauf(uebungId) {
    const alle = await this.alle();
    return alle
      .flatMap(e => e.saetze.filter(s => s.uebungId === uebungId).map(s => ({ ...s, datum: e.datum })))
      .sort((a, b) => a.datum.localeCompare(b.datum));
  },

  loeschen(id) {
    return transaktion("protokoll", "readwrite", s => anfrage(s.delete(id)));
  },
};

// ---------------------------------------------------------- Einstellungen

export const einstellungen = {
  async lesen(schluessel, standard = null) {
    const e = await transaktion("einstellungen", "readonly", s => anfrage(s.get(schluessel)));
    return e ? e.wert : standard;
  },
  schreiben(schluessel, wert) {
    return transaktion("einstellungen", "readwrite", s => anfrage(s.put({ schluessel, wert })));
  },
};

// -------------------------------------------------------------- Speicher

/**
 * Bittet den Browser, die Daten dauerhaft zu behalten. Ohne das darf er bei
 * Speicherdruck alles verwerfen — bei einer App voller Videos ein echtes Risiko.
 */
export async function persistentAnfordern() {
  if (!navigator.storage?.persist) return { unterstuetzt: false, dauerhaft: false };
  const bereits = await navigator.storage.persisted();
  const dauerhaft = bereits || await navigator.storage.persist();
  return { unterstuetzt: true, dauerhaft };
}

export async function speicherInfo() {
  const uebersicht = await medien.uebersicht();
  const belegtVonMedien = uebersicht.reduce((summe, m) => summe + (m.groesseBytes ?? 0), 0);
  const schaetzung = navigator.storage?.estimate ? await navigator.storage.estimate() : {};
  return {
    anzahlUebungen: await uebungen.anzahl(),
    anzahlMedien: uebersicht.length,
    belegtVonMedien,
    belegtGesamt: schaetzung.usage ?? null,
    verfuegbar: schaetzung.quota ?? null,
    dauerhaft: navigator.storage?.persisted ? await navigator.storage.persisted() : false,
  };
}

// ------------------------------------------------------ Sicherung / Umzug

/**
 * Exportiert Übungen, Workouts und Protokoll als JSON.
 * Videos bleiben außen vor — die wären base64-kodiert um ein Drittel größer und
 * sprengen jede Datei. Für die gehört das Original auf einen zweiten Datenträger.
 */
export async function exportieren() {
  const [alleUebungen, alleWorkouts, allesProtokoll, medienMeta] = await Promise.all([
    uebungen.alle(), workouts.alle(), protokoll.alle(), medien.uebersicht(),
  ]);

  // Verlinkte Videos (YouTube und Direktlinks) sind reine Textdaten und wandern
  // vollständig mit. Selbst hochgeladene Dateien nicht — die stecken als Blob in
  // der Datenbank und würden base64-kodiert jede Datei sprengen.
  const alsDatei = medienMeta.filter(m => m.quelle === "datei").length;

  return {
    format: "fitness-app-sicherung",
    version: DB_VERSION,
    erstelltAm: jetzt(),
    hinweis: alsDatei
      ? `${alsDatei} selbst hochgeladene Videodatei(en) sind nicht enthalten und müssen separat gesichert werden. Verlinkte Videos sind vollständig dabei.`
      : "Alle Videos sind verlinkt und vollständig enthalten.",
    uebungen: alleUebungen,
    workouts: alleWorkouts,
    protokoll: allesProtokoll,
    medien: medienMeta,
    medienMetadaten: medienMeta, // alter Feldname, damit ältere Sicherungen lesbar bleiben
  };
}

export async function importieren(sicherung, { ersetzen = false } = {}) {
  if (sicherung?.format !== "fitness-app-sicherung") {
    throw new Error("Unbekanntes Dateiformat.");
  }
  if (ersetzen) {
    await transaktion(["uebungen", "workouts", "protokoll", "medien"], "readwrite",
      async ({ uebungen: u, workouts: w, protokoll: p, medien: m }) => {
        await Promise.all([anfrage(u.clear()), anfrage(w.clear()),
                           anfrage(p.clear()), anfrage(m.clear())]);
      });
  }

  // medienId zurücksetzen: Die ids aus der Sicherung gelten hier nicht mehr.
  // Die Verknüpfung stellt medien.speichern() gleich neu her.
  await uebungen.vieleSpeichern((sicherung.uebungen ?? []).map(u => ({ ...u, medienId: null })));
  for (const w of sicherung.workouts ?? []) await workouts.speichern(w);

  let videos = 0, ohneDatei = 0;
  for (const m of sicherung.medien ?? sicherung.medienMetadaten ?? []) {
    // Ohne Blob lässt sich ein Dateivideo nicht wiederherstellen — nur Links.
    if (m.quelle === "datei" || !(m.url || m.videoId)) { ohneDatei++; continue; }
    if (!await uebungen.nachId(m.uebungId)) continue; // Übung fehlt in der Sicherung
    await medien.speichern({
      uebungId: m.uebungId,
      quelle: m.quelle,
      url: m.url,
      videoId: m.videoId ?? null,
      posterUrl: m.posterUrl ?? null,
      dauerMs: m.dauerMs ?? null,
      breite: m.breite ?? null,
      hoehe: m.hoehe ?? null,
      loopStartMs: m.loopStartMs ?? 0,
      loopEndeMs: m.loopEndeMs ?? null,
    });
    videos++;
  }

  return {
    uebungen: (sicherung.uebungen ?? []).length,
    workouts: (sicherung.workouts ?? []).length,
    videos,
    ohneDatei,
  };
}
