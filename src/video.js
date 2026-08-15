/**
 * Videohilfen: Metadaten auslesen und ein Standbild erzeugen.
 * Läuft komplett im Browser, es verlässt nichts das Gerät.
 */

/** Liest Dauer und Abmessungen, ohne das Video abzuspielen. */
export function metadatenLesen(quelle) {
  return new Promise((erfuellen, ablehnen) => {
    // Bei einem Link direkt darauf zeigen, bei einer Datei eine Blob-URL bauen.
    const istLink = typeof quelle === "string";
    const url = istLink ? quelle : URL.createObjectURL(quelle);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;

    const aufraeumen = () => { if (!istLink) URL.revokeObjectURL(url); };

    video.onloadedmetadata = () => {
      const ergebnis = {
        dauerMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null,
        breite: video.videoWidth || null,
        hoehe: video.videoHeight || null,
      };
      aufraeumen();
      erfuellen(ergebnis);
    };
    video.onerror = () => {
      aufraeumen();
      ablehnen(new Error("Video konnte nicht gelesen werden. Format wird eventuell nicht unterstützt."));
    };
    if (istLink) {
      setTimeout(() => { aufraeumen(); ablehnen(new Error("Der Link antwortet nicht.")); }, 12000);
    }

    video.src = url;
  });
}

// --------------------------------------------------------------- Videolinks

const YOUTUBE_MUSTER = [
  /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:.*&)?v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|shorts|v)\/([\w-]{11})/,
];

/**
 * Erkennt, was für ein Link eingegeben wurde.
 * Liefert die Quelle sowie — bei YouTube — die Video-ID und einen ggf.
 * enthaltenen Startzeitpunkt (?t=90).
 */
export function linkAnalysieren(eingabe) {
  const text = String(eingabe ?? "").trim();
  if (!text) throw new Error("Bitte einen Link eingeben.");

  let adresse;
  try {
    adresse = new URL(text);
  } catch {
    throw new Error("Das ist keine gültige Adresse. Sie muss mit https:// beginnen.");
  }
  if (!/^https?:$/.test(adresse.protocol)) {
    throw new Error("Nur http:// und https:// werden unterstützt.");
  }

  for (const muster of YOUTUBE_MUSTER) {
    const treffer = text.match(muster);
    if (treffer) {
      const startSek = Number(adresse.searchParams.get("t")?.replace("s", "")) || 0;
      return {
        quelle: "youtube",
        url: text,
        videoId: treffer[1],
        loopStartMs: startSek * 1000,
        posterUrl: `https://i.ytimg.com/vi/${treffer[1]}/mqdefault.jpg`,
      };
    }
  }

  if (/(?:vimeo|instagram|tiktok|facebook)\.com/i.test(adresse.hostname)) {
    throw new Error(
      "Von dieser Plattform lässt sich kein Video direkt einbinden. " +
      "Nutze YouTube oder einen direkten Link auf eine .mp4-Datei."
    );
  }

  return { quelle: "url", url: text, videoId: null, loopStartMs: 0, posterUrl: null };
}

