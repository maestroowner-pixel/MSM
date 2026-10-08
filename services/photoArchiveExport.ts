// ===================================
// Building one month's photo archive — the file the vessel keeps.
//
// This is the half of services/photoArchive.ts that touches bytes: it gathers
// every photograph signed in a month, from wherever that photograph currently
// is, and hands back a ZIP.
//
// WHERE A PHOTO COMES FROM, in order: the local original (the device that took
// it), the copy already fetched into `attachments/`, then Cloud Storage. That is
// exactly `ensureLocalPhoto`, so the archive is built from the same path the
// screens display — a photo that shows on screen is a photo that lands in the
// ZIP, with no second way for it to go missing.
//
// **A MISSING PHOTO DOES NOT FAIL THE ARCHIVE, IT IS RECORDED IN IT.** A month
// where three files are unreachable — never uploaded from a phone that has since
// been wiped, say — must still produce an archive of the other two hundred, and
// must say plainly which three are not there. An all-or-nothing export would
// mean one dead file keeps a vessel from ever archiving anything, and a sweep
// gated on archiving would then never run. `index.csv` carries a Status column
// and `missing` comes back in the result, so the confirmation can say it.
//
// The ZIP is built in memory: a month of downscaled photos is tens of megabytes,
// which is why the archive is per month and not per year (see photoArchive.ts).
// ===================================

import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';

import { deliverFile, onWindows } from '../utils/fileShare';
import { CATEGORY_MAP } from '../constants/categories';
import { EquipmentItem } from '../types/equipment';
import { Inspection, PERIOD_LABEL } from '../types/inspection';
import { VesselInfo } from './storage';
import { ensureLocalPhoto } from './photoStorage';
import { ArchiveMonth, archiveFileName, photosInMonth } from './photoArchive';

export interface ArchiveProgress {
  done: number;
  total: number;
}

export interface ArchiveResult {
  fileName: string;
  photos: number;
  /** Photos that could not be read from anywhere — listed in the manifest. */
  missing: number;
  inspections: number;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function stamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function dateTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Safe in a file name on every platform, and still readable. */
function slug(s: string | undefined, fallback: string): string {
  const out = (s ?? '').replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
  return out || fallback;
}

function itemName(item?: EquipmentItem): string {
  if (!item) return 'Item no longer in register';
  return item.type || (item.serial ? `S/N ${item.serial}` : '') || (item.no != null ? `No. ${item.no}` : '') || '—';
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Read one photograph as base64, from wherever it is. Returns null when it is
 * nowhere — see the header: that is a row in the manifest, not an exception.
 */
async function readPhoto(vessel: string, insp: Inspection, photoId: string, uri: string): Promise<string | null> {
  try {
    const local = await ensureLocalPhoto(vessel, insp.id, { id: photoId, kind: 'photo', uri, addedAt: insp.at });
    if (!local) return null;
    // On the web a photo is a base64 `data:` URI already (attachments.web.ts has
    // no files directory), and expo-file-system cannot read it — nor does it
    // need to.
    if (local.startsWith('data:')) return local.slice(local.indexOf(',') + 1);
    const info = await FileSystem.getInfoAsync(local);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(local, { encoding: 'base64' });
  } catch {
    return null;
  }
}

/**
 * Build and deliver the month's archive.
 *
 * `onProgress` is called per photograph because this is a long job over a ship's
 * connection — fetching two hundred files that are only in the cloud is minutes,
 * and a screen that says nothing for minutes is a screen people force-quit.
 */
export async function exportMonthArchive(
  month: ArchiveMonth,
  trail: Inspection[],
  flat: EquipmentItem[],
  vessel: VesselInfo | null,
  onProgress?: (p: ArchiveProgress) => void
): Promise<ArchiveResult> {
  if (onWindows) throw new Error('The photo archive is not available on Windows — use the web app.');

  const imo = (vessel?.imo ?? '').replace(/\D/g, '');
  if (!imo) throw new Error('Set the vessel IMO first — the archive is filed under it.');

  const records = photosInMonth(trail, month.from, month.to);
  const byId = new Map(flat.map((i) => [i.id, i]));

  const zip = new JSZip();
  const folder = zip.folder(`photos_${month.key}`);
  const rows: string[] = [
    ['Date', 'Time', 'Category', 'Item', 'Serial', 'Position', 'Round', 'Outcome', 'Signed by', 'File', 'Status']
      .map(csvCell)
      .join(','),
  ];

  const total = records.reduce((n, r) => n + (r.photos?.length ?? 0), 0);
  let done = 0;
  let missing = 0;
  const used = new Set<string>();

  for (const insp of records) {
    const item = byId.get(insp.itemId);
    const cat = CATEGORY_MAP[insp.category]?.label ?? insp.category;
    for (const photo of insp.photos ?? []) {
      const base = `${stamp(insp.at)}_${slug(cat, 'item')}_${slug(itemName(item), insp.itemId.slice(0, 6))}`;
      let name = `${base}.jpg`;
      // Four photos in one round would otherwise overwrite each other inside the
      // ZIP, and a silently shorter archive is the worst possible outcome here.
      for (let n = 2; used.has(name); n++) name = `${base}_${n}.jpg`;
      used.add(name);

      const b64 = await readPhoto(imo, insp, photo.id, photo.uri);
      if (b64) {
        folder?.file(name, b64, { base64: true });
      } else {
        missing++;
      }
      rows.push(
        [
          dateTime(insp.at).split(' ').slice(0, 3).join(' '),
          dateTime(insp.at).split(' ')[3],
          cat,
          itemName(item),
          item?.serial ?? '',
          [item?.deck, item?.position].filter(Boolean).join(' · '),
          PERIOD_LABEL[insp.period],
          insp.outcome === 'fail' ? 'FAIL' : 'Pass',
          insp.by,
          name,
          b64 ? 'in this archive' : 'NOT FOUND — never uploaded, or its device is gone',
        ]
          .map((c) => csvCell(String(c)))
          .join(',')
      );
      done++;
      onProgress?.({ done, total });
    }
  }

  // A README beside the manifest, because this file will be opened in two years
  // by somebody who was not aboard — possibly by a surveyor, and possibly with
  // no copy of MSM to hand.
  zip.file(
    'README.txt',
    [
      `ISMpilot — inspection photographs`,
      `Vessel: ${vessel?.vessel_name ?? '—'} (IMO ${imo})`,
      `Period: ${month.label}`,
      `Photographs: ${total - missing} of ${total}${missing ? ` (${missing} not found — see index.csv)` : ''}`,
      `Inspections: ${records.length}`,
      `Exported: ${dateTime(Date.now())}`,
      ``,
      `index.csv lists every photograph with the inspection it belongs to: the item,`,
      `the round, the outcome and who signed it. The signed records themselves stay`,
      `in the app and in its .msm backup — this archive is the evidence photographs`,
      `only, kept by the vessel after they age out of cloud storage (90 days).`,
    ].join('\n')
  );
  zip.file('index.csv', rows.join('\n'));

  const data = await zip.generateAsync({ type: 'base64' });
  const fileName = archiveFileName(month, imo);
  await deliverFile(fileName, data, true, 'application/zip');

  return { fileName, photos: total - missing, missing, inspections: records.length };
}
