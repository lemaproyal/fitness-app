/**
 * Trainingsansicht für einen Tag.
 *
 * Aufbau: drei Blöcke, in der Regel mit zwei Bereichen (Kraft + Sprung bzw.
 * Rumpf); Block 1 von Tag A trägt zusätzlich das Warm-Up. In jedem Bereich
 * stehen alle Übungen der zugehörigen Kategorie; per Klick wählst du aus,
 * welche davon heute drankommen. Trägt ein Bereich eine `vorgabe`, steht die
 * empfohlene Satzzahl neben seinem Namen.
 *
 * Die Auswahl wird pro Tag gespeichert und beim nächsten Öffnen wieder
 * angezeigt — Trainingspläne wiederholen sich.
 *
 * Die laufende Einheit liegt ebenfalls in der Datenbank, nicht nur im
 * Arbeitsspeicher: Am Handy wandert die App beim Sperren des Bildschirms in den
 * Hintergrund und wird womöglich beendet. Die Uhr rechnet deshalb aus dem
 * gespeicherten Startzeitpunkt, statt Sekunden mitzuzählen.
 */

import { uebungen, medien, protokoll, einstellungen } from "./db.js";
import { TAGE, tagNach } from "./stammdaten.js";
import { schleifeAbspielen } from "./video.js";
import { spielerErzeugen } from "./youtube.js";
import { serviceWorkerAnmelden } from "./pwa.js";

