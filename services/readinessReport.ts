// ===================================
// Inspection readiness as a PDF — one A4 landscape page set, the same tables as
// the PMS history (services/pmsHistoryReport.ts). Clean areas are listed in the
// facts line, so the reader sees what was checked as well as what was found.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { KIND_LABEL, READINESS_HEAD, Readiness, sectionRows, verdict } from './readiness';
import { icsEvents, toIcs } from './calendarIcs';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const ICS_MIME = 'text/calendar';

export async function exportReadinessPdf(r: Readiness, vessel: VesselInfo | null) {
  const day = r.date.split('-').reverse().join('.');
  const clean = r.sections.filter((s) => !s.gaps.length).map((s) => s.title);
  const facts = [
    `${KIND_LABEL[r.kind]} on ${day}`,
    verdict(r),
    `prepared ${r.today.split('-').reverse().join('.')}`,
    ...(clean.length ? [`nothing found: ${clean.join(', ')}`] : []),
  ];
  const tables = r.sections.filter((s) => s.gaps.length).map((s) => ({ title: s.title, head: READINESS_HEAD, rows: sectionRows(s), widths: { 0: 14, 1: 70, 2: 90, 3: 16 } }));
  return exportPmsHistory('Inspection readiness', `Readiness ${r.kind.toUpperCase()} ${r.date}`, vessel, [{ title: `Inspection readiness — ${KIND_LABEL[r.kind]}`, facts, tables }]);
}

/** Every due date a year ahead as a calendar file (services/calendarIcs.ts). Returns the event count. */
export async function exportCalendarIcs(r: Readiness, vessel: VesselInfo | null): Promise<{ count: number; where: string | null | void }> {
  const name = (vessel?.vessel_name ?? '').trim();
  const events = icsEvents(r, name);
  const text = toIcs(events, `ISM AI Pilot${name ? ` — ${name}` : ''}`, new Date());
  const file = `ISM AI Pilot due dates${name ? ` ${name.replace(/[\\/:*?"<>|]+/g, ' ')}` : ''} ${r.today}.ics`;
  const where = onWeb ? await saveFileWeb(new Blob([text], { type: ICS_MIME }), file, 'reports') : await deliverFile(file, text, false, ICS_MIME);
  return { count: events.length, where };
}
