// ===================================
// A drug and alcohol test on paper — for the vessel's D&A file and the
// inspector: the readings, the laboratory, what was done, the signature.
// English always. Printed from the device, so names are as recorded there.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { daTestReport } from './daTests';
import { DaFollowUp, DaResult, DaTest } from '../types/daTest';

export async function exportDaTestPdf(t: DaTest, results: DaResult[], follow: DaFollowUp[], vessel: VesselInfo | null) {
  return exportPmsHistory('Drug and alcohol test', `DA test ${t.no}`, vessel, [daTestReport(t, results, follow)]);
}
