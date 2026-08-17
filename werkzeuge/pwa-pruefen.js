/**
 * Prüft, ob die App vollständig installierbar ist:
 * Manifest gültig, Symbole vorhanden, und jede vom Service Worker
 * vorgemerkte Datei existiert auch wirklich.
 *
 *   node werkzeuge/pwa-pruefen.js
 */

const fs = require("node:fs");
const path = require("node:path");

const WURZEL = path.join(__dirname, "..");
const lies = p => fs.readFileSync(path.join(WURZEL, p), "utf8");

let fehler = 0;
const melde = (ok, text) => {
  console.log(`  ${ok ? "OK    " : "FEHLER"}  ${text}`);
  if (!ok) fehler++;
};

// ------------------------------------------------------------------ Manifest

const manifest = JSON.parse(lies("manifest.webmanifest"));
melde(!!manifest.name && !!manifest.short_name, `Name: ${manifest.name}`);
melde(manifest.display === "standalone", `Anzeigemodus: ${manifest.display}`);
melde(!!manifest.start_url?.startsWith("."), `start_url relativ: ${manifest.start_url}`);
melde(!!manifest.scope?.startsWith("."), `scope relativ: ${manifest.scope}`);

const groessen = manifest.icons.map(i => i.sizes);
melde(groessen.includes("192x192") && groessen.includes("512x512"),
  `Symbolgrößen: ${groessen.join(", ")}`);
melde(manifest.icons.some(i => i.purpose === "maskable"), "maskierbares Symbol vorhanden");

for (const symbol of manifest.icons) {
  const datei = path.join(WURZEL, symbol.src);
  const da = fs.existsSync(datei);
  // PNG-Signatur prüfen, damit keine kaputte Datei durchrutscht.
  const gueltig = da && fs.readFileSync(datei).subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  melde(gueltig, `Symbol ${symbol.src}${da ? "" : " — Datei fehlt"}`);
}

// ------------------------------------------------------------ Service Worker

const sw = lies("sw.js");
const liste = sw.match(/const SCHALE = \[([\s\S]*?)\];/)?.[1] ?? "";
const pfade = [...liste.matchAll(/"([^"]+)"/g)].map(m => m[1]);

melde(pfade.length > 0, `Service Worker merkt ${pfade.length} Dateien vor`);
melde(pfade.every(p => p.startsWith("./")), "alle Pfade relativ (nötig für GitHub Pages)");

for (const p of pfade) {
  if (p === "./") continue; // die Startseite selbst, entspricht index.html
  melde(fs.existsSync(path.join(WURZEL, p)), `vorgemerkt: ${p}`);
}

// Umgekehrt: Wird etwas ausgeliefert, das nicht vorgemerkt ist?
const auslieferung = [
  "index.html", "verwaltung.html", "manifest.webmanifest",
  ...fs.readdirSync(path.join(WURZEL, "src")).map(d => `src/${d}`),
  ...fs.readdirSync(path.join(WURZEL, "icons")).map(d => `icons/${d}`),
];
const vergessen = auslieferung.filter(d => !pfade.includes("./" + d));
melde(vergessen.length === 0,
  vergessen.length ? `nicht vorgemerkt: ${vergessen.join(", ")}` : "keine Datei vergessen");

// Die Seiten müssen Manifest und Symbol verlinken.
for (const seite of ["index.html", "verwaltung.html", "training.html"]) {
  const html = lies(seite);
  melde(html.includes('rel="manifest"'), `${seite} verlinkt das Manifest`);
  melde(/name="theme-color"/.test(html), `${seite} setzt theme-color`);
}

console.log(fehler === 0
  ? "\n  Alles vollständig — die App ist installierbar.\n"
  : `\n  ${fehler} Punkt(e) offen.\n`);

process.exit(fehler === 0 ? 0 : 1);
