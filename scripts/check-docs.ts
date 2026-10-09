// npm run check:docs — who has read the current revision (services/docs.ts).
import { iHaveRead, readStatus, reviewState, toRead } from '../services/docs';
import { CrewMember } from '../types/crew';
import { DocAck, IsmDoc, ackId } from '../types/docs';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const crew: CrewMember[] = [
  { id: 'c1', name: 'Jez Dodd', rank: '3/O', active: true, addedAt: 0, updatedAt: 0 },
  { id: 'c2', name: 'Ana Ruiz', active: true, addedAt: 0, updatedAt: 0 },
  { id: 'c3', name: 'Tom Reed', active: true, addedAt: 0, updatedAt: 0 },
  { id: 'c4', name: 'Left Ship', active: false, addedAt: 0, updatedAt: 0 },
];
const doc: IsmDoc = { id: 'd1', title: 'Enclosed space entry', category: 'procedure', revision: 2, issued: '2026-10-01', updatedAt: 0 };
const ack = (personKey: string, by: string, revision = 2): DocAck => ({
  id: ackId('d1', revision, personKey), docId: 'd1', revision, docTitle: doc.title, personKey, by, at: 0, updatedAt: 0,
});

const acks = [ack('c1', 'Jez Dodd'), ack('device:dev_9', 'ana  ruiz'), ack('c3', 'Tom Reed', 1), ack('x', 'Superintendent')];
const st = readStatus(doc, acks, crew);
ok(st.required === 3, 'retired crew are not required to read');
ok(st.read.map((p) => p.id).sort().join() === 'c1,c2', 'read by id (Jez) and by name signed as a device (Ana, case/space-insensitive)');
ok(st.unread.map((p) => p.id).join() === 'c3', 'Tom signed Rev 1 only → still unread for Rev 2');
ok(st.others.length === 1 && st.others[0].by === 'Superintendent', 'a signature from someone off the list is shown separately');

ok(iHaveRead(doc, acks, 'device:dev_9', 'Ana Ruiz'), 'device account recognised by key');
ok(!iHaveRead({ ...doc, revision: 3 }, acks, 'c1', 'Jez Dodd'), 'new revision → Jez must sign again');
ok(toRead([doc, { ...doc, id: 'd2', mustRead: false }], acks, 'c3', 'Tom Reed').map((d) => d.id).join() === 'd1',
  'reference documents (mustRead false) are never "to read"');

ok(ackId('d1', 2, 'device:dev 9') === 'd1_r2_device:dev_9', 'ack id: one per person per revision, safe characters');
ok(reviewState({ ...doc, reviewDue: '2026-10-01' }, '2026-10-09') === 'overdue', 'review overdue');
ok(reviewState({ ...doc, reviewDue: '2026-10-30' }, '2026-10-09') === 'soon', 'review within 30 days → soon');
ok(reviewState({ ...doc, reviewDue: '2027-03-01' }, '2026-10-09') === null, 'review far off → nothing');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
