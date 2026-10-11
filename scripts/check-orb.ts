// npm run check:orb — Oil Record Book Part I: what each code needs and how the line reads.
import { orbProblem, orbText } from '../services/orb';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const base: any = { date: '2026-10-11' };
ok(orbProblem({ ...base, code: 'D', tank: 'Bilge holding tank', quantity: 2.4, start: '10:20', stop: '11:05', method: 'ows' }) !== null, 'D through 15 ppm without position → asked for the position');
const d: any = { ...base, code: 'D', tank: 'Bilge holding tank', quantity: 2.4, start: '10:20', stop: '11:05', method: 'ows', place: "43°32.1'N 007°01.4'E – 43°30.0'N 007°05.2'E" };
ok(orbProblem(d) === null, 'D complete');
ok(orbText(d).startsWith('13. 2.4 m³ from Bilge holding tank; 14. 10:20–11:05; 15. Through 15 ppm equipment overboard'), 'D reads with items 13, 14, 15');
const c: any = { ...base, code: 'C', tank: 'Sludge tank', retained: 1.2 };
ok(orbProblem(c) === null && orbText(c) === '11.1 Sludge tank; 11.2 retained 1.2 m³', 'C 11 sludge retained');
ok(orbProblem({ ...base, code: 'C', tank: 'Sludge tank', quantity: 3 }) !== null, 'C 12 without method → asked how');
const h: any = { ...base, code: 'H', place: 'Antibes', grade: 'MGO DMA', quantity: 8.4, tank: 'Port and stbd diesel tanks', bdnNo: 'BDN 4471' };
ok(orbProblem(h) === null && /26.1 Antibes; 26.2 MGO DMA, 8.4 m³ into/.test(orbText(h)), 'H bunkering');
ok(orbProblem({ ...base, code: 'F', start: '09:00' }) !== null, 'F needs what failed');
ok(orbProblem({ ...base, code: 'I', remarks: 'Weekly test of 15 ppm alarm' }) === null, 'I remark');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
