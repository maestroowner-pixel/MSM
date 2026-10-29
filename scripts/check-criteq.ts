// npm run check:criteq — critical equipment: downtime on the defect, the office's mail, Board, Fleet, reports.
import { alertWorthy, backOn, closeOut, critSummary, downtimeDays, downtimeIn, isOut, machineDowntime, markBack, markOut, monthDowntime, outNow } from '../services/critEq';
import { buildBoard } from '../services/board';
import { summarise } from '../services/fleetSummary';
import { machineHistory } from '../services/pmsHistory';
import { pmsMonth } from '../services/pmsKpi';
import { Machine, PmsDefect } from '../types/pms';
import { MANUAL, releasedManual } from '../constants/manual';
import { moduleOn } from '../constants/modules';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const F = require('../../functions/critAlert');

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const threw = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

const M = (id: string, p: Partial<Machine> = {}): Machine => ({ id, name: id.toUpperCase(), updatedAt: 1, ...p } as Machine);
const D = (id: string, p: Partial<PmsDefect>): PmsDefect => ({ id, machineId: 'steer', machineName: 'STEER', category: 'operational', description: 'Leak ' + id, date: '2026-10-20', by: 'Ann', byRank: 'C/E', at: 1, updatedAt: 1, ...p });
const ce = { name: 'Ann', rank: 'C/E' };
const steer = M('steer', { critical: true });
const gen = M('gen');
const today = '2026-10-29';

// who hears at once
ok(alertWorthy({ category: 'operational' }, steer), 'operational defect on a critical machine: mailed');
ok(alertWorthy({ category: 'safety' }, gen), 'safety-critical on any machine: mailed');
ok(!alertWorthy({ category: 'class' }, gen), 'class defect on an ordinary machine: not mailed');
for (const c of ['safety', 'class', 'operational'] as const) for (const m of [steer, gen, undefined]) {
  ok(alertWorthy({ category: c }, m) === F.alertWorthy({ category: c }, m), `function = app: ${c} on ${m?.id ?? 'no machine'}`);
}

// downtime
const d0 = D('a', {});
const out = markOut(d0, '2026-10-25', ce, 10);
ok(isOut(out) && out.outOfService!.by === 'Ann' && out.outOfService!.byRank === 'C/E', 'marked out, signed');
ok(downtimeDays(out, today) === 5, 'still out: 25th to today (29th) = 5 days, both ends');
ok(threw(() => markBack(out, '2026-10-24', ce, 11)), 'cannot be back before it went out');
const back = markBack(out, '2026-10-27', { name: 'Bob' }, 12);
ok(!isOut(back) && backOn(back) === '2026-10-27' && back.outOfService!.backBy === 'Bob', 'back in service on the 27th');
ok(downtimeDays(back, today) === 3, '25–27 = 3 days');
ok(threw(() => markBack(back, '2026-10-28', ce, 13)), 'not back twice');
ok(threw(() => markOut({ ...d0, closed: { date: '2026-10-21', note: 'x', by: 'y', at: 1 } }, '2026-10-21', ce, 1)), 'a closed defect does not go out of service');
// closing ends it
const closePatch = closeOut(out, '2026-10-28', ce, 20);
ok(closePatch.outOfService?.to === '2026-10-28', 'closing the defect puts the machine back the same day');
ok(Object.keys(closeOut(back, '2026-10-28', ce, 20)).length === 0, 'closing after it was back changes nothing');
ok(closeOut(markOut(d0, '2026-10-29', ce, 1), '2026-10-28', ce, 2).outOfService?.to === '2026-10-29', 'closed with an earlier date: back the day it went out, never before');
const closedNoTo: PmsDefect = { ...out, closed: { date: '2026-10-26', note: 'x', by: 'y', at: 1 } };
ok(!isOut(closedNoTo) && backOn(closedNoTo) === '2026-10-26', 'closed by an older app without `to`: back on the closing day');
// month window
ok(downtimeIn(markOut(d0, '2026-09-28', ce, 1), '2026-10-01', '2026-10-31', today) === 29, 'from September, still out on the 29th: 29 days in October');
ok(downtimeIn(back, '2026-11-01', '2026-11-30', today) === 0, 'nothing in a month it was not out');

// machine and summary
const defs = [
  out,
  D('b', { machineId: 'gen', machineName: 'GEN', outOfService: { from: '2026-10-28', by: 'x', at: 1 } }),
  D('c', { machineId: 'steer', category: 'class' }),
  { ...back, id: 'old', machineId: 'steer' },
  D('z', { machineId: 'steer', closed: { date: '2026-10-21', note: 'x', by: 'y', at: 1 } }),
];
ok(outNow('steer', defs)?.id === 'a' && !outNow('pump', defs), 'which defect holds a machine out');
ok(machineDowntime('steer', defs).map((d) => d.id).join() === 'a,old' || machineDowntime('steer', defs).length === 2, "machine's downtime from its defects");
const cs = critSummary([steer, gen], defs);
ok(cs.defects === 3, 'open defects on critical machines: 3 (closed one not counted)');
ok(cs.out.length === 2 && cs.out[0].machineId === 'steer' && cs.out[0].critical, 'out of service: critical first');
ok(critSummary([steer, { ...gen, deleted: true }], defs).out.length === 1, 'a removed machine is not listed');

