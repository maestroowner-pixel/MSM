// npm run check:fleet — the superintendent's per-vessel summary (services/fleetSummary.ts).
import { fleetOrder, summarise, VesselData } from '../services/fleetSummary';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const base: VesselData = {
  imo: '9000001', name: 'MY Alpha', registerAt: 1, items: [], certificates: [], crew: [], docs: [], acks: [],
  machines: [], jobs: [], spares: [], moves: [],
};
const v: VesselData = {
  ...base,
  certificates: [
    { id: 'a', name: 'Raft', expiryDate: iso(-3), itemIds: [], createdAt: 0, updatedAt: 0 },
    { id: 'b', name: 'SMC', scope: 'vessel', expiryDate: iso(20), itemIds: [], createdAt: 0, updatedAt: 0 },
    { id: 'c', name: 'STCW', scope: 'crew', expiryDate: iso(400), itemIds: [], createdAt: 0, updatedAt: 0 },
    { id: 'd', name: 'ENG1', scope: 'crew', expiryDate: iso(-1), itemIds: [], createdAt: 0, updatedAt: 0 },
  ],
  crew: [
    { id: 'c1', name: 'Jez', active: true, addedAt: 0, updatedAt: 0 },
    { id: 'c2', name: 'Ana', active: true, addedAt: 0, updatedAt: 0 },
  ],
  docs: [
    { id: 'd1', title: 'ESE', category: 'procedure', revision: 2, issued: iso(-10), updatedAt: 0 },
    { id: 'd2', title: 'Ref', category: 'policy', revision: 1, issued: iso(-10), mustRead: false, updatedAt: 0 },
    { id: 'd3', title: 'Old', category: 'other', revision: 1, issued: iso(-10), deleted: true, updatedAt: 0 },
  ],
  acks: [{ id: 'x', docId: 'd1', revision: 2, docTitle: 'ESE', personKey: 'c1', by: 'Jez', at: 0, updatedAt: 0 }],
  spares: [{ id: 'p', name: 'Impeller', minQty: 2, updatedAt: 0 }],
  moves: [],
};
const s = summarise(v);
ok(s.certs.expired === 1 && s.vesselCerts.due === 1, 'equipment cert expired, vessel cert due (≤ 60 d)');
ok(s.crewCerts.expired === 1 && s.crewCerts.due === 0, 'crew certs: one expired, one valid');
ok(s.docs === 2 && s.docsOutstanding === 1 && s.signaturesMissing === 1, 'withdrawn docs ignored; reference doc never outstanding; Ana has not signed');
ok(s.sparesOut === 1, 'a part with no movements is out of stock');

const clean = summarise({ ...base, imo: '2', name: 'MY Bravo' });
const due = summarise({ ...base, imo: '3', name: 'MY Charlie', certificates: [{ id: 'z', name: 'x', expiryDate: iso(10), itemIds: [], createdAt: 0, updatedAt: 0 }] });
const order = [clean, due, s].sort(fleetOrder).map((x) => x.name);
ok(order.join() === 'MY Alpha,MY Charlie,MY Bravo', 'fleet order: anything expired first, then due, then clean');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
