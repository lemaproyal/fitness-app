/**
 * Verlauf: alle absolvierten Trainingseinheiten.
 *
 * Beim Stopp legt die Trainingsansicht eine Einheit im Protokoll ab — hier wird
 * sie sichtbar. Ohne diese Seite lägen die Daten zwar in der Datenbank, man
 * käme aber nur über eine Sicherung an sie heran.
 *
 * Zwei Wege hinaus: CSV zum Auswerten in der Tabellenkalkulation und die
 * vollständige JSON-Sicherung, die sich auch wieder einlesen lässt.
 */

import { protokoll, uebungen, exportieren, protokollCsv } from "./db.js";
import { tagNach } from "./stammdaten.js";
import { serviceWorkerAnmelden } from "./pwa.js";
import { dateiSpeichern } from "./datei.js";

const $ = id => document.getElementById(id);
const ZEICHEN = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = t => String(t ?? "").replace(/[&<>"']/g, z => ZEICHEN[z]);

const TAGFARBE = { A: "var(--tagA)", B: "var(--tagB)" };

let einheiten = [];      // Protokolleinträge, neueste zuerst
let namen = new Map();   // uebungId → Anzeigename
let filter = "alle";     // "alle" | "A" | "B"
let offen = null;        // id der aufgeklappten Einheit

// ------------------------------------------------------------------ Formate

const zahl = n => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });

