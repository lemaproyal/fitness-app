/**
 * YouTube-Player als Ersatz für ein <video>-Element.
 *
 * Die schlichte Einbettung per iframe gibt keine Abspielposition heraus — damit
 * wären Start und Stopp nicht umsetzbar. Die IFrame-Player-Schnittstelle von
 * YouTube kann das. Diese Datei kapselt sie hinter derselben Oberfläche, die
 * auch ein Videoelement bietet (duration, currentTime, paused, play, pause,
 * addEventListener), damit die Schnittleiste nicht wissen muss, womit sie
 * gerade arbeitet.
 *
 * Setzt eine Internetverbindung voraus. Schlägt das Laden fehl, meldet
 * spielerErzeugen() einen Fehler und der Aufrufer fällt auf die Sekundeneingabe
 * zurück.
 */

let apiVersprechen = null;

function apiLaden() {
  if (apiVersprechen) return apiVersprechen;

  apiVersprechen = new Promise((erfuellen, ablehnen) => {
    if (window.YT?.Player) return erfuellen(window.YT);

    // YouTube ruft diesen globalen Namen auf, sobald die Schnittstelle bereit ist.
    const vorheriger = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof vorheriger === "function") vorheriger();
      erfuellen(window.YT);
    };

    const skript = document.createElement("script");
    skript.src = "https://www.youtube.com/iframe_api";
    skript.onerror = () => {
      apiVersprechen = null; // beim nächsten Versuch neu laden
      ablehnen(new Error("YouTube-Player nicht erreichbar — keine Internetverbindung?"));
    };
    document.head.appendChild(skript);

    setTimeout(() => {
      if (!window.YT?.Player) {
        apiVersprechen = null;
        ablehnen(new Error("YouTube-Player antwortet nicht."));
      }
    }, 12000);
  });

  return apiVersprechen;
}

/** Zustandscodes der YouTube-Schnittstelle. */
const LAEUFT = 1, BEENDET = 0;

class YoutubeSpieler extends EventTarget {
  #spieler = null;
  #pausiert = true;
  #aktiv = true;
  #grenzen;
  #uhr = null;

  constructor(grenzen) {
    super();
    this.#grenzen = grenzen;
    this.readyState = 0;
  }

  // --- Oberfläche eines Videoelements

  get duration() {
    const d = this.#spieler?.getDuration?.() ?? 0;
    return Number.isFinite(d) ? d : 0;
  }

  get currentTime() {
    return this.#spieler?.getCurrentTime?.() ?? 0;
  }

  set currentTime(sekunden) {
    this.#spieler?.seekTo?.(Math.max(0, sekunden), true);
  }

  get paused() {
    return this.#pausiert;
  }

  play() {
    this.#spieler?.playVideo?.();
    return Promise.resolve();
  }

  pause() {
    this.#spieler?.pauseVideo?.();
  }

  // --- Innenleben

  _spielerSetzen(spieler) {
    this.#spieler = spieler;
  }

  async _starten() {
    this.#spieler.mute(); // Autoplay ist nur stumm erlaubt
    this.#spieler.playVideo();

    // Die Dauer steht direkt nach onReady nicht immer schon fest.
    for (let versuch = 0; versuch < 40 && this.duration === 0; versuch++) {
      await new Promise(w => setTimeout(w, 50));
    }
    this.readyState = 1;
    this.dispatchEvent(new Event("loadedmetadata"));
    this.#schleife();
  }

  _zustandGeaendert(code) {
    this.#pausiert = code !== LAEUFT;
    if (code === BEENDET) this.dispatchEvent(new Event("ended"));
  }

  /**
   * Hält die Wiedergabe innerhalb der markierten Sequenz — liest die Grenzen live.
   *
   * Bewusst ein Timer und kein requestAnimationFrame: Letzteres pausiert, sobald
   * der Tab nicht mehr gezeichnet wird, und die Schleife bliebe dann stehen.
   */
  #schleife() {
    const start = () => (this.#grenzen.loopStartMs ?? 0) / 1000;
    const ende = () => this.#grenzen.loopEndeMs != null
      ? this.#grenzen.loopEndeMs / 1000
      : this.duration || Infinity;

    this.#uhr = setInterval(() => {
      if (!this.#aktiv) return;
      const t = this.currentTime;
      if (t >= ende() - 0.05 || t < start() - 0.3) this.currentTime = start();
    }, 100);
  }

  zerstoeren() {
    this.#aktiv = false;
    clearInterval(this.#uhr);
    this.#uhr = null;
    try { this.#spieler?.destroy?.(); } catch { /* Player war schon weg */ }
    this.#spieler = null;
  }
}

/**
 * Erzeugt einen Player im Element mit der angegebenen id.
 * Das Element wird dabei durch das iframe von YouTube ersetzt; die id bleibt erhalten.
 */
export async function spielerErzeugen({ halterId, videoId, grenzen }) {
  const YT = await apiLaden();
  const spieler = new YoutubeSpieler(grenzen);

  await new Promise((erfuellen, ablehnen) => {
    const zeituhr = setTimeout(() => ablehnen(new Error("YouTube-Video lädt nicht.")), 15000);

    const roh = new YT.Player(halterId, {
      videoId,
      host: "https://www.youtube-nocookie.com",
      playerVars: {
        controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3,
      },
      events: {
        onReady: () => { clearTimeout(zeituhr); erfuellen(); },
        onStateChange: ev => spieler._zustandGeaendert(ev.data),
        onError: () => { clearTimeout(zeituhr); ablehnen(new Error("Video nicht abspielbar — gelöscht oder gesperrt?")); },
      },
    });

    spieler._spielerSetzen(roh);
  });

  await spieler._starten();
  return spieler;
}
