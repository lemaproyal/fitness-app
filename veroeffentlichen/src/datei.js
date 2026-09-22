/**
 * Dateien an den Nutzer ausgeben (Sicherung, CSV).
 *
 * Im Browser ein gewöhnlicher Download. In der Android-App gibt es den nicht:
 * Die WebView verwirft Blob-Downloads kommentarlos. Dort stellt die App das
 * Objekt `FitnessAndroid` bereit, schreibt die Datei selbst in den
 * Download-Ordner des Handys und meldet zurück, ob es geklappt hat.
 */

const ANTWORT_WARTEZEIT_MS = 15000;

/** Läuft die Seite in der Android-App (APK)? */
export function inAndroidApp() {
  return "FitnessAndroid" in window;
}

/**
 * Gibt die Datei aus und liefert die Meldung für den Nutzer, etwa
 * „Sicherung heruntergeladen.“ oder „Sicherung fehlgeschlagen: …“.
 * `was` benennt die Datei in der Meldung („Sicherung“, „CSV“).
 */
export async function dateiAusgeben(was, dateiname, inhalt, typ) {
  try {
    return `${was} ${await dateiSpeichern(dateiname, inhalt, typ)}.`;
  } catch (fehler) {
    return `${was} fehlgeschlagen: ${fehler.message}`;
  }
}

/** Liefert, was mit der Datei geschah; wirft, wenn nichts gespeichert wurde. */
async function dateiSpeichern(dateiname, inhalt, typ) {
  if (inAndroidApp()) {
    const name = await ueberAndroidSpeichern(dateiname, inhalt, typ);
    return `in „Downloads“ gespeichert (${name})`;
  }
  // Eine WebView ohne Brücke (ältere App-Fassung) würde den Download stumm
  // verwerfen – lieber ehrlich scheitern als „heruntergeladen“ melden.
  if (/; wv\)/.test(navigator.userAgent)) {
    throw new Error("diese App-Fassung kann keine Dateien speichern – bitte die APK aktualisieren");
  }

  const blob = new Blob([inhalt], { type: typ });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return "heruntergeladen";
}

// ------------------------------------------------------------ Android-Brücke

let naechsteAuftragsnummer = 1;
const offeneAuftraege = new Map();

function ueberAndroidSpeichern(dateiname, inhalt, typ) {
  const bruecke = window.FitnessAndroid;
  if (!bruecke.onmessage) bruecke.onmessage = antwortVerarbeiten;

  const id = naechsteAuftragsnummer++;
  return new Promise((erfuellen, ablehnen) => {
    const zeitgeber = setTimeout(() => {
      offeneAuftraege.delete(id);
      ablehnen(new Error("die App hat nicht geantwortet"));
    }, ANTWORT_WARTEZEIT_MS);
    offeneAuftraege.set(id, { erfuellen, ablehnen, zeitgeber });
    bruecke.postMessage(JSON.stringify({ aktion: "dateiSpeichern", id, dateiname, inhalt, typ }));
  });
}

function antwortVerarbeiten(ereignis) {
  const antwort = JSON.parse(ereignis.data);
  const auftrag = offeneAuftraege.get(antwort.id);
  if (!auftrag) return;
  offeneAuftraege.delete(antwort.id);
  clearTimeout(auftrag.zeitgeber);
  if (antwort.ok) auftrag.erfuellen(antwort.name);
  else auftrag.ablehnen(new Error(antwort.fehler));
}
