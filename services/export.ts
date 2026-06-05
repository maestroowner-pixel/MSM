// ===================================
// Export service
// PDF (expo-print) and XLSX (SheetJS) generation + share (expo-sharing).
// ===================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { CATEGORIES, CATEGORY_MAP } from '../constants/categories';
import { complianceDate, computeStatus, formatDate } from '../utils/dates';
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
  const parts = [vessel.vessel_name, vessel.imo ? `IMO ${vessel.imo}` : null, vessel.flag].filter(Boolean);
  return parts.join(' · ') || 'Marine Safety Manager';
}

/** Build the set of categories to include (single category or all non-empty). */
function selectedCategories(
  byCategory: Record<CategoryKey, EquipmentItem[]>,
  only?: CategoryKey
): Array<{ key: CategoryKey; label: string; items: EquipmentItem[] }> {
  const cats = only ? CATEGORIES.filter((c) => c.key === only) : CATEGORIES;
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
            <td>${r.no}</td>
            <td>${esc(r.type)}</td>
            <td>${esc(r.serial)}</td>
            <td>${esc(r.position)}</td>
            <td>${r.mfg}</td>
            <td>${r.due}</td>
            <td style="color:${STATUS_HEX[r.status]};font-weight:bold">${STATUS_LABEL[r.status]}</td>
            <td>${esc(r.remarks)}</td>
          </tr>`
        )
        .join('');
      return `<h2>${CATEGORY_MAP[g.key].emoji} ${esc(g.label)} <span class="count">(${g.items.length})</span></h2>
        <table>
          <thead><tr>
            <th>No</th><th>Type</th><th>Serial</th><th>Position</th><th>Mfg</th><th>Due</th><th>Status</th><th>Remarks</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2C3E50; padding: 24px; }
      h1 { color: #1F5670; margin-bottom: 2px; }
      .meta { color: #7F8C8D; font-size: 12px; margin-bottom: 18px; }
      h2 { color: #2E7D99; font-size: 15px; margin: 18px 0 6px; }
      .count { color: #7F8C8D; font-weight: normal; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #E0E6ED; padding: 4px 6px; text-align: left; }
      th { background: #DAEEF7; }
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
  only?: CategoryKey
): Promise<void> {
  const groups = selectedCategories(byCategory, only);
  if (!groups.length) throw new Error('No items to export.');
  const title = only ? CATEGORY_MAP[only].label : 'Safety Equipment Register';
  const html = buildHtml(groups, vessel, title);
  const { uri } = await Print.printToFileAsync({ html });
  await share(uri, 'application/pdf', title);
}

export async function exportXlsx(
  byCategory: Record<CategoryKey, EquipmentItem[]>,
  vessel: VesselInfo | null,
  only?: CategoryKey
): Promise<void> {
  const groups = selectedCategories(byCategory, only);
  if (!groups.length) throw new Error('No items to export.');
  const wb = XLSX.utils.book_new();
  for (const g of groups) {
    const aoa = [
      ['No', 'Type', 'Serial', 'Position', 'Qty', 'Manufacture', 'Due', 'Status', 'Remarks'],
      ...rowsFor(g.items).map((r) => [
        r.no, r.type, r.serial, r.position, r.qty, r.mfg, r.due, STATUS_LABEL[r.status], r.remarks,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(g.label));
  }
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileName = `${only ? CATEGORY_MAP[only].short : 'Safety_Register'}_${Date.now()}.xlsx`;
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
  await share(uri, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName);
}

function sheetName(label: string): string {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  return label.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
}

async function share(uri: string, mimeType: string, title: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
  }
}