/** Baut die Einbettungsadresse für YouTube — ohne Tracking-Cookies, stumm, in Schleife. */
export function youtubeEinbettung(videoId, { loopStartMs = 0, loopEndeMs = null, steuerung = false } = {}) {
  const p = new URLSearchParams({
    autoplay: "1", mute: "1", loop: "1", playlist: videoId,
    controls: steuerung ? "1" : "0",
    modestbranding: "1", rel: "0", playsinline: "1",
  });
  if (loopStartMs) p.set("start", String(Math.floor(loopStartMs / 1000)));
  if (loopEndeMs) p.set("end", String(Math.ceil(loopEndeMs / 1000)));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${p}`;
}

/**
 * Versucht, einen verlinkten Clip herunterzuladen und als Datei abzulegen,
 * damit er offline verfügbar ist. Viele Server verbieten das per CORS —
 * dann bleibt es beim Link.
 */
export async function linkHerunterladen(url) {
  const antwort = await fetch(url, { mode: "cors" }).catch(() => {
    throw new Error("Der Server erlaubt keinen Zugriff aus der App heraus (CORS). Der Link bleibt bestehen.");
  });
  if (!antwort.ok) throw new Error(`Server meldet ${antwort.status}.`);
  const blob = await antwort.blob();
  if (!blob.type.startsWith("video/")) {
    throw new Error(`Das ist kein Video, sondern ${blob.type || "unbekannter Inhalt"}.`);
  }
  return blob;
}

/**
 * Erzeugt ein Standbild als JPEG-Blob. Wird in der Listenansicht angezeigt,
 * damit nicht dutzende Videos gleichzeitig laufen müssen.
 */
export function posterErzeugen(datei, { zeitpunktMs = null, maxBreite = 480, qualitaet = 0.75 } = {}) {
  return new Promise((erfuellen, ablehnen) => {
    const url = URL.createObjectURL(datei);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    let fertig = false;
    const abschliessen = (fn, wert) => {
      if (fertig) return;
      fertig = true;
      URL.revokeObjectURL(url);
      fn(wert);
    };

    video.onloadedmetadata = () => {
      // Standardmäßig aus der Mitte greifen — der Anfang zeigt oft nur die Ausgangsposition.
      const ziel = zeitpunktMs !== null ? zeitpunktMs / 1000 : video.duration / 2;
      video.currentTime = Math.min(Math.max(ziel, 0), Math.max(video.duration - 0.05, 0));
    };

    video.onseeked = () => {
      try {
        const faktor = Math.min(1, maxBreite / (video.videoWidth || maxBreite));
        const leinwand = document.createElement("canvas");
        leinwand.width = Math.round(video.videoWidth * faktor);
        leinwand.height = Math.round(video.videoHeight * faktor);
        leinwand.getContext("2d").drawImage(video, 0, 0, leinwand.width, leinwand.height);
        leinwand.toBlob(
          blob => blob ? abschliessen(erfuellen, blob)
                       : abschliessen(ablehnen, new Error("Standbild konnte nicht erzeugt werden.")),
          "image/jpeg", qualitaet
        );
      } catch (fehler) {
        abschliessen(ablehnen, fehler);
      }
    };

    video.onerror = () => abschliessen(ablehnen, new Error("Video konnte nicht gelesen werden."));
    setTimeout(() => abschliessen(ablehnen, new Error("Zeitüberschreitung beim Erzeugen des Standbilds.")), 15000);

    video.src = url;
  });
}

/** Nimmt eine Videodatei entgegen und liefert alles, was medien.speichern() braucht. */
export async function aufbereiten(datei, { uebungId }) {
  const meta = await metadatenLesen(datei);
  let poster = null;
  try {
    poster = await posterErzeugen(datei);
  } catch {
    // Ohne Standbild ist die App weiterhin benutzbar — kein Grund, den Import abzubrechen.
  }
  return {
    uebungId,
    blob: datei,
    mimeType: datei.type,
    dauerMs: meta.dauerMs,
    breite: meta.breite,
    hoehe: meta.hoehe,
    poster,
    loopStartMs: 0,
    loopEndeMs: meta.dauerMs,
  };
}

/**
 * Hängt ein Video an ein <video>-Element und lässt nur den gewählten Ausschnitt
 * in Schleife laufen. Spart das Neukodieren: aus zehn Sekunden Rohmaterial
 * werden drei Sekunden Anzeige, ohne die Datei anzufassen.
 */
export function schleifeAbspielen(videoElement, quelle, grenzen = {}) {
  const istLink = typeof quelle === "string";
  const url = istLink ? quelle : URL.createObjectURL(quelle);

  // Die Grenzen werden bei jedem Durchlauf neu gelesen, nicht einmalig festgehalten —
  // so wirkt sich das Ziehen an der Schnittleiste sofort aus.
  const start = () => (grenzen.loopStartMs ?? 0) / 1000;
  const ende = () => grenzen.loopEndeMs != null
    ? grenzen.loopEndeMs / 1000
    : (Number.isFinite(videoElement.duration) ? videoElement.duration : Infinity);

  videoElement.src = url;
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.loop = false; // die Schleife steuern wir selbst

  let laeuft = true;

  const pruefen = () => {
    const a = start(), b = ende();
    if (videoElement.currentTime >= b - 0.02 || videoElement.currentTime < a - 0.15) {
      videoElement.currentTime = a;
    }
  };

  // requestVideoFrameCallback prüft bildgenau, steht aber still, sobald der Tab
  // nicht mehr gezeichnet wird. timeupdate läuft unabhängig davon weiter und
  // dient als Auffangnetz — beide zusammen, nicht entweder oder.
  const proFrame = "requestVideoFrameCallback" in videoElement;
  const frameSchleife = () => {
    if (!laeuft) return;
    pruefen();
    videoElement.requestVideoFrameCallback(frameSchleife);
  };

  videoElement.addEventListener("timeupdate", pruefen);

  videoElement.addEventListener("loadedmetadata", () => {
    videoElement.currentTime = start();
    videoElement.play().catch(() => {}); // Autoplay kann blockiert sein — dann bleibt das Standbild stehen
    if (proFrame) videoElement.requestVideoFrameCallback(frameSchleife);
  }, { once: true });

  // Aufräumfunktion: verhindert, dass Blob-URLs sich im Speicher ansammeln.
  return () => {
    laeuft = false;
    videoElement.removeEventListener("timeupdate", pruefen);
    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.load();
    if (!istLink) URL.revokeObjectURL(url);
  };
}

/** Bereitet einen Link so auf, wie ihn medien.speichern() erwartet. */
export async function aufbereitenLink(eingabe, { uebungId }) {
  const erkannt = linkAnalysieren(eingabe);

  // Bei direkten Videolinks lässt sich die Dauer auslesen; bei YouTube nicht.
  let meta = { dauerMs: null, breite: null, hoehe: null };
  if (erkannt.quelle === "url") {
    meta = await metadatenLesen(erkannt.url);
  }

  return {
    uebungId,
    quelle: erkannt.quelle,
    url: erkannt.url,
    videoId: erkannt.videoId,
    posterUrl: erkannt.posterUrl,
    blob: null,
    mimeType: null,
    ...meta,
    loopStartMs: erkannt.loopStartMs,
    loopEndeMs: erkannt.quelle === "url" ? meta.dauerMs : null,
  };
}

export function groesseFormatieren(bytes) {
  if (bytes == null) return "–";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
