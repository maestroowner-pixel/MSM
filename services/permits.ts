// ===================================
// Permits to work and risk assessments — the rules, as pure functions.
// The reasons they return are screen text, in the interface language
// (English in check:permits); the PDF does not use them.
// ===================================

import { GAS_LIMITS, PERMIT_TYPE_MAP } from '../constants/permitTypes';
import { GasTest, Hazard, Permit, RiskAssessment } from '../types/permits';
import { t as tr, tk, tn } from '../utils/t';

/** "PTW-2026-007": the next number for the year, from those already issued. */
export function nextNumber(prefix: 'PTW' | 'RA', year: number, taken: (string | undefined)[]): string {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = taken.reduce((m, n) => {
    const x = n ? re.exec(n) : null;
    return x ? Math.max(m, Number(x[1])) : m;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`;
}

/** What is out of limits in one set of readings. Empty = safe to enter. */
export function gasProblems(t: GasTest): string[] {
  const L = GAS_LIMITS;
  const out: string[] = [];
  if (t.o2 == null) out.push(tr('ptw.b.o2None'));
  else if (t.o2 < L.o2Min || t.o2 > L.o2Max) out.push(tr('ptw.b.o2', { v: t.o2, min: L.o2Min, max: L.o2Max }));
  if (t.lel != null && t.lel >= L.lelMax) out.push(tr('ptw.b.lel', { v: t.lel, max: L.lelMax }));
  if (t.h2s != null && t.h2s >= L.h2sMax) out.push(tr('ptw.b.h2s', { v: t.h2s, max: L.h2sMax }));
  if (t.co != null && t.co >= L.coMax) out.push(tr('ptw.b.co', { v: t.co, max: L.coMax }));
  if (t.lel == null) out.push(tr('ptw.b.lelNone'));
  return out;
}

export function lastGas(p: Permit): GasTest | undefined {
  return [...(p.gasTests ?? [])].sort((a, b) => b.at - a.at)[0];
}

/** Why a permit cannot be approved yet. Empty = it can. */
/**
 * Why the work cannot start yet: no toolbox meeting, someone on the team not
 * marked present at it, or the meeting held for a different place / job.
 */
export function startBlockers(p: Permit): string[] {
  const t = p.toolbox;
  if (!t) return [tr('ptw.b.noToolbox')];
  const out: string[] = [];
  const present = new Set(t.attendees.filter((a) => a.present).map((a) => a.name));
  const absent = p.team.filter((n) => !present.has(n));
  if (absent.length) out.push(tr('ptw.b.notAtToolbox', { names: absent.join(', ') }));
  if (t.location.trim() !== p.location.trim() || t.work.trim() !== p.work.trim()) out.push(tr('ptw.b.toolboxChanged'));
  return out;
}

export function approvalBlockers(p: Permit, raExists: boolean): string[] {
  const def = PERMIT_TYPE_MAP[p.type];
  const out: string[] = [];
  if (!p.work.trim()) out.push(tr('ptw.b.noWork'));
  if (!p.location.trim()) out.push(tr('ptw.b.noLocation'));
  if (!p.from || !p.to) out.push(tr('ptw.b.noWindow'));
  else if (p.to <= p.from) out.push(tr('ptw.b.badWindow'));
  else {
    const hours = (Date.parse(p.to) - Date.parse(p.from)) / 3600000;
    if (hours > def.maxHours) out.push(tr('ptw.b.tooLong', { h: def.maxHours }));
  }
  if (!p.team.length) out.push(tr('ptw.b.noTeam'));
  const open = def.checks.filter((c) => !p.checks[c.id]);
  if (open.length) out.push(tn('ptw.b.noAnswer', open.length));
  const no = def.checks.filter((c) => p.checks[c.id] === 'no');
  if (no.length) out.push(tr('ptw.b.saidNo', { list: no.map((c) => tk(`ptw.chk.${p.type}.${c.id}`).split(/[;:,]/)[0]).join('; ') }));
  if (def.gas) {
    const g = lastGas(p);
    if (!g) out.push(tr('ptw.b.noGas'));
    else if (gasProblems(g).length) out.push(tr('ptw.b.gas', { list: gasProblems(g).join(', ') }));
  }
  if (!raExists) out.push(tr('ptw.b.noRa'));
  return out;
}

/** In progress past its window — to be closed or renewed. */
export function isOverdue(p: Permit, nowIso: string): boolean {
  return (p.status === 'active' || p.status === 'approved') && !!p.to && p.to < nowIso;
}

/** Local "yyyy-mm-ddThh:mm". */
export function nowLocal(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

// ---- risk matrix (5 × 5) ----------------------------------------------------------

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export function riskLevel(likelihood: number, severity: number): RiskLevel {
  const s = likelihood * severity;
  return s <= 4 ? 'low' : s <= 9 ? 'medium' : s <= 16 ? 'high' : 'extreme';
}

export const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High', extreme: 'Extreme' };
export const RISK_COLOR: Record<RiskLevel, string> = { low: '#27AE60', medium: '#F5A524', high: '#E67E22', extreme: '#E74C3C' };

export const LIKELIHOOD = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
export const SEVERITY = ['Negligible', 'Minor injury', 'Lost-time injury', 'Major injury', 'Fatality'];

/** The worst residual risk in an assessment — what it is judged by. */
export function worstResidual(ra: RiskAssessment): RiskLevel | null {
  const order: RiskLevel[] = ['low', 'medium', 'high', 'extreme'];
  let w = -1;
  for (const h of ra.hazards) {
    const l = h.residualLikelihood ?? h.likelihood;
    const s = h.residualSeverity ?? h.severity;
    w = Math.max(w, order.indexOf(riskLevel(l, s)));
  }
  return w < 0 ? null : order[w];
}

/** Hazards whose risk is still high or extreme with the controls in place. */
export function unacceptable(ra: RiskAssessment): Hazard[] {
  return ra.hazards.filter((h) => {
    const lvl = riskLevel(h.residualLikelihood ?? h.likelihood, h.residualSeverity ?? h.severity);
    return lvl === 'high' || lvl === 'extreme';
  });
}
