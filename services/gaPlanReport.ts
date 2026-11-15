// ===================================
// The ship's plan on paper: one page per deck — the picture with its numbered
// points, and the table of what each number is. For the yard, the class
// surveyor, the office. PDF, saved or shared. English always.
// ===================================

import { Platform } from 'react-native';

import { VesselInfo } from './storage';
import { exportPmsHistory, sharePmsHistory } from './pmsHistoryReport';
import { MachineHistory } from './pmsHistory';
import { ensureLocalPhoto } from './photoStorage';
import { toDataUri } from './attachments';
import { Mark, MarkFilter, PLAN_HEAD, STATUS_HEX, markRows } from './gaPlan';
import { GaSheet } from '../types/gaPlan';

/** The picture as a data: URI, or null when this device cannot have it (not uploaded yet, no signal). */
async function pictureOf(vessel: string, s: GaSheet): Promise<string | null> {
  const ph = s.photos[0];
  if (!ph) return null;
  try {
    const uri = await ensureLocalPhoto(vessel, s.id, ph);
    if (!uri) return null;
    if (uri.startsWith('data:')) return uri;
    if (Platform.OS !== 'web') return await toDataUri(uri, /\.png$/i.test(uri) ? 'plan.png' : 'plan.jpg');
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => no(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function filterLine(f: MarkFilter, projectName?: string): string {
  const kinds = f.kinds.length === 2 ? 'Defects and yard jobs' : f.kinds[0] === 'defect' ? 'Defects' : 'Yard jobs';
  return `${kinds}${projectName ? ` (${projectName})` : ''}${f.closed ? ', closed included' : ', open only'}`;
}

async function pages(vessel: string, list: { sheet: GaSheet; marks: Mark[] }[], f: MarkFilter, projectName: string | undefined, today: string): Promise<MachineHistory[]> {
  const out: MachineHistory[] = [];
  for (const { sheet, marks } of list) {
    const image = await pictureOf(vessel, sheet);
    out.push({
      title: `Ship's plan — ${sheet.name}`,
      facts: [filterLine(f, projectName), `${marks.length} point${marks.length === 1 ? '' : 's'}`, `Printed ${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}`, ...(image ? [] : ['The picture is not on this device yet — the points are listed below'])],
      plans: image ? [{ image, w: sheet.w, h: sheet.h, marks: marks.map((m) => ({ n: m.n, x: m.pin.x, y: m.pin.y, color: STATUS_HEX[m.status] })) }] : [],
      tables: [{ title: 'Points', head: PLAN_HEAD, rows: markRows(marks) }],
    });
  }
  return out;
}

const stem = (list: { sheet: GaSheet }[]) => (list.length === 1 ? `Ship's plan ${list[0].sheet.name}` : "Ship's plan");

export async function exportGaPlan(vessel: VesselInfo | null, list: { sheet: GaSheet; marks: Mark[] }[], f: MarkFilter, projectName: string | undefined, today: string) {
  return exportPmsHistory("Ship's plan", stem(list), vessel, await pages(vessel?.imo ?? '', list, f, projectName, today));
}

export async function shareGaPlan(vessel: VesselInfo | null, list: { sheet: GaSheet; marks: Mark[] }[], f: MarkFilter, projectName: string | undefined, today: string) {
  return sharePmsHistory("Ship's plan", stem(list), vessel, await pages(vessel?.imo ?? '', list, f, projectName, today));
}
