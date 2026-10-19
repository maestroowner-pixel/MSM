// ===================================
// Galley orders — helpers, XLSX export, basic + AI XLSX import.
// ===================================

import { Platform } from 'react-native';
import { GALLEY_GROUPS, GalleyGroup, GalleyLine, GalleyOrder } from '../types/galley';
import { uid } from '../utils/id';
import { aiCall, maskCell } from './ai';
import { headingRow } from './aiImport';

// Field descriptions sent to the AI for column mapping.
const GALLEY_AI_FIELDS = [
  'name — the product name or description',
  'pack — pack size or unit (e.g. "20 kg bag", "6L bottle", "case of 12")',
  'stock — current stock quantity on board',
  'orderQty — quantity to order / requested quantity',
  'price — unit price',
  'group — product category (Meat, Fish & Seafood, Dairy, Dry Goods, etc.)',
  'notes — any notes or remarks',
];

const GALLEY_FIELD_KEYS = ['name', 'pack', 'stock', 'orderqty', 'price', 'group', 'notes'] as const;
type GalleyColKey = typeof GALLEY_FIELD_KEYS[number];

function canonGalleyField(said: string): GalleyColKey | undefined {
  const s = String(said ?? '').split(' — ')[0].trim().toLowerCase().replace(/\s+/g, '');
  return GALLEY_FIELD_KEYS.find((k) => k === s || k.startsWith(s) || s.startsWith(k));
}

export const GALLEY_ORDERS_KEY = 'msm:galley_orders';

