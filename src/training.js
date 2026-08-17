/**
 * Trainingsansicht für einen Tag.
 *
 * Zeigt die Übungen des Tages in der festgelegten Reihenfolge, spielt auf
 * Antippen die markierte Videosequenz ab und stoppt die Trainingsdauer.
 *
 * Die laufende Einheit liegt in der Datenbank, nicht nur im Arbeitsspeicher:
 * Am Handy wandert die App beim Sperren des Bildschirms in den Hintergrund und
 * wird womöglich beendet. Die Uhr rechnet deshalb aus dem gespeicherten
 * Startzeitpunkt, statt Sekunden mitzuzählen.
 */

import { uebungen, medien, protokoll, einstellungen } from "./db.js";
import { KATEGORIEN, TAGE, tagNach, kategorieNach } from "./stammdaten.js";
import { schleifeAbspielen } from "./video.js";
import { spielerErzeugen } from "./youtube.js";
import { serviceWorkerAnmelden } from "./pwa.js";

const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"']/g, z =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

const SCHLUESSEL = "laufendesTraining";

const tagId = new URLSearchParams(location.search).get("tag");
const tag = tagNach(tagId) ?? TAGE[0];

let sitzung = null;          // { tag, startMs, erledigt: [] }
let uhrLaeuft = null;        // Intervall der Anzeige
let offeneUebung = null;     // id der aufgeklappten Übung
let aufraeumenVideo = null;  // Aufräumfunktion des laufenden Players

// ------------------------------------------------------------------- Zeiten

function zeitText(sekunden) {
  const s = Math.max(0, Math.floor(sekunden));
  const std = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sek = s % 60;
  const zwei = n => String(n).padStart(2, "0");
  return std ? `${std}:${zwei(min)}:${zwei(sek)}` : `${zwei(min)}:${zwei(sek)}`;
}

const dauerKurz = sekunden => {
  const min = Math.round(sekunden / 60);
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
  const vorhanden = await einstellungen.lesen(SCHLUESSEL);
  if (vorhanden && vorhanden.tag !== tag.id) {
    const anderer = tagNach(vorhanden.tag);
    if (!confirm(`Für ${anderer?.name ?? "einen anderen Tag"} läuft noch ein Training. Verwerfen und hier neu starten?`)) return;
  }
  sitzung = { tag: tag.id, startMs: Date.now(), erledigt: [] };
  await einstellungen.schreiben(SCHLUESSEL, sitzung);
  uhrStarten();
  melden("Training gestartet.");
}

async function trainingBeenden() {
  if (!sitzung) return;
  const dauerSek = Math.round((Date.now() - sitzung.startMs) / 1000);

  await protokoll.eintragen({
    tag: tag.id,
    dauerSek,
    notiz: `${sitzung.erledigt.length} ${sitzung.erledigt.length === 1 ? "Übung" : "Übungen"} abgehakt`,
  });
  await einstellungen.schreiben(SCHLUESSEL, null);

  sitzung = null;
  clearInterval(uhrLaeuft);
  uhrZeichnen();
  $("uhr").firstChild.textContent = zeitText(dauerSek);
  $("uhrText").textContent = "gerade beendet";
  melden(`Training beendet: ${dauerKurz(dauerSek)}`);
  await letzteEinheitenZeigen();
}

async function trainingVerwerfen() {
  if (!sitzung || !confirm("Laufendes Training verwerfen? Die Zeit wird nicht gespeichert.")) return;
  await einstellungen.schreiben(SCHLUESSEL, null);
  sitzung = null;
  clearInterval(uhrLaeuft);
  uhrZeichnen();
  $("uhrText").textContent = "noch nicht gestartet";
  zeichnen();
  melden("Verworfen.");
}

