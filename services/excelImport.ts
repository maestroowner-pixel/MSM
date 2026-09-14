// ===================================
// Excel importer
// Header-driven generic mapper: finds header rows, classifies columns
// by keyword, and walks data rows. Handles multi-section sheets
// (e.g. Liferafts + HRU, GMDSS radios + SART + EPIRB, FIFI sets + bottles).
// ===================================

import * as XLSX from 'xlsx';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { CATEGORIES, CATEGORY_MAP, sheetSafeName } from '../constants/categories';
import { parseDateCell } from '../utils/dates';
import { uid } from '../utils/id';

type Field =
  | 'no'
  | 'type'
  | 'make'
  | 'size'
  | 'serial'
  | 'deck'
  | 'position'
  | 'persons'
  | 'quantity'
  | 'manufactureDate'
  | 'nextInspection'
  | 'expiry'
  // "Exp / Inspc." — one column that holds whichever date the category runs on.
  | 'compliance'
  | 'remarks'
  // The item's own id, written by our register export ("MSM ID"). Not a data
  // field: it never makes a row a header or an item, it only says WHICH item.
  | 'msmId';

/**
 * Headings that ARE a field's name, matched on the whole cell before any
 * keyword guessing. Two reasons they come first:
 *   - A vessel's own list says "Description · Make · Type · Size". Guessed by
 *     keyword in column order, "Make" took `type` (it is one of type's keywords)
 *     and the real "Type" column fell into extras — a CO2 extinguisher imported as
 *     type "Viking".
 *   - These are the headings our own template and register export write, so a
 *     round trip must never depend on column order.
 * Deliberately NOT added to the keyword pass below: "Hydrostatic Release: Make &
 * Type" is a type column in the reference workbook, and must stay one.
 */
