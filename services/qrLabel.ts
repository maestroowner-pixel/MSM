// ===================================
// QR labels — the sticker that goes on a piece of safety equipment.
//
// The payload is the item's own `id`: `msm://item/<id>`. Two consequences worth
// stating out loud:
//
//   • A reprint is never a new code. A sticker scraped off a lifejacket locker or
//     bleached by sun can be printed again — the payload is the permanent id, not
//     a one-time token, so reprinting cannot fork one item into two.
//   • The scheme is private (`msm://`), matching app.json's `scheme`, not an
//     https:// URL. A QR on a liferaft resolves inside this app against this
//     vessel's register; it is not a link for whoever points a phone at it.
//
// The id alone is enough even though ItemDetail is keyed by {category, id}: the
// category is looked up from the register (see services/barcode.ts). Encoding the
// category into the sticker would mean a re-categorised item's printed label
// quietly pointed at the wrong screen.
//
// The QR is always paired with a human-readable block, because a sticker whose QR
// is damaged must still tell a person what the item is — hence the type, the
// serial and the compliance date.
//
// Platforms follow MSM's existing rules (services/export.ts): native prints via
// expo-print, web prints the same HTML through a hidden iframe, Windows is guarded
// off — it has no print and its react-native-svg/expo-print are mocks.
// ===================================

import * as Print from 'expo-print';

import QRCode from 'qrcode';

import { EquipmentItem } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';
import { complianceDate, fileDateStamp, formatDate } from '../utils/dates';
import { deliverFile, onWeb, onWindows } from '../utils/fileShare';
import { printHtmlWeb } from '../utils/webFile';

// ---- payload ---------------------------------------------------------------

/** The private URI scheme every MSM-printed label carries. Matches app.json. */
export const QR_SCHEME = 'msm://item/';

/** The QR payload for an item. The id is permanent, so the payload is too. */
export function itemQrPayload(id: string): string {
  return `${QR_SCHEME}${id}`;
}

/**
 * Read a scanned string back as an item id, or null if it is not one of ours.
 *
 * The scheme is matched case-insensitively (a scanner or a QR generator may
 * normalise it), but the id is returned verbatim — `uid()` mixes base-36 digits
 * whose case is significant, and lowercasing an id would silently fail to match.
 */
export function parseItemQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= QR_SCHEME.length) return null;
  if (s.slice(0, QR_SCHEME.length).toLowerCase() !== QR_SCHEME) return null;
  const id = s.slice(QR_SCHEME.length).trim();
  return id || null;
}

// ---- sizes -----------------------------------------------------------------

export type LabelSize = '100x50' | '60x40' | '50x30' | '40x30' | '40x40';

/**
 * How much text a stock carries:
 *   • full    — QR beside the type, serial, the compliance line and the category/position line.
 *   • compact — QR beside the type and the one identifier a person can act on.
 *   • qr      — QR on top, a one-line type under it. The code IS the label; the
 *               type is only there so a person can tell two stickers apart.
 */
export type LabelLayout = 'full' | 'compact' | 'qr';

export interface LabelStock {
  label: string;
  hint: string;
  widthMm: number;
  heightMm: number;
  /** The QR's footprint on the label, quiet zone INCLUDED — i.e. how much of the
   *  sticker the code costs, which is the only number the layout cares about. */
  qrMm: number;
  layout: LabelLayout;
}

/**
 * The stocks the Xprinter XP-365B takes — a 4-inch (≤104 mm) direct-thermal roll
 * printer, one label per page. Not a free-form size picker: a label that does not
 * match the roll loaded in the printer is a wasted roll, so these are fixed
 * die-cut sizes, largest to smallest.
 */