/** Next galley order number: GO-001-2026. */
export function nextGalleyNo(existing: GalleyOrder[], year = new Date().getFullYear()): string {
  const prefix = 'GO-';
  const suffix = `-${year}`;
  const nums = existing
    .map((o) => o.no)
    .filter((n) => n.startsWith(prefix) && n.endsWith(suffix))
    .map((n) => parseInt(n.slice(prefix.length, n.length - suffix.length), 10))
    .filter((n) => Number.isFinite(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}${suffix}`;
}

/** Total order value: sum of orderQty × price for lines that have a price. */
export function galleyTotal(order: GalleyOrder): number {
  return order.lines.reduce((s, l) => s + (l.orderQty > 0 && l.price ? l.orderQty * l.price : 0), 0);
}

/** Group lines into an ordered map by group name. */
export function groupLines(lines: GalleyLine[]): { group: string; lines: GalleyLine[] }[] {
  const map = new Map<string, GalleyLine[]>();
  for (const l of lines) {
    const g = l.group || 'Other';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(l);
  }
  // Sort groups by GALLEY_GROUPS order, extras at the end
  const knownOrder = GALLEY_GROUPS as readonly string[];
  const groups = [...map.keys()].sort((a, b) => {
    const ai = knownOrder.indexOf(a);
    const bi = knownOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return groups.map((g) => ({ group: g, lines: map.get(g)! }));
}

/** Export galley order as XLSX (grouped). Web uses blob download, native uses sharing. */
export async function exportGalleyXlsx(order: GalleyOrder): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const currency = order.lines.find((l) => l.currency)?.currency ?? '€';
  const grouped = groupLines(order.lines);

  // One sheet: header, then group sections separated by bold group header rows
  const rows: any[][] = [
    [`Galley Order ${order.no}`, '', '', '', '', '', ''],
    [`Date: ${order.date}`, '', '', '', '', '', ''],
    [`Total: ${currency} ${galleyTotal(order).toFixed(2)}`, '', '', '', '', '', ''],
    [''],
    ['Product', 'Pack', 'Stock', 'Order', `Price (${currency})`, `Total (${currency})`, 'Notes'],
  ];

  for (const { group, lines } of grouped) {
    rows.push([group, '', '', '', '', '', '']);
    for (const l of lines) {
      const lineTotal = l.price && l.orderQty > 0 ? (l.orderQty * l.price).toFixed(2) : '';
      rows.push([
        l.name,
        l.pack ?? '',
        l.stock,
        l.orderQty || '',
        l.price != null ? l.price : '',
        lineTotal,
        l.notes ?? '',
      ]);
    }
    rows.push(['']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Galley Order');

  const fileName = `${order.no}_galley_order.xlsx`;

  if (Platform.OS === 'web') {
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const FS = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    const buf: string = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const path = `${FS.cacheDirectory ?? ''}${fileName}`;
    await FS.writeAsStringAsync(path, buf, { encoding: FS.EncodingType.Base64 });
    await Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'com.microsoft.excel.xlsx' });
  }
}

/**
 * Parse a galley XLSX file — basic column-detection import.
 * Returns GalleyLine[] ready to add to a new order.
 * Tries to detect group header rows (non-data rows with a name but no numbers).
 */
export async function importGalleyXlsx(fileUri: string): Promise<{ lines: GalleyLine[]; warnings: string[] }> {
  const XLSX = await import('xlsx');
  const FS = await import('expo-file-system/legacy');
  const base64 = await FS.readAsStringAsync(fileUri, { encoding: FS.EncodingType.Base64 });
  const wb = XLSX.read(base64, { type: 'base64' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const lines: GalleyLine[] = [];
  const warnings: string[] = [];
  let currentGroup: string = 'Other';

  // Detect column indices from header row
  let nameCol = 0, packCol = -1, stockCol = -1, orderCol = -1, priceCol = -1;
  let headerFound = false;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] as any[];
    if (!row || !row.length) continue;
    const cells = row.map((c: any) => String(c ?? '').toLowerCase().trim());
    const hasName = cells.some((c) => c.includes('name') || c.includes('product') || c.includes('item') || c.includes('description'));
    if (hasName) {
      headerFound = true;
      nameCol = cells.findIndex((c) => c.includes('name') || c.includes('product') || c.includes('item') || c.includes('description'));
      packCol = cells.findIndex((c) => c.includes('pack') || c.includes('unit') || c.includes('size'));
      stockCol = cells.findIndex((c) => c.includes('stock') || c.includes('on board') || c.includes('balance') || c.includes('remain'));
      orderCol = cells.findIndex((c) => c.includes('order') || c.includes('req') || c.includes('qty'));
      priceCol = cells.findIndex((c) => c.includes('price') || c.includes('cost') || c.includes('rate'));
      continue;
    }
    if (!headerFound) continue;
    if (!row[0] && !row[nameCol]) continue;

    const rawName = String(row[nameCol] ?? row[0] ?? '').trim();
    if (!rawName) continue;

    // Group header detection: non-empty first cell, all other numeric cells empty
    const numericCols = [stockCol, orderCol, priceCol].filter((c) => c >= 0);
    const hasAnyNumber = numericCols.some((c) => {
      const v = row[c];
      return v != null && v !== '' && !isNaN(Number(v));
    });

    if (!hasAnyNumber && rawName.length < 50) {
      // Might be a group header — check against known groups or just use it
      const matched = GALLEY_GROUPS.find((g) => rawName.toLowerCase().includes(g.toLowerCase().split(' ')[0]));
      currentGroup = matched ?? rawName;
      continue;
    }

    const stock = stockCol >= 0 ? Number(row[stockCol]) || 0 : 0;
    const orderQty = orderCol >= 0 ? Number(row[orderCol]) || 0 : 0;
    const price = priceCol >= 0 && row[priceCol] != null && row[priceCol] !== '' ? Number(row[priceCol]) || undefined : undefined;
    const pack = packCol >= 0 ? String(row[packCol] ?? '').trim() : undefined;

    lines.push({
      id: uid('gl'),
      group: currentGroup,
      name: rawName,
      pack: pack || undefined,
      stock,
      orderQty,
      price,
    });
  }

  if (!lines.length) {
    warnings.push('No product lines found. Check that the file has columns: Product, Stock, Order Qty.');
  }

  return { lines, warnings };
}

/**
 * AI-powered galley XLSX import.
 * Sends only column headers + 4 masked sample rows to the AI for column mapping.
 * Parses all 900+ product rows locally using the returned mapping.
 * Falls back to basic import if AI is unavailable.
 */
export async function importGalleyXlsxAI(fileUri: string): Promise<{
  lines: GalleyLine[];
  warnings: string[];
  groupCount: number;
}> {
  const XLSX = await import('xlsx');
  const FS = await import('expo-file-system/legacy');

  const base64 = await FS.readAsStringAsync(fileUri, { encoding: FS.EncodingType.Base64 });
  const wb = XLSX.read(base64, { type: 'base64' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (!rows.length) return { lines: [], warnings: ['Empty file.'], groupCount: 0 };

  const warnings: string[] = [];
  const h = headingRow(rows);
  const headers = (rows[h] ?? []).map((c) => String(c ?? '').trim());

  // Only headers + 4 masked rows go to the AI — no product data leaves the device.
  const samples = rows
    .slice(h + 1)
    .filter((r) => ((r ?? []) as unknown[]).filter((c) => String(c ?? '').trim()).length >= 2)
    .slice(0, 4)
    .map((r) => headers.map((_, i) => maskCell(((r ?? []) as unknown[])[i])));

  let colFor: Partial<Record<GalleyColKey, number>> = {};
  try {
    const res = await aiCall<{ mapping?: Record<string, string | null> }>('map', {
      target: 'galley',
      fields: GALLEY_AI_FIELDS,
      headers,
      samples,
    });
    for (const [idx, field] of Object.entries(res.mapping ?? {})) {
      const i = Number(idx);
      const key = field ? canonGalleyField(field) : undefined;
      if (key && i >= 0 && i < headers.length && !(key in colFor)) {
        colFor[key] = i;
      }
    }
  } catch (e: any) {
    warnings.push(`AI mapping failed: ${e?.message ?? 'error'}. Using basic column detection.`);
    const basic = await importGalleyXlsx(fileUri);
    return { ...basic, groupCount: groupLines(basic.lines).length };
  }

  if (!('name' in colFor)) {
    warnings.push('AI could not find the product name column. Using basic column detection.');
    const basic = await importGalleyXlsx(fileUri);
    return { ...basic, groupCount: groupLines(basic.lines).length };
  }

  const lines: GalleyLine[] = [];
  let currentGroup = 'Other';

  for (let i = h + 1; i < rows.length; i++) {
    const row = (rows[i] ?? []) as unknown[];
    const rawName = colFor.name !== undefined ? String(row[colFor.name] ?? '').trim() : '';
    if (!rawName) continue;

    // Detect group header rows: text but no numbers in any numeric column
    const numCols = (['stock', 'orderqty', 'price'] as GalleyColKey[])
      .map((k) => colFor[k])
      .filter((c): c is number => c !== undefined);
    const hasNumber = numCols.some((c) => {
      const v = row[c];
      return v != null && v !== '' && !isNaN(Number(v));
    });

    if (!hasNumber && rawName.length < 60) {
      const matched = GALLEY_GROUPS.find((g) =>
        rawName.toLowerCase().includes(g.toLowerCase().split(/\s/)[0]) ||
        g.toLowerCase().startsWith(rawName.toLowerCase().slice(0, 4))
      );
      currentGroup = matched ?? rawName;
      continue;
    }

    const groupColVal = colFor.group !== undefined ? String(row[colFor.group] ?? '').trim() : '';
    const group = groupColVal
      ? (GALLEY_GROUPS.find((g) => g.toLowerCase() === groupColVal.toLowerCase()) ?? groupColVal)
      : currentGroup;

    const stock = colFor.stock !== undefined ? Number(row[colFor.stock]) || 0 : 0;
    const orderQty = colFor.orderqty !== undefined ? Number(row[colFor.orderqty]) || 0 : 0;
    const priceRaw = colFor.price !== undefined ? row[colFor.price] : undefined;
    const price = priceRaw != null && priceRaw !== '' ? Number(priceRaw) || undefined : undefined;
    const pack = colFor.pack !== undefined ? String(row[colFor.pack] ?? '').trim() || undefined : undefined;
    const notes = colFor.notes !== undefined ? String(row[colFor.notes] ?? '').trim() || undefined : undefined;

    lines.push({ id: uid('gl'), group, name: rawName, pack, stock, orderQty, price, notes });
  }

  if (!lines.length) {
    warnings.push('No products found. Check the file has a header row with product names.');
  }

  return { lines, warnings, groupCount: groupLines(lines).length };
}

/** Default empty line for adding to a group. */
export function emptyGalleyLine(group: GalleyGroup | string): GalleyLine {
  return { id: uid('gl'), group, name: '', stock: 0, orderQty: 0 };
}
