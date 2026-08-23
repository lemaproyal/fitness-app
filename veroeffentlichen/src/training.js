/**
 * Trainingsansicht für einen Tag.
 *
 * Aufbau: drei Blöcke, jeder mit zwei Bereichen (Kraft + Sprung bzw. Rumpf).
 * In jedem Bereich stehen alle Übungen der zugehörigen Kategorie; per Klick
 * wählst du aus, welche davon heute drankommen.
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
let auswahl = {};            // { "Jump 1": ["box-jumps"], … }
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

  // Ein Eintrag je Satz — die Form, die protokoll.verlauf() für spätere
  // Auswertungen erwartet. Ohne eingetragene Satzzahl bleibt es bei einem Satz.
  await protokoll.eintragen({
    tag: tag.id,
    dauerSek,
    saetze: gewaehlt.flatMap(g => {
      const w = werteVon(g.bereich, g.uebungId);
      const anzahl = Math.min(Math.max(Math.round(w.saetze ?? 1), 1), 30);
      return Array.from({ length: anzahl }, (_, i) => ({
        uebungId: g.uebungId,
        satzNr: i + 1,
        wiederholungen: w.wiederholungen ?? null,
        gewichtKg: w.gewichtKg ?? null,
        dauerSek: w.dauerSek ?? null,
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
 * Sätze, Wiederholungen, Gewicht, Dauer und eine freie Notiz je Übung.
 * Wird pro Trainingstag
 * gespeichert und beim nächsten Öffnen wieder angezeigt — so sieht man, womit
 * man zuletzt gearbeitet hat. Geschlüsselt wie die Auswahl nach Bereich, denn
 * dieselbe Übung kann in Jump 1 und Jump 3 mit anderen Werten stehen.
 */
const FELDER = [
  { feld: "saetze",         name: "Sätze",   einheit: "",   schritt: "1"   },
  { feld: "wiederholungen", name: "WDH",     einheit: "",   schritt: "1"   },
  { feld: "gewichtKg",      name: "Gewicht", einheit: "kg", schritt: "0.5" },
  { feld: "dauerSek",       name: "Dauer",   einheit: "s",  schritt: "1"   },
];

const werteVon = (bereich, id) => werte[`${bereich}::${id}`] ?? {};
const uebungNach = id => [...nachKategorie.values()].flat().find(u => u.id === id);

function werteMerken(bereich, id, feld, roh) {
  const schluessel = `${bereich}::${id}`;
  const eintrag = { ...werteVon(bereich, id) };

  if (feld === "notiz") {
    // Zeilenumbrüche bleiben erhalten, nur außen wird gekürzt.
    const text = String(roh).replace(/\s+$/, "");
    if (text.trim() === "") delete eintrag.notiz;
    else eintrag.notiz = text;
  } else {
    const zahl = Number(String(roh).replace(",", "."));
    if (String(roh).trim() === "" || !Number.isFinite(zahl) || zahl < 0) delete eintrag[feld];
    else eintrag[feld] = zahl;
  }

  if (Object.keys(eintrag).length) werte[schluessel] = eintrag;
  else delete werte[schluessel];

  werteSichern();
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
  const w = werteVon(bereich, id);
  const z = n => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });
  const teile = [];
  if (w.saetze && w.wiederholungen) teile.push(`${z(w.saetze)} × ${z(w.wiederholungen)}`);
  else if (w.saetze) teile.push(`${z(w.saetze)} ${w.saetze === 1 ? "Satz" : "Sätze"}`);
  else if (w.wiederholungen) teile.push(`${z(w.wiederholungen)} WDH`);
  if (w.gewichtKg) teile.push(`${z(w.gewichtKg)} kg`);
  if (w.dauerSek) teile.push(`${z(w.dauerSek)} s`);
  return teile.join(" · ");
}

/**
 * Die vier Zahlenfelder, darunter das freie Notizfeld. Die Standardvorgaben der
 * Übung stehen als Platzhalter in den Zahlenfeldern — sichtbar, aber nicht
 * mitgespeichert.
 */
function werteFelder(bereich, u) {
  const w = werteVon(bereich, u.id);
  const s = u.standard ?? {};
  return `
    <div class="werte" role="group" aria-label="Werte für ${esc(u.name)}">
      ${FELDER.map(f => `
        <label>
          <span>${f.name}${f.einheit ? ` <i>${f.einheit}</i>` : ""}</span>
          <input type="number" min="0" step="${f.schritt}"
                 inputmode="${f.schritt === "1" ? "numeric" : "decimal"}"
                 data-feld="${f.feld}" value="${w[f.feld] ?? ""}"
                 placeholder="${s[f.feld] ?? "–"}">
        </label>`).join("")}
    </div>
    <label class="tagesnotiz">
      <span>Notiz</span>
      <textarea rows="2" data-feld="notiz"
                placeholder="z. B. Sitz 4, links schwächer, nächstes Mal 25 kg"
                >${esc(w.notiz ?? "")}</textarea>
    </label>`;
}

// ----------------------------------------------------------------- Anzeige

async function laden() {
  const alle = await uebungen.alle();
  nachKategorie = new Map();
  for (const kat of tag.kategorien) {
    nachKategorie.set(kat, alle.filter(u => u.kategorie === kat));
  }
  auswahl = (await einstellungen.lesen(AUSWAHL)) ?? {};
  werte = (await einstellungen.lesen(WERTE)) ?? {};
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
        <span class="zaehler ${anzahl ? "aktiv" : ""}">${anzahl ? `${anzahl} gewählt` : "offen"}</span>
      </h3>
      ${liste.length
        ? liste.map(u => uebungZeichnen(u, bereich.name)).join("")
        : `<p class="bereich-leer">Keine Übung für diesen Bereich —
             <a href="./verwaltung.html?tag=${esc(tag.id)}">anlegen</a></p>`}
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
    ${werteFelder(bereich, u)}
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
  // Ein Klick ins Eingabefeld oder aufs Video soll nicht zuklappen.
  if (ev.target.closest(".details")) return;
  const { bereich, id } = kachel.dataset;
  const aktion = ev.target.closest("[data-aktion]")?.dataset.aktion;
  if (aktion === "waehlen") auswahlUmschalten(bereich, id);
  else umschalten(bereich, id);
});

$("liste").addEventListener("input", ev => {
  const feld = ev.target.closest("[data-feld]");
  const kachel = feld?.closest(".uebung");
  if (!kachel) return;
  const { bereich, id } = kachel.dataset;
  werteMerken(bereich, id, feld.dataset.feld, feld.value);
  const kurz = kachel.querySelector(".erfasst");
  if (kurz) kurz.textContent = werteText(bereich, id);
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
