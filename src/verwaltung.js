/**
 * Oberfläche zum Füllen der Übungsdatenbank.
 * Reine Anzeige- und Bedienlogik — alles Persistente liegt in db.js.
 */

import { uebungen, medien, speicherInfo, persistentAnfordern, exportieren, importieren, slug } from "./db.js";
import { KATEGORIEN, TAGE, MESSTYPEN, EQUIPMENT, SEED_PLYOMETRIE,
         kategorieNach, tagVonKategorie } from "./stammdaten.js";
import { aufbereiten, aufbereitenLink, schleifeAbspielen,
         linkHerunterladen, groesseFormatieren } from "./video.js";
import { schnittleisteVerbinden } from "./schnitt.js";
import { spielerErzeugen } from "./youtube.js";
import { serviceWorkerAnmelden } from "./pwa.js";
import { dateiAusgeben, inAndroidApp } from "./datei.js";

const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"']/g, z =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));
const zeilen = t => t.split("\n").map(z => z.trim()).filter(Boolean);
const liste = t => t.split(",").map(z => z.trim()).filter(Boolean);

let bearbeiteteId = null;      // null = neue Übung
let neuesVideo = null;         // vorbereitetes Video, das beim Speichern übernommen wird
let videoEntfernen = false;
let aufraeumenVorschau = null; // Aufräumfunktion des Vorschau-Players
let schnittsteuerung = null;   // aktive Schnittleiste
let aktuelleGrenzen = null;    // { loopStartMs, loopEndeMs } der Vorschau
let ytSpieler = null;          // aktiver YouTube-Player
let vorschauLauf = 0;          // zählt Vorschau-Aufbauten, um veraltete zu verwerfen
let offeneUrls = [];           // Blob-URLs der Listenvorschauen

// ------------------------------------------------------------- Startaufbau

function selectFuellen(el, eintraege, leerText = null) {
  el.innerHTML = (leerText ? `<option value="">${esc(leerText)}</option>` : "") +
    eintraege.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("");
}

selectFuellen($("filterTag"), TAGE, "Alle Tage");
selectFuellen($("filterKategorie"), KATEGORIEN, "Alle Kategorien");

// Nur Jump- und Core-Übungen lassen sich einem Block zuordnen; bei den
// Kraftübungen ist der Block schon durch die Kategorie festgelegt.
const MIT_BLOCK = ["plyometrie", "core"];
const blockFeldAktualisieren = () => {
  $("blockFeld").hidden = !MIT_BLOCK.includes($("fKategorie").value);
};

// Von der Startseite kommend ist der Tag schon vorgewählt: verwaltung.html?tag=A
// Aus einem leeren Bereich heraus die Kategorie: verwaltung.html?kategorie=warmup.
// Nach Kategorie und nicht nach Tag, weil Warm-Up, Jump, Core und Exit auf beiden
// Tagen stehen — ein Tagesfilter würde sie auf dem jeweils anderen wegfiltern.
const adresse = new URLSearchParams(location.search);
const tagAusAdresse = adresse.get("tag");
if (TAGE.some(t => t.id === tagAusAdresse)) $("filterTag").value = tagAusAdresse;
const kategorieAusAdresse = adresse.get("kategorie");
if (KATEGORIEN.some(k => k.id === kategorieAusAdresse)) {
  $("filterKategorie").value = kategorieAusAdresse;
}
selectFuellen($("fKategorie"), KATEGORIEN);
selectFuellen($("fMesstyp"), MESSTYPEN);
$("equipmentListe").innerHTML = EQUIPMENT.map(e => `<option value="${esc(e)}">`).join("");

// ------------------------------------------------------------------ Liste

