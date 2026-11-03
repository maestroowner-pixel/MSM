// npm run check:restplan — the watch plan (services/restPlan, plan item 41): the
// forecast mixes record and plan the right way round and finds the breaches
// before they are worked.
import { paint, presetWork } from '../services/restHours';
import { addDays, emptyPlan, forecast, planBreaches, plannedWork, prunePlan } from '../services/restPlan';
import { RestDay } from '../types/rest';
import { RestPlan } from '../types/restPlan';
import { CrewMember } from '../types/crew';
import { releasedManual } from '../constants/manual';

let failed = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
}
const TODAY = '2026-11-10';
const rec = (date: string, work: string, crewId = 'p'): RestDay => ({ id: `${crewId}_${date}`, crewId, holderName: 'P', date, work, updatedAt: 1 });
const week = (work: string) => Array.from({ length: 7 }, (_, i) => rec(addDays(TODAY, i - 7), work));
const plan = (x: Partial<RestPlan>): RestPlan => ({ ...emptyPlan({ id: 'p', name: 'P' }, TODAY), ...x });
const empty = '0'.repeat(48);
const w = (...spans: [number, number][]) => spans.reduce((s, [a, b]) => paint(s, a * 2, b * 2, true), empty);

// 1. A compliant watch, recorded behind and planned ahead: 14 days, nothing to say.
{
  const f = forecast('p', week(presetWork('w04')), plan({ pattern: presetWork('w04') }), TODAY);
  ok(f.length === 14 && f[0].date === TODAY && f[13].date === addDays(TODAY, 13), 'forecast: 14 days from today');
  ok(f.every((d) => d.source === 'plan' && d.ahead.length === 0), '4-on/8-off: planned every day, no breach');
  ok(f[13].summary.minRest24h === 16, 'the last day is judged too (the day after the horizon is planned)');
}
// 2. A watch that leaves 8 h of rest: a 24 h breach on every planned day.
{
  const bad = w([6, 18], [20, 24]);
  const f = forecast('p', week(presetWork('day')), plan({ pattern: bad }), TODAY);
  ok(f.every((d) => d.ahead.some((v) => v.rule === '24h')), '12 + 4 h of work: every day breaks 10 h in 24 h');
}
// 3. 14 h a day, rest in one 10 h block: fine for 24 h, a 77 h breach once a week of it is in.
{
  const long = w([6, 20]);
  const f = forecast('p', [], plan({ pattern: long, from: TODAY }), TODAY);
  ok(f.every((d) => !d.ahead.some((v) => v.rule === '24h' || v.rule === 'gap' || v.rule === 'split')), '06–20: no 24 h, gap or split breach');
  ok(!f[0].ahead.some((v) => v.rule === '7d'), 'nothing recorded, plan from today: today\'s 7 days are not judged');
  ok(f[6].ahead.some((v) => v.rule === '7d'), '…the seventh day is: 70 h < 77 h');
  const g = forecast('p', [], plan({ pattern: long, from: addDays(TODAY, -10) }), TODAY);
  ok(g[0].ahead.some((v) => v.rule === '7d'), 'a past week nobody recorded counts as planned: today already breaks 77 h');
  const h = forecast('p', week(presetWork('day')), plan({ pattern: long, from: addDays(TODAY, -10) }), TODAY);
  ok(!h[0].ahead.some((v) => v.rule === '7d') && h[5].ahead.some((v) => v.rule === '7d'), 'a recorded week outranks the plan: the breach comes later');
}
// 4. One day changed: only that day (and the 24 h running into it) breaks; the standing watch is untouched.
{
  const d3 = addDays(TODAY, 3);
  const p = plan({ pattern: presetWork('day'), days: { [d3]: { work: w([0, 20]), note: 'Arrival' } } });
  const f = forecast('p', week(presetWork('day')), p, TODAY);
  const bad = f.filter((d) => d.ahead.length).map((d) => d.date);
  ok(bad.includes(d3) && bad.every((d) => d === d3 || d === addDays(d3, -1) || d === addDays(d3, 1)), 'a changed day: the breach is on it and its neighbours only');
  ok(f[3].source === 'changed' && f[3].note === 'Arrival' && f[2].source === 'plan', 'the changed day is marked, with its note');
  const people = [{ id: 'p', name: 'P' }, { id: 'q', name: 'Q' }] as CrewMember[];
  const b = planBreaches(people, week(presetWork('day')), [p, { ...p, id: 'q', crewId: 'q', days: {} }], TODAY);
  ok(b.length === 1 && b[0].crewId === 'p' && b[0].first <= d3, 'planBreaches: only the person whose plan breaks, from the first day');
}
// 5. A day recorded beats the plan.
{
  const p = plan({ pattern: w([0, 20]) });
  const f = forecast('p', [...week(presetWork('day')), rec(TODAY, presetWork('day'))], p, TODAY);
  ok(f[0].source === 'record' && f[1].source === 'plan', 'today recorded: the record, tomorrow the plan');
  ok(f[0].ahead.length > 0, '…but a recorded day whose 24 h runs into a bad planned day is flagged ahead');
  const g = forecast('p', [...week(presetWork('day')), rec(TODAY, presetWork('day'))], plan({ pattern: presetWork('day') }), TODAY);
  ok(g[0].ahead.length === 0, 'a recorded day before a good plan: nothing ahead');
}
// 6. What the plan says for a day; pruning.
{
  const p = plan({ pattern: presetWork('w48'), from: addDays(TODAY, 2), days: { [addDays(TODAY, 1)]: { work: empty } } });
  ok(plannedWork(p, TODAY) === null, 'before the standing watch starts: nothing');
  ok(plannedWork(p, addDays(TODAY, 1))?.changed === true, 'a changed day wins');
  ok(plannedWork(p, addDays(TODAY, 2))?.work === presetWork('w48'), 'from its first day: the standing watch');
  ok(forecast('p', [], plan({}), TODAY).every((d) => d.source === 'none' && !d.ahead.length), 'no plan: nothing judged, nothing invented');
  const q = prunePlan(plan({ days: { [addDays(TODAY, -8)]: { work: empty }, [addDays(TODAY, -7)]: { work: empty }, [addDays(TODAY, 4)]: { work: '' } } }), TODAY);
  ok(Object.keys(q.days).join() === addDays(TODAY, -7), 'prune: a week behind kept, older and empty days dropped');
}
// 7. Shipped dark: the manual says nothing about the plan while the flag is off.
{
  const sec = releasedManual('en').sections.find((s) => s.title === 'Hours of rest');
  const ru = releasedManual('ru').sections.find((s) => s.title.startsWith('Часы отдыха'));
  ok(!!sec && !sec.body!.some((b) => b.includes('Watch plan')) && sec.body!.length === 5, 'manual (flag off): Hours of rest as before');
  ok(!!ru && !ru.body!.some((b) => b.includes('План вахт')), 'manual ru (flag off): no plan paragraphs');
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
