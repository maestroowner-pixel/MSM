// npm run check:versions — record versions: amend, cancel, what the book shows.
import { amended, cancelled, current, live, previous } from '../services/versions';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const a: any = { id: 'a', litres: 100, by: 'Ana', updatedAt: 0 };
const b: any = { id: 'b', litres: 50, by: 'Tom', updatedAt: 0 };
const a2 = amended(a, { litres: 120 }, 'a2', 'Read the gauge again', { name: 'Master', rank: 'Master' }, 5);
const b2 = cancelled(b, 'b2', 'Entered twice', { name: 'Master' }, 6);
const all = [a, b, a2, b2];
ok(current(all).map((r) => r.id).join() === 'a2,b2', 'the latest version of each record');
ok(live(all).map((r) => r.id).join() === 'a2', 'cancelled records do not count');
ok(a2.by === 'Ana' && a2.editedBy === 'Master' && a2.editReason === 'Read the gauge again' && a2.supersedes === 'a', 'the original signer kept, the editor and the reason added');
ok(previous(all, a2).map((r) => r.id).join() === 'a', 'the earlier version is kept');
const a3 = amended(a2, { litres: 121 }, 'a3', 'again', { name: 'Master' }, 7);
ok(previous([...all, a3], a3).map((r) => r.id).join() === 'a2,a', 'a chain of changes, newest first');
ok(!('editedByRank' in b2), 'no empty fields (the server refuses undefined)');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
