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
import { Mark, MarkFilter, PLAN_HEAD, STATUS_HEX, isGear, markRows } from './gaPlan';
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

const KIND_EN: Record<string, string> = { defect: 'defects', yard: 'yard jobs', equip: 'safety equipment', obs: 'observations' };

function filterLine(f: MarkFilter, projectName?: string, categoryName?: string): string {
  const kinds = f.kinds.map((k) => (k === 'yard' && projectName ? `yard jobs (${projectName})` : k === 'equip' && categoryName ? `safety equipment (${categoryName})` : KIND_EN[k]));
  const said = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : kinds[0] ?? '';
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}${f.closed ? ', closed included' : ', open only'}`;
}

async function pages(vessel: string, list: { sheet: GaSheet; marks: Mark[] }[], f: MarkFilter, projectName: string | undefined, today: string, categoryName?: string): Promise<MachineHistory[]> {
  const out: MachineHistory[] = [];
  for (const { sheet, marks } of list) {
    const image = await pictureOf(vessel, sheet);
    out.push({
      title: `Ship's plan — ${sheet.name}`,
      facts: [filterLine(f, projectName, categoryName), `${marks.length} point${marks.length === 1 ? '' : 's'}`, `Printed ${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}`, ...(image ? [] : ['The picture is not on this device yet — the points are listed below'])],
      plans: image ? [{ image, w: sheet.w, h: sheet.h, marks: marks.map((m) => ({ n: m.n, x: m.pin.x, y: m.pin.y, color: STATUS_HEX[m.status], ...(isGear(m.pin.kind) ? { square: true } : {}) })) }] : [],
      tables: [{ title: 'Points', head: PLAN_HEAD, rows: markRows(marks) }],
    });
  }
  return out;
}

const stem = (list: { sheet: GaSheet }[]) => (list.length === 1 ? `Ship's plan ${list[0].sheet.name}` : "Ship's plan");

export async function exportGaPlan(vessel: VesselInfo | null, list: { sheet: GaSheet; marks: Mark[] }[], f: MarkFilter, projectName: string | undefined, today: string, categoryName?: string) {
  return exportPmsHistory("Ship's plan", stem(list), vessel, await pages(vessel?.imo ?? '', list, f, projectName, today, categoryName));
}

export async function shareGaPlan(vessel: VesselInfo | null, list: { sheet: GaSheet; marks: Mark[] }[], f: MarkFilter, projectName: string | undefined, today: string, categoryName?: string) {
  return sharePmsHistory("Ship's plan", stem(list), vessel, await pages(vessel?.imo ?? '', list, f, projectName, today, categoryName));
}
