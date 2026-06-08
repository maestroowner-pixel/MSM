// ===================================
// Export service
// PDF (expo-print) and XLSX (SheetJS) generation + share (expo-sharing).
// ===================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CATEGORIES, CATEGORY_MAP, CategoryMeta } from '../constants/categories';
import { complianceDate, computeStatus, formatDate, fileDateStamp } from '../utils/dates';
import { deliverFile, onWindows } from '../utils/fileShare';
import { VesselInfo } from './storage';

const STATUS_LABEL: Record<string, string> = {
  expired: 'EXPIRED',
  due: 'DUE SOON',
  ok: 'OK',
  none: '—',
};
const STATUS_HEX: Record<string, string> = {
  expired: '#E74C3C',
  due: '#F39C12',
  ok: '#27AE60',
  none: '#7F8C8D',
};

function rowsFor(items: EquipmentItem[]) {
  return items.map((it) => {
    const status = computeStatus(it);
    return {
      no: it.no ?? '',
      type: it.type ?? '',
      serial: it.serial ?? '',
      position: it.position ?? '',
      qty: it.quantity ?? '',
      mfg: it.manufactureDate ? formatDate(it.manufactureDate) : '',
      due: complianceDate(it) ? formatDate(complianceDate(it)) : '',
      status,
      remarks: it.remarks ?? '',
    };
  });
}