const dauerKurz = sek => {
  if (sek == null) return "";
  const min = Math.round(sek / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};

function datumText(eintrag) {
  const d = new Date(eintrag.erstelltAm ?? eintrag.datum);
  if (Number.isNaN(d.getTime())) return eintrag.datum ?? "";
  return d.toLocaleDateString("de-DE",
    { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * Die Sätze einer Einheit nach Übung gruppiert, in der Reihenfolge, in der sie
 * protokolliert wurden — das ist die Reihenfolge der Blöcke im Training.
 */
function nachUebung(eintrag) {
  const gruppen = new Map();
  for (const satz of eintrag.saetze ?? []) {
    if (!gruppen.has(satz.uebungId)) gruppen.set(satz.uebungId, []);
    gruppen.get(satz.uebungId).push(satz);
  }
  return [...gruppen];
}

// ------------------------------------------------------------------ Anzeige

function zusammenfassungZeigen() {
  const anzahl = einheiten.length;
  if (!anzahl) return ($("zusammenfassung").textContent = "");

  // Der letzte Monat sagt mehr über die aktuelle Regelmäßigkeit als die
  // Gesamtzahl — die wächst ohnehin nur.
  const grenze = new Date(Date.now() - 30 * 864e5).toISOString();
  const letzte30 = einheiten.filter(e => (e.erstelltAm ?? "") >= grenze).length;
  $("zusammenfassung").textContent =
    `${anzahl} ${anzahl === 1 ? "Training" : "Trainings"} · ${letzte30} in 30 Tagen`;
}

function filterZeichnen() {
  const knoepfe = [
    { id: "alle", name: "Alle" },
    { id: "A", name: tagNach("A")?.name ?? "Tag A" },
    { id: "B", name: tagNach("B")?.name ?? "Tag B" },
  ];
  $("filter").innerHTML = knoepfe.map(k => `
    <button type="button" data-filter="${k.id}" aria-pressed="${filter === k.id}">
      ${esc(k.name)}
    </button>`).join("");
}

function einheitZeichnen(e) {
  const gruppen = nachUebung(e);
  const anzahlSaetze = (e.saetze ?? []).length;
  const tag = tagNach(e.tag);

  return `
    <div class="einheit ${offen === e.id ? "offen" : ""}"
         data-id="${esc(e.id)}" style="--tagfarbe:${TAGFARBE[e.tag] ?? "var(--line)"}">
      <button type="button" class="kopf">
        <span class="datum">${esc(datumText(e))}</span>
        <span class="tag">${esc(tag?.name ?? e.tag ?? "")}</span>
        <span class="zahlen">
          ${esc(dauerKurz(e.dauerSek))}${e.dauerSek != null ? " · " : ""}${gruppen.length} Üb. · ${anzahlSaetze} Sätze
        </span>
        <span class="pfeil">›</span>
      </button>
      <div class="inhalt">
        ${gruppen.map(([uebungId, saetze]) => `
          <div class="uebung-block">
            <h3>${esc(namen.get(uebungId) ?? uebungId ?? "Unbekannte Übung")}</h3>
            <table>
              <thead>
                <tr><th>Satz</th><th>WDH</th><th>Gewicht kg</th><th>Dauer s</th></tr>
              </thead>
              <tbody>
                ${saetze.map((s, i) => `
                  <tr>
                    <td>${s.satzNr ?? i + 1}</td>
                    <td>${s.wiederholungen == null ? "–" : zahl(s.wiederholungen)}</td>
                    <td>${s.gewichtKg == null ? "–" : zahl(s.gewichtKg)}</td>
                    <td>${s.dauerSek == null ? "–" : zahl(s.dauerSek)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>`).join("")}
        ${e.notiz ? `<div class="einheit-notiz">${esc(e.notiz)}</div>` : ""}
        <div class="fuss">
          <button type="button" class="weg" data-aktion="loeschen">Eintrag löschen</button>
        </div>
      </div>
    </div>`;
}

function zeichnen() {
  const sichtbar = einheiten.filter(e => filter === "alle" || e.tag === filter);

  if (!sichtbar.length) {
    $("liste").innerHTML = einheiten.length
      ? `<div class="leer"><p>Für diesen Trainingstag ist noch nichts protokolliert.</p></div>`
      : `<div class="leer"><p>Noch kein Training aufgezeichnet.</p>
           <p>Eine Einheit wandert hierher, sobald du sie im Training mit
              <b>Stopp</b> beendest.</p>
           <p><a href="./">Zur Startseite</a></p></div>`;
    return;
  }

  $("liste").innerHTML = sichtbar.map(einheitZeichnen).join("");
}

// ------------------------------------------------------------------- Export

const heute = () => new Date().toISOString().slice(0, 10);

async function csvExport() {
  if (!einheiten.length) return melden("Noch nichts zu exportieren.");
  dateiSpeichern(`fitness-trainings-${heute()}.csv`, await protokollCsv(),
                 "text/csv;charset=utf-8");
  melden("CSV heruntergeladen.");
}

async function jsonExport() {
  const daten = await exportieren();
  dateiSpeichern(`fitness-sicherung-${heute()}.json`, JSON.stringify(daten, null, 2),
                 "application/json");
  melden("Sicherung heruntergeladen.");
}

// ------------------------------------------------------------------ Löschen

async function einheitLoeschen(id) {
  const e = einheiten.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`Training vom ${datumText(e)} löschen? Das lässt sich nicht rückgängig machen.`)) return;
  await protokoll.loeschen(id);
  if (offen === id) offen = null;
  await laden();
  zeichnen();
  zusammenfassungZeigen();
  melden("Eintrag gelöscht.");
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

async function laden() {
  const [alle, katalog] = await Promise.all([protokoll.alle(), uebungen.alle()]);
  namen = new Map(katalog.map(u => [u.id, u.name]));
  einheiten = alle.sort((a, b) =>
    (b.erstelltAm ?? b.datum ?? "").localeCompare(a.erstelltAm ?? a.datum ?? ""));
}

$("filter").addEventListener("click", ev => {
  const knopf = ev.target.closest("[data-filter]");
  if (!knopf) return;
  filter = knopf.dataset.filter;
  filterZeichnen();
  zeichnen();
});

$("liste").addEventListener("click", ev => {
  const karte = ev.target.closest(".einheit");
  if (!karte) return;
  if (ev.target.closest("[data-aktion='loeschen']")) return einheitLoeschen(karte.dataset.id);
  offen = offen === karte.dataset.id ? null : karte.dataset.id;
  zeichnen();
});

$("btnCsv").addEventListener("click", csvExport);
$("btnJson").addEventListener("click", jsonExport);

serviceWorkerAnmelden();

(async () => {
  await laden();
  filterZeichnen();
  zeichnen();
  zusammenfassungZeigen();
})().catch(fehler => {
  $("liste").innerHTML = `<div class="leer"><p>${esc(fehler.message)}</p></div>`;
});
