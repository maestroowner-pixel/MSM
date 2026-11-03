// ===================================
// A crew appraisal on paper — for the seafarer's file and the crewing office:
// the scores, the remarks, every signature (drawn ones printed). English always.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { appraisalReport } from './appraisals';
import { CrewAppraisal } from '../types/appraisal';

export async function exportAppraisalPdf(a: CrewAppraisal, vessel: VesselInfo | null) {
  return exportPmsHistory('Crew appraisal', `Appraisal ${a.name} ${a.to}`, vessel, [appraisalReport(a)]);
}