function vesselHeader(vessel: VesselInfo | null): string {
  if (!vessel) return 'Marine Safety Manager';
  const parts = [
    vessel.vessel_name,
    vessel.imo ? `IMO ${vessel.imo}` : null,
    vessel.flag,
    vessel.call_sign ? `Call sign ${vessel.call_sign}` : null,
    vessel.mmsi ? `MMSI ${vessel.mmsi}` : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'Marine Safety Manager';
}

/** Build the set of categories to include (a selection, or all when omitted). */
function selectedCategories(
  byCategory: Record<CategoryKey, EquipmentItem[]>,
  only?: CategoryKey[]
): Array<{ key: CategoryKey; label: string; items: EquipmentItem[] }> {
  const pick = only && only.length ? new Set(only) : null;
  const cats = pick ? CATEGORIES.filter((c) => pick.has(c.key)) : CATEGORIES;
  return cats
    .map((c) => ({ key: c.key, label: c.label, items: byCategory[c.key] ?? [] }))
    .filter((c) => c.items.length > 0);
}

function buildHtml(
  groups: Array<{ key: CategoryKey; label: string; items: EquipmentItem[] }>,
  vessel: VesselInfo | null,
  title: string
): string {
  const today = formatDate(new Date().toISOString().slice(0, 10));
  const sections = groups
    .map((g) => {
      const body = rowsFor(g.items)
        .map(
          (r) => `<tr>
            <td class="n">${r.no}</td>
            <td>${esc(r.type)}</td>
            <td>${esc(r.serial)}</td>
            <td>${esc(r.position)}</td>
            <td>${r.mfg}</td>
            <td>${r.due}</td>
            <td class="st" style="color:${STATUS_HEX[r.status]};font-weight:bold">${STATUS_LABEL[r.status]}</td>
            <td class="rm">${esc(r.remarks)}</td>
          </tr>`
        )
        .join('');
      return `<h2>${CATEGORY_MAP[g.key].emoji} ${esc(g.label)} <span class="count">(${g.items.length})</span></h2>
        <table>
          <thead><tr>
            <th class="n">No</th><th>Type</th><th>Serial</th><th>Position</th><th>Mfg</th><th>Due</th><th>Status</th><th class="rm">Remarks</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      /* Landscape gives each row room to stay on a single line. */
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2C3E50; }
      h1 { color: #1F5670; margin-bottom: 2px; font-size: 18px; }
      .meta { color: #7F8C8D; font-size: 11px; margin-bottom: 14px; }
      h2 { color: #2E7D99; font-size: 13px; margin: 14px 0 5px; }
      .count { color: #7F8C8D; font-weight: normal; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: auto; }
      th, td {
        border: 1px solid #E0E6ED; padding: 3px 5px; text-align: left;
        vertical-align: top; white-space: nowrap; /* keep each cell on one line */
      }
      th { background: #DAEEF7; }
      td.n, th.n { text-align: right; }
      /* Remarks can be long — allow it (only it) to wrap so the rest stays tight. */
      td.rm, th.rm { white-space: normal; word-break: break-word; }
    </style></head>
    <body>
      <h1>${esc(title)}</h1>
      <div class="meta">${esc(vesselHeader(vessel))} — generated ${today}</div>
      ${sections}
    </body></html>`;
}

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function exportPdf(
  byCategory: Record<CategoryKey, EquipmentItem[]>,
  vessel: VesselInfo | null,
  only?: CategoryKey[]
): Promise<void> {
  if (onWindows) throw new Error('PDF export is not available on Windows — use XLSX or a .msm backup.');
  const groups = selectedCategories(byCategory, only);
  if (!groups.length) throw new Error('No items to export.');
  const title = only && only.length === 1 ? CATEGORY_MAP[only[0]].label : 'Safety Equipment Register';
  const html = buildHtml(groups, vessel, title);
  const { uri } = await Print.printToFileAsync({ html });
  // printToFileAsync names the file with a random id — copy it to a friendly name.
  const fileName = `MSM_report_${fileDateStamp()}.pdf`;
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName); // fallback to the temp file
  }
}

/** Open the native print dialog (AirPrint / Android print) for the selection. */
export async function printReport(
  byCategory: Record<CategoryKey, EquipmentItem[]>,
  vessel: VesselInfo | null,
  only?: CategoryKey[]
): Promise<void> {
  if (onWindows) throw new Error('Printing is not available on Windows.');
  const groups = selectedCategories(byCategory, only);
  if (!groups.length) throw new Error('No items to print.');
  const title = only && only.length === 1 ? CATEGORY_MAP[only[0]].label : 'Safety Equipment Register';
  const html = buildHtml(groups, vessel, title);
  await Print.printAsync({ html });
}

export async function exportXlsx(
  byCategory: Record<CategoryKey, EquipmentItem[]>,
  vessel: VesselInfo | null,
  only?: CategoryKey[]
): Promise<void> {
  const groups = selectedCategories(byCategory, only);
  if (!groups.length) throw new Error('No items to export.');
  const today = formatDate(new Date().toISOString().slice(0, 10));
  const header = vesselHeader(vessel);
  const wb = XLSX.utils.book_new();
  for (const g of groups) {
    const aoa = [
      // Vessel header block (kept above the real column header so re-import still
      // detects the header row — these rows classify as data, not headers).
      [header],
      [`Generated ${today}`],
      [],
      ['No', 'Type', 'Serial', 'Position', 'Qty', 'Manufacture', 'Due', 'Status', 'Remarks'],
      ...rowsFor(g.items).map((r) => [
        r.no, r.type, r.serial, r.position, r.qty, r.mfg, r.due, STATUS_LABEL[r.status], r.remarks,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(g.label));
  }
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileName = `MSM_report_${fileDateStamp()}.xlsx`;
  await deliverFile(fileName, b64, true, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Short human label for an item, used in the ZIP manifest. */
function itemLabel(categoryLabel: string, it: EquipmentItem): string {
  const id = [it.type, it.serial && `S/N ${it.serial}`, it.position, it.no != null ? `#${it.no}` : null]
    .filter(Boolean)
    .join(' · ');
  return `${categoryLabel} — ${id || 'item'}`;
}

/**
 * Export a ZIP archive bundling the PDF register of the selected categories,
 * every photo/document attached to those items, AND the certificate files that
 * cover them — with a manifest mapping each certificate to its items, so after
 * extracting/uploading the archive the certificates sit in place against the
 * right items. Shared as MSM_backup_DDMMYY.zip.
 */
export async function exportZip(
  byCategory: Record<CategoryKey, EquipmentItem[]>,
  vessel: VesselInfo | null,
  certificates: Certificate[],
  only?: CategoryKey[]
): Promise<{ files: number; certificates: number }> {
  if (onWindows) throw new Error('ZIP export is not available on Windows — use XLSX or a .msm backup.');
  const groups = selectedCategories(byCategory, only);
  if (!groups.length) throw new Error('No items to export.');

  // 1) PDF report.
  const title = only && only.length === 1 ? CATEGORY_MAP[only[0]].label : 'Safety Equipment Register';
  const html = buildHtml(groups, vessel, title);
  const { uri: pdfUri } = await Print.printToFileAsync({ html });
  const pdfB64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: 'base64' });

  const zip = new JSZip();
  zip.file('Safety_Register.pdf', pdfB64, { base64: true });

  // In-scope items: id -> label (so certificates can be tied back to them).
  const itemLabels = new Map<string, string>();
  for (const g of groups) {
    const label = CATEGORY_MAP[g.key].label;
    for (const it of g.items) itemLabels.set(it.id, itemLabel(label, it));
  }

  // 2) Attached photos/documents of the selected items.
  const photos = zip.folder('photos');
  const usedNames = new Set<string>();
  let fileCount = 0;
  for (const g of groups) {
    for (const it of g.items) {
      for (const att of it.attachments ?? []) {
        try {
          const info = await FileSystem.getInfoAsync(att.uri);
          if (!info.exists) continue;
          const b64 = await FileSystem.readAsStringAsync(att.uri, { encoding: 'base64' });
          photos?.file(zipEntryName(g.key, it, att.name, att.uri, usedNames), b64, { base64: true });
          fileCount++;
        } catch {
          /* skip unreadable attachment */
        }
      }
    }
  }

  // 3) Certificates covering the selected items — files + a linkage manifest.
  const certFolder = zip.folder('certificates');
  const certNames = new Set<string>();
  const manifest: string[] = [];
  let certCount = 0;
  for (const cert of certificates) {
    const covered = cert.itemIds.filter((id) => itemLabels.has(id));
    if (!covered.length) continue; // only certificates that cover in-scope items

    let storedAs = '(no file attached)';
    if (cert.fileUri) {
      try {
        const info = await FileSystem.getInfoAsync(cert.fileUri);
        if (info.exists) {
          const b64 = await FileSystem.readAsStringAsync(cert.fileUri, { encoding: 'base64' });
          storedAs = `certificates/${certEntryName(cert, certNames)}`;
          certFolder?.file(storedAs.replace('certificates/', ''), b64, { base64: true });
        }
      } catch {
        /* keep manifest entry even if the file can't be read */
      }
    }

    certCount++;
    manifest.push(
      `Certificate: ${cert.name || 'Certificate'}` +
        (cert.number ? ` (No. ${cert.number})` : '') +
        (cert.expiryDate ? ` — expires ${formatDate(cert.expiryDate)}` : '') +
        `\n  File: ${storedAs}` +
        `\n  Covers ${covered.length} item${covered.length === 1 ? '' : 's'}:` +
        covered.map((id) => `\n    - ${itemLabels.get(id)}`).join('') +
        '\n'
    );
  }
  if (manifest.length) {
    zip.file(
      'certificates/INDEX.txt',
      `Certificates in this archive and the items they cover\n` +
        `Generated ${formatDate(new Date().toISOString().slice(0, 10))}\n\n` +
        manifest.join('\n')
    );
  }

  const zipB64 = await zip.generateAsync({ type: 'base64' });
  const fileName = `MSM_backup_${fileDateStamp()}.zip`;
  const outUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(outUri, zipB64, { encoding: 'base64' });
  await share(outUri, 'application/zip', fileName);
  return { files: fileCount, certificates: certCount };
}

/** A readable, unique zip entry name: <category>_<item>_<n>.<ext>. */
function zipEntryName(
  cat: CategoryKey,
  item: EquipmentItem,
  attName: string | undefined,
  uri: string,
  used: Set<string>
): string {
  const extMatch = (attName || uri).match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
  const id = (item.serial || item.type || String(item.no ?? '') || 'item')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  let base = `${cat}_${id || 'item'}`;
  let name = `${base}.${ext}`;
  let n = 2;
  while (used.has(name)) name = `${base}_${n++}.${ext}`;
  used.add(name);
  return name;
}

/** A readable, unique certificate file name within the zip's certificates/ folder. */
function certEntryName(cert: Certificate, used: Set<string>): string {
  const extMatch = (cert.fileName || cert.fileUri || '').match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : (cert.fileKind === 'photo' ? 'jpg' : 'pdf');
  const namePart = [cert.name, cert.number]
    .filter(Boolean)
    .join('_')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  let base = namePart || 'certificate';
  let name = `${base}.${ext}`;
  let n = 2;
  while (used.has(name)) name = `${base}_${n++}.${ext}`;
  used.add(name);
  return name;
}

function sheetName(label: string): string {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  return label.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
}

// ===================================
// Blank import template
// One sheet per category, named to match the importer's sheet lookup, with a
// header row whose column names match excelImport's FIELD_PATTERNS so a
// filled-in copy re-imports cleanly. Dates accept ISO (YYYY-MM-DD), DD/MM/YYYY
// or an Excel date cell.
// ===================================

// Categories whose register tracks rated persons rather than a quantity.
const PERSONS_CATS = new Set<CategoryKey>([
  'liferafts', 'lifejackets', 'immersion_suits', 'inflatable_lifejackets',
]);

function templateColumns(meta: CategoryMeta): string[] {
  const cols = ['No', 'Type', 'Serial', 'Position'];
  cols.push(PERSONS_CATS.has(meta.key) ? 'Persons' : 'Quantity');
  cols.push('Manufacture Date');
  cols.push(meta.dateField === 'nextInspection' ? 'Next Inspection' : 'Expiry');
  cols.push('Remarks');
  return cols;
}

/** Build and share a blank .xlsx import template (one sheet per category). */
export async function exportTemplate(): Promise<void> {
  const wb = XLSX.utils.book_new();
  for (const meta of CATEGORIES) {
    // First Aid has no header row in the importer — label in col A, expiry date.
    const cols =
      meta.key === 'first_aid' ? ['Location', 'Expiry'] : templateColumns(meta);
    const ws = XLSX.utils.aoa_to_sheet([cols]);
    ws['!cols'] = cols.map((c) => ({ wch: Math.max(12, c.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName(meta.sheet.trim()));
  }
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileName = `MSM_Import_Template.xlsx`;
  await deliverFile(fileName, b64, true, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

async function share(uri: string, mimeType: string, title: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
  }
}
