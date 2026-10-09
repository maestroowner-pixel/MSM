// npm run check:rest — the hours-of-rest rules against hand-worked cases.
import { analyseRest, presetWork, paint } from '../services/restHours';
import { RestDay, SLOTS_PER_DAY } from '../types/rest';

let failed = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
}
const day = (date: string, work: string): RestDay => ({ id: `p_${date}`, crewId: 'p', holderName: 'P', date, work, updatedAt: 1 });
const dates = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => { const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
const rules = (r: ReturnType<typeof analyseRest>, date: string) => (r.find((x) => x.date === date)?.violations ?? []).map((v) => v.rule).sort().join(',');

// 1. Day work 08–17 every day for two weeks: compliant everywhere.
{
  const ds = dates('2026-10-01', 14);
  const r = analyseRest(ds.map((d) => day(d, presetWork('day'))), ds[7], ds[13]);
  ok(r.every((x) => x.violations.length === 0), 'day work 08–17 for two weeks: no breach');
  ok(r[0].restHours === 16 && r[0].workHours === 8, 'day work: 16 h rest, 8 h work');
}
// 2. 4-on/8-off watches every day: compliant (two 8 h rests).
{
  const ds = dates('2026-10-01', 10);
  const r = analyseRest(ds.map((d) => day(d, presetWork('w04'))), ds[7], ds[9]);
  ok(r.every((x) => x.violations.length === 0), 'watch 00–04/12–16: no breach');
}
// 3. 16 h work in a day: 24h breach and gap breach.
{
  const ds = dates('2026-10-01', 3);
  const long = paint('0'.repeat(SLOTS_PER_DAY), 12, 44, true); // 06:00–22:00
  const r = analyseRest([day(ds[0], presetWork('day')), day(ds[1], long), day(ds[2], presetWork('day'))], ds[1], ds[1]);
  ok(rules(r, ds[1]).includes('24h'), '16 h work: 24h breach');
  ok(rules(r, ds[1]).includes('gap'), '16 h work: more than 14 h without rest');
}
// 4. Rest in 2 h scraps (5 × 2 h rest, rest of day work): split breach.
{
  const ds = dates('2026-10-01', 3);
  let w = '1'.repeat(SLOTS_PER_DAY);
  for (const h of [0, 4, 8, 14, 20]) w = paint(w, h * 2, h * 2 + 4, false); // 10 h rest in five pieces
  // 14 h of rest the day before and after, so 24h is not the issue at the edges
  const r = analyseRest([day(ds[0], presetWork('off')), day(ds[1], w), day(ds[2], presetWork('off'))], ds[1], ds[1]);
  ok(rules(r, ds[1]).includes('split'), 'rest in five 2 h pieces: split breach');
}
// 5. 7-day: 13 h work (11 h rest) every day = 77 h rest: exactly compliant; 13.5 h: breach.
{
  const ds = dates('2026-10-01', 8);
  const w13 = paint('0'.repeat(SLOTS_PER_DAY), 14, 40, true); // 07:00–20:00, 11 h rest
  const r = analyseRest(ds.map((d) => day(d, w13)), ds[7], ds[7]);
  ok(!rules(r, ds[7]).includes('7d'), '11 h rest a day for 7 days (77 h): no 7-day breach');
  const w135 = paint('0'.repeat(SLOTS_PER_DAY), 14, 41, true); // 13.5 h work
  const r2 = analyseRest(ds.map((d) => day(d, w135)), ds[7], ds[7]);
  ok(rules(r2, ds[7]).includes('7d'), '10.5 h rest a day for 7 days (73.5 h): 7-day breach');
}
// 6. Unknown neighbours: nothing judged across a missing day.
{
  const r = analyseRest([day('2026-10-05', presetWork('day'))], '2026-10-04', '2026-10-06');
  ok(r[0].recorded === false && r[2].recorded === false, 'missing days are reported as not recorded');
  ok(r[1].violations.length === 0 && r[1].minRest24h === 16, 'a lone day is judged on its own 24 h only');
}
// 7. Late night into early morning across midnight: 24h window across days is caught.
{
  // Day 1: work 08–24 (rest 00–08). Day 2: work 00–02 then rest. Across midnight 18 h work.
  const d1 = paint('0'.repeat(SLOTS_PER_DAY), 16, 48, true);
  const d2 = paint('0'.repeat(SLOTS_PER_DAY), 0, 4, true);
  const r = analyseRest([day('2026-10-01', d1), day('2026-10-02', d2), day('2026-10-03', presetWork('off'))], '2026-10-01', '2026-10-02');
  ok(rules(r, '2026-10-02').includes('gap'), 'work 08:00 to 02:00 next day: gap breach on the day it ends');
  ok(rules(r, '2026-10-01').includes('24h'), 'work 08:00 to 02:00: 24 h window from the morning has < 10 h rest');
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