async function listeZeichnen() {
  offeneUrls.forEach(URL.revokeObjectURL);
  offeneUrls = [];

  const suchtext = $("suche").value.trim();
  const kategorie = $("filterKategorie").value;
  const nurOhneVideo = $("filterOhneVideo").checked;

  const tag = $("filterTag").value;

  let gefunden = suchtext ? await uebungen.suchen(suchtext) : await uebungen.alle();
  if (tag) gefunden = gefunden.filter(u => tagVonKategorie(u.kategorie) === tag);
  if (kategorie) gefunden = gefunden.filter(u => u.kategorie === kategorie);
  if (nurOhneVideo) gefunden = gefunden.filter(u => !u.medienId);

  const behaelter = $("liste");

  if (!gefunden.length) {
    const gesamt = await uebungen.anzahl();
    behaelter.innerHTML = gesamt === 0
      ? `<div class="leerzustand">
           <p>Noch keine Übungen angelegt.</p>
           <p>Leg die erste über <b>+ Neue Übung</b> an — oder lade unter <b>⋯</b> die zehn
              plyometrischen Übungen als Starthilfe.</p>
         </div>`
      : `<div class="leerzustand"><p>Keine Übung passt zu diesem Filter.</p></div>`;
    return;
  }

  // Vorschaubild und Herkunft je Übung ermitteln.
  const medienKarte = new Map();
  for (const u of gefunden.filter(u => u.medienId)) {
    const m = await medien.nachId(u.medienId);
    if (!m) continue;
    let bild = m.posterUrl ?? null; // bei YouTube das Vorschaubild von dort
    if (m.poster) {
      bild = URL.createObjectURL(m.poster);
      offeneUrls.push(bild);
    }
    medienKarte.set(u.id, { bild, quelle: m.quelle ?? "datei" });
  }

  const QUELLE_MARKE = { datei: "OFFLINE", url: "LINK", youtube: "YT" };

  behaelter.innerHTML = gefunden.map(u => {
    const kat = kategorieNach(u.kategorie);
    const med = medienKarte.get(u.id);
    return `
      <div class="zeile" data-id="${esc(u.id)}">
        <div class="vorschau">
          ${med?.bild ? `<img src="${esc(med.bild)}" alt="" loading="lazy">` : `<span class="leer">🏋</span>`}
          ${med ? `<span class="quelle-marke">${QUELLE_MARKE[med.quelle] ?? ""}</span>` : ""}
        </div>
        <div class="info">
          <h3>${esc(u.name)}</h3>
          <div class="chips">
            ${kat ? `<span class="chip tag" style="background:${esc(kat.farbe)}">Tag ${esc(kat.tag)}</span>
                     <span class="chip">${esc(kat.name)}</span>` : ""}
            ${u.block ? `<span class="chip">Block ${esc(u.block)}</span>` : ""}
            ${med ? "" : `<span class="chip kein-video">kein Video</span>`}
            ${u.unilateral ? `<span class="chip">einseitig</span>` : ""}
          </div>
          ${u.notizen ? `<div class="notiz-vorschau">${esc(u.notizen)}</div>` : ""}
        </div>
        <div class="aktionen">
          <button type="button" class="leise" data-aktion="bearbeiten">Bearbeiten</button>
        </div>
      </div>`;
  }).join("");
}

async function statusAktualisieren() {
  const info = await speicherInfo();
  $("status").innerHTML =
    `<b>${info.anzahlUebungen}</b> Übungen · <b>${info.anzahlMedien}</b> mit Video · ` +
    `${groesseFormatieren(info.belegtVonMedien)}` +
    (info.dauerhaft || inAndroidApp() ? " · dauerhaft gespeichert" : "");
}

async function neuLaden() {
  await listeZeichnen();
  await statusAktualisieren();
}

// ----------------------------------------------------------------- Dialog

/** Beendet Abspielschleife, YouTube-Player und Schnittleiste der aktuellen Vorschau. */
function vorschauAufraeumen() {
  if (schnittsteuerung) { schnittsteuerung.aufraeumen(); schnittsteuerung = null; }
  if (aufraeumenVorschau) { aufraeumenVorschau(); aufraeumenVorschau = null; }
  if (ytSpieler) { ytSpieler.zerstoeren(); ytSpieler = null; }
}