// Board
const on = (k: string) => ['pms', 'critEq'].includes(k);
const base: any = {
  on, role: 'superadmin', me: null, today, now: `${today}T10:00`,
  labelOf: (c: string) => c, periodsOf: () => [], flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [],
  machines: [steer, gen], pmsJobs: [], pmsDefects: defs, pmsDone: [], pmsDeferrals: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [],
};
let notes: any[] = [];
try { notes = buildBoard(base).attention; } catch (e) { console.log('  (board threw:', (e as Error).message, ')'); }
const outNote = notes.find((n) => n.key === 'crit:out:steer');
ok(!!outNote && outNote.level === 'red' && /STEER/.test(outNote.title), 'Board: critical machine out of service — red, named');
ok(notes.some((n) => n.key === 'crit:out-other' && n.level === 'amber'), 'Board: an ordinary machine out — amber');
ok(notes.some((n) => n.key === 'crit:defects' && n.level === 'red'), 'Board: defects on critical equipment — red');
let off: any[] = [];
try { off = buildBoard({ ...base, on: (k: string) => k === 'pms' }).attention; } catch { /* checked above */ }
ok(!off.some((n) => String(n.key).startsWith('crit:')), 'Board: nothing with the module off');

// Fleet
const sum = summarise({ imo: '1', name: 'V', registerAt: 0, items: [], certificates: [], crew: [], docs: [], acks: [], machines: [steer, gen], jobs: [], spares: [], moves: [], defects: defs, modules: { critEq: true } });
ok(sum.crit.defects === 3 && sum.crit.out.length === 2 && sum.critOn, 'Fleet summary: critical defects and out of service');

// reports
const h = machineHistory(steer, [], [], [], defs, today);
ok(h.facts.includes('OUT OF SERVICE since 25.10.2026'), 'history: out of service in the facts');
const t = h.tables.find((x) => x.title.startsWith('Downtime'));
ok(!!t && t.title === 'Downtime — 8 days in all' && t.rows.length === 2 && t.rows[0][1] === 'STILL OUT', 'history: downtime table, total days, still out');
ok(!machineHistory(gen, [], [], [], [], today).tables.some((x) => x.title.startsWith('Downtime')), 'history: no table when never out');
const mon = pmsMonth('2026-10', [steer, gen], [], [], [], today, defs);
ok(!!mon.downtime && mon.downtime.length === 3 && mon.downtime[0][0] === '⚑ STEER', 'month: downtime rows, critical flagged, longest first');
ok(pmsMonth('2026-10', [steer], [], [], [], today).downtime === undefined, 'month: no section when the defects are not given (module off)');
ok(monthDowntime('2026-11', [steer], [back], today).length === 0, 'month: nothing in November');

// the function's events and mail
ok(F.alertEvents(null, D('n', {}), steer).join() === 'raised', 'mail: new defect on critical equipment');
ok(F.alertEvents(null, D('n', {}), gen).length === 0, 'mail: nothing for an operational defect on an ordinary machine');
ok(F.alertEvents(D('n', {}), out, steer).join() === 'out', 'mail: taken out of service later');
ok(F.alertEvents(out, back, steer).join() === 'back', 'mail: back in service');
ok(F.alertEvents(out, { ...out, closed: { date: '2026-10-28', note: 'x', by: 'y', at: 1 } }, steer).join() === 'back', 'mail: closed while out = back');
ok(F.alertEvents(out, { ...out, responsible: '2/E' }, steer).length === 0, 'mail: other changes send nothing');
const mail = F.buildMail('raised', { ...out, by: 'Ann Secret' }, steer, 'Dream', '1234567');
ok(/Critical equipment defect — STEER/.test(mail.subject) && /Dream/.test(mail.subject), 'mail subject: vessel, machine');
ok(!/Ann/.test(mail.html) && /C\/E/.test(mail.html), 'mail: the rank, never the name');
ok(/still out/.test(mail.html), 'mail: out of service shown');
ok(!/<script/.test(F.buildMail('raised', D('x', { description: '<script>x</script>' }), steer, 'V', '1').html), 'mail: text escaped');

// manual: the paragraph is last in Planned maintenance in every language, and held back while the module is off
const pmIdx = MANUAL.en.sections.findIndex((x) => x.title === 'Planned maintenance');
for (const lang of Object.keys(MANUAL) as (keyof typeof MANUAL)[]) {
  const body = MANUAL[lang].sections[pmIdx].body ?? [];
  const mine = body[body.length - 1];
  ok(/[Cc]riti|[Кк]ритич|[Kk]ritisk/.test(mine) && /Out of service|Fuera|Fora|Вне|Поза|Ute av/.test(mine), `manual ${lang}: paragraph last in Planned maintenance`);
  const shown = releasedManual(lang).sections.find((x) => x.title === MANUAL[lang].sections[pmIdx].title)?.body ?? [];
  ok(moduleOn('critEq') ? shown.includes(mine) : !shown.includes(mine) && shown.length === body.length - 1, `manual ${lang}: ${moduleOn('critEq') ? 'shown' : 'held back, nothing else dropped'}`);
}

console.log(fail ? `\n${fail} failed` : '\nAll passed');
process.exit(fail ? 1 : 0);
