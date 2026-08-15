/** Startseite: Überblick, Installationshinweis, Offline-Zustand. */

import { uebungen, medien, speicherInfo } from "./db.js";
import { KATEGORIEN } from "./stammdaten.js";
import { serviceWorkerAnmelden, dauerhaftSpeichern, installationBeobachten } from "./pwa.js";

const $ = id => document.getElementById(id);

// ------------------------------------------------------------------- Zahlen

async function zahlenZeigen() {
  const alle = await uebungen.alle();
  const mitVideo = alle.filter(u => u.medienId).length;
  const proTag = tag => alle.filter(u => u.kategorie &&
    KATEGORIEN.find(k => k.id === u.kategorie)?.tag === tag).length;

  $("zahlen").innerHTML = [
    { wert: alle.length, text: "Übungen" },
    { wert: proTag("A"), text: "Tag A" },
    { wert: proTag("B"), text: "Tag B" },
    { wert: mitVideo, text: "mit Video" },
  ].map(z => `<div class="zahl"><b>${z.wert}</b><span>${z.text}</span></div>`).join("");
}

// -------------------------------------------------------------- Installation

function hinweisZeigen(id, html) {
  const el = $(id);
  el.innerHTML = html;
  el.hidden = false;
  return el;
}

const { bereitsInstalliert } = installationBeobachten({
  beiVerfuegbar: installieren => {
    const el = hinweisZeigen("installHinweis",
      `<b>Auf dem Startbildschirm ablegen?</b><br>
       Dann startet die App im Vollbild und läuft auch ohne Internet.
       <button type="button">Installieren</button>`);
    el.querySelector("button").addEventListener("click", async () => {
      if (await installieren()) el.hidden = true;
    });
  },
  beiInstalliert: () => { $("installHinweis").hidden = true; dauerhaftSpeichern(); },
});

// Auf iOS und teils auf Android bietet Chrome die Einladung nicht von selbst an.
if (!bereitsInstalliert) {
  setTimeout(() => {
    if ($("installHinweis").hidden && window.isSecureContext) {
      hinweisZeigen("installHinweis",
        `<b>Als App ablegen:</b> im Browsermenü <b>Zum Startbildschirm hinzufügen</b> wählen.
         Danach startet sie im Vollbild und funktioniert ohne Internet.`);
    }
  }, 2500);
}

// -------------------------------------------------------- Service Worker

serviceWorkerAnmelden({
  beiUpdate: uebernehmen => {
    const el = hinweisZeigen("offlineHinweis",
      `<b>Neue Fassung verfügbar.</b><br>
       <button type="button">Jetzt aktualisieren</button>`);
    el.querySelector("button").addEventListener("click", uebernehmen);
  },
}).then(ergebnis => {
  if (!ergebnis.moeglich) {
    hinweisZeigen("offlineHinweis",
      `<b>Offline-Betrieb nicht aktiv.</b><br>${ergebnis.grund}`);
  } else if (bereitsInstalliert) {
    dauerhaftSpeichern();
  }
});

// ---------------------------------------------------------------- Aufbau

zahlenZeigen().catch(fehler => {
  $("zahlen").innerHTML = `<div class="zahl"><b>–</b><span>${fehler.message}</span></div>`;
});

// Speicherwarnung, falls die Videos zu viel Platz belegen.
speicherInfo().then(info => {
  if (info.verfuegbar && info.belegtGesamt / info.verfuegbar > 0.8) {
    hinweisZeigen("offlineHinweis",
      `<b>Speicher wird knapp.</b><br>Die App belegt über 80 % des verfügbaren Platzes.`);
  }
}).catch(() => { /* Schätzung ist optional */ });
