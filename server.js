/**
 * Winziger Entwicklungsserver ohne Abhängigkeiten.
 *
 * Nötig, weil Chrome IndexedDB und ES-Module auf file:// blockiert — die App
 * muss also über http:// ausgeliefert werden, auch lokal.
 *
 *   node server.js
 *   → http://localhost:5173
 *
 * Mit --host ist der Server zusätzlich im WLAN erreichbar, damit du die App
 * auf dem Handy testen kannst.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PORT = Number(process.env.PORT) || 5173;
const WURZEL = __dirname;
const IM_NETZ = process.argv.includes("--host");

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer((anfrage, antwort) => {
  let pfad = decodeURIComponent(new URL(anfrage.url, "http://localhost").pathname);
  if (pfad.endsWith("/")) pfad += "index.html";

  const datei = path.join(WURZEL, pfad);

  // Verhindert, dass über ../ auf Dateien außerhalb des Projekts zugegriffen wird.
  if (!datei.startsWith(WURZEL)) {
    antwort.writeHead(403).end("Zugriff verweigert");
    return;
  }

  fs.readFile(datei, (fehler, inhalt) => {
    if (fehler) {
      antwort.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      antwort.end("Nicht gefunden: " + pfad);
      return;
    }
    antwort.writeHead(200, {
      "Content-Type": TYPEN[path.extname(datei).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    antwort.end(inhalt);
  });
});

server.listen(PORT, IM_NETZ ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`\n  Fitness-App läuft:\n`);
  console.log(`  →  http://localhost:${PORT}/verwaltung.html`);

  if (IM_NETZ) {
    for (const schnittstellen of Object.values(os.networkInterfaces())) {
      for (const s of schnittstellen ?? []) {
        if (s.family === "IPv4" && !s.internal) {
          console.log(`  →  http://${s.address}:${PORT}/verwaltung.html   (Handy im selben WLAN)`);
        }
      }
    }
  } else {
    console.log(`\n  Für den Zugriff vom Handy: node server.js --host`);
  }
  console.log("");
});