/**
 * Beschafft das Element, das die Vorschau aufnimmt.
 *
 * Der YouTube-Player entfernt beim Zerstören sein iframe aus dem Dokument.
 * Danach gibt es kein #videoVorschau mehr, und ein gemerkter Verweis zeigt ins
 * Leere — deshalb hier notfalls neu anlegen statt blind darauf zuzugreifen.
 */
function vorschauHalter() {
  const vorhanden = $("videoVorschau");
  if (vorhanden?.parentNode) return vorhanden;

  const neu = document.createElement("div");
  neu.id = "videoVorschau";
  neu.className = "vorschau-leer";
  const feld = document.querySelector(".video-feld");
  feld.insertBefore(neu, feld.firstChild);
  return neu;
}

/** Zeigt das Medium an — je nach Quelle als Videoelement oder als YouTube-Player. */
async function videoVorschauSetzen(medium) {
  const meinLauf = ++vorschauLauf; // spätere Aufrufe machen frühere ungültig
  vorschauAufraeumen();
  const halter = vorschauHalter(); // erst nach dem Aufräumen holen

  if (!medium) {
    halter.outerHTML = `<div id="videoVorschau" class="vorschau-leer">🎬</div>`;
    $("videoInfo").textContent = "Noch kein Video hinterlegt.";
    $("btnVideoWeg").hidden = true;
    $("btnOffline").hidden = true;
    $("loopFelder").hidden = true;
    return;
  }

  const quelle = medium.quelle ?? (medium.blob ? "datei" : "url");
  const teile = [];

  // Ein gemeinsames Objekt für Anfang und Ende: Schnittleiste schreibt hinein,
  // Abspielschleife liest daraus. Deshalb wirkt jedes Ziehen sofort.
  aktuelleGrenzen = {
    loopStartMs: medium.loopStartMs ?? 0,
    loopEndeMs: medium.loopEndeMs ?? null,
  };

  if (quelle === "youtube") {
    // Platzhalter, den die YouTube-Schnittstelle gleich durch ihr iframe ersetzt.
    halter.outerHTML = `<div id="videoVorschau" class="vorschau-leer">▶</div>`;
    teile.push("YouTube", "braucht Internet");
    $("videoInfo").textContent = teile.join(" · ");
    $("btnVideoWeg").hidden = false;
    $("btnOffline").hidden = true;

    // Während der Player entsteht, nichts Halbfertiges zeigen.
    $("loopFelder").hidden = false;
    $("markierbereich").hidden = true;
    $("youtubeFelder").hidden = true;
    $("schnittHinweis").textContent = "YouTube-Player wird geladen …";

    try {
      const spieler = await spielerErzeugen({
        halterId: "videoVorschau", videoId: medium.videoId, grenzen: aktuelleGrenzen,
      });
      if (meinLauf !== vorschauLauf) { spieler.zerstoeren(); return; } // Dialog inzwischen weitergeschaltet
      // YouTube übernimmt die Klasse des ersetzten Platzhalters auf sein iframe.
      $("videoVorschau").className = "";
      ytSpieler = spieler;
      schnittBereitstellen("youtube", spieler);
    } catch (fehler) {
      if (meinLauf !== vorschauLauf) return;
      // Ohne Player bleibt die Eingabe in Sekunden als Rückfallebene.
      schnittBereitstellen("youtube", null);
      $("schnittHinweis").textContent = fehler.message
        + " Solange geht nur die Eingabe in Sekunden.";
    }
    return;
  } else {
    halter.outerHTML = `<video id="videoVorschau" muted playsinline></video>`;
    aufraeumenVorschau = schleifeAbspielen($("videoVorschau"), medium.blob ?? medium.url, aktuelleGrenzen);
    if (quelle === "datei") {
      teile.push(groesseFormatieren(medium.groesseBytes ?? medium.blob?.size), "auf dem Gerät");
    } else {
      let gastgeber = medium.url;
      try { gastgeber = new URL(medium.url).hostname; } catch { /* Anzeige ist unkritisch */ }
      teile.push("Link · " + gastgeber, "braucht Internet");
    }
  }

  if (medium.dauerMs) teile.push((medium.dauerMs / 1000).toFixed(1) + " s");
  if (medium.breite) teile.push(`${medium.breite}×${medium.hoehe}`);

  $("videoInfo").textContent = teile.filter(Boolean).join(" · ");
  $("btnVideoWeg").hidden = false;
  $("btnOffline").hidden = quelle !== "url"; // YouTube lässt sich nicht herunterladen

  schnittBereitstellen(quelle, $("videoVorschau"));
}

