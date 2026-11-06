// ===================================
// The AI on Inspection readiness (plan AI-1, 6 Nov 2026): the list says what an
// inspector would find; this says what to do first, in steps that join lines
// which share a fix. A draft for the Master: the list stays what counts. A step
// can only point at lines the list holds, and every line it leaves out is
// counted on the screen. People's names stay here (the crew and rest lines).
// ===================================

import { Gap, Readiness } from './readiness';

export const MAX_AI_GAPS = 150;

export interface AiGap {
  key: string;
  level: Gap['level'];
  section: string;
  title: string;
  sub?: string;
  date?: string;
}

/** Red first, so a long list loses its least urgent lines. */
export function gapsForAi(r: Readiness): AiGap[] {
  const all = r.sections.flatMap((s) =>
    s.gaps.map((g): AiGap => {
      const personal = s.key === 'crew' || s.key === 'rest';
      const title = personal ? `Crew member: ${g.title.slice(g.title.lastIndexOf(' — ') + 3)}` : g.title;
      // A person's key carries their id: it means nothing outside the vessel, and is the way back to the line.
      return { key: g.key, level: g.level, section: s.title, title, ...(g.sub ? { sub: g.sub } : {}), ...(g.date ? { date: g.date } : {}) };
    })
  );
  return [...all.filter((g) => g.level === 'red'), ...all.filter((g) => g.level !== 'red')].slice(0, MAX_AI_GAPS);
}

export interface ReadinessAiReply {
  summary?: string;
  note?: string;
  steps?: { keys?: string[]; action?: string; why?: string }[];
}

export interface PlanStep {
  action: string;
  why?: string;
  gaps: Gap[];
}

export interface ReadinessPlan {
  summary?: string;
  note?: string;
  steps: PlanStep[];
  /** Lines of today's list that no step mentions. */
  left: number;
}

/** The reply against the list as it is now: a key that is not on it (invented, or put right since) goes, a step with none goes too. */
export function readPlan(reply: ReadinessAiReply, r: Readiness): ReadinessPlan {
  const byKey = new Map(r.sections.flatMap((s) => s.gaps).map((g) => [g.key, g]));
  const used = new Set<string>();
  const steps: PlanStep[] = [];
  for (const s of reply.steps ?? []) {
    const gaps = [...new Set(s.keys ?? [])].map((k) => byKey.get(k)).filter((g): g is Gap => !!g);
    const action = String(s.action ?? '').trim();
    if (!gaps.length || !action) continue;
    gaps.forEach((g) => used.add(g.key));
    steps.push({ action, ...(s.why ? { why: String(s.why).trim() } : {}), gaps });
  }
  return { summary: reply.summary?.trim() || undefined, note: reply.note?.trim() || undefined, steps, left: byKey.size - used.size };
}