export const LABEL_STOCKS: Record<LabelSize, LabelStock> = {
  '100x50': {
    label: '100 × 50 mm',
    hint: 'Full detail — type, serial, category, position and the compliance date.',
    widthMm: 100,
    heightMm: 50,
    qrMm: 34,
    layout: 'full',
  },
  '60x40': {
    label: '60 × 40 mm',
    hint: 'Medium — type, serial, the compliance date and category. For most gear.',
    widthMm: 60,
    heightMm: 40,
    qrMm: 26,
    layout: 'full',
  },
  '50x30': {
    label: '50 × 30 mm',
    hint: 'Compact — QR, type and serial only. For small or crowded gear.',
    widthMm: 50,
    heightMm: 30,
    qrMm: 20,
    layout: 'compact',
  },
  '40x30': {
    label: '40 × 30 mm',
    hint: 'Small — QR, type and serial. For crowded racks.',
    widthMm: 40,
    heightMm: 30,
    qrMm: 18,
    layout: 'compact',
  },
  '40x40': {
    label: '40 × 40 mm (QR)',
    hint: 'QR + a short type, nothing else. The smallest gear — a pin, a clip.',
    widthMm: 40,
    heightMm: 40,
    qrMm: 30,
    layout: 'qr',
  },
};

export const LABEL_SIZES = Object.keys(LABEL_STOCKS) as LabelSize[];

/** expo-print measures pages in points (72 per inch); the stocks are in mm. */
const PT_PER_MM = 72 / 25.4;
const mmToPt = (mm: number) => Math.round(mm * PT_PER_MM);

// ---- editable style --------------------------------------------------------
//
// Each stock's `layout` sets sensible defaults, but a keeper can fine-tune the
// printed sticker on the Label screen — the QR's size, the two visible font sizes,
// and whether the QR sits to the LEFT of the text or ON TOP of it. The overrides are
// sparse: a field left undefined falls back to the layout default, so an untouched
// label prints exactly as before this existed.
//
// `layout` still decides WHICH fields appear (qr = type only; compact = type + id;
// full = everything) — the editor changes size and position, not the field set.

export interface LabelOverrides {
  /** QR footprint in mm (quiet zone included). */
  qrMm?: number;
  /** Type/name font size in pt. */
  nameSize?: number;
  /** Human-id (serial) font size in pt. */
  idSize?: number;
  /** QR on top of the text (column) instead of beside it (row). */
  vertical?: boolean;
}

/** Per-item printed-text override — a custom sticker name and/or an extra line,
 *  kept OUT of the register (item.type is untouched). */
export interface LabelText {
  name?: string;
  note?: string;
}

/** The concrete numbers a resolved label is drawn from — no more `undefined`s. */
export interface LabelStyle {
  qrMm: number;
  nameSize: number;
  idSize: number;
  strongSize: number;
  padMm: number;
  gapMm: number;
  vertical: boolean;
  /** How many lines the name may wrap to (1 on the QR-only stock, 2 otherwise). */
  nameLines: number;
}

/** Editable-range limits, shared by the service and the on-screen editor so the two
 *  never disagree about a legal value. `max` for the QR is per-stock (it may not
 *  exceed the sticker), so it is a function. */
export const LABEL_STYLE_LIMITS = {
  qrMm: {
    step: 1,
    min: 10,
    max: (stock: LabelStock) => Math.min(stock.widthMm, stock.heightMm) - 4,
  },
  nameSize: { step: 0.5, min: 5, max: 16 },
  idSize: { step: 0.5, min: 4, max: 12 },
} as const;

const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The layout's defaults for a stock, before any override. */
export function defaultLabelStyle(stock: LabelStock): LabelStyle {
  const qr = stock.layout === 'qr';
  const compact = stock.layout === 'compact';
  const tight = stock.layout === 'full' && stock.widthMm < 80;
  return {
    qrMm: stock.qrMm,
    nameSize: qr ? 7 : compact ? 7.5 : tight ? 9 : 11,
    idSize: compact || qr ? 6 : tight ? 7.5 : 8.5,
    strongSize: tight ? 7.5 : 9,
    padMm: qr ? 2 : compact ? 1.5 : tight ? 2.5 : 3,
    gapMm: qr ? 1 : compact ? 1.5 : tight ? 2 : 3,
    vertical: qr,
    nameLines: qr ? 1 : 2,
  };
}

