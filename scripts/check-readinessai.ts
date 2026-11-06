// npm run check:readinessai — the AI's plan points only at the list's own lines, and names stay aboard (plan AI-1).
import { gapsForAi, MAX_AI_GAPS, readPlan } from '../services/readinessAi';
import { Gap, Readiness } from '../services/readiness';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const g = (key: string, level: Gap['level'], title: string, sub?: string): Gap => ({ key, level, title, sub, route: 'X' });
const r = (over: Partial<Readiness> = {}): Readiness => ({
  kind: 'psc', date: '2026-11-20', today: '2026-11-06', red: 2, amber: 2,
  sections: [
    { key: 'crew', title: 'Crew certificates', icon: 'x', gaps: [g('cc:1', 'red', 'Ana Ruiz — ENG1 / Seafarer medical', 'expired')] },
    { key: 'rest', title: 'Hours of rest', icon: 'x', gaps: [g('rest:p1:v', 'amber', 'Luis Pérez — rest below the minimum', '2 days')] },
    { key: 'drills', title: 'Drills', icon: 'x', gaps: [g('drl:fire', 'amber', 'Fire drill')] },
    { key: 'vesselCerts', title: 'Vessel certificates', icon: 'x', gaps: [g('vc:1', 'red', 'Load Line Certificate')] },
  ],
  ...over,
} as Readiness);

const sent = gapsForAi(r());
const json = JSON.stringify(sent);
ok(!/Ana|Ruiz|Luis|Pérez/.test(json), 'no names go to the AI');
ok(sent.some((x) => x.title === 'Crew member: rest below the minimum'), 'what is wrong still goes');
ok(sent[0].level === 'red' && sent[1].level === 'red', 'red first');
const many = r({ sections: [{ key: 'drills', title: 'D', icon: 'x', gaps: Array.from({ length: 200 }, (_, i) => g(`k${i}`, i === 199 ? 'red' : 'amber', 'x')) }] } as any);
ok(gapsForAi(many).length === MAX_AI_GAPS && gapsForAi(many)[0].key === 'k199', 'a long list keeps its red lines');

const plan = readPlan({ summary: ' S ', steps: [
  { keys: ['vc:1', 'invented'], action: 'Renew', why: 'W' },
  { keys: ['nope'], action: 'Invented step' },
  { keys: ['drl:fire'], action: '  ' },
  { keys: ['cc:1', 'cc:1'], action: 'Medical' },
] }, r());
ok(plan.steps.length === 2, 'a step with no real line goes, and one with no action');
ok(plan.steps[0].gaps.length === 1 && plan.steps[0].gaps[0].key === 'vc:1', 'an invented key goes, the real one stays');
ok(plan.steps[1].gaps.length === 1, 'a key said twice counts once');
ok(plan.left === 2, 'the lines no step mentions are counted');
ok(plan.steps[1].gaps[0].title.startsWith('Ana Ruiz'), 'the Master sees the name, from the list itself');
ok(readPlan({}, r()).steps.length === 0 && readPlan({}, r()).left === 4, 'an empty reply leaves the whole list');

if (bad) { console.error(`${bad} failed`); process.exit(1); }
console.log('All passed');
