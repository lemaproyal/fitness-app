/**
 * Meldet den Service Worker an und kümmert sich um Aktualisierungen.
 *
 * Service Worker laufen nur in einem sicheren Kontext: https oder localhost.
 * Über die WLAN-Adresse des Rechners (http://192.168.…) verweigert der Browser
 * die Anmeldung — dort läuft die App dann eben ohne Offline-Fähigkeit.
 */

export function serviceWorkerAnmelden({ beiUpdate } = {}) {
  if (!("serviceWorker" in navigator)) {
    return Promise.resolve({ moeglich: false, grund: "Browser kennt keine Service Worker." });
  }
  if (!window.isSecureContext) {
    return Promise.resolve({
      moeglich: false,
      grund: "Offline-Betrieb braucht https oder localhost — über die WLAN-Adresse geht er nicht.",
    });
  }

  return navigator.serviceWorker.register("./sw.js", { scope: "./" })
    .then(anmeldung => {
      // Hatte die Seite beim Start schon einen Controller, ist jede weitere
      // Fassung eine Aktualisierung — sonst ist es die Erstinstallation, und
      // dafür gibt es nichts zu melden.
      const warSchonInstalliert = !!navigator.serviceWorker.controller;
      let gemeldet = false;

      function melden() {
        if (gemeldet || !warSchonInstalliert || !beiUpdate) return;
        gemeldet = true;
        beiUpdate(() => {
          // Der wartende Arbeiter soll sofort übernehmen; danach neu laden,
          // damit die Seite den neuen Programmcode bekommt. Das Zeitlimit ist
          // die Rückfallebene, falls niemand mehr wartet.
          navigator.serviceWorker.addEventListener("controllerchange",
            () => location.reload(), { once: true });
          anmeldung.waiting?.postMessage("uebernehmen");
          setTimeout(() => location.reload(), 1500);
        });
      }

      // Drei Wege führen zu einer neuen Fassung, und je nach Gerät greift ein
      // anderer: eine, die beim Öffnen schon bereitsteht; eine, die gerade
      // installiert wird; und eine, die sich bereits selbst übernommen hat.
      if (anmeldung.waiting) melden();

      anmeldung.addEventListener("updatefound", () => {
        const neuer = anmeldung.installing;
        neuer?.addEventListener("statechange", () => {
          if (neuer.state === "installed" || neuer.state === "activated") melden();
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", melden);

      // Der entscheidende Punkt am Handy: Eine installierte App wird aus dem
      // Hintergrund geholt statt neu geladen. Ohne Seitenaufruf fragt der
      // Browser von sich aus nie nach einer neuen Fassung — dann bliebe das
      // Handy beliebig lange auf dem alten Stand. Also selbst nachsehen, beim
      // Start und jedes Mal, wenn die App wieder nach vorn kommt.
      let zuletztGeprueft = 0;
      const nachsehen = () => {
        if (Date.now() - zuletztGeprueft < 30_000) return;
        zuletztGeprueft = Date.now();
        anmeldung.update().catch(() => { /* kein Netz — beim nächsten Mal */ });
      };

      nachsehen();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) nachsehen(); });

      return { moeglich: true, anmeldung };
    })
    .catch(fehler => ({ moeglich: false, grund: fehler.message }));
}

/**
 * Bittet den Browser, die Daten dauerhaft zu behalten. Ohne das darf er bei
 * Speicherdruck alles verwerfen. Die Chance steigt deutlich, sobald die App
 * zum Startbildschirm hinzugefügt wurde.
 */
export async function dauerhaftSpeichern() {
  if (!navigator.storage?.persist) return false;
  return await navigator.storage.persisted() || await navigator.storage.persist();
}

/**
 * Fängt die Einladung des Browsers zum Installieren ab, damit die App sie zu
 * einem passenden Zeitpunkt selbst anbieten kann.
 */
export function installationBeobachten({ beiVerfuegbar, beiInstalliert } = {}) {
  let einladung = null;

  window.addEventListener("beforeinstallprompt", ev => {
    ev.preventDefault();
    einladung = ev;
    beiVerfuegbar?.(async () => {
      einladung.prompt();
      const { outcome } = await einladung.userChoice;
      einladung = null;
      return outcome === "accepted";
    });
  });

  window.addEventListener("appinstalled", () => { einladung = null; beiInstalliert?.(); });

  // display-mode: standalone bedeutet, dass die App vom Startbildschirm läuft.
  return { bereitsInstalliert: matchMedia("(display-mode: standalone)").matches };
}
