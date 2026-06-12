// ===================================
// Excel importer
// Header-driven generic mapper: finds header rows, classifies columns
// by keyword, and walks data rows. Handles multi-section sheets
// (e.g. Liferafts + HRU, GMDSS radios + SART + EPIRB, FIFI sets + bottles).
// ===================================

import * as XLSX from 'xlsx';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { CATEGORIES } from '../constants/categories';
import { parseDateCell } from '../utils/dates';
import { uid } from '../utils/id';

type Field =
  | 'no'
  | 'type'
  | 'serial'
  | 'position'
  | 'persons'
  | 'quantity'
  | 'manufactureDate'
  | 'nextInspection'
  | 'expiry'
  | 'remarks';

// Order matters: more specific patterns first.
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

type ColMap = Partial<Record<Field, number>> & { extras: Array<{ name: string; col: number }> };

const DATA_FIELDS: Field[] = [
  'no', 'type', 'serial', 'position', 'persons', 'quantity', 'manufactureDate', 'nextInspection', 'expiry', 'remarks',
];

// Minimum number of columns that must classify into fields for a row to count
// as a header. Header rows classify many fields (their cells ARE the column
// names); data rows classify almost none (cell values rarely contain column words).
const HEADER_FIELD_THRESHOLD = 3;

function norm(v: any): string {
  return v == null ? '' : String(v).trim();
}

function classifyHeader(row: any[]): ColMap {
  const map: ColMap = { extras: [] };
  const used = new Set<Field>();
  row.forEach((cell, col) => {
    const text = norm(cell);
    if (!text) return;
    let matched: Field | null = null;
    for (const [field, re] of FIELD_PATTERNS) {
      if (used.has(field)) continue;
      if (re.test(text)) {
        matched = field;
        break;
      }
    }
    if (matched) {
      map[matched] = col;
      used.add(matched);
    } else {
      map.extras.push({ name: text, col });
    }
  });
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

function countRecognized(row: any[], cm: ColMap): number {
  let n = 0;
  DATA_FIELDS.forEach((f) => {
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

  const no = get('no');
  if (no != null && norm(no) !== '') item.no = typeof no === 'number' ? no : norm(no);
  if (type) item.type = type;

  const serial = norm(get('serial'));
  if (serial) item.serial = serial;
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
    items.push({ id: uid('fa'), category, type: label, expiry, updatedAt: Date.now() });
  }
  return items;
}

/** Map a single sheet's rows to equipment items. */
export function mapSheet(category: CategoryKey, rows: any[][]): EquipmentItem[] {
  if (category === 'first_aid') return mapFirstAid(category, rows);

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

    const item = rowToItem(row, cm, category, lastType);
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
}

/** Parse a base64-encoded .xlsx into items grouped by category. */
export function parseWorkbookBase64(base64: string): ImportPreview {
  const wb = XLSX.read(base64, { type: 'base64' });
  return buildPreview(wb);
}

function buildPreview(wb: XLSX.WorkBook): ImportPreview {
  const byCategory: Partial<Record<CategoryKey, EquipmentItem[]>> = {};
  const counts: ImportPreview['counts'] = [];
  const missingSheets: string[] = [];
  let total = 0;

  // Tolerant sheet lookup (trim + case-insensitive).
  const sheetIndex = new Map<string, string>();
  wb.SheetNames.forEach((n) => sheetIndex.set(n.trim().toLowerCase(), n));

  for (const meta of CATEGORIES) {
    const realName = sheetIndex.get(meta.sheet.trim().toLowerCase());
    if (!realName) {
      missingSheets.push(meta.sheet);
      counts.push({ category: meta.key, label: meta.label, count: 0 });
      continue;
    }
    const ws = wb.Sheets[realName];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: null });
    const items = mapSheet(meta.key, rows);
    byCategory[meta.key] = items;
    counts.push({ category: meta.key, label: meta.label, count: items.length });
    total += items.length;
  }

  return { byCategory, counts, total, missingSheets };
}
