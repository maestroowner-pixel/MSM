// npm run check:inbox — the superintendent's attention list (services/officeInbox.ts).
import { VesselData } from '../services/fleetSummary';
import { fleetInbox, fleetRed, inboxOf, officeParts, redOf } from '../services/officeInbox';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const today = '2026-11-02';
const H = 3600000;
const now = Date.parse('2026-11-02T08:00:00Z');

const base: VesselData = {
  imo: '9000001', name: 'MY Alpha', registerAt: 1, items: [], certificates: [], crew: [], docs: [], acks: [],
  machines: [], jobs: [], spares: [], moves: [],
};
const all = { office: true, po: true, crit: true, ext: true, moc: true, threads: true };
const none = { office: false, po: false, crit: false, ext: false, moc: false, threads: false };

const machines: any[] = [
  { id: 'me', name: 'Main engine', critical: true },
  { id: 'gen', name: 'Generator 2' },
  { id: 'old', name: 'Old pump', deleted: true },
];
const jobs: any[] = [
  { id: 'j1', machineId: 'gen', title: 'Oil change', intervalDays: 30, lastDoneDate: '2026-08-01' },
  { id: 'j2', machineId: 'gen', title: 'Filter', intervalDays: 30, lastDoneDate: '2026-08-01' },
  { id: 'j3', machineId: 'old', title: 'Gone', intervalDays: 30, lastDoneDate: '2025-01-01' },
];
const close = (at: number) => ({ date: today, note: 'fixed', by: 'C/E', at });
const defects: any[] = [
  { id: 'd1', machineId: 'gen', machineName: 'Generator 2', category: 'operational', description: 'Leak', date: '2026-10-20', by: 'x', at: now - 300 * H, closed: close(now - 50 * H) },
  { id: 'd2', machineId: 'gen', machineName: 'Generator 2', category: 'operational', description: 'Done', date: '2026-10-20', by: 'x', at: 0, closed: close(now - 10 * H), office: { result: 'verified', by: 'S', at: now } },
  { id: 'd3', machineId: 'me', machineName: 'Main engine', category: 'safety', description: 'Governor', date: '2026-10-28', by: 'x', at: now - 120 * H, outOfService: { from: '2026-10-28', by: 'C/E', at: now - 120 * H } },
];
const deferrals: any[] = [
  // j2 deferred in its current cycle → waits; j1's deferral is of an older cycle → does not.
  { id: 'f1', jobId: 'j2', machineId: 'gen', jobTitle: 'Filter', machineName: 'Generator 2', cycle: '2026-08-01|', untilDate: '2026-12-01', reason: 'port', by: 'Master', byRank: 'Master', at: now - 200 * H },
  { id: 'f2', jobId: 'j1', machineId: 'gen', jobTitle: 'Oil change', machineName: 'Generator 2', cycle: '2026-05-01|', untilDate: '2026-06-01', reason: 'old', by: 'Master', at: now - 900 * H },
];
const ncs: any[] = [
  { id: 'n1', no: 'NC-2026-004', title: 'Fire door', closedAt: now - 30 * H, closedBy: 'Master', actions: [], date: today },
  { id: 'n2', no: 'NC-2026-005', title: 'PSC 07105', inspId: 'ei1', actions: [{ id: 'a', text: 'fix', due: '2026-10-25' }], date: '2026-10-10' },
];
const ext: any[] = [{ id: 'ei1', no: 'EI-2026-01', kind: 'psc', date: '2026-10-10', port: 'Palma', detained: true, by: 'Master', at: 0, updatedAt: 0 }];
const orders: any[] = [
  { id: 'o1', no: 'PO-EN-001', dept: 'engine', status: 'draft', date: today, by: 'C/E', at: now - 400 * H, lines: [], approval: [{ kind: 'submit', by: 'C/E', at: now - 100 * H }, { kind: 'master', by: 'Master', byRank: 'Master', at: now - 90 * H }] },
  { id: 'o2', no: 'PO-DK-002', dept: 'deck', status: 'sent', urgency: 'emergency', date: today, by: 'Master', at: now - 5 * H, lines: [], approval: [{ kind: 'emergency', by: 'Master', at: now - 5 * H, note: 'no flares' }] },
  { id: 'o3', no: 'PO-DK-003', dept: 'deck', status: 'draft', date: today, by: 'Bosun', at: 0, lines: [], approval: [{ kind: 'submit', by: 'Bosun', at: now }] },
];
const certs: any[] = [
  { id: 'c1', name: 'SMC', scope: 'vessel', expiryDate: '2026-10-01', itemIds: [], createdAt: 0, updatedAt: 0 },
  { id: 'c2', name: 'ENG1', scope: 'crew', holderName: 'Ana', expiryDate: '2026-10-30', itemIds: [], createdAt: 0, updatedAt: 0 },
  { id: 'c3', name: 'IOPP', scope: 'vessel', expiryDate: '2026-11-20', itemIds: [], createdAt: 0, updatedAt: 0 },
];
const v: VesselData = { ...base, machines, jobs, defects, deferrals, ncs, extInspections: ext, orders, certificates: certs };