async function letzteEinheitenZeigen() {
  const [letzte] = await protokoll.letzte(1, tag.id);
  if (letzte?.dauerSek && !sitzung) {
    const datum = new Date(letzte.erstelltAm ?? letzte.datum);
    $("uhrText").textContent =
      `zuletzt ${dauerKurz(letzte.dauerSek)} am ${datum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
  }
}

// ---------------------------------------------------------------- Übungen

let nachKategorie = new Map();

async function laden() {
  const alle = await uebungen.alle();
  nachKategorie = new Map();
  for (const kat of tag.kategorien) {
    nachKategorie.set(kat, alle.filter(u => u.kategorie === kat));
  }
}

function zeichnen() {
  const gesamt = [...nachKategorie.values()].flat().length;

  if (!gesamt) {
    $("liste").innerHTML = `
      <div class="leer">
        <p>Für ${esc(tag.name)} sind noch keine Übungen angelegt.</p>
        <p><a href="./verwaltung.html?tag=${esc(tag.id)}">Jetzt anlegen</a></p>
      </div>`;
    $("fortschritt").textContent = "";
    return;
  }

  const erledigt = sitzung?.erledigt ?? [];
  $("fortschritt").textContent = `${erledigt.length} / ${gesamt}`;

  $("liste").innerHTML = tag.kategorien.map(katId => {
    const liste = nachKategorie.get(katId) ?? [];
    if (!liste.length) return "";
    const kat = kategorieNach(katId);

    return `
      <section class="gruppe" style="--gruppenfarbe:${esc(kat.farbe)}">
        <h2>${esc(kat.name)}<span>${liste.length}</span></h2>
        ${liste.map(u => uebungZeichnen(u, erledigt.includes(u.id))).join("")}
      </section>`;
  }).join("");
}

function vorgabeText(u) {
  const s = u.standard ?? {};
  if (u.messtyp === "zeit" && s.dauerSek) return `${s.saetze} × ${s.dauerSek} s`;
  if (s.saetze && s.wiederholungen) return `${s.saetze} × ${s.wiederholungen}`;
  return s.saetze ? `${s.saetze} Sätze` : "";
}

function uebungZeichnen(u, istErledigt) {
  const offen = offeneUebung === u.id;
  return `
    <div class="uebung ${istErledigt ? "erledigt" : ""} ${offen ? "offen" : ""}" data-id="${esc(u.id)}">
      <div class="zeile">
        <button type="button" class="haken" data-aktion="haken"
                aria-label="Als erledigt markieren" aria-pressed="${istErledigt}">✓</button>
        <button type="button" class="zeile" data-aktion="oeffnen"
                style="padding:0; flex:1 1 auto; display:flex; gap:11px; align-items:center;">
          <span class="titel">${esc(u.name)}</span>
          <span class="vorgabe">${esc(vorgabeText(u))}</span>
          <span class="pfeil">›</span>
        </button>
      </div>
      <div class="details" data-details="${esc(u.id)}">${offen ? "" : ""}</div>
    </div>`;
}

/** Baut den Inhalt einer aufgeklappten Übung — inklusive Video. */
async function detailsFuellen(u) {
  const halter = document.querySelector(`[data-details="${CSS.escape(u.id)}"]`);
  if (!halter) return;

  const m = u.medienId ? await medien.nachId(u.medienId) : null;

  halter.innerHTML = `
    ${m ? `<div data-video></div>` : `<div class="kein-video">Kein Video hinterlegt</div>`}
    ${u.ausfuehrung?.length ? `<h3>Ausführung</h3><ol>${u.ausfuehrung.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    ${u.hinweise?.length ? `<h3>Hinweise</h3><ul>${u.hinweise.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
    ${u.notizen ? `<div class="notiz">${esc(u.notizen)}</div>` : ""}
  `;

  if (!m) return;

  const halterVideo = halter.querySelector("[data-video]");
  const grenzen = { loopStartMs: m.loopStartMs ?? 0, loopEndeMs: m.loopEndeMs ?? null };

  if (m.quelle === "youtube") {
    halterVideo.id = "trainingVideo";
    try {
      const spieler = await spielerErzeugen({
        halterId: "trainingVideo", videoId: m.videoId, grenzen,
      });
      if (offeneUebung !== u.id) { spieler.zerstoeren(); return; } // inzwischen weitergeklappt
      $("trainingVideo")?.removeAttribute("id");
      aufraeumenVideo = () => spieler.zerstoeren();
    } catch (fehler) {
      halterVideo.outerHTML = `<div class="kein-video">${esc(fehler.message)}</div>`;
    }
  } else {
    halterVideo.outerHTML = `<video muted playsinline></video>`;
    const video = halter.querySelector("video");
    aufraeumenVideo = schleifeAbspielen(video, m.blob ?? m.url, grenzen);
  }
}

function videoAufraeumen() {
  if (aufraeumenVideo) { aufraeumenVideo(); aufraeumenVideo = null; }
}

async function umschalten(id) {
  videoAufraeumen();
  offeneUebung = offeneUebung === id ? null : id;
  zeichnen();
  if (!offeneUebung) return;

  const u = [...nachKategorie.values()].flat().find(x => x.id === offeneUebung);
  if (u) await detailsFuellen(u);
  document.querySelector(`.uebung[data-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function hakenUmschalten(id) {
  if (!sitzung) return melden("Erst das Training starten.");
  const i = sitzung.erledigt.indexOf(id);
  if (i >= 0) sitzung.erledigt.splice(i, 1); else sitzung.erledigt.push(id);
  await einstellungen.schreiben(SCHLUESSEL, sitzung);
  zeichnen();
  if (offeneUebung) {
    const u = [...nachKategorie.values()].flat().find(x => x.id === offeneUebung);
    if (u) await detailsFuellen(u);
  }
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
  const aktion = ev.target.closest("[data-aktion]")?.dataset.aktion;
  if (aktion === "haken") hakenUmschalten(kachel.dataset.id);
  else umschalten(kachel.dataset.id);
});

// Kehrt die App aus dem Hintergrund zurück, muss die Uhr sofort stimmen.
document.addEventListener("visibilitychange", () => { if (!document.hidden) uhrZeichnen(); });

serviceWorkerAnmelden();

(async () => {
  const gespeichert = await einstellungen.lesen(SCHLUESSEL);
  if (gespeichert?.tag === tag.id) sitzung = gespeichert;

  await laden();
  zeichnen();
  uhrStarten();
  if (!sitzung) await letzteEinheitenZeigen();
})().catch(fehler => {
  $("liste").innerHTML = `<div class="leer"><p>${esc(fehler.message)}</p></div>`;
});