/**
 * Baut die Schnittleiste auf. `spieler` ist entweder das <video>-Element oder
 * der YouTube-Player — beide bieten dieselbe Oberfläche. Ist er null, bleibt
 * nur die Eingabe in Sekunden.
 */
function schnittBereitstellen(quelle, spieler) {
  $("loopFelder").hidden = false;
  $("fLoopStart").value = ((aktuelleGrenzen.loopStartMs ?? 0) / 1000).toFixed(1);
  $("fLoopEnde").value = aktuelleGrenzen.loopEndeMs != null
    ? (aktuelleGrenzen.loopEndeMs / 1000).toFixed(1) : "";

  const markierbar = !!spieler;
  $("markierbereich").hidden = !markierbar;
  $("youtubeFelder").hidden = markierbar;
  $("schnittHinweis").textContent = markierbar
    ? "Video läuft — bei Beginn der Bewegung auf Start drücken, am Ende auf Stopp. "
      + "Danach spielt die Vorschau nur noch diese Sequenz. Leertaste hält an."
      + (quelle === "youtube" ? " Bei YouTube auf Zehntelsekunden genau." : "")
    : "Anfang und Ende in Sekunden eintragen.";

  if (!markierbar) return;

  schnittsteuerung = schnittleisteVerbinden({
    video: spieler,
    grenzen: aktuelleGrenzen,
    elemente: {
      leiste: $("schnittLeiste"), auswahl: $("schnittAuswahl"), kopf: $("schnittKopf"),
      griffStart: $("griffStart"), griffEnde: $("griffEnde"),
      feldStart: $("fLoopStart"), feldEnde: $("fLoopEnde"),
      anzeigeDauer: $("wertDauer"), anzeigeAuswahl: $("wertAuswahl"), anzeigeZeit: $("anzeigeZeit"),
      btnAbspielen: $("btnAbspielen"), btnStart: $("btnSequenzStart"),
      btnStopp: $("btnSequenzStopp"), btnNeu: $("btnGanzesVideo"),
    },
  });
}

async function dialogOeffnen(id = null) {
  bearbeiteteId = id;
  neuesVideo = null;
  videoEntfernen = false;

  const u = id ? await uebungen.nachId(id) : null;
  $("dlgTitel").textContent = u ? "Übung bearbeiten" : "Neue Übung";
  $("btnLoeschen").hidden = !u;
  $("details").open = false;

  $("fName").value = u?.name ?? "";
  $("fKategorie").value = u?.kategorie ?? KATEGORIEN[0].id;
  $("fBlock").value = u?.block ?? "";
  blockFeldAktualisieren();
  $("fMesstyp").value = u?.messtyp ?? "gewicht-wdh";
  $("fEquipment").value = (u?.equipment ?? []).join(", ");
  $("fMuskeln").value = (u?.muskelnPrimaer ?? []).join(", ");
  $("fSaetze").value = u?.standard?.saetze ?? 3;
  $("fWdh").value = u?.standard?.wiederholungen ?? 10;
  $("fPause").value = u?.standard?.pauseSek ?? 90;
  $("fAusfuehrung").value = (u?.ausfuehrung ?? []).join("\n");
  $("fHinweise").value = (u?.hinweise ?? []).join("\n");
  $("fFehler").value = (u?.fehler ?? []).join("\n");
  $("fNotizen").value = u?.notizen ?? "";
  $("fUnilateral").checked = !!u?.unilateral;

  $("fLink").value = "";
  const vorhandenesVideo = u?.medienId ? await medien.nachId(u.medienId) : null;

  $("dlg").showModal();
  $("fName").focus();

  // Erst nach dem Öffnen: der YouTube-Player braucht ein sichtbares Element.
  await videoVorschauSetzen(vorhandenesVideo);
}

