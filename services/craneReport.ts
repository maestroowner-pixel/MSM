// ===================================
// Crane operator's experience statement as a PDF — the PMS-history pages
// (services/pmsHistoryReport.ts); content from services/craneLog.ts.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { statementPages, StatementInput } from './craneLog';
import { CraneEntry, CraneTest } from '../types/craneLog';

export async function exportCraneStatement(all: CraneEntry[], crewId: string, x: Omit<StatementInput, 'vesselName' | 'imo' | 'flag'>, vessel: VesselInfo | null, tests: CraneTest[] = []) {
  const pages = statementPages(all, crewId, { ...x, vesselName: vessel?.vessel_name, imo: vessel?.imo, flag: vessel?.flag }, tests);
  return exportPmsHistory('Crane operator — experience statement', `Crane experience ${x.name} ${x.from} ${x.to}`, vessel, pages);
}
