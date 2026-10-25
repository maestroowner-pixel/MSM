// npm run check:verification — the Master's verification of the record books and
// the certified true copy (services/verification, utils/trueCopyPdf; MEPC.312(74)).
import { awaiting, copyRows, entryStatus, masterCell, verificationId, verificationLines, verifiedIds, withEarlier } from '../services/verification';
import { current } from '../services/versions';
import { trueCopyDoc } from '../services/trueCopy';
import { buildBoard } from '../services/board';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = (d: string, h = '10:00') => Date.parse(`${d}T${h}:00Z`);

const e1: any = { id: 'o1', date: '2026-10-02', code: 'D', text: 'first', by: 'C/E Ivan', byRank: 'Chief Engineer', byId: 'crew-1', at: T('2026-10-02') };
const e2: any = { id: 'o2', date: '2026-10-05', code: 'C', text: 'second', by: '2/E Petr', at: T('2026-10-05') };

// A signature from before 2.68 (no `covers`): it verified what was written before it.
const legacy: any = { id: 'orb_2026-10', month: '2026-10', by: 'Master', at: T('2026-10-03') };
let ids = verifiedIds([e1, e2], [legacy]);
ok(entryStatus(e1, [e1, e2], ids) === 'verified' && entryStatus(e2, [e1, e2], ids) === 'pending', 'pre-2.68 month signature verifies only what was written before it');

// The Master verifies the waiting entries — those versions, by id.
const v2: any = { id: verificationId('orb', '2026-10', [legacy], T('2026-10-06')), month: '2026-10', by: 'Master', at: T('2026-10-06'), covers: awaiting([e1, e2], ids).map((e) => e.id) };
ok(v2.id === `orb_2026-10_${T('2026-10-06')}` && verificationId('orb', '2026-11', [legacy], 1) === 'orb_2026-11', 'first signature of a month keeps the old id, later ones get their own');
ok(v2.covers.length === 1 && v2.covers[0] === 'o2', 'a verification covers only the entries still waiting');
ids = verifiedIds([e1, e2], [legacy, v2]);
ok(awaiting([e1, e2], ids).length === 0, 'after it nothing waits');

// An amendment after verification goes back for re-verification.
const e1b: any = { ...e1, id: 'o1b', supersedes: 'o1', text: 'first, corrected', editReason: 'wrong tank', editedBy: 'Master', at: T('2026-10-07') };
const all = [e1, e2, e1b];
ids = verifiedIds(all, [legacy, v2]);
const book = current(all);
ok(entryStatus(e1b, all, ids) === 'reverify', 'amended after verification → re-verification');
ok(awaiting(book, ids).map((e: any) => e.id).join() === 'o1b', 'only the amended entry waits');
ok(/^Amended — awaiting re-verification/.test(masterCell(e1b, all, [legacy, v2], false)) && /^Superseded · was verified/.test(masterCell(e1, all, [legacy, v2], true)), 'printed stage: amended entry and its superseded original');

// The page prints the original under its amendment.
const lines = withEarlier(book.filter((e: any) => e.date.startsWith('2026-10')), all);
ok(lines.length === 3 && lines.some((l) => l.r.id === 'o1' && l.earlier), 'original kept on the page as an earlier version');
const { rows, struck } = copyRows(book as any[], all, [legacy, v2], (r: any) => [r.date, r.code, r.text], 2);
const orig = rows.findIndex((r) => r[2].startsWith('[Earlier version]'));
ok(orig >= 0 && struck[orig] && !struck[rows.findIndex((r) => r[2].includes('corrected'))], 'earlier version struck, the current one not');
ok(rows.some((r) => /ID crew-1/.test(r[3]) && /entered 02\.10\.2026 10:00 UTC/.test(r[3])), 'officer column: name, ID, time entered (UTC)');
ok(rows.some((r) => /ID crew-1/.test(r[3]) && /changed 07\.10\.2026 10:00 UTC by Master/.test(r[3])), 'an amended entry keeps its officer; the change is the amender\'s');
ok(verificationLines([legacy, v2]).length === 2 && /1 entry$/.test(verificationLines([v2])[0]), 'one line per signature with what it covered');

// The PDF: every page numbered "Page n of N", the software and print time on each.
const many = Array.from({ length: 70 }, (_, i) => [`0${(i % 9) + 1}.10.2026`, 'I', `Remark ${i}`, 'Officer', 'Awaiting verification']);
const doc = trueCopyDoc({ title: 'Oil Record Book — Part I · October 2026', subtitle: 'TEST · IMO 1234567', vessel: 'TEST · IMO 1234567', orientation: 'portrait', head: ['Date', 'Code', 'Record', 'Officer', 'Master'], rows: many, struck: many.map(() => false), verifications: [], awaiting: 70, printedAt: T('2026-10-25', '14:05') });
const n = doc.getNumberOfPages();
const raw = String(doc.output());
ok(n >= 2, `long month runs to ${n} pages`);
ok(Array.from({ length: n }, (_, i) => raw.includes(`Page ${i + 1} of ${n}`)).every(Boolean), 'every page says "Page n of N"');
ok((raw.match(/Certified true copy/g) ?? []).length === n, 'a true-copy line for the Master on every page');
ok(raw.includes('Printed 25.10.2026 14:05 UTC') && raw.includes('electronic record book, version'), 'print time (UTC) and software version in the footer');

// The board reminds the Master of entries waiting more than a day.
const today = '2026-10-25';
const base: any = { on: (k: string) => k === 'orb', role: 'superadmin', me: null, today, now: `${today}T13:00`, labelOf: (k: any) => k, periodsOf: () => [], flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [], fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [], visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [] };
const nowMs = Date.parse(`${today}T13:00:00`);
let b = buildBoard({ ...base, orb: all, orbSigns: [legacy, v2] });
ok(b.attention.some((x) => x.key === 'orb:verify' && x.params?.month === '2026-10'), 'the Master is reminded of the amended entry, on its month');
b = buildBoard({ ...base, orb: [{ ...e2, id: 'fresh', at: nowMs - 3600_000 }], orbSigns: [] });
ok(!b.attention.some((x) => x.key === 'orb:verify'), 'an entry made an hour ago is not nagged about yet');
b = buildBoard({ ...base, role: 'admin', orb: all, orbSigns: [legacy, v2] });
ok(!b.attention.some((x) => x.key === 'orb:verify'), 'officers do not see the Master’s verification');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
