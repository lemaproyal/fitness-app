/**
 * Führt JavaScript in der WebView der laufenden App aus und gibt das Ergebnis
 * als JSON aus. Nutzt das DevTools-Protokoll, das nur die Debug-APK freigibt.
 *
 *   node cdp.mjs 'return document.title'
 *
 * Voraussetzung: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`
 * (erledigt emulator-test.sh). Braucht Node 22 wegen des eingebauten WebSocket.
 */

const APP_ADRESSE = "https://lemaproyal.github.io/fitness-app/";

const [code] = process.argv.slice(2);

const ziele = await (await fetch("http://localhost:9222/json")).json();
const seite = ziele.find(z => z.type === "page" && z.url.startsWith(APP_ADRESSE));
if (!seite) {
  console.error("Keine Seite der App gefunden. Offen:", ziele.map(z => z.url).join(", "));
  process.exit(1);
}

const ws = new WebSocket(seite.webSocketDebuggerUrl);
await new Promise((fertig, fehler) => { ws.onopen = fertig; ws.onerror = fehler; });

ws.send(JSON.stringify({
  id: 1,
  method: "Runtime.evaluate",
  params: {
    expression: `(async () => { ${code} })()`,
    awaitPromise: true,
    returnByValue: true,
    // Wie ein echter Tipp: sonst verweigert die WebView Dateiauswahl und Dialoge.
    userGesture: true,
  },
}));
const antwort = await new Promise(fertig => {
  ws.onmessage = ereignis => {
    const nachricht = JSON.parse(ereignis.data);
    if (nachricht.id === 1) fertig(nachricht);
  };
});
ws.close();

const ausnahme = antwort.result?.exceptionDetails;
if (antwort.error || ausnahme) {
  console.error(JSON.stringify(antwort.error ?? ausnahme.exception?.description ?? ausnahme));
  process.exit(1);
}
console.log(JSON.stringify(antwort.result.result.value ?? null));