/** The layout defaults with the keeper's overrides applied and clamped to legal ranges. */
export function resolveLabelStyle(stock: LabelStock, overrides?: LabelOverrides): LabelStyle {
  const d = defaultLabelStyle(stock);
  if (!overrides) return d;
  const L = LABEL_STYLE_LIMITS;
  return {
    ...d,
    qrMm: overrides.qrMm != null ? clampNum(overrides.qrMm, L.qrMm.min, L.qrMm.max(stock)) : d.qrMm,
    nameSize: overrides.nameSize != null ? clampNum(overrides.nameSize, L.nameSize.min, L.nameSize.max) : d.nameSize,
    idSize: overrides.idSize != null ? clampNum(overrides.idSize, L.idSize.min, L.idSize.max) : d.idSize,
    vertical: overrides.vertical ?? d.vertical,
  };
}

/** The text actually printed as the sticker's name — the keeper's override if set,
 *  otherwise the item's own type/name. */
export function printedTitle(item: EquipmentItem, text?: LabelText): string {
  const override = text?.name?.trim();
  return override && override.length ? override : labelTitle(item);
}

// ---- QR rendering ----------------------------------------------------------

/**
 * Error correction is fixed at Q (~25% recoverable). The default M is tuned for
 * screens and clean paper; these stickers live on deck gear — salt, sun, paint —
 * and get scraped. The payload is short enough that the extra redundancy costs a
 * version bump at most, and a QR that still reads with a corner gone is the whole
 * point of printing one.
 *
 * Exported because the on-screen preview must encode with the identical settings:
 * a preview at a different error-correction level is a different code, of a
 * possibly different version, at a different module size — i.e. a preview of a
 * sticker that will never be printed.
 */
export const QR_ECL = 'Q';

/** Quiet zone, in modules. Four is the QR spec minimum — below it, scanners start
 *  failing against a busy background, and a sticker's background is the item
 *  itself. Baked into the SVG so no layout change can eat it. */
export const QUIET_ZONE = 4;

/**
 * How many modules across the code for this payload is — version 3 (29) for a
 * typical id, more for a long one.
 *
 * The preview needs it to reproduce the printed quiet zone: react-native-qrcode-svg
 * fits `size + 2 × quietZone` worth of modules into `size` points, so the quiet
 * zone has to be expressed in points there, while the print SVG expresses it in
 * modules. Same geometry, two coordinate systems.
 */
export function qrModuleCount(value: string): number {
  return QRCode.create(value, { errorCorrectionLevel: QR_ECL }).modules.size;
}

/**
 * A QR as a standalone inline SVG string, sized in millimetres.
 *
 * Dark modules are emitted as run-length-merged rects rather than one rect per
 * module — about half the nodes in practice (a 29×29 code: ~425 dark modules,
 * ~220 rects), and, more to the point, no hairline seams between horizontally
 * adjacent modules where the renderer rounds a fractional edge.
 *
 * This is plain string-building on top of `qrcode` (pure JS), NOT react-native-svg
 * — which matters, because react-native-svg is one of the modules mocked out on
 * Windows. The printed code does not depend on it.
 */
