/**
 * Vergleicht die veröffentlichte Fassung mit der auf der Festplatte.
 *
 *   node werkzeuge/online-pruefen.js
 *
 * Beantwortet die Frage, die man sich nach jedem Hochladen stellt:
 * Ist meine Änderung schon online, oder baut GitHub noch?
 */

const fs = require("node:fs");
const path = require("node:path");

const ADRESSE = "https://lemaproyal.github.io/fitness-app/";
const WURZEL = path.join(__dirname, "..");

const versionAus = text => text.match(/const VERSION = "([^"]+)"/)?.[1] ?? null;

async function holen(datei) {
  // Zwischenspeicher umgehen, sonst sieht man womöglich den alten Stand.
  const antwort = await fetch(ADRESSE + datei + "?stand=" + Date.now(), { cache: "no-store" });
  if (!antwort.ok) throw new Error(`${datei}: Server meldet ${antwort.status}`);
  return antwort.text();
}

// process.exit() würde die noch offenen Verbindungen von fetch mitreißen und
// Node zum Absturz bringen — deshalb nur den Rückgabewert setzen und
// regulär auslaufen lassen.
(async () => {
  const lokal = versionAus(fs.readFileSync(path.join(WURZEL, "sw.js"), "utf8"));
  console.log(`\n  Adresse:  ${ADRESSE}`);
  console.log(`  Lokal:    ${lokal}`);

  let online;
  try {
    online = versionAus(await holen("sw.js"));
  } catch (fehler) {
    console.log(`  Online:   nicht erreichbar — ${fehler.message}\n`);
    process.exitCode = 2;
    return;
  }
  console.log(`  Online:   ${online}`);

  if (lokal === online) {
    // Zusätzlich stichprobenartig prüfen, ob auch der Code selbst aktuell ist:
    // die Version kann stimmen, während eine Datei noch fehlt.
    const seiten = ["index.html", "training.html", "verwaltung.html", "verlauf.html"];
    const fehlend = [];
    for (const seite of seiten) {
      try { await holen(seite); } catch { fehlend.push(seite); }
    }
    if (fehlend.length) {
      console.log(`\n  ACHTUNG: nicht erreichbar — ${fehlend.join(", ")}\n`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n  Aktuell. Am Handy die App öffnen und "Jetzt aktualisieren" antippen.\n`);
    return;
  }

  console.log(`\n  Noch nicht aktuell. GitHub baut meist ein bis zwei Minuten —`);
  console.log(`  danach diesen Befehl einfach erneut ausführen.\n`);
  process.exitCode = 1;
})();