const $ = id => document.getElementById(id);
const ZEICHEN = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = t => String(t ?? "").replace(/[&<>"']/g, z => ZEICHEN[z]);

const tagId = new URLSearchParams(location.search).get("tag");
const tag = tagNach(tagId) ?? TAGE[0];

const SITZUNG = "laufendesTraining";
const AUSWAHL = `auswahl-${tag.id}`;
const WERTE = `werte-${tag.id}`;

let sitzung = null;          // { tag, startMs }
let auswahl = {};            // { "Jump": ["box-jumps"], … }
let werte = {};              // { "Brust::cable": { saetze: 3, wiederholungen: 10, … } }
let nachKategorie = new Map();
let uhrLaeuft = null;
let offen = null;            // "Bereichsname::uebungId"
let aufraeumenVideo = null;

// ------------------------------------------------------------------- Zeiten

function zeitText(sekunden) {
  const s = Math.max(0, Math.floor(sekunden));
  const zwei = n => String(n).padStart(2, "0");
  const std = Math.floor(s / 3600);
  return std ? `${std}:${zwei(Math.floor((s % 3600) / 60))}:${zwei(s % 60)}`
             : `${zwei(Math.floor(s / 60))}:${zwei(s % 60)}`;
}

const dauerKurz = sek => {
  const min = Math.round(sek / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};

// --------------------------------------------------------------------- Uhr

function uhrZeichnen() {
  if (sitzung) {
    $("uhr").firstChild.textContent = zeitText((Date.now() - sitzung.startMs) / 1000);
    $("uhr").classList.add("laeuft");
    $("uhrText").textContent = "läuft";
  } else {
    $("uhr").firstChild.textContent = "00:00";
    $("uhr").classList.remove("laeuft");
  }
  $("btnStart").hidden = !!sitzung;
  $("btnStopp").hidden = !sitzung;
  $("btnVerwerfen").hidden = !sitzung;
}

function uhrStarten() {
  clearInterval(uhrLaeuft);
  uhrZeichnen();
  if (sitzung) uhrLaeuft = setInterval(uhrZeichnen, 1000);
}

async function trainingStarten() {
  const vorhanden = await einstellungen.lesen(SITZUNG);
  if (vorhanden && vorhanden.tag !== tag.id) {
    const anderer = tagNach(vorhanden.tag);
    if (!confirm(`Für ${anderer?.name ?? "einen anderen Tag"} läuft noch ein Training. Verwerfen und hier neu starten?`)) return;
  }
  sitzung = { tag: tag.id, startMs: Date.now() };
  await einstellungen.schreiben(SITZUNG, sitzung);
  uhrStarten();
  melden("Training gestartet.");
}

async function trainingBeenden() {
  if (!sitzung) return;
  const dauerSek = Math.round((Date.now() - sitzung.startMs) / 1000);
  const gewaehlt = alleGewaehlten();

  // Zuletzt Getipptes hängt womöglich noch in der Verzögerung — vor dem
  // Auslesen einmal sicher wegschreiben, sonst fehlt der letzte Satz.
  await werteJetztSichern();

  if (!gewaehlt.length &&
      !confirm("Keine Übung ausgewählt. Trotzdem beenden und nur die Zeit speichern?")) return;

  // Ein Eintrag je erfasstem Satz — genau die Zeilen, die oben stehen. Leere
  // Zeilen fallen weg; eine Übung ohne jede Zahl bleibt mit einem leeren Satz
  // im Protokoll, damit sichtbar bleibt, dass sie drankam.
  await protokoll.eintragen({
    tag: tag.id,
    dauerSek,
    saetze: gewaehlt.flatMap(g => {
      const erfasst = saetzeVon(g.bereich, g.uebungId).filter(hatWert);
      return (erfasst.length ? erfasst : [{}]).map((z, i) => ({
        uebungId: g.uebungId,
        satzNr: i + 1,
        wiederholungen: z.wiederholungen ?? null,
        gewichtKg: z.gewichtKg ?? null,
        dauerSek: z.dauerSek ?? null,
      }));
    }),
    // Die Notizen der einzelnen Übungen gehören mit ins Protokoll — sonst wären
    // sie beim nächsten Training überschrieben und für immer weg.
    notiz: [
      `${gewaehlt.length} ${gewaehlt.length === 1 ? "Übung" : "Übungen"}`,
      ...gewaehlt.map(g => {
        const text = werteVon(g.bereich, g.uebungId).notiz;
        return text ? `${uebungNach(g.uebungId)?.name ?? g.uebungId}: ${text}` : null;
      }).filter(Boolean),
    ].join(" — "),
  });
  await einstellungen.schreiben(SITZUNG, null);

  sitzung = null;
  clearInterval(uhrLaeuft);
  uhrZeichnen();
  $("uhr").firstChild.textContent = zeitText(dauerSek);
  $("uhrText").textContent = "gerade beendet";
  melden(`Training beendet: ${dauerKurz(dauerSek)}`);
}

async function trainingVerwerfen() {
  if (!sitzung || !confirm("Laufendes Training verwerfen? Die Zeit wird nicht gespeichert.")) return;
  await einstellungen.schreiben(SITZUNG, null);
  sitzung = null;
  clearInterval(uhrLaeuft);
  uhrZeichnen();
  $("uhrText").textContent = "noch nicht gestartet";
  melden("Verworfen.");
}

async function letzteEinheitZeigen() {
  const [letzte] = await protokoll.letzte(1, tag.id);
  if (letzte?.dauerSek && !sitzung) {
    const d = new Date(letzte.erstelltAm ?? letzte.datum);
    $("uhrText").textContent = `zuletzt ${dauerKurz(letzte.dauerSek)} am `
      + d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }
}

// ------------------------------------------------------------------ Auswahl

const gewaehltIn = bereich => auswahl[bereich] ?? [];
const istGewaehlt = (bereich, id) => gewaehltIn(bereich).includes(id);

/** Alle für heute gewählten Übungen, in der Reihenfolge der Blöcke. */
function alleGewaehlten() {
  const raus = [];
  for (const block of tag.bloecke) {
    for (const bereich of block.bereiche) {
      for (const uebungId of gewaehltIn(bereich.name)) {
        raus.push({ bereich: bereich.name, uebungId });
      }
    }
  }
  return raus;
}

async function auswahlUmschalten(bereich, id) {
  const liste = gewaehltIn(bereich).slice();
  const i = liste.indexOf(id);
  if (i >= 0) liste.splice(i, 1); else liste.push(id);
  auswahl[bereich] = liste;
  await einstellungen.schreiben(AUSWAHL, auswahl);
  auswahlAnzeigen();
}

/**
 * Nur Häkchen, Zähler und Fortschritt nachziehen — die Liste bleibt stehen.
 * Ein vollständiger Neuaufbau würde ein laufendes Video abreißen und halb
 * getippte Werte aus den Feldern werfen.
 */
function auswahlAnzeigen() {
  for (const el of document.querySelectorAll(".uebung")) {
    const gewaehlt = istGewaehlt(el.dataset.bereich, el.dataset.id);
    el.classList.toggle("gewaehlt", gewaehlt);
    el.querySelector(".waehlen")?.setAttribute("aria-pressed", String(gewaehlt));
  }
  for (const el of document.querySelectorAll(".bereich")) {
    const anzahl = el.querySelectorAll(".uebung.gewaehlt").length;
    const zaehler = el.querySelector(".zaehler");
    if (!zaehler) continue;
    zaehler.textContent = anzahl ? `${anzahl} gewählt` : "offen";
    zaehler.classList.toggle("aktiv", !!anzahl);
  }
  fortschrittZeigen();
}

// ------------------------------------------------------------------- Werte

/**
 * Je Satz eine Zeile: Wiederholungen, Gewicht, Dauer. Dazu eine freie Notiz für
 * die ganze Übung.
 *
 * Getrennte Zeilen, weil sich Sätze unterscheiden — der dritte fällt ab, beim
 * vierten geht das Gewicht runter. Eine gemeinsame Zeile für alle Sätze konnte
 * das nicht festhalten.
 *
 * Gespeichert wird pro Trainingstag und beim nächsten Öffnen wieder angezeigt —
 * so sieht man, womit man zuletzt gearbeitet hat. Geschlüsselt wie die Auswahl
 * nach Bereich, denn dieselbe Übung kann in Core 1 und Core 3 mit anderen
 * Werten stehen.
 *
 *   werte["Brust::cable"] = { saetze: [ { wiederholungen, gewichtKg, dauerSek }, … ],
 *                             notiz: "Sitz auf 4" }
 */
const FELDER = [
  { feld: "wiederholungen", name: "WDH",     einheit: "",   schritt: "1"   },
  { feld: "gewichtKg",      name: "Gewicht", einheit: "kg", schritt: "0.5" },
  { feld: "dauerSek",       name: "Dauer",   einheit: "s",  schritt: "1"   },
];

const MAX_SAETZE = 30;

const werteVon = (bereich, id) => werte[`${bereich}::${id}`] ?? {};
const saetzeVon = (bereich, id) => werteVon(bereich, id).saetze ?? [];
const uebungNach = id => [...nachKategorie.values()].flat().find(u => u.id === id);

/** Ein Satz zählt erst, wenn mindestens eine Zahl darin steht. */
const hatWert = z => FELDER.some(f => z?.[f.feld] != null);

const begrenzt = n => Math.min(Math.max(Math.round(Number(n) || 1), 1), MAX_SAETZE);

/**
 * Ältere Fassungen hielten eine einzige Zeile je Übung, die für alle Sätze galt.
 * Daraus wird beim Laden je Satz eine eigene Zeile mit denselben Zahlen — so
 * geht nichts verloren und die neue Ansicht hat vom ersten Öffnen an Inhalt.
 */
function werteAngleichen(roh) {
  const raus = {};
  for (const [schluessel, alt] of Object.entries(roh ?? {})) {
    if (Array.isArray(alt?.saetze)) { raus[schluessel] = alt; continue; }
    const zeile = {};
    for (const f of FELDER) if (alt?.[f.feld] != null) zeile[f.feld] = alt[f.feld];
    const eintrag = {
      saetze: Array.from({ length: begrenzt(alt?.saetze) }, () => ({ ...zeile })),
    };
    if (alt?.notiz) eintrag.notiz = alt.notiz;
    raus[schluessel] = eintrag;
  }
  return raus;
}

/**
 * Beide Tage hatten früher drei nummerierte Nebenslots — auf Tag A Jump 1 bis
 * Jump 3, auf Tag B Core 1 bis Core 3, je einer pro Block. Geblieben ist davon
 * einer, an den beiden anderen Stellen stehen jetzt andere Kategorien:
 *
 *   Tag A   Jump 1–3  →  Jump          (Core und Exit kommen neu dazu)
 *   Tag B   Core 1–3  →  Core          (Warm-Up, Jump und Exit kommen neu dazu)
 *
 * Auswahl und Werte hängen am Bereichsnamen, also würden die alten Einträge
 * sonst verwaisen. Alle drei Slots wandern deshalb in den verbliebenen Bereich
 * derselben Kategorie; steht dieselbe Übung mehrfach, gewinnt der zuerst
 * gespeicherte Eintrag. Die neu hinzugekommenen Bereiche fangen leer an — was
 * unter „Core 3" lag, waren Rumpfübungen und gehört nicht in einen Ausklang.
 *
 * Zurückgeschrieben wird nichts: Die nächste Änderung speichert ohnehin den
 * ganzen Datensatz und lässt die alten Schlüssel damit fallen.
 */
const ALTE_BEREICHE = {
  A: { "Jump 1": "Jump", "Jump 2": "Jump", "Jump 3": "Jump" },
  B: { "Core 1": "Core", "Core 2": "Core", "Core 3": "Core" },
};

/** Bereichsnamen in der Auswahl umschreiben und dabei zusammenführen. */
function auswahlAngleichen(roh) {
  const karte = ALTE_BEREICHE[tag.id];
  if (!karte) return roh ?? {};
  const raus = {};
  for (const [name, ids] of Object.entries(roh ?? {})) {
    const ziel = karte[name] ?? name;
    raus[ziel] = [...new Set([...(raus[ziel] ?? []), ...ids])];
  }
  return raus;
}

/** Dasselbe für die Werte, deren Schlüssel `Bereich::uebungId` lautet. */
function bereicheAngleichen(werteRoh) {
  const karte = ALTE_BEREICHE[tag.id];
  if (!karte) return werteRoh;
  const raus = {};
  for (const [schluessel, wert] of Object.entries(werteRoh)) {
    const trenner = schluessel.indexOf("::");
    if (trenner < 0) { raus[schluessel] ??= wert; continue; }
    const name = schluessel.slice(0, trenner);
    const ziel = (karte[name] ?? name) + schluessel.slice(trenner);
    raus[ziel] ??= wert;
  }
  return raus;
}

/**
 * Die Zeilen, die angezeigt werden: das bereits Erfasste — und solange nichts
 * erfasst ist, so viele leere Zeilen, wie die Übung als Vorgabe mitbringt.
 */
function zeilenVon(bereich, u) {
  const vorhanden = saetzeVon(bereich, u.id);
  if (vorhanden.length) return vorhanden;
  return Array.from({ length: begrenzt(u.standard?.saetze ?? 3) }, () => ({}));
}

/** Schreibt den Eintrag zurück — oder räumt ihn weg, wenn nichts übrig bleibt. */
function eintragMerken(bereich, id, eintrag) {
  const schluessel = `${bereich}::${id}`;
  if (eintrag.saetze?.length || eintrag.notiz) werte[schluessel] = eintrag;
  else delete werte[schluessel];
  werteSichern();
}

function satzMerken(bereich, id, nr, feld, roh) {
  const eintrag = { ...werteVon(bereich, id) };
  const liste = (eintrag.saetze ?? []).map(z => ({ ...z }));
  while (liste.length <= nr) liste.push({});

  const zahl = Number(String(roh).replace(",", "."));
  if (String(roh).trim() === "" || !Number.isFinite(zahl) || zahl < 0) delete liste[nr][feld];
  else liste[nr][feld] = zahl;

  eintrag.saetze = liste;
  eintragMerken(bereich, id, eintrag);
}

function notizMerken(bereich, id, roh) {
  const eintrag = { ...werteVon(bereich, id) };
  // Zeilenumbrüche bleiben erhalten, nur außen wird gekürzt.
  const text = String(roh).replace(/\s+$/, "");
  if (text.trim() === "") delete eintrag.notiz;
  else eintrag.notiz = text;
  eintragMerken(bereich, id, eintrag);
}

/**
 * Ein Satz mehr — mit den Zahlen des vorherigen vorbelegt. Von Satz zu Satz
 * ändert sich meist nur eine Zahl, und die tippt sich schneller als drei.
 */
function satzHinzufuegen(bereich, u) {
  const liste = zeilenVon(bereich, u).map(z => ({ ...z }));
  if (liste.length >= MAX_SAETZE) return melden(`Mehr als ${MAX_SAETZE} Sätze gehen nicht.`);
  liste.push({ ...(liste.at(-1) ?? {}) });
  eintragMerken(bereich, u.id, { ...werteVon(bereich, u.id), saetze: liste });
  saetzeNeuZeichnen(bereich, u);
}

/** Die letzte Zeile bleibt stehen — ohne Satz gäbe es nichts zu erfassen. */
function satzEntfernen(bereich, u, nr) {
  const liste = zeilenVon(bereich, u).map(z => ({ ...z }));
  if (liste.length < 2) return;
  liste.splice(nr, 1);
  eintragMerken(bereich, u.id, { ...werteVon(bereich, u.id), saetze: liste });
  saetzeNeuZeichnen(bereich, u);
}

// Beim Tippen nicht bei jedem Zeichen in die Datenbank schreiben.
let speicherUhr = null;
function werteSichern() {
  clearTimeout(speicherUhr);
  speicherUhr = setTimeout(werteJetztSichern, 400);
}
function werteJetztSichern() {
  clearTimeout(speicherUhr);
  return einstellungen.schreiben(WERTE, werte);
}

/** Kurzfassung für die zugeklappte Zeile — leer, solange nichts erfasst ist. */
function werteText(bereich, id) {
  const zeilen = saetzeVon(bereich, id).filter(hatWert);
  if (!zeilen.length) return "";
  const z = n => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });

  // Bleibt eine Zahl über alle Sätze gleich, steht sie einmal da; ändert sie
  // sich, zeigt die Spanne den Verlauf vom ersten zum letzten Satz — "4 × 12–8"
  // sagt mehr als eine Liste und passt auch am Handy in die Zeile.
  const spanne = feld => {
    const zahlen = zeilen.map(x => x[feld]).filter(v => v != null);
    if (!zahlen.length) return null;
    return zahlen.every(v => v === zahlen[0])
      ? z(zahlen[0]) : `${z(zahlen[0])}–${z(zahlen.at(-1))}`;
  };

  const wdh = spanne("wiederholungen");
  const kg = spanne("gewichtKg");
  const dauer = spanne("dauerSek");

  const teile = [wdh ? `${zeilen.length} × ${wdh}`
                     : `${zeilen.length} ${zeilen.length === 1 ? "Satz" : "Sätze"}`];
  if (kg) teile.push(`${kg} kg`);
  if (dauer) teile.push(`${dauer} s`);
  return teile.join(" · ");
}

/**
 * Eine Zeile je Satz. Die Standardvorgaben der Übung stehen als Platzhalter in
 * den Feldern — sichtbar, aber nicht mitgespeichert. Was leer bleibt, bleibt leer.
 */
function saetzeFelder(bereich, u) {
  const zeilen = zeilenVon(bereich, u);
  const s = u.standard ?? {};
  const einzeln = zeilen.length < 2;

  return `
    <div class="saetze" data-saetze role="group" aria-label="Sätze für ${esc(u.name)}">
      <div class="satz-kopf" aria-hidden="true">
        <span></span>
        ${FELDER.map(f => `<span>${f.name}${f.einheit ? ` <i>${f.einheit}</i>` : ""}</span>`).join("")}
        <span></span>
      </div>
      ${zeilen.map((zeile, nr) => `
        <div class="satz" data-satz="${nr}">
          <span class="nr">${nr + 1}</span>
          ${FELDER.map(f => `
            <input type="number" min="0" step="${f.schritt}"
                   inputmode="${f.schritt === "1" ? "numeric" : "decimal"}"
                   aria-label="${f.name}, Satz ${nr + 1}"
                   data-feld="${f.feld}" value="${zeile[f.feld] ?? ""}"
                   placeholder="${s[f.feld] ?? "–"}">`).join("")}
          <button type="button" class="satz-weg" data-aktion="satz-weg"
                  aria-label="Satz ${nr + 1} entfernen" ${einzeln ? "hidden" : ""}>✕</button>
        </div>`).join("")}
      <button type="button" class="satz-mehr" data-aktion="satz-mehr">+ Satz</button>
    </div>`;
}

function notizFeld(bereich, u) {
  return `
    <label class="tagesnotiz">
      <span>Notiz</span>
      <textarea rows="2" data-feld="notiz"
                placeholder="z. B. Sitz 4, links schwächer, nächstes Mal 25 kg"
                >${esc(werteVon(bereich, u.id).notiz ?? "")}</textarea>
    </label>`;
}

/**
 * Zeichnet nur den Satzblock neu — die Details drumherum bleiben stehen, damit
 * ein laufendes Video beim Hinzufügen eines Satzes nicht abreißt.
 */
function saetzeNeuZeichnen(bereich, u) {
  const halter = document.querySelector(
    `[data-details="${CSS.escape(bereich + "::" + u.id)}"] [data-saetze]`);
  if (halter) halter.outerHTML = saetzeFelder(bereich, u);
  kurzfassungZeigen(bereich, u.id);
}

function kurzfassungZeigen(bereich, id) {
  const kurz = document.querySelector(
    `.uebung[data-bereich="${CSS.escape(bereich)}"][data-id="${CSS.escape(id)}"] .erfasst`);
  if (kurz) kurz.textContent = werteText(bereich, id);
}

// ----------------------------------------------------------------- Anzeige

async function laden() {
  const alle = await uebungen.alle();
  nachKategorie = new Map();
  for (const kat of tag.kategorien) {
    nachKategorie.set(kat, alle.filter(u => u.kategorie === kat));
  }
  auswahl = auswahlAngleichen(await einstellungen.lesen(AUSWAHL));
  werte = bereicheAngleichen(werteAngleichen(await einstellungen.lesen(WERTE)));
}

function uebungZeichnen(u, bereich) {
  const gewaehlt = istGewaehlt(bereich, u.id);
  const istOffen = offen === `${bereich}::${u.id}`;
  return `
    <div class="uebung ${gewaehlt ? "gewaehlt" : ""} ${istOffen ? "offen" : ""}"
         data-bereich="${esc(bereich)}" data-id="${esc(u.id)}">
      <div class="zeile">
        <button type="button" class="waehlen" data-aktion="waehlen"
                aria-pressed="${gewaehlt}" aria-label="Für heute auswählen">✓</button>
        <button type="button" class="oeffnen" data-aktion="oeffnen">
          <span class="titel">${esc(u.name)}</span>
          <span class="erfasst">${esc(werteText(bereich, u.id))}</span>
          <span class="pfeil">›</span>
        </button>
      </div>
      <div class="details" data-details="${esc(bereich)}::${esc(u.id)}"></div>
    </div>`;
}

function bereichZeichnen(bereich, blockNr) {
  // Jump- und Core-Bereiche zeigen nur Übungen, die diesem Block zugeordnet sind.
  // Ohne Zuordnung steht eine Übung in allen drei Slots zur Wahl.
  const liste = (nachKategorie.get(bereich.kategorie) ?? [])
    .filter(u => !bereich.slot || !u.block || Number(u.block) === blockNr);
  const anzahl = gewaehltIn(bereich.name).filter(id => liste.some(u => u.id === id)).length;

  return `
    <div class="bereich">
      <h3>
        <span>${esc(bereich.name)}</span>
        ${bereich.vorgabe ? `<span class="vorgabe">(${esc(bereich.vorgabe)})</span>` : ""}
        <span class="zaehler ${anzahl ? "aktiv" : ""}">${anzahl ? `${anzahl} gewählt` : "offen"}</span>
      </h3>
      ${liste.length
        ? liste.map(u => uebungZeichnen(u, bereich.name)).join("")
        : `<p class="bereich-leer">Keine Übung für diesen Bereich —
             <a href="./verwaltung.html?kategorie=${esc(bereich.kategorie)}">anlegen</a></p>`}
    </div>`;
}

function fortschrittZeigen() {
  const gewaehlt = alleGewaehlten().length;
  $("fortschritt").textContent = gewaehlt
    ? `${gewaehlt} ${gewaehlt === 1 ? "Übung" : "Übungen"} gewählt` : "";
}

function zeichnen() {
  fortschrittZeigen();

  $("liste").innerHTML = tag.bloecke.map((block, nr) => `
    <section class="block">
      <h2>${esc(block.name)}</h2>
      ${block.bereiche.map(b => bereichZeichnen(b, nr + 1)).join("")}
    </section>`).join("");
}

// -------------------------------------------------------------- Aufklappen

async function detailsFuellen(bereich, u) {
  const halter = document.querySelector(`[data-details="${CSS.escape(bereich + "::" + u.id)}"]`);
  if (!halter) return;

  const m = u.medienId ? await medien.nachId(u.medienId) : null;

  halter.innerHTML = `
    ${saetzeFelder(bereich, u)}
    ${notizFeld(bereich, u)}
    ${m ? `<div data-video></div>` : `<div class="kein-video">Kein Video hinterlegt</div>`}
    ${u.ausfuehrung?.length ? `<h4>Ausführung</h4><ol>${u.ausfuehrung.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    ${u.hinweise?.length ? `<h4>Hinweise</h4><ul>${u.hinweise.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
    ${u.notizen ? `<div class="notiz">${esc(u.notizen)}</div>` : ""}`;

  if (!m) return;
  const halterVideo = halter.querySelector("[data-video]");
  const grenzen = { loopStartMs: m.loopStartMs ?? 0, loopEndeMs: m.loopEndeMs ?? null };

  if (m.quelle === "youtube") {
    halterVideo.id = "trainingVideo";
    try {
      const spieler = await spielerErzeugen({ halterId: "trainingVideo", videoId: m.videoId, grenzen });
      if (offen !== `${bereich}::${u.id}`) { spieler.zerstoeren(); return; } // inzwischen weitergeklappt
      $("trainingVideo")?.removeAttribute("id");
      aufraeumenVideo = () => spieler.zerstoeren();
    } catch (fehler) {
      halterVideo.outerHTML = `<div class="kein-video">${esc(fehler.message)}</div>`;
    }
  } else {
    halterVideo.outerHTML = `<video muted playsinline></video>`;
    aufraeumenVideo = schleifeAbspielen(halter.querySelector("video"), m.blob ?? m.url, grenzen);
  }
}

function videoAufraeumen() {
  if (aufraeumenVideo) { aufraeumenVideo(); aufraeumenVideo = null; }
}

async function umschalten(bereich, id) {
  videoAufraeumen();
  const schluessel = `${bereich}::${id}`;
  offen = offen === schluessel ? null : schluessel;
  zeichnen();
  if (!offen) return;

  const u = uebungNach(id);
  if (u) await detailsFuellen(bereich, u);
  document.querySelector(`[data-bereich="${CSS.escape(bereich)}"][data-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ------------------------------------------------------------------ Meldung

let meldungsUhr = null;
function melden(text) {
  const el = $("meldung");
  el.textContent = text;
  el.classList.add("an");
  clearTimeout(meldungsUhr);
  meldungsUhr = setTimeout(() => el.classList.remove("an"), 2600);
}

// -------------------------------------------------------------- Verdrahtung

document.documentElement.style.setProperty("--tagfarbe", tag.farbe);
$("titel").textContent = `${tag.name} — ${tag.untertitel}`;
document.title = `${tag.name} · Training`;

$("btnStart").addEventListener("click", trainingStarten);
$("btnStopp").addEventListener("click", trainingBeenden);
$("btnVerwerfen").addEventListener("click", trainingVerwerfen);

$("liste").addEventListener("click", ev => {
  const kachel = ev.target.closest(".uebung");
  if (!kachel) return;
  const { bereich, id } = kachel.dataset;
  const aktion = ev.target.closest("[data-aktion]")?.dataset.aktion;

  // Die Satzknöpfe stecken in den Details und müssen vor der Sperre darunter
  // drankommen — sonst würde ein Klick dort nur zuklappen.
  if (aktion === "satz-mehr" || aktion === "satz-weg") {
    const u = uebungNach(id);
    if (!u) return;
    if (aktion === "satz-mehr") satzHinzufuegen(bereich, u);
    else satzEntfernen(bereich, u, Number(ev.target.closest("[data-satz]")?.dataset.satz));
    return;
  }

  // Ein Klick ins Eingabefeld oder aufs Video soll nicht zuklappen.
  if (ev.target.closest(".details")) return;
  if (aktion === "waehlen") auswahlUmschalten(bereich, id);
  else umschalten(bereich, id);
});

$("liste").addEventListener("input", ev => {
  const feld = ev.target.closest("[data-feld]");
  const kachel = feld?.closest(".uebung");
  if (!kachel) return;
  const { bereich, id } = kachel.dataset;
  const zeile = feld.closest("[data-satz]");
  if (zeile) satzMerken(bereich, id, Number(zeile.dataset.satz), feld.dataset.feld, feld.value);
  else notizMerken(bereich, id, feld.value);
  kurzfassungZeigen(bereich, id);
});

// Kehrt die App aus dem Hintergrund zurück, muss die Uhr sofort stimmen.
// Geht sie in den Hintergrund, müssen getippte Werte sofort gesichert sein —
// womöglich kommt die Seite nie wieder.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) werteJetztSichern();
  else uhrZeichnen();
});

serviceWorkerAnmelden();

(async () => {
  const gespeichert = await einstellungen.lesen(SITZUNG);
  if (gespeichert?.tag === tag.id) sitzung = gespeichert;

  await laden();
  zeichnen();
  uhrStarten();
  if (!sitzung) await letzteEinheitZeigen();
})().catch(fehler => {
  $("liste").innerHTML = `<div class="leer"><p>${esc(fehler.message)}</p></div>`;
});
