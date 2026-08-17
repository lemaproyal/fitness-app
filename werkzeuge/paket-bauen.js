/**
 * Stellt im Ordner "veroeffentlichen" genau die Dateien zusammen, die zu
 * GitHub Pages hochgehören — nichts mehr, nichts weniger.
 *
 *   node werkzeuge/paket-bauen.js
 *
 * Der Server, die Startdatei, die Werkzeuge und die Demo bleiben außen vor.
 * Die gehören zur Entwicklung, nicht zur App.
 */

const fs = require("node:fs");
const path = require("node:path");

const WURZEL = path.join(__dirname, "..");
const ZIEL = path.join(WURZEL, "veroeffentlichen");

const EINZELDATEIEN = ["index.html", "verwaltung.html", "manifest.webmanifest", "sw.js", ".nojekyll"];
const ORDNER = [
  { name: "src", endung: ".js" },
  { name: "icons", endung: ".png" },
];

// Alten Stand wegräumen, damit gelöschte Dateien nicht als Leichen zurückbleiben.
// Der Ordner .git bleibt dabei unangetastet — sonst wäre bei jedem Bauen die
// Verbindung zu GitHub weg.
fs.mkdirSync(ZIEL, { recursive: true });
for (const eintrag of fs.readdirSync(ZIEL)) {
  if (eintrag === ".git") continue;
  fs.rmSync(path.join(ZIEL, eintrag), { recursive: true, force: true });
}

let anzahl = 0, bytes = 0;

function kopiere(relativerPfad) {
  const quelle = path.join(WURZEL, relativerPfad);
  const ziel = path.join(ZIEL, relativerPfad);
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.copyFileSync(quelle, ziel);
  const groesse = fs.statSync(ziel).size;
  anzahl++; bytes += groesse;
  console.log(`  ${relativerPfad.padEnd(34)} ${(groesse / 1024).toFixed(1).padStart(6)} KB`);
}

console.log("\n  Paket wird gebaut:\n");

for (const datei of EINZELDATEIEN) {
  if (fs.existsSync(path.join(WURZEL, datei))) kopiere(datei);
  else console.log(`  ${datei.padEnd(34)}  fehlt — übersprungen`);
}

for (const { name, endung } of ORDNER) {
  for (const eintrag of fs.readdirSync(path.join(WURZEL, name))) {
    if (eintrag.endsWith(endung)) kopiere(path.join(name, eintrag));
  }
}

// Version des Service Workers mit ausgeben — der häufigste vergessene Schritt.
const version = fs.readFileSync(path.join(WURZEL, "sw.js"), "utf8")
  .match(/const VERSION = "([^"]+)"/)?.[1] ?? "unbekannt";

console.log(`\n  ${anzahl} Dateien, ${(bytes / 1024).toFixed(0)} KB gesamt`);
console.log(`  Service-Worker-Version: ${version}`);
console.log(`\n  Fertig: ${ZIEL}`);
console.log(`  Beim Hochladen den INHALT dieses Ordners auswählen, nicht den Ordner selbst.\n`);