const EXACT_PATTERNS: Array<[Field, RegExp]> = [
  ['msmId', /^msm id$/],
  ['no', /^(no|nr|n_|n°|item no|item nr|item number|item #|ref|ref no)$/],
  ['type', /^type$/],
  ['make', /^(make|maker|manufacturer|brand)$/],
  ['size', /^(size|capacity|volume|weight)$/],
  ['serial', /^(serial|serial no|serial nr|serial number|s\/n|sn)$/],
  ['deck', /^deck$/],
  ['position', /^(location|position)$/],
  ['compliance', /\bexp.*\binsp|\binsp.*\bexp/],
  ['remarks', /^(comments?|remarks?|notes?)$/],
];

// Keyword pass. Order matters: more specific patterns first.
const FIELD_PATTERNS: Array<[Field, RegExp]> = [
  ['no', /^(no|nr|n_|set)\.?$/i],
  ['remarks', /remark|comment|note/i],
  ['manufactureDate', /manufactur/i],
  ['nextInspection', /next\s*(inspection|insp|pressure|test|3rd\s*party|shore|hydro)|^inspection$/i],
  ['expiry', /expiry|exp\b|exp\.|life\s*date|due|bottle\s*exp/i],
  ['serial', /serial|id\s*number|^id$|suit\s*number|^#$/i],
  ['persons', /persons/i],
  ['quantity', /quantity|qty/i],
  ['position', /position|place|location|cabin|area\s*served|^space$|fire\s*station|stowage/i],
  ['type', /type|brand|make|model|raft|^item$|co2\s*bottles|damper|vent|hydrant|firebox|detector|outfit/i],
];

type ColMap = Partial<Record<Field, number>> & {
  extras: Array<{ name: string; col: number }>;
  /** A "Description" column beside a real "Type" — kept, and read to sort rows. */
  description?: number;
  /** The header row is our own register export (see `ourExport` below). */
  ours?: boolean;
};

const DATA_FIELDS: Field[] = [
  'no', 'type', 'make', 'size', 'serial', 'deck', 'position', 'persons', 'quantity',
  'manufactureDate', 'nextInspection', 'expiry', 'compliance', 'remarks',
];

// Minimum number of columns that must classify into fields for a row to count
// as a header. Header rows classify many fields (their cells ARE the column
// names); data rows classify almost none (cell values rarely contain column words).
const HEADER_FIELD_THRESHOLD = 3;

function norm(v: any): string {
  return v == null ? '' : String(v).trim();
}

/** A heading reduced to compare: lower case, single spaces, no trailing dot/colon. */
function headingKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').replace(/[.:]+$/, '').trim();
}

function classifyHeader(row: any[]): ColMap {
  const map: ColMap = { extras: [] };
  const used = new Set<Field>();
  const taken = new Set<number>();
  const assign = (field: Field, col: number) => {
    map[field] = col;
    used.add(field);
    taken.add(col);
  };

  // Pass 1 — headings that name their field outright.
  const keys = row.map((c) => headingKey(norm(c)));
  const hasTypeHeading = keys.some((k) => k === 'type');
  // "Type" beats a keyword guess only on a sheet that also names its Make — the
  // vessel layout "Description · Make · Type". On the reference GMDSS sheet
  // ("Flares, make" · "Type") the first column is the item and "Type" the maker,
  // and that sheet must read as it always has.
  const typeIsExact = hasTypeHeading && keys.some((k) => /^(make|maker|manufacturer|brand)$/.test(k));
  // Our own register export. Two of its headings mean something only there:
  // "Due" is the category's compliance date (the keyword pass would file it as
  // EXPIRY, moving a liferaft's next inspection into the wrong field on every
  // round trip), and "Status" is computed — importing it would plant a stale
  // "OK" in every item's extras. Recognised by the id column, or, for files
  // exported before that column existed, by its distinctive heading set.
  const ourExport =
    keys.includes('msm id') || (keys.includes('due') && keys.includes('status') && keys.includes('manufacture'));
  map.ours = ourExport;
  row.forEach((cell, col) => {
    const key = headingKey(norm(cell));
    if (!key) return;
    if (ourExport && key === 'due' && !used.has('compliance')) {
      assign('compliance', col);
      return;
    }
    if (ourExport && key === 'status') {
      taken.add(col);
      return;
    }
    for (const [field, re] of EXACT_PATTERNS) {
      if (used.has(field)) continue;
      // With no Type column, "Make"/"Brand" IS what the sheet calls the item
      // (the reference BA sheet: DRAEGER, SCOTT) — leave it to the keyword pass,
      // which files it as the type, exactly as before make had a field.
      if (field === 'make' && !hasTypeHeading) continue;
      if (field === 'type' && !typeIsExact) continue;
      if (re.test(key)) {
        assign(field, col);
        return;
      }
    }
  });

  const hasDescription = row.findIndex((c) => headingKey(norm(c)) === 'description');

  // Pass 2 — keyword guessing for everything else, in column order as before.
  row.forEach((cell, col) => {
    if (taken.has(col)) return;
    const text = norm(cell);
    if (!text) return;

    // "#" is ambiguous. On the reference Harnesses sheet it is the only serial
    // column; on a vessel list with its own "Serial" beside it, it is the item
    // number ("01-SD"). Which it is follows from whether a serial is already there.
    if (text === '#') {
      if (!used.has('serial')) assign('serial', col);
      else if (!used.has('no')) assign('no', col);
      else map.extras.push({ name: text, col });
      return;
    }

    // A "Description" column is the type when there is no Type column, and
    // otherwise kept as its own extra (and used to sort rows into categories).
    if (col === hasDescription) {
      if (!used.has('type') && !hasTypeHeading) {
        assign('type', col);
      } else {
        map.description = col;
        map.extras.push({ name: text, col });
        taken.add(col);
      }
      return;
    }

    let matched: Field | null = null;
    for (const [field, re] of FIELD_PATTERNS) {
      if (used.has(field)) continue;
      if (re.test(text)) {
        matched = field;
        break;
      }
    }
    if (matched) assign(matched, col);
    else map.extras.push({ name: text, col });
  });

  // Extras in column order, as they appear in the sheet.
  map.extras.sort((a, b) => a.col - b.col);
  return map;
}

function fieldCount(cm: ColMap): number {
  return DATA_FIELDS.reduce((n, f) => (cm[f] != null ? n + 1 : n), 0);
}

function isHeaderRow(cm: ColMap): boolean {
  return fieldCount(cm) >= HEADER_FIELD_THRESHOLD;
}

function toInt(v: any): number | undefined {
  if (v == null || v === '') return undefined;
  const m = String(v).match(/\d+(\.\d+)?/);
  if (!m) return undefined;
  const n = Math.round(parseFloat(m[0]));
  return isFinite(n) ? n : undefined;
}

// Fields that make a row an ITEM. Make, size and deck describe an item but do
// not identify one: counted, a section title with a stray number under "Volume"
// ("FIRE BLANKETS", 45899 on the reference sheet) passed for a row of equipment.
const ROW_FIELDS: Field[] = DATA_FIELDS.filter((f) => f !== 'make' && f !== 'size' && f !== 'deck');

function countRecognized(row: any[], cm: ColMap): number {
  let n = 0;
  ROW_FIELDS.forEach((f) => {
    const c = cm[f];
    if (c != null && norm(row[c]) !== '') n++;
  });
  return n;
}

function rowToItem(row: any[], cm: ColMap, category: CategoryKey, lastType: string): EquipmentItem | null {
  const get = (f: Field) => (cm[f] != null ? row[cm[f] as number] : undefined);

  let type = norm(get('type'));
  if (!type) type = lastType; // carry forward merged type cells

  const item: EquipmentItem = {
    id: uid(category.slice(0, 3)),
    category,
    updatedAt: Date.now(),
  };
  // Which fields this sheet HAS a column for — so an update can tell "the cell
  // was emptied" (clear it) from "the file never had that column" (keep it).
  (item as any)._fields = DATA_FIELDS.filter((f) => cm[f] != null);
  const msmId = norm(get('msmId'));
  if (msmId) (item as any)._msmId = msmId;

  const no = get('no');
  if (no != null && norm(no) !== '') item.no = typeof no === 'number' ? no : norm(no);
  if (type) item.type = type;

  const make = norm(get('make'));
  if (make) item.make = make;
  const size = norm(get('size'));
  if (size) item.size = size;
  const serial = norm(get('serial'));
  if (serial) item.serial = serial;
  const deck = norm(get('deck'));
  if (deck) item.deck = deck;
  const position = norm(get('position'));
  if (position) item.position = position;
  const remarks = norm(get('remarks'));
  if (remarks) item.remarks = remarks;

  const persons = toInt(get('persons'));
  if (persons != null) item.persons = persons;
  const quantity = toInt(get('quantity'));
  if (quantity != null) item.quantity = quantity;

  const mfg = parseDateCell(get('manufactureDate'));
  if (mfg) item.manufactureDate = mfg;
  const ni = parseDateCell(get('nextInspection'));
  if (ni) item.nextInspection = ni;
  const exp = parseDateCell(get('expiry'));
  if (exp) item.expiry = exp;
  // "Exp / Inspc." fills whichever date this category is judged by, so the
  // status and the label read it under the right name.
  const due = parseDateCell(get('compliance'));
  if (due) {
    const field = CATEGORY_MAP[category]?.dateField ?? 'expiry';
    if (!item[field]) {
      item[field] = due;
      // Remembered only so a row sorted into another category later can move
      // the date to THAT category's field (see sortRows). Stripped before storing.
      (item as any)._complianceField = field;
    }
  }

  // Extras (unclassified columns with values)
  const extra: Record<string, any> = {};
  for (const e of cm.extras) {
    const v = row[e.col];
    if (v != null && norm(v) !== '') {
      // Render date-serial-looking extras as dates where plausible.
      extra[e.name] = typeof v === 'number' && v > 30000 && v < 80000 ? parseDateCell(v) ?? v : v;
    }
  }
  if (Object.keys(extra).length) item.extra = extra;

  // Must have an identity beyond just a row number.
  if (!item.type && !item.serial && !item.position && !item.quantity && item.no == null) return null;
  // Present only on a sheet sorted row by row (see sortRows) — never stored as-is.
  if (cm.description != null) {
    const d = norm(row[cm.description]);
    if (d) (item as any)._description = d;
  }
  return item;
}

/**
 * First Aid Kit sheet has no header row — rows look like
 * ["BRIDGE", "EXPIRY", <date serial>]. Map label -> type, date -> expiry.
 */
function mapFirstAid(category: CategoryKey, rows: any[][]): EquipmentItem[] {
  const items: EquipmentItem[] = [];
  for (const row of rows) {
    if (!row) continue;
    const label = norm(row[0]);
    if (!label || /^checked$/i.test(label)) continue;
    let expiry: string | undefined;
    for (const cell of row) {
      const d = parseDateCell(cell);
      if (d) {
        expiry = d;
        break;
      }
    }
    if (!expiry && !/kit|bridge|engine|galley|ecr|er\b|hospital/i.test(label)) continue;
    const item: EquipmentItem = { id: uid('fa'), category, type: label, expiry, updatedAt: Date.now() };
    (item as any)._fields = ['type', 'expiry'];
    items.push(item);
  }
  return items;
}

/** Map a single sheet's rows to equipment items. */
export function mapSheet(category: CategoryKey, rows: any[][]): EquipmentItem[] {
  // The reference First Aid sheet has no header row; our own export of it does,
  // and read the headerless way its heading row became a "kit" called "No".
  if (category === 'first_aid' && !rows.some((r) => r && isHeaderRow(classifyHeader(r)))) {
    return mapFirstAid(category, rows);
  }

  const items: EquipmentItem[] = [];
  let cm: ColMap | null = null;
  let lastType = '';

  for (const row of rows) {
    if (!row || row.every((c) => norm(c) === '')) continue;

    const candidate = classifyHeader(row);
    if (isHeaderRow(candidate)) {
      cm = candidate;
      lastType = ''; // new section resets carry-forward
      continue;
    }

    if (!cm) continue; // skip preamble before first header
    if (countRecognized(row, cm) < 2) continue; // section titles / notes

    // Carrying a type down into blank cells is for merged cells in a hand-made
    // workbook. Our export writes every row in full, so a blank there means "no
    // type" — carried forward, five untyped immersion suits came back typed.
    const item = rowToItem(row, cm, category, cm.ours ? '' : lastType);
    if (item) {
      if (item.type) lastType = item.type;
      items.push(item);
    }
  }
  return items;
}

export interface ImportPreview {
  byCategory: Partial<Record<CategoryKey, EquipmentItem[]>>;
  counts: Array<{ category: CategoryKey; label: string; count: number }>;
  total: number;
  missingSheets: string[];
  /** Worksheets with no category of their own, whose rows were sorted by what
   *  each item is ("Fire extinguisher" -> Fire Extinguishers). */
  sortedSheets: string[];
}

/** Parse a base64-encoded .xlsx into items grouped by category. */
export function parseWorkbookBase64(base64: string): ImportPreview {
  const wb = XLSX.read(base64, { type: 'base64' });
  return buildPreview(wb);
}

/** Parse raw .xlsx bytes — the browser hands a file over as an ArrayBuffer. */
export function parseWorkbookBytes(bytes: ArrayBuffer | Uint8Array): ImportPreview {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const wb = XLSX.read(data, { type: 'array' });
  return buildPreview(wb);
}

/**
 * What an item is, from the words a vessel uses for it. Checked in order, so the
 * specific come before the general ("inflatable lifejacket" before "lifejacket").
 */
const CATEGORY_WORDS: Array<[CategoryKey, RegExp]> = [
  ['eebd', /\beebd|escape\s*breathing|emergency\s*escape/i],
  ['fire_extinguishers', /extinguish/i],
  ['inflatable_lifejackets', /inflatable/i],
  ['lifejackets', /life\s*jacket/i],
  ['immersion_suits', /immersion/i],
  ['liferafts', /life\s*raft|\bhru\b|hydrostatic/i],
  ['lifebuoys', /life\s*buoy|ring\s*buoy/i],
  ['plb', /\bplb/i],
  ['harnesses', /harness|fall\s*arrest/i],
  ['gmdss_pyro', /epirb|\bsart\b|pyro|flare|rocket|smoke\s*signal|gmdss|line\s*throw/i],
  ['fire_dampers', /damper/i],
  ['fire_vents', /fire\s*vent/i],
  ['hydrants_fireboxes', /hydrant|fire\s*box|fire\s*hose/i],
  ['fixed_co2', /fixed\s*co2|co2\s*(system|bottle|room)/i],
  ['bottle_pressure', /bottle\s*press/i],
  ['fifi_ba', /fire\s*fighter|fireman|fire\s*man|\bba\s*set|breathing\s*app/i],
  ['fire_detectors', /detector/i],
  ['eye_wash', /eye\s*wash/i],
  ['first_aid', /first\s*aid/i],
  ['chemical_suits', /chemical\s*suit/i],
  ['gas_detection', /gas\s*detect/i],
  ['sopep', /sopep/i],
];

function categoryFromWords(text: string): CategoryKey | null {
  const t = text.trim();
  if (!t) return null;
  for (const [key, re] of CATEGORY_WORDS) if (re.test(t)) return key;
  // A heading the vessel made up for itself, named in the sheet.
  const lower = t.toLowerCase();
  const own = CATEGORIES.find((c) => c.key.startsWith('v_') && lower.includes(c.label.toLowerCase()));
  return own ? own.key : null;
}

/**
 * A worksheet that is not one of ours — a vessel's own list, typically one sheet
 * of everything by deck. Rows are sorted by the item's description (or type),
 * falling back to the sheet's name, and to Other Safety Equipment when nothing
 * says what the thing is: an item put somewhere sortable beats one left out.
 */
function sortRows(sheetName: string, rows: any[][]): EquipmentItem[] {
  const sheetGuess = categoryFromWords(sheetName);
  const items = mapSheet('other_safety', rows);
  return items.map((it) => {
    const words = [(it as any)._description, it.type, it.extra && Object.values(it.extra).join(' ')]
      .filter(Boolean)
      .join(' ');
    const category = categoryFromWords(words) ?? sheetGuess ?? 'other_safety';
    // A fresh id with the real category's prefix — the one it was parsed under was Other's.
    const moved: EquipmentItem = { ...stripInternal(it), id: uid(category.slice(0, 3)), category };
    // "Exp / Inspc." was filed under Other's date field while the row was still
    // unsorted; it belongs in the field the real category is judged by.
    const from = (it as any)._complianceField as 'expiry' | 'nextInspection' | undefined;
    const to = CATEGORY_MAP[category]?.dateField;
    if (from && to && from !== to && !moved[to]) {
      moved[to] = moved[from];
      delete moved[from];
    }
    return moved;
  });
}

function buildPreview(wb: XLSX.WorkBook): ImportPreview {
  const byCategory: Partial<Record<CategoryKey, EquipmentItem[]>> = {};
  const missingSheets: string[] = [];
  const sortedSheets: string[] = [];
  const add = (key: CategoryKey, items: EquipmentItem[]) => {
    if (!items.length && byCategory[key]) return;
    byCategory[key] = [...(byCategory[key] ?? []), ...items];
  };

  // Tolerant sheet lookup (trim + case-insensitive).
  const sheetIndex = new Map<string, string>();
  wb.SheetNames.forEach((n) => sheetIndex.set(n.trim().toLowerCase(), n));
  const claimed = new Set<string>();

  for (const meta of CATEGORIES) {
    // Our register export names each worksheet after the category's LABEL
    // ("Liferafts / HRU" → "Liferafts   HRU"), not its source sheet ("Liferafts"),
    // and writes one for categories that have no source sheet at all (Other
    // Safety Equipment, a vessel's own). Without the label lookup an exported
    // register came back through the row-by-row sorter and could land its items
    // in a neighbouring category.
    const bySheet = meta.sheet ? sheetIndex.get(meta.sheet.trim().toLowerCase()) : undefined;
    const realName = bySheet ?? sheetIndex.get(sheetSafeName(meta.label).toLowerCase());
    if (!realName || claimed.has(realName)) {
      // Hand-built categories have no source worksheet. Not finding one is not a
      // gap in the workbook, so it must not be reported as a missing sheet.
      if (!realName && meta.sheet) missingSheets.push(meta.sheet);
      continue;
    }
    claimed.add(realName);
    const ws = wb.Sheets[realName];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: null });
    add(meta.key, mapSheet(meta.key, rows).map(stripInternal));
  }

  // Everything else: a vessel's own layout. Sheets with no header row (a cover
  // page, an overview) yield nothing and are passed over quietly.
  for (const name of wb.SheetNames) {
    if (claimed.has(name)) continue;
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: null });
    const items = sortRows(name, rows);
    if (!items.length) continue;
    sortedSheets.push(name);
    for (const it of items) add(it.category, [it]);
  }

  const counts: ImportPreview['counts'] = [];
  let total = 0;
  for (const meta of CATEGORIES) {
    const n = byCategory[meta.key]?.length ?? 0;
    if (!meta.sheet && !n) continue;
    counts.push({ category: meta.key, label: meta.label, count: n });
    total += n;
  }

  // A workbook in the vessel's own layout is not missing our sheets — it never
  // had them. Listing twenty-three "not found" names there reads like a failure.
  const ownLayout = sortedSheets.length > 0 && claimed.size === 0;
  return { byCategory, counts, total, missingSheets: ownLayout ? [] : missingSheets, sortedSheets };
}

/**
 * Drop the working notes only the parser needs (`_description`,
 * `_complianceField`). `_msmId` and `_fields` survive into the preview, because
 * the UPDATE is decided from them — see services/registerUpdate.ts, whose
 * `storable` removes them before anything is saved.
 */
function stripInternal(it: EquipmentItem): EquipmentItem {
  const { _description, _complianceField, ...rest } = it as any;
  return rest;
}
