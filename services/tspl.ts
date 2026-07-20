// ===================================
// TSPL — the label command language the Xprinter (XP-420B and its TSC-family
// kin) actually speaks. Portable across the portfolio: this file knows nothing
// about DEM/MSM/MHM domains — it turns a neutral label spec into TSPL bytes. Each
// app supplies the spec from its own data (services/labelPrint or qrLabel).
//
// Unlike the expo-print HTML→PDF route (which rasterises a whole page), TSPL is
// sent over Bluetooth and the printer draws the QR and text itself with native
// QRCODE / TEXT commands. One `PRINT` per label, at the stock's real mm size.
//
// Units: the XP-420B is 203 dpi → 8 dots per millimetre. SIZE/GAP take mm; QRCODE
// and TEXT take dot coordinates. `mm()` bridges the two.
// ===================================

/** 203 dpi → 8 dots per millimetre. */
export const DOTS_PER_MM = 8;
export const mm = (v: number) => Math.round(v * DOTS_PER_MM);

/** A neutral, domain-free description of one label — the whole contract between an
 *  app and the printer. */
export interface TsplLabelSpec {
  widthMm: number;
  heightMm: number;
  /** The QR payload (e.g. `dem://item/<id>`), drawn by the printer's QRCODE cmd. */
  qrPayload: string;
  /** The bold item name (first text line). */
  name: string;
  /** Extra lines under the name, in order (identifier, compliance, etc.). */
  lines?: string[];
  /** QR footprint in mm — how much width the code reserves on the left. */
  qrMm?: number;
  /** Print darkness 0–15 (thermal density) and speed in inch/s; sensible defaults. */
  darkness?: number;
  speedIps?: number;
  /** Label gap between die-cut labels, mm (roll dependent). */
  gapMm?: number;
}

/** TSPL string literals are double-quoted; a literal quote inside is doubled. */
function esc(s: string): string {
  return String(s ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
}

/** The QR error-correction level for the printed code — H (~30%) for scuffed,
 *  oily gear/medicine labels, matching the on-screen preview's high ECL intent. */
const QR_ECL = 'H';

/**
 * Build the TSPL for one label. Layout mirrors the on-screen sticker: QR on the
 * left, name + lines to the right; for a (near-)square stock the text simply gets
 * less width. Coordinates are computed so nothing is clipped at 203 dpi.
 */
export function labelToTspl(spec: TsplLabelSpec): string {
  const w = spec.widthMm;
  const h = spec.heightMm;
  const gap = spec.gapMm ?? 2;
  const darkness = spec.darkness ?? 10;
  const speed = spec.speedIps ?? 4;

  const margin = mm(1.5);
  const qrMm = spec.qrMm ?? Math.min(w, h) * 0.55;

  // QR cell (module) width in dots. The printed QR is moduleCount × cell; picking
  // the cell from the target mm and a typical version-3/4 module count keeps the
  // code near qrMm without measuring the exact version.
  const cell = Math.max(3, Math.round(mm(qrMm) / 33));
  const qrBox = cell * 33; // approx footprint used to place the text column

  const textX = margin + qrBox + mm(2);
  const qrY = Math.max(margin, Math.round((mm(h) - qrBox) / 2)); // vertically centred

  const cmds: string[] = [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gap} mm,0 mm`,
    `DIRECTION 1`,
    `DENSITY ${darkness}`,
    `SPEED ${speed}`,
    `CLS`,
    // QRCODE x,y,ECL,cell,mode(A=auto),rotation,"data"
    `QRCODE ${margin},${qrY},${QR_ECL},${cell},A,0,"${esc(spec.qrPayload)}"`,
  ];

  // Text column. Font "3" ≈ 24pt for the name, font "2" ≈ 18pt for the rest;
  // x/y magnification 1. Lines are stacked with a fixed leading.
  let y = margin + mm(0.5);
  cmds.push(`TEXT ${textX},${y},"3",0,1,1,"${esc(spec.name)}"`);
  y += mm(3.6);
  for (const line of spec.lines ?? []) {
    if (!line) continue;
    cmds.push(`TEXT ${textX},${y},"2",0,1,1,"${esc(line)}"`);
    y += mm(3.0);
  }

  cmds.push(`PRINT 1,1`);
  return cmds.join('\r\n') + '\r\n';
}

/** Join several labels into one job (each ends in its own PRINT). */
export function labelsToTspl(specs: TsplLabelSpec[]): string {
  return specs.map(labelToTspl).join('');
}