function dialogSchliessen() {
  vorschauAufraeumen();
  $("dlg").close();
}

async function videoUebernehmen(datei) {
  if (!datei) return;
  melden("Video wird gelesen …");
  try {
    const vorbereitet = await aufbereiten(datei, { uebungId: bearbeiteteId ?? "neu" });
    neuesVideo = { ...vorbereitet, quelle: "datei" };
    videoEntfernen = false;
    $("fLink").value = "";
    await videoVorschauSetzen({ ...neuesVideo, groesseBytes: datei.size });
    melden("Video übernommen — mit Speichern bestätigen.");
  } catch (fehler) {
    melden("Fehler: " + fehler.message);
  }
}

async function linkUebernehmen() {
  const eingabe = $("fLink").value.trim();
  if (!eingabe) return melden("Bitte erst einen Link einfügen.");
  melden("Link wird geprüft …");
  try {
    const vorbereitet = await aufbereitenLink(eingabe, { uebungId: bearbeiteteId ?? "neu" });
    neuesVideo = vorbereitet;
    videoEntfernen = false;
    await videoVorschauSetzen(vorbereitet);
    melden(vorbereitet.quelle === "youtube"
      ? "YouTube-Video übernommen — mit Speichern bestätigen."
      : "Link übernommen — mit Speichern bestätigen.");
  } catch (fehler) {
    melden(fehler.message);
  }
}

/** Holt einen verlinkten Clip in die Datenbank, damit er offline verfügbar ist. */
async function offlineSpeichern() {
  const quelleUrl = neuesVideo?.url ?? (await aktuellesMedium())?.url;
  if (!quelleUrl) return;
  melden("Video wird geladen …");
  try {
    const blob = await linkHerunterladen(quelleUrl);
    const datei = new File([blob], "video", { type: blob.type });
    await videoUebernehmen(datei);
    melden("Jetzt offline verfügbar — mit Speichern bestätigen.");
  } catch (fehler) {
    melden(fehler.message);
  }
}

async function aktuellesMedium() {
  if (!bearbeiteteId) return null;
  const u = await uebungen.nachId(bearbeiteteId);
  return u?.medienId ? medien.nachId(u.medienId) : null;
}

async function speichern(ev) {
  ev.preventDefault();
  const name = $("fName").value.trim();
  if (!name) return;

  const kategorie = $("fKategorie").value;

  // Bei neuen Übungen aus dem Namen eine id bilden und Kollisionen durchnummerieren.
  let id = bearbeiteteId;
  if (!id) {
    const basis = slug(name) || "uebung";
    id = basis;
    let n = 2;
    while (await uebungen.nachId(id)) id = `${basis}-${n++}`;
  }

  const alt = bearbeiteteId ? await uebungen.nachId(bearbeiteteId) : null;

  await uebungen.speichern({
    ...alt,
    id,
    name,
    kategorie,
    tag: tagVonKategorie(kategorie),
    block: $("fBlock").value ? Number($("fBlock").value) : null,
    messtyp: $("fMesstyp").value,
    equipment: liste($("fEquipment").value),
    muskelnPrimaer: liste($("fMuskeln").value),
    ausfuehrung: zeilen($("fAusfuehrung").value),
    hinweise: zeilen($("fHinweise").value),
    fehler: zeilen($("fFehler").value),
    notizen: $("fNotizen").value.trim(),
    unilateral: $("fUnilateral").checked,
    standard: {
      ...alt?.standard,
      saetze: Number($("fSaetze").value) || 3,
      wiederholungen: Number($("fWdh").value) || 0,
      pauseSek: Number($("fPause").value) || 90,
    },
    medienId: videoEntfernen ? null : alt?.medienId ?? null,
  });

  if (videoEntfernen && alt?.medienId) {
    await medien.loeschen(alt.medienId);
  }

  if (neuesVideo) {
    const start = Number($("fLoopStart").value) * 1000 || 0;
    const ende = $("fLoopEnde").value === "" ? null : Number($("fLoopEnde").value) * 1000;
    await medien.speichern({ ...neuesVideo, uebungId: id, loopStartMs: start, loopEndeMs: ende });
  } else if (!videoEntfernen && alt?.medienId) {
    // Nur die Schleifengrenzen wurden geändert.
    const m = await medien.nachId(alt.medienId);
    if (m) {
      const start = Number($("fLoopStart").value) * 1000 || 0;
      const ende = $("fLoopEnde").value === "" ? null : Number($("fLoopEnde").value) * 1000;
      if (m.loopStartMs !== start || m.loopEndeMs !== ende) {
        await medien.speichern({ ...m, uebungId: id, loopStartMs: start, loopEndeMs: ende });
      }
    }
  }

  dialogSchliessen();
  await neuLaden();
  melden(alt ? "Gespeichert." : `„${name}" angelegt.`);
}

