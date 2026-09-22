/**
 * Führt JavaScript in der WebView der laufenden App aus und gibt das Ergebnis
 * als JSON aus. Nutzt das DevTools-Protokoll, das nur die Debug-APK freigibt.
 *
 *   node cdp.mjs 'return document.title'
 *   node cdp.mjs 'return typeof window.FitnessAndroid' https://www.youtube-nocookie.com
 *
 * Das zweite Argument wählt statt der Seite ein eingebettetes iframe dieser Herkunft.
 *
 * Voraussetzung: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`
 * (erledigt emulator-test.sh). Braucht Node 22 wegen des eingebauten WebSocket.
 */

// Muss zu START_URL in android/app/src/main/java/de/lemaproyal/fitness/MainActivity.java passen.
const APP_ADRESSE = "https://lemaproyal.github.io/fitness-app/";
const ZEITLIMIT_MS = 30000;

const [code, iframeHerkunft] = process.argv.slice(2);

setTimeout(() => { console.error("Zeitlimit: keine Antwort der WebView"); process.exit(1); },
           ZEITLIMIT_MS).unref();

const ziele = await (await fetch("http://localhost:9222/json")).json();
const seite = ziele.find(z => z.type === "page" && z.url.startsWith(APP_ADRESSE));
if (!seite) {
  console.error("Keine Seite der App gefunden. Offen:", ziele.map(z => z.url).join(", "));
  process.exit(1);
}

const ws = new WebSocket(seite.webSocketDebuggerUrl);
await new Promise((fertig, fehler) => { ws.onopen = fertig; ws.onerror = fehler; });

let naechsteId = 1;
const offen = new Map();
const kontexte = [];
ws.onmessage = ereignis => {
  const nachricht = JSON.parse(ereignis.data);
  if (nachricht.method === "Runtime.executionContextCreated") kontexte.push(nachricht.params.context);
  offen.get(nachricht.id)?.(nachricht);
};
function senden(method, params = {}) {
  const id = naechsteId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise(fertig => offen.set(id, fertig));
}

let kontextId;
if (iframeHerkunft) {
  // Runtime.enable meldet alle vorhandenen Ausführungskontexte, auch die der iframes.
  await senden("Runtime.enable");
  // Nur der Hauptkontext des iframes – Nebenkontexte (z. B. isolierte Welten) sehen anderes.
  kontextId = kontexte.find(k => k.origin === iframeHerkunft && k.auxData?.isDefault)?.id;
  if (!kontextId) {
    console.error("Kein iframe mit Herkunft", iframeHerkunft, "– vorhanden:",
                  [...new Set(kontexte.map(k => k.origin))].join(", "));
    process.exit(1);
  }
}

// Sonderbefehl für den Test: lässt die Darstellung der Seite abstürzen. Eine Antwort
// kommt dann nicht mehr – die Verbindung reißt ab.
if (code === "@darstellung-abstuerzen") {
  ws.send(JSON.stringify({ id: naechsteId++, method: "Page.crash" }));
  await new Promise(fertig => setTimeout(fertig, 1000));
  console.log(JSON.stringify("abgestürzt"));
  process.exit(0);
}

const antwort = await senden("Runtime.evaluate", {
  expression: `(async () => { ${code} })()`,
  awaitPromise: true,
  returnByValue: true,
  // Wie ein echter Tipp: sonst verweigert die WebView Dateiauswahl und Dialoge.
  userGesture: true,
  ...(kontextId ? { contextId: kontextId } : {}),
});
ws.close();

const ausnahme = antwort.result?.exceptionDetails;
if (antwort.error || ausnahme) {
  console.error(JSON.stringify(antwort.error ?? ausnahme.exception?.description ?? ausnahme));
  process.exit(1);
}
console.log(JSON.stringify(antwort.result.result.value ?? null));
process.exit(0);
