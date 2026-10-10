// npm run check:permits — permit-to-work and risk-assessment rules (services/permits.ts).
import { approvalBlockers, gasProblems, isOverdue, nextNumber, riskLevel, unacceptable, worstResidual } from '../services/permits';
import { PERMIT_TYPE_MAP, PERMIT_TYPES } from '../constants/permitTypes';
import { RISK_LIBRARY } from '../constants/riskLibrary';
import { Permit, RiskAssessment } from '../types/permits';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };

ok(nextNumber('PTW', 2026, ['PTW-2026-002', 'PTW-2025-009', undefined, 'PTW-2026-010']) === 'PTW-2026-011', 'numbering: next in the year, other years ignored');
ok(nextNumber('RA', 2026, []) === 'RA-2026-001', 'numbering: first of the year');

ok(gasProblems({ at: 0, by: 'x', o2: 20.9, lel: 0, h2s: 0, co: 2 }).length === 0, 'gas: normal air is safe');
ok(gasProblems({ at: 0, by: 'x', o2: 19.5, lel: 0 }).some((p) => p.startsWith('O₂ 19.5')), 'gas: low oxygen refused');
ok(gasProblems({ at: 0, by: 'x', o2: 20.9, lel: 2, h2s: 7, co: 30 }).length === 3, 'gas: LEL, H₂S and CO over the limits');
ok(gasProblems({ at: 0, by: 'x', o2: 20.9 }).includes('LEL not measured'), 'gas: LEL must be measured');

const enclosed = PERMIT_TYPE_MAP.enclosed;
const allYes = Object.fromEntries(enclosed.checks.map((c) => [c.id, 'yes' as const]));
const p: Permit = { id: 'p', type: 'enclosed', work: 'Inspect fresh-water tank 3', location: 'Tank 3', from: '2026-10-10T08:00', to: '2026-10-10T12:00', team: ['Tom'], checks: allYes,
  gasTests: [{ at: 1, by: 'x', o2: 20.9, lel: 0, h2s: 0, co: 0 }], status: 'requested', createdAt: 0, updatedAt: 0 };
ok(approvalBlockers(p, true).length === 0, 'a complete enclosed-space permit can be approved');
ok(approvalBlockers(p, false).includes('no risk assessment attached'), 'no risk assessment → blocked');
ok(approvalBlockers({ ...p, checks: { ...allYes, rescue: 'no' } }, true).some((b) => b.startsWith('“No” to: Rescue equipment')), 'a "No" precaution blocks approval and is named');
ok(approvalBlockers({ ...p, gasTests: [{ at: 1, by: 'x', o2: 18, lel: 0 }] }, true).some((b) => b.startsWith('gas:')), 'bad gas blocks approval');
ok(approvalBlockers({ ...p, to: '2026-10-10T20:00' }, true).some((b) => b.includes('longer than 8 h')), 'window longer than the type allows');
ok(approvalBlockers({ ...p, type: 'cold', gasTests: [] , checks: Object.fromEntries(PERMIT_TYPE_MAP.cold.checks.map((c) => [c.id, 'na' as const])) }, true).length === 0, 'cold work needs no gas; N/A answers accepted');
ok(isOverdue({ ...p, status: 'active' }, '2026-10-10T12:30') && !isOverdue({ ...p, status: 'closed' }, '2026-10-10T12:30'), 'active past its window is overdue; closed is not');

ok(riskLevel(1, 4) === 'low' && riskLevel(3, 3) === 'medium' && riskLevel(4, 4) === 'high' && riskLevel(5, 4) === 'extreme', 'risk matrix: 4 low, 9 medium, 16 high, 20 extreme');
const ra: RiskAssessment = { id: 'r', title: 'x', generic: false, createdAt: 0, updatedAt: 0, hazards: [
  { id: 'a', hazard: 'A', likelihood: 3, severity: 5, residualLikelihood: 1, residualSeverity: 5 },
  { id: 'b', hazard: 'B', likelihood: 4, severity: 4 },
] };
ok(worstResidual(ra) === 'high' && unacceptable(ra).map((h) => h.id).join() === 'b', 'a hazard with no controls rated keeps its high risk and is flagged');
ok(PERMIT_TYPES.every((t) => t.checks.some((c) => c.id === 'ra')), 'every permit type asks that the risk assessment was reviewed');
ok(RISK_LIBRARY.every((t) => t.hazards.every((h) => riskLevel(h.residualLikelihood!, h.residualSeverity!) !== 'extreme')), 'starter library: no hazard left Extreme with controls');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