export function qrSvg(value: string, sizeMm: number): string {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: QR_ECL });
  const n = modules.size;
  const total = n + QUIET_ZONE * 2;

  const rects: string[] = [];
  for (let y = 0; y < n; y++) {
    let runStart = -1;
    for (let x = 0; x <= n; x++) {
      const dark = x < n && modules.data[y * n + x] !== 0;
      if (dark && runStart < 0) runStart = x;
      if (!dark && runStart >= 0) {
        rects.push(
          `<rect x="${runStart + QUIET_ZONE}" y="${y + QUIET_ZONE}" width="${x - runStart}" height="1"/>`
        );
        runStart = -1;
      }
    }
  }

  // shape-rendering=crispEdges stops the renderer anti-aliasing module edges into
  // grey — a thermal head prints a dot or it does not, and grey becomes mush.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizeMm}mm" height="${sizeMm}mm"
    viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">
    <rect width="${total}" height="${total}" fill="#fff"/>
    <g fill="#000">${rects.join('')}</g>
  </svg>`;
}

// ---- label content ---------------------------------------------------------

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** What a person reads off the sticker when the QR will not scan. Falls back down
 *  the chain of identifiers the register actually holds, and to the id only as a
 *  last resort — an id is stable but means nothing to a human. */
export function humanId(item: EquipmentItem): string {
  if (item.serial) return `S/N ${item.serial}`;
  if (item.no != null && item.no !== '') return `No. ${item.no}`;
  return item.id;
}

/** The item's own name, however this register happens to record it. */
export function labelTitle(item: EquipmentItem): string {
  return item.type || CATEGORY_MAP[item.category]?.label || 'Item';
}

/**
 * The lines under the title. Nothing here is invented: a field the register does
 * not hold is simply absent from the sticker rather than printed as a guess.
 */
export function labelLines(item: EquipmentItem): { strong: string[]; weak: string[] } {
  const meta = CATEGORY_MAP[item.category];

  // The compliance line — the reason a surveyor looks at the sticker at all.
  // "Next Inspection" and "Expiry" are not interchangeable words to the person
  // reading it, so the category decides which, exactly as export.ts does.
  const strong: string[] = [];
  const date = complianceDate(item);
  if (date) {
    const what = meta?.dateField === 'expiry' ? 'Expiry' : 'Next Inspection';
    strong.push(`${what}: ${formatDate(date)}`);
  }

  const weak: string[] = [];
  if (meta?.label) weak.push(meta.label);
  if (item.position) weak.push(item.position);
  // Liferafts carry a capacity, and it is the one number a person wants off the
  // sticker in an emergency. Everything else quantity-ish stays off the label.
  if (item.persons != null) weak.push(`${item.persons} pers.`);

  return { strong, weak };
}

// ---- label HTML ------------------------------------------------------------

function labelCss(stock: LabelStock, style: LabelStyle): string {
  const compact = stock.layout === 'compact';
  const tight = stock.layout === 'full' && stock.widthMm < 80;
  const v = style.vertical;

  return `
    @page { size: ${stock.widthMm}mm ${stock.heightMm}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; }
    body { font-family: Helvetica, Arial, sans-serif; color: #000; -webkit-font-smoothing: none; }

    .label {
      width: ${stock.widthMm}mm; height: ${stock.heightMm}mm;
      padding: ${style.padMm}mm;
      display: flex;
      flex-direction: ${v ? 'column' : 'row'};
      align-items: center; justify-content: center;
      gap: ${style.gapMm}mm;
      overflow: hidden;
      page-break-after: always;
    }
    /* Without this the job ends on a trailing blank label — one wasted sticker
       per print, every print. */
    .label:last-child { page-break-after: auto; }

    .qr { flex: 0 0 auto; width: ${style.qrMm}mm; height: ${style.qrMm}mm; }
    .qr svg { display: block; width: 100%; height: 100%; }

    .text { flex: 1 1 auto; min-width: 0; overflow: hidden; ${v ? 'width: 100%; text-align: center;' : ''} }

    /* Thermal print is 1-bit: weight and size carry the hierarchy, since there is
       no grey to fall back on. This is also why the category's emoji, which the
       rest of the UI uses, is NOT on the sticker — its colour is the whole point
       of it, and a thermal head has none. The category is spelled out instead. */
    .name {
      font-size: ${style.nameSize}pt; font-weight: bold; line-height: 1.15;
      display: -webkit-box; -webkit-line-clamp: ${style.nameLines}; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .id { font-size: ${style.idSize}pt; margin-top: ${compact ? 0.5 : 1}mm; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; }
    .strong { font-size: ${style.strongSize}pt; font-weight: bold; margin-top: ${tight ? 0.8 : 1.2}mm;
              line-height: 1.25; }
    .weak { font-size: 6.5pt; margin-top: 1mm; line-height: 1.25;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            overflow: hidden; }
    /* The keeper's free-text extra line, just under the name. */
    .extra { font-size: ${style.idSize}pt; margin-top: ${compact ? 0.4 : 0.8}mm; line-height: 1.2;
             display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
             overflow: hidden; }
  `;
}

function labelBody(item: EquipmentItem, stock: LabelStock, style: LabelStyle, text?: LabelText): string {
  const qr = qrSvg(itemQrPayload(item.id), style.qrMm);
  const name = esc(printedTitle(item, text));
  const note = text?.note?.trim();
  const extra = note ? `<div class="extra">${esc(note)}</div>` : '';

  // QR-only stock: the code and a one-line type — enough to tell two stickers apart
  // by eye, the scan does the rest. No room for the extra line here.
  if (stock.layout === 'qr') {
    return `<div class="label">
      <div class="qr">${qr}</div>
      <div class="text"><div class="name">${name}</div></div>
    </div>`;
  }

  // Compact: QR, the type and the one identifier a person can act on. Squeezing the
  // category and dates onto a 30 mm-tall label produces type nobody reads in a dim
  // locker — the QR is the route to that detail on these sizes.
  if (stock.layout === 'compact') {
    return `<div class="label">
      <div class="qr">${qr}</div>
      <div class="text">
        <div class="name">${name}</div>
        ${extra}
        <div class="id">${esc(humanId(item))}</div>
      </div>
    </div>`;
  }

  const { strong, weak } = labelLines(item);
  return `<div class="label">
    <div class="qr">${qr}</div>
    <div class="text">
      <div class="name">${name}</div>
      ${extra}
      <div class="id">${esc(humanId(item))}</div>
      ${strong.length ? `<div class="strong">${esc(strong.join('  ·  '))}</div>` : ''}
      ${weak.length ? `<div class="weak">${esc(weak.join('  ·  '))}</div>` : ''}
    </div>
  </div>`;
}

/** One print job, one label per item, sequenced for a roll-fed thermal printer.
 *  `texts` carries per-item printed-text overrides, keyed by item id. */
export function buildLabelsHtml(
  items: EquipmentItem[],
  size: LabelSize,
  overrides?: LabelOverrides,
  texts?: Record<string, LabelText>
): string {
  const stock = LABEL_STOCKS[size];
  const style = resolveLabelStyle(stock, overrides);
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>${labelCss(stock, style)}</style></head><body>
    ${items.map((i) => labelBody(i, stock, style, texts?.[i.id])).join('')}
  </body></html>`;
}

// ---- output ----------------------------------------------------------------

/** Windows has no print at all (expo-print is a mock there) — same rule as
 *  export.ts's printReport/exportPdf. */
export const canPrintLabels = !onWindows;

/** A real PDF file is a native-only route: expo-print's printToFileAsync has no
 *  web implementation, and on web the print dialog's own "Save as PDF" is the
 *  honest equivalent rather than a second, half-working button. */
export const canSaveLabelsPdf = !onWindows && !onWeb;

function pageOptions(size: LabelSize) {
  const stock = LABEL_STOCKS[size];
  return { width: mmToPt(stock.widthMm), height: mmToPt(stock.heightMm) };
}

/** Hand the labels to the print dialog, at the stock's exact dimensions. */
export async function printLabels(
  items: EquipmentItem[],
  size: LabelSize,
  overrides?: LabelOverrides,
  texts?: Record<string, LabelText>
): Promise<void> {
  if (onWindows) throw new Error('Printing is not available on Windows.');
  const html = buildLabelsHtml(items, size, overrides, texts);
  if (onWeb) {
    // The browser honours the @page size in the HTML, so the same document that
    // drives the thermal printer on a phone drives it from a laptop too.
    printHtmlWeb(html);
    return;
  }
  await Print.printAsync({ html, ...pageOptions(size) });
}

/**
 * Render the labels to a PDF and hand it to the share sheet — the route to a
 * printer this phone cannot see. Goes through deliverFile so the file arrives
 * named, the same way every other MSM export does.
 */
export async function saveLabelsPdf(
  items: EquipmentItem[],
  size: LabelSize,
  overrides?: LabelOverrides,
  texts?: Record<string, LabelText>
): Promise<void> {
  if (!canSaveLabelsPdf) throw new Error('Saving labels as a PDF is only available on iOS/Android.');
  const html = buildLabelsHtml(items, size, overrides, texts);
  const { base64 } = await Print.printToFileAsync({ html, ...pageOptions(size), base64: true });
  if (!base64) throw new Error('Could not render the labels to a PDF.');
  await deliverFile(`MSM_labels_${size}_${fileDateStamp()}.pdf`, base64, true, 'application/pdf');
}
