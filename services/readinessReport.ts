// ===================================
// Inspection readiness as a PDF — one A4 landscape page set, the same tables as
// the PMS history (services/pmsHistoryReport.ts). Clean areas are listed in the
// facts line, so the reader sees what was checked as well as what was found.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { KIND_LABEL, READINESS_HEAD, Readiness, sectionRows, verdict } from './readiness';

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
