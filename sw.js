/**
 * Service Worker — macht die App offline lauffähig.
 *
 * Ohne diese Datei wäre die App auf eine Internetverbindung angewiesen; mit ihr
 * liegt der gesamte Programmcode auf dem Handy. Genau das ist der Unterschied
 * zwischen einem Lesezeichen und einer installierten App.
 *
 * Die Trainingsdaten selbst liegen ohnehin lokal in IndexedDB und werden hier
 * nicht angefasst.
 *
 * WICHTIG: Bei jeder Änderung an den Dateien unten die VERSION hochzählen.
 * Sonst behalten bereits installierte Geräte den alten Stand.
 */

const VERSION = "v15";
const CACHE = `fitness-${VERSION}`;

// Alles, was die App zum Starten braucht. Relative Pfade, damit es auch in einem
// Unterordner funktioniert — GitHub Pages liefert unter /benutzername/projekt/ aus.
const SCHALE = [
  "./",
  "./index.html",
  "./verwaltung.html",
  "./training.html",
  "./verlauf.html",
  "./manifest.webmanifest",
  "./src/db.js",
  "./src/stammdaten.js",
  "./src/video.js",
  "./src/schnitt.js",
  "./src/youtube.js",
  "./src/verwaltung.js",
  "./src/training.js",
  "./src/verlauf.js",
  "./src/start.js",
  "./src/pwa.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskierbar-512.png",
];

self.addEventListener("install", ev => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Einzeln statt addAll: Eine fehlende Datei soll nicht die ganze
    // Installation scheitern lassen.
    await Promise.all(SCHALE.map(pfad =>
      cache.add(new Request(pfad, { cache: "reload" }))
        .catch(fehler => console.warn("[sw] nicht zwischengespeichert:", pfad, fehler.message))
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", ev => {
  ev.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("fitness-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", ev => {
  const anfrage = ev.request;
  if (anfrage.method !== "GET") return;

  const adresse = new URL(anfrage.url);

  // Fremde Adressen (YouTube) nie zwischenspeichern — sie brauchen ohnehin Netz
  // und würden den Speicher unnötig füllen.
  if (adresse.origin !== self.location.origin) return;

  // Seitenaufrufe: erst das Netz fragen, damit Aktualisierungen sofort ankommen,
  // und nur bei fehlender Verbindung auf die Kopie zurückfallen.
  if (anfrage.mode === "navigate") {
    ev.respondWith((async () => {
      try {
        const antwort = await fetch(anfrage);
        const cache = await caches.open(CACHE);
        cache.put(anfrage, antwort.clone());
        return antwort;
      } catch {
        return (await caches.match(anfrage))
          ?? (await caches.match("./index.html"))
          ?? new Response("Offline und nicht zwischengespeichert.", {
               status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // Alles andere: sofort aus dem Zwischenspeicher liefern und im Hintergrund
  // erneuern. Startet schnell, bleibt trotzdem aktuell.
  ev.respondWith((async () => {
    const zwischenspeicher = await caches.match(anfrage);
    const ausDemNetz = fetch(anfrage).then(async antwort => {
      if (antwort.ok) (await caches.open(CACHE)).put(anfrage, antwort.clone());
      return antwort;
    }).catch(() => null);

    return zwischenspeicher ?? await ausDemNetz
      ?? new Response("", { status: 504 });
  })());
});

// Erlaubt der Seite, ein bereitstehendes Update sofort zu übernehmen.
self.addEventListener("message", ev => {
  if (ev.data === "uebernehmen") self.skipWaiting();
});
