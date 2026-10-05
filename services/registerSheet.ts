// ===================================
// The register as worksheet rows — shared by the XLSX export and the checks.
//
// Pure on purpose (no Expo, no React Native): the exported workbook is also how a
// vessel sends its register BACK in ("Update from Excel"), so the exact rows it
// writes are part of the import contract, and scripts/check-register-update.ts
// has to be able to build them without a phone.
// ===================================

import { CategoryKey, EquipmentItem } from '../types/equipment';
import { complianceDate, computeStatus, formatDate } from '../utils/dates';

const STATUS_LABEL: Record<string, string> = {
  expired: 'EXPIRED',
  due: 'DUE SOON',
  ok: 'OK',
  none: '—',
};

/**
 * The column that makes a re-import an UPDATE rather than a second copy.
 *
 * It carries the item's own id — the same id its QR label encodes — so a row
 * edited in Excel finds its item again whatever else in the row was changed.
 * The importer recognises the heading exactly (excelImport EXACT_PATTERNS); do
 * not rename it without renaming it there.
 */
export const MSM_ID_HEADING = 'MSM ID';

/**
 * Column headings, in order. "Due" is the category's own compliance date (expiry
 * or next inspection) and "Status" is computed — the importer knows both when it
 * sees this layout, see `ourExportLayout` in excelImport.
 */
export const REGISTER_HEADINGS = [
  'No', 'Type', 'Make', 'Size', 'Serial', 'Deck', 'Location', 'Qty', 'Persons', 'Manufacture', 'Due', 'Status',
  'Comments', MSM_ID_HEADING,
];

/** One worksheet's rows: vessel header block, blank line, headings, items. */
export function registerSheetRows(items: EquipmentItem[], header: string, generated: string): any[][] {
  return [
    // Vessel header block (kept above the real column header so re-import still
    // detects the header row — these rows classify as data, not headers).
    [header],
    [`Generated ${generated}`],
    [],
    // Deck and Location stay separate here (unlike the PDF): this sheet is also
    // how a register goes back in, and the importer maps each to its own field.
    REGISTER_HEADINGS,
    ...items.map((it) => {
      const due = complianceDate(it);
      return [
        it.no ?? '',
        it.type ?? '',
        it.make ?? '',
        it.size ?? '',
        it.serial ?? '',
        it.deck ?? '',
        it.position ?? '',
        it.quantity ?? '',
        it.persons ?? '',
        it.manufactureDate ? formatDate(it.manufactureDate) : '',
        due ? formatDate(due) : '',
        STATUS_LABEL[computeStatus(it)],
        it.remarks ?? '',
        it.id,
      ];
    }),
  ];
}

// Categories whose register tracks rated persons as well as a quantity.
const PERSONS_CATS = new Set<CategoryKey>([
  'liferafts', 'lifejackets', 'immersion_suits', 'inflatable_lifejackets',
]);

/**
 * The blank template's headings for an LSA / FFE / Other category.
 *
 * The vessel's own list reads "# · Deck · Location · Description · Make · Type ·
 * Size · Serial" — so does the template, and every heading maps back on import.
 *
 * BOTH dates and a Quantity on every sheet (3 Oct 2026). The template used to
 * offer only the date its category is judged by, and Persons INSTEAD of a
 * quantity, so the Liferafts sheet had nowhere to write an HRU's expiry or how
 * many there are — and the same goes for anything whose own component runs out
 * on a date of its own (a lifebuoy light, a battery) beside the item's service.
 * A row with only an Expiry is judged by it; `complianceDate` falls back.
 */
export function templateHeadings(category: CategoryKey): string[] {
  const cols = ['No', 'Type', 'Make', 'Size', 'Serial', 'Deck', 'Location'];
  if (PERSONS_CATS.has(category)) cols.push('Persons');
  cols.push('Quantity', 'Manufacture Date', 'Next Inspection', 'Expiry', 'Comments');
  return cols;
}
