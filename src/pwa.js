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
      anmeldung.addEventListener("updatefound", () => {
        const neuer = anmeldung.installing;
        if (!neuer) return;
        neuer.addEventListener("statechange", () => {
          // "installed" bei vorhandenem Controller heißt: Es liegt eine neue
          // Fassung bereit, die alte läuft noch.
          if (neuer.state === "installed" && navigator.serviceWorker.controller) {
            beiUpdate?.(() => {
              neuer.postMessage("uebernehmen");
              navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
            });
          }
        });
      });
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