// -------------------------------------------------------------- Werkzeuge

async function werkzeugeOeffnen() {
  const info = await speicherInfo();
  const anteil = info.verfuegbar
    ? ` von etwa ${groesseFormatieren(info.verfuegbar)} verfügbar`
    : "";
  $("speicherInfo").textContent =
    `${info.anzahlMedien} Videos belegen ${groesseFormatieren(info.belegtVonMedien)}, ` +
    `insgesamt belegt ${groesseFormatieren(info.belegtGesamt)}${anteil}. ` +
    speicherHinweis(info.dauerhaft);
  // In der Android-App liegen die Daten ohnehin im eigenen Speicher der App; die
  // Browser-Erlaubnis dort ist bedeutungslos, ihr Rat („zum Startbildschirm
  // hinzufügen“) führte zurück in den Speicher von Chrome.
  $("btnPersistent").hidden = inAndroidApp();
  $("persistentHilfe").hidden = inAndroidApp();
  $("btnPersistent").disabled = info.dauerhaft;
  $("dlgMehr").showModal();
}

function speicherHinweis(dauerhaft) {
  if (inAndroidApp()) return "Die Daten liegen im eigenen Speicher der App.";
  return dauerhaft ? "Dauerhafte Speicherung ist aktiv." : "Dauerhafte Speicherung ist nicht aktiv.";
}

async function seedLaden() {
  const vorhanden = new Set((await uebungen.alle()).map(u => u.id));
  const neue = SEED_PLYOMETRIE
    .filter(u => !vorhanden.has(u.id))
    .map(u => ({ ...u, tag: tagVonKategorie(u.kategorie) }));

  if (!neue.length) return melden("Alle zehn sind bereits angelegt.");
  await uebungen.vieleSpeichern(neue);
  $("dlgMehr").close();
  await neuLaden();
  melden(`${neue.length} Übungen hinzugefügt.`);
}

async function exportDatei() {
  const daten = await exportieren();
  melden(await dateiAusgeben("Sicherung",
                             `fitness-sicherung-${new Date().toISOString().slice(0, 10)}.json`,
                             JSON.stringify(daten, null, 2), "application/json"));
}

async function importDatei(datei) {
  if (!datei) return;
  try {
    const ersetzen = $("fImportErsetzen").checked;
    if (ersetzen && !confirm("Alle Übungen, Videos und das Protokoll auf diesem Gerät werden gelöscht und durch die Sicherung ersetzt. Fortfahren?")) return;
    const ergebnis = await importieren(JSON.parse(await datei.text()), { ersetzen });
    $("dlgMehr").close();
    await neuLaden();
    melden(`${ergebnis.uebungen} Übungen, ${ergebnis.videos} Videos importiert.`
      + (ergebnis.einstellungen ? " Auswahl übernommen." : "")
      + (ergebnis.ohneDatei ? ` ${ergebnis.ohneDatei} Videodatei(en) fehlen.` : ""));
  } catch (fehler) {
    melden("Import fehlgeschlagen: " + fehler.message);
  }
}

