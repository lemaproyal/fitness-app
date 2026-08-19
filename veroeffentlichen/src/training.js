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

let sitzung = null;          // { tag, startMs }
let auswahl = {};            // { "Jump 1": ["box-jumps"], … }
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

  await protokoll.eintragen({
    tag: tag.id,
    dauerSek,
    saetze: gewaehlt.map(g => ({ uebungId: g.uebungId })),
    notiz: `${gewaehlt.length} ${gewaehlt.length === 1 ? "Übung" : "Übungen"}`,
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
  zeichnen();
}

// ----------------------------------------------------------------- Anzeige

async function laden() {
  const alle = await uebungen.alle();
  nachKategorie = new Map();
  for (const kat of tag.kategorien) {
    nachKategorie.set(kat, alle.filter(u => u.kategorie === kat));
  }
  auswahl = (await einstellungen.lesen(AUSWAHL)) ?? {};
}

function vorgabeText(u) {
  const s = u.standard ?? {};
  if (u.messtyp === "zeit" && s.dauerSek) return `${s.saetze} × ${s.dauerSek} s`;
  if (s.saetze && s.wiederholungen) return `${s.saetze} × ${s.wiederholungen}`;
  return s.saetze ? `${s.saetze} Sätze` : "";
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
          <span class="vorgabe">${esc(vorgabeText(u))}</span>
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

function zeichnen() {
  const gewaehlt = alleGewaehlten().length;
  $("fortschritt").textContent = gewaehlt
    ? `${gewaehlt} ${gewaehlt === 1 ? "Übung" : "Übungen"} gewählt` : "";

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

  const u = [...nachKategorie.values()].flat().find(x => x.id === id);
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
  if (aktion === "waehlen") auswahlUmschalten(bereich, id);
  else umschalten(bereich, id);
});

// Kehrt die App aus dem Hintergrund zurück, muss die Uhr sofort stimmen.
document.addEventListener("visibilitychange", () => { if (!document.hidden) uhrZeichnen(); });

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
