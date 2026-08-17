/**
 * Erzeugt die App-Symbole als PNG — ohne Bildbibliothek, nur mit Bordmitteln.
 *
 *   node werkzeuge/icons-erzeugen.js
 *
 * Motiv: Hantel auf farbigem Grund. Bewusst schlicht, damit es auch als
 * 48-Pixel-Symbol auf dem Startbildschirm noch erkennbar bleibt.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ZIEL = path.join(__dirname, "..", "icons");

const GRUND = [212, 70, 42];    // #d4462a
const MOTIV = [255, 255, 255];

// ------------------------------------------------------------------ Zeichnen

/** Liegt der Punkt in einem Rechteck mit abgerundeten Ecken? */
function inRundrechteck(x, y, links, oben, rechts, unten, radius) {
  if (x < links || x > rechts || y < oben || y > unten) return false;
  const nx = Math.max(links + radius - x, 0, x - (rechts - radius));
  const ny = Math.max(oben + radius - y, 0, y - (unten - radius));
  return nx * nx + ny * ny <= radius * radius;
}

/**
 * Die Hantel in normierten Koordinaten (0…1 innerhalb des Motivbereichs):
 * Stange in der Mitte, je zwei Scheiben pro Seite.
 */
const TEILE = [
  { l: 0.20, o: 0.435, r: 0.80, u: 0.565, rad: 0.02 },  // Stange
  { l: 0.11, o: 0.260, r: 0.25, u: 0.740, rad: 0.05 },  // Scheibe innen links
  { l: 0.75, o: 0.260, r: 0.89, u: 0.740, rad: 0.05 },  // Scheibe innen rechts
  { l: 0.01, o: 0.360, r: 0.11, u: 0.640, rad: 0.04 },  // Scheibe außen links
  { l: 0.89, o: 0.360, r: 0.99, u: 0.640, rad: 0.04 },  // Scheibe außen rechts
];

function pixelFarbe(x, y, groesse, maskierbar) {
  // Maskierbare Symbole schneidet Android selbst zu — Rand randlos, Motiv kleiner,
  // damit beim Zuschnitt auf einen Kreis nichts Wichtiges wegfällt.
  const eckradius = maskierbar ? 0 : groesse * 0.22;
  const imGrund = maskierbar
    ? true
    : inRundrechteck(x, y, 0, 0, groesse - 1, groesse - 1, eckradius);

  if (!imGrund) return null; // durchsichtig

  const anteil = maskierbar ? 0.58 : 0.72;
  const seite = groesse * anteil;
  const versatz = (groesse - seite) / 2;
  const mx = (x - versatz) / seite;
  const my = (y - versatz) / seite;

  for (const t of TEILE) {
    if (inRundrechteck(mx, my, t.l, t.o, t.r, t.u, t.rad)) return MOTIV;
  }
  return GRUND;
}

// ------------------------------------------------------------ PNG schreiben

const crcTabelle = (() => {
  const tabelle = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabelle[n] = c;
  }
  return tabelle;
})();

function crc32(puffer) {
  let c = 0xffffffff;
  for (const b of puffer) c = crcTabelle[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const koerper = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(koerper));
  return Buffer.concat([laenge, koerper, pruefsumme]);
}

function pngErzeugen(groesse, maskierbar) {
  // Eine Bytezeile pro Pixelzeile, jeweils mit führendem Filter-Byte (0 = kein Filter).
  const zeilen = Buffer.alloc(groesse * (groesse * 4 + 1));
  let pos = 0;

  for (let y = 0; y < groesse; y++) {
    zeilen[pos++] = 0;
    for (let x = 0; x < groesse; x++) {
      const farbe = pixelFarbe(x, y, groesse, maskierbar);
      if (farbe) {
        zeilen[pos++] = farbe[0];
        zeilen[pos++] = farbe[1];
        zeilen[pos++] = farbe[2];
        zeilen[pos++] = 255;
      } else {
        pos += 4; // bleibt 0 = vollständig durchsichtig
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(groesse, 0);
  ihdr.writeUInt32BE(groesse, 4);
  ihdr[8] = 8;   // 8 Bit je Kanal
  ihdr[9] = 6;   // Farbtyp RGBA
  ihdr[10] = 0;  // Deflate
  ihdr[11] = 0;  // Standardfilter
  ihdr[12] = 0;  // nicht interlaced

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(zeilen, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------------- Ausführen

fs.mkdirSync(ZIEL, { recursive: true });

const aufgaben = [
  { datei: "icon-192.png", groesse: 192, maskierbar: false },
  { datei: "icon-512.png", groesse: 512, maskierbar: false },
  { datei: "icon-maskierbar-512.png", groesse: 512, maskierbar: true },
];

for (const { datei, groesse, maskierbar } of aufgaben) {
  const png = pngErzeugen(groesse, maskierbar);
  fs.writeFileSync(path.join(ZIEL, datei), png);
  console.log(`  ${datei.padEnd(26)} ${groesse}×${groesse}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log("\n  Symbole erzeugt in icons/\n");