// -------------------------------------------------------------- Meldungen

let meldungsUhr = null;
function melden(text) {
  const el = $("meldung");
  el.textContent = text;
  el.classList.add("an");
  clearTimeout(meldungsUhr);
  meldungsUhr = setTimeout(() => el.classList.remove("an"), 2600);
}

// -------------------------------------------------------------- Verdrahtung

$("btnNeu").addEventListener("click", () => dialogOeffnen());
$("btnMehr").addEventListener("click", werkzeugeOeffnen);
$("btnMehrZu").addEventListener("click", () => $("dlgMehr").close());
$("btnAbbrechen").addEventListener("click", dialogSchliessen);
$("btnSchliessen").addEventListener("click", dialogSchliessen);
$("formular").addEventListener("submit", speichern);

$("liste").addEventListener("click", ev => {
  const zeile = ev.target.closest(".zeile");
  if (zeile) dialogOeffnen(zeile.dataset.id);
});

$("btnLoeschen").addEventListener("click", async () => {
  const u = await uebungen.nachId(bearbeiteteId);
  if (!confirm(`„${u.name}" mitsamt Video löschen?`)) return;
  await uebungen.loeschen(bearbeiteteId);
  dialogSchliessen();
  await neuLaden();
  melden("Gelöscht.");
});

$("fKategorie").addEventListener("change", blockFeldAktualisieren);
$("btnLink").addEventListener("click", linkUebernehmen);
$("btnOffline").addEventListener("click", offlineSpeichern);
$("fLink").addEventListener("keydown", ev => {
  // Enter im Linkfeld soll den Link übernehmen, nicht das Formular abschicken.
  if (ev.key === "Enter") { ev.preventDefault(); linkUebernehmen(); }
});

$("btnVideoWeg").addEventListener("click", () => {
  neuesVideo = null;
  videoEntfernen = true;
  $("fLink").value = "";
  videoVorschauSetzen(null);
  melden("Video wird beim Speichern entfernt.");
});

$("btnPersistent").addEventListener("click", async () => {
  const { unterstuetzt, dauerhaft } = await persistentAnfordern();
  melden(!unterstuetzt ? "Dieser Browser kennt die Funktion nicht."
        : dauerhaft ? "Dauerhafte Speicherung ist aktiv."
        : "Der Browser hat abgelehnt — meist hilft es, die App zum Startbildschirm hinzuzufügen.");
  await statusAktualisieren();
  $("btnPersistent").disabled = dauerhaft;
});

$("btnSeed").addEventListener("click", seedLaden);
$("btnExport").addEventListener("click", exportDatei);
$("btnImport").addEventListener("click", () => $("fImport").click());
$("fImport").addEventListener("change", e => importDatei(e.target.files[0]));

let suchUhr = null;
$("suche").addEventListener("input", () => {
  clearTimeout(suchUhr);
  suchUhr = setTimeout(listeZeichnen, 180);
});
$("filterTag").addEventListener("change", listeZeichnen);
$("filterKategorie").addEventListener("change", listeZeichnen);
$("filterOhneVideo").addEventListener("change", listeZeichnen);

$("dlg").addEventListener("close", vorschauAufraeumen);

serviceWorkerAnmelden(); // sorgt dafür, dass auch diese Seite offline verfügbar bleibt

neuLaden().catch(fehler => {
  $("status").textContent = "Datenbank nicht verfügbar";
  $("liste").innerHTML = `<div class="leerzustand"><p>${esc(fehler.message)}</p>
    <p>Die App muss über <b>http://localhost</b> laufen, nicht per Doppelklick auf die Datei.
    Starte dazu <code>node server.js</code>.</p></div>`;
});
