/**
 * Dateien an den Nutzer ausgeben (Sicherung, CSV).
 *
 * Im Browser ein gewöhnlicher Download. In der Android-App gibt es den nicht:
 * Die WebView kann Blob-Links nicht herunterladen. Dort stellt die App das
 * Objekt `FitnessAndroid` bereit und schreibt die Datei selbst in den
 * Download-Ordner des Handys.
 */

export function dateiSpeichern(dateiname, inhalt, typ) {
  const android = window.FitnessAndroid;
  if (android) {
    android.postMessage(JSON.stringify({ aktion: "dateiSpeichern", dateiname, inhalt, typ }));
    return;
  }

  const blob = new Blob([inhalt], { type: typ });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
