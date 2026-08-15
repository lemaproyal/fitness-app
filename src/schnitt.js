/**
 * Sequenz markieren: Video läuft, du drückst Start und Stopp.
 *
 * Geschnitten wird nichts — gespeichert werden nur die beiden Marken. Das
 * Original bleibt unangetastet, nichts wird neu kodiert, und die Markierung
 * lässt sich jederzeit neu setzen.
 *
 * Die Leiste darunter zeigt an, was markiert ist, und erlaubt Nachkorrektur
 * durch Ziehen. Der übliche Weg sind aber die beiden Knöpfe.
 */

const MINDESTLAENGE_SEK = 0.3; // darunter wird die Schleife zum Zucken

const klemmen = (wert, min, max) => Math.min(Math.max(wert, min), max);
const zeigen = sek => (Number.isFinite(sek) ? sek : 0).toFixed(1).replace(".", ",") + " s";

export function schnittleisteVerbinden({ elemente, video, grenzen, beiAenderung = () => {} }) {
  const {
    leiste, auswahl, kopf, griffStart, griffEnde,
    feldStart, feldEnde, anzeigeDauer, anzeigeAuswahl, anzeigeZeit,
    btnAbspielen, btnStart, btnStopp, btnNeu,
  } = elemente;

  // Die Knöpfe leben dauerhaft im Dialog und werden bei jedem Öffnen neu verbunden.
  // Über den AbortController fällt beim Aufräumen jeder Listener dieser Instanz weg —
  // sonst würden alte Instanzen weiterlaufen und in längst verworfene Grenzen schreiben.
  const steuerung = new AbortController();
  const signal = steuerung.signal;

  let dauerSek = 0;
  let abgeraeumt = false;
  // "leer" = nichts markiert, "laeuft" = Start gesetzt, wartet auf Stopp, "fertig" = beides gesetzt
  let phase = grenzen.loopEndeMs != null ? "fertig" : "leer";

  const startSek = () => (grenzen.loopStartMs ?? 0) / 1000;
  const endeSek = () => (grenzen.loopEndeMs != null ? grenzen.loopEndeMs / 1000 : dauerSek);

  // ------------------------------------------------------------- Darstellung

  function zeichnen() {
    if (dauerSek) {
      const a = startSek(), b = endeSek();
      const pa = (a / dauerSek) * 100, pb = (b / dauerSek) * 100;

      auswahl.style.left = pa + "%";
      auswahl.style.width = Math.max(0, pb - pa) + "%";
      griffStart.style.left = pa + "%";
      griffEnde.style.left = pb + "%";
      griffEnde.hidden = phase === "laeuft"; // Ende steht noch nicht fest

      feldStart.value = a.toFixed(1);
      feldEnde.value = phase === "laeuft" ? "" : b.toFixed(1);
      anzeigeDauer.textContent = phase === "laeuft" ? "…" : zeigen(b - a);

      anzeigeAuswahl.textContent =
        phase === "leer" ? "ganzes Video"
        : phase === "laeuft" ? `ab ${zeigen(a)} — Stopp drücken`
        : `${zeigen(a)} bis ${zeigen(b)}`;

      for (const [griff, wert] of [[griffStart, a], [griffEnde, b]]) {
        griff.setAttribute("aria-valuenow", wert.toFixed(1));
        griff.setAttribute("aria-valuemax", dauerSek.toFixed(1));
        griff.setAttribute("aria-valuetext", zeigen(wert));
      }
    }

    btnStart.textContent = phase === "laeuft" ? "Start neu" : "Start";
    btnStopp.disabled = phase !== "laeuft";
    btnNeu.hidden = phase === "leer";
    leiste.classList.toggle("markiert", phase !== "leer");
  }

  function laufendZeichnen() {
    if (!dauerSek || !Number.isFinite(video.currentTime)) return;
    kopf.style.left = (klemmen(video.currentTime, 0, dauerSek) / dauerSek) * 100 + "%";
    anzeigeZeit.textContent = `${zeigen(video.currentTime)} / ${zeigen(dauerSek)}`;
    btnAbspielen.textContent = video.paused ? "▶ Abspielen" : "❚❚ Pause";
  }

  // ---------------------------------------------------------- Marken setzen

  function startSetzen() {
    if (!dauerSek) return;
    // Ende freigeben, damit die Schleife jetzt nicht dazwischenfunkt und das
    // Video bis zum echten Stopp durchläuft.
    grenzen.loopStartMs = klemmen(video.currentTime, 0, dauerSek - MINDESTLAENGE_SEK) * 1000;
    grenzen.loopEndeMs = null;
    phase = "laeuft";
    video.play().catch(() => {});
    zeichnen();
    beiAenderung();
  }

  function stoppSetzen() {
    if (!dauerSek || phase !== "laeuft") return;
    const ende = klemmen(video.currentTime, startSek() + MINDESTLAENGE_SEK, dauerSek);
    grenzen.loopEndeMs = ende * 1000;
    phase = "fertig";
    video.currentTime = startSek(); // ab jetzt läuft die markierte Sequenz in Schleife
    video.play().catch(() => {});
    zeichnen();
    beiAenderung();
  }

  function neuMarkieren() {
    grenzen.loopStartMs = 0;
    grenzen.loopEndeMs = null;
    phase = "leer";
    video.currentTime = 0;
    video.play().catch(() => {});
    zeichnen();
    beiAenderung();
  }

  function abspielenUmschalten() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    laufendZeichnen();
  }

  btnStart.addEventListener("click", startSetzen, { signal });
  btnStopp.addEventListener("click", stoppSetzen, { signal });
  btnNeu.addEventListener("click", neuMarkieren, { signal });
  btnAbspielen.addEventListener("click", abspielenUmschalten, { signal });

  // Leertaste als Abspieltaste, solange kein Textfeld den Fokus hat.
  leiste.closest("dialog")?.addEventListener("keydown", ev => {
    if (ev.key !== " " || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement?.tagName)) return;
    ev.preventDefault();
    abspielenUmschalten();
  }, { signal });

  // ------------------------------------------------- Nachkorrektur per Griff

  function grenzeSetzen(welche, sekunden) {
    if (!dauerSek) return;
    if (welche === "start") {
      grenzen.loopStartMs = klemmen(sekunden, 0, Math.max(0, endeSek() - MINDESTLAENGE_SEK)) * 1000;
    } else {
      grenzen.loopEndeMs = klemmen(sekunden, Math.min(startSek() + MINDESTLAENGE_SEK, dauerSek), dauerSek) * 1000;
    }
    if (phase !== "fertig") phase = "fertig";
    video.currentTime = welche === "start" ? startSek() : Math.max(startSek(), endeSek() - 0.15);
    zeichnen();
    beiAenderung();
  }

  const verhaeltnis = ev => {
    const kasten = leiste.getBoundingClientRect();
    return klemmen((ev.clientX - kasten.left) / kasten.width, 0, 1);
  };

  function griffVerdrahten(griff, welche) {
    griff.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      griff.setPointerCapture(ev.pointerId);
      griff.classList.add("aktiv");

      const bewegen = e => grenzeSetzen(welche, verhaeltnis(e) * dauerSek);
      const loslassen = () => {
        griff.classList.remove("aktiv");
        griff.removeEventListener("pointermove", bewegen);
        griff.removeEventListener("pointerup", loslassen);
        griff.removeEventListener("pointercancel", loslassen);
      };

      griff.addEventListener("pointermove", bewegen);
      griff.addEventListener("pointerup", loslassen);
      griff.addEventListener("pointercancel", loslassen);
    }, { signal });

    griff.addEventListener("keydown", ev => {
      const schritt = ev.shiftKey ? 1 : 0.1;
      const jetzt = welche === "start" ? startSek() : endeSek();
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { grenzeSetzen(welche, jetzt - schritt); ev.preventDefault(); }
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { grenzeSetzen(welche, jetzt + schritt); ev.preventDefault(); }
    }, { signal });
  }

  griffVerdrahten(griffStart, "start");
  griffVerdrahten(griffEnde, "ende");

  // Klick in die Leiste springt an die Stelle — zum Ansteuern eines Zeitpunkts.
  leiste.addEventListener("pointerdown", ev => {
    if (!dauerSek || ev.target.classList.contains("schnitt-griff")) return;
    video.currentTime = verhaeltnis(ev) * dauerSek;
    laufendZeichnen();
  }, { signal });

  // ---------------------------------------------------------------- Laufzeit

  const beiMetadaten = () => {
    dauerSek = Number.isFinite(video.duration) ? video.duration : 0;
    leiste.classList.toggle("bereit", dauerSek > 0);
    zeichnen();
    laufendZeichnen();
  };
  video.addEventListener("loadedmetadata", beiMetadaten, { signal });
  if (video.readyState >= 1) beiMetadaten();

  // Läuft das Video während des Markierens bis ans Ende, wird dort gestoppt —
  // sonst springt die Schleife zurück und der Stopp-Knopf trifft ins Leere.
  const beiEnde = () => { if (phase === "laeuft") { video.pause(); stoppSetzen(); } };
  video.addEventListener("ended", beiEnde, { signal });

  let laeuft = true;
  const anzeigeSchleife = () => {
    if (!laeuft || abgeraeumt) return;
    laufendZeichnen();
    if (phase === "laeuft" && dauerSek && video.currentTime >= dauerSek - 0.05) beiEnde();
    requestAnimationFrame(anzeigeSchleife);
  };
  requestAnimationFrame(anzeigeSchleife);

  zeichnen();

  return {
    zuruecksetzen: neuMarkieren,
    aufraeumen() {
      abgeraeumt = true;
      laeuft = false;
      steuerung.abort(); // entfernt sämtliche Listener dieser Instanz auf einen Schlag
    },
  };
}