const box = inboxOf(v, all);
ok(box.map((x) => x.id).join() === 'o2,f1,o1,d1,n1', `emergency first, then oldest first: ${box.map((x) => x.id).join()}`);
ok(!box.some((x) => x.id === 'd2' || x.id === 'f2' || x.id === 'o3'), 'verified closure, old-cycle deferral, order still with the Master are not the office\'s');
ok(box.find((x) => x.id === 'o1')!.since === now - 90 * H && box.find((x) => x.id === 'o1')!.by === 'Master (Master)', 'a requisition waits from the Master\'s step, signed by him');
ok(box.find((x) => x.id === 'f1')!.tab === 'verify' && box.find((x) => x.id === 'o2')!.tab === 'po', 'rows point at their vessel tab');
ok(inboxOf(v, { ...all, office: false }).every((x) => x.tab === 'po'), 'office loop off: only requisitions');
ok(inboxOf(v, none).length === 0, 'nothing on: nothing waits');

const red = redOf(v, today, all);
const kinds = red.map((l) => l.kind).join();
ok(kinds === 'detained,critOut,critDefects,findingsOverdue,pmsOverdue,certsExpired', `red, worst kind first: ${kinds}`);
ok(red[0].since === '2026-10-10' && red[0].names[0] === 'Palma', 'detention: since when and where');
ok(red[1].names.join() === 'Main engine' && red[1].since === '2026-10-28', 'critical machine out, with the day');
const two = redOf({ ...v, defects: [...defects, { ...defects[2], id: 'd4', outOfService: undefined }] }, today, all).find((l) => l.kind === 'critDefects')!;
ok(two.n === 2 && two.names.join() === 'Main engine' && two.more === 0, 'two defects on one machine: n 2, one name, no "+1"');
const pms = red.find((l) => l.kind === 'pmsOverdue')!;
ok(pms.n === 1 && pms.names[0] === 'Generator 2 — Oil change', 'deferred job not overdue; deleted machine\'s job not counted');
const c = red.find((l) => l.kind === 'certsExpired')!;
ok(c.n === 2 && c.names.join('|') === 'SMC|ENG1 · Ana', 'expired certificates only (due is amber), crew ones with the holder');
ok(redOf(v, today, none).map((l) => l.kind).join() === 'pmsOverdue,certsExpired', 'office modules off: PMS and certificates still red');

const clean: VesselData = { ...base, imo: '2', name: 'MY Bravo' };
const pmsOnly: VesselData = { ...base, imo: '3', name: 'MY Charlie', machines, jobs };
const fr = fleetRed([{ v: clean, on: all }, { v: pmsOnly, on: all }, { v, on: all }], today);
ok(fr.map((r) => r.vessel).join() === 'MY Alpha,MY Charlie', 'fleet red: clean vessel left out, detained one first');
ok(fleetInbox([{ v: clean, on: all }, { v, on: all }]).length === 5, 'fleet inbox: all vessels in one list');

const p = officeParts({ modules: { poApproval: true } }, (k) => k === 'critEq');
ok(p.po && p.crit && !p.office && !p.ext && !p.moc, 'parts: the vessel\'s pilot module or the build\'s flag');

// A change the Master approved for the office (plan item 38): in the inbox, oldest first; not one still aboard.
const mc = (id: string, steps: any[]): any => ({ id, no: `MOC-2026-0${id}`, title: 'Bypass', needsOffice: true, actions: [], steps, at: 1 });
const withMocs: VesselData = { ...clean, mocs: [mc('1', [{ kind: 'master', by: 'Anna', byRank: 'Master', at: 50 }]), mc('2', [{ kind: 'submit', by: 'Liam', at: 5 }]), mc('3', [{ kind: 'master', by: 'Anna', at: 60 }, { kind: 'office', by: 'S', at: 70 }])] };
const mi = inboxOf(withMocs, all).filter((x) => x.kind === 'moc');
ok(mi.length === 1 && mi[0].id === '1' && mi[0].tab === 'moc' && mi[0].by === 'Anna (Master)' && mi[0].since === 50, 'inbox: a change sent to the office, by the Master, since the approval');
ok(!inboxOf(withMocs, { ...all, moc: false }).some((x) => x.kind === 'moc'), 'inbox: module off — no changes');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
