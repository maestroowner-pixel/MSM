// npm run check:service — a station's report finds its items, and applying it touches only what was ticked.
import { applyReport, certificateFor, fromAiRows, matchReport, normSerial, remarkFor, resultOf } from '../services/serviceReport';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const it = (id: string, o: any = {}): any => ({ id, category: 'fire_extinguishers', type: 'CO2 5 kg', updatedAt: 1, ...o });

ok(normSerial('CO2-00123') === normSerial('co2 123') && normSerial('CO2/123') === 'CO2123' && normSerial('000') === '0', 'serials: case, separators and leading zeros ignored');
ok(resultOf('Passed') === 'ok' && resultOf('CONDEMNED - corrosion') === 'condemned' && resultOf('Refill required') === 'fail' && resultOf('Replaced with new') === 'replaced' && resultOf('') === '', 'results read from the station\'s words');

// What the AI returns for a typical extinguisher certificate.
const rep = fromAiRows([
  { 'Certificate No': 'FM-4471', 'Service station': 'Firemaster Palma', Equipment: 'Portable fire extinguishers', 'Service date': '2026-10-12', 'Next service': '2027-10-12' },
  { 'Serial number': 'AB-00123', No: '12', Description: 'CO2 5 kg', Result: 'Passed' },
  { 'Serial number': '', No: '3', Description: 'Foam 9 L', Result: 'Condemned — cylinder corroded' },
  { 'Serial number': 'ZZ999', No: '40', Description: 'Powder 6 kg', Result: 'ok' },
]);
ok(rep.number === 'FM-4471' && rep.issuer === 'Firemaster Palma' && rep.serviceDate === '2026-10-12' && rep.nextDate === '2027-10-12', 'header: number, station, dates');
ok(rep.category === 'fire_extinguishers' && rep.lines.length === 3, 'category from the equipment words; header row is not a line');
ok(rep.lines[1].result === 'condemned', 'condemned line');

const flat = [
  it('a', { serial: 'ab 123', no: '1' }),
  it('b', { no: '3' }),
  it('c', { no: '7' }),
  it('d', { category: 'eebd', serial: 'XX1' }),
];
const m = matchReport(rep, flat);
ok(m.matches.some((x) => x.itemId === 'a' && x.how === 'serial') && m.matches.some((x) => x.itemId === 'b' && x.how === 'no'), 'matched by serial, then by No in the category');
ok(m.unmatched.length === 1 && m.unmatched[0] === 2, 'unknown serial and No → listed as unmatched, not guessed');
ok(m.others.join() === 'c', 'category items not in the report offered separately');

// Two items with the same No: none picked.
const twice = matchReport({ ...rep, lines: [{ no: '5', result: 'ok' }] }, [it('x', { no: '5' }), it('y', { no: '5' })]);
ok(twice.matches.length === 0 && twice.unmatched.length === 1, 'an ambiguous No picks nothing');

// One paper for the whole category.
const whole = matchReport({ ...rep, lines: [] }, flat);
ok(whole.matches.map((x) => x.itemId).join() === 'a,b,c' && whole.matches.every((x) => x.how === 'category'), 'no lines → every item of the category');

// Apply.
const picks = m.matches.map((x) => ({ itemId: x.itemId, line: x.line }));
const r = applyReport(flat, rep, picks, 'nextInspection', 5);
const A = r.items.find((x) => x.id === 'a')!;
const B = r.items.find((x) => x.id === 'b')!;
ok(A.nextInspection === '2027-10-12' && A.updatedAt === 5 && /^Serviced 12\.10\.2026 by Firemaster Palma, cert\. FM-4471$/.test(A.remarks!), `passed: next date set, remark "${A.remarks}"`);
ok(B.nextInspection === undefined && /^CONDEMNED at service 12\.10\.2026/.test(B.remarks!) && r.bad === 1, 'condemned: no new date, remark says so');
ok(r.items.find((x) => x.id === 'c') === flat[2] && r.items.find((x) => x.id === 'd') === flat[3], 'unticked items untouched (same object)');
const again = applyReport(r.items, rep, picks, 'nextInspection', 9);
ok(again.changed === 0, 'applying twice changes nothing');
const ex = applyReport(flat, rep, [{ itemId: 'a', line: 0 }], 'expiry', 5).items[0];
ok(ex.expiry === '2027-10-12' && ex.nextInspection === undefined, 'the date can go into Expiry instead');

// The certificate.
const c1 = certificateFor(rep, ['a', 'b'], { fileUri: 'f.pdf', fileName: 'FM-4471.pdf', fileKind: 'document' }, [], 'cert_1', 5);
ok(c1.id === 'cert_1' && c1.scope === 'equipment' && c1.number === 'FM-4471' && c1.issueDate === '2026-10-12' && c1.expiryDate === '2027-10-12' && c1.itemIds.join() === 'a,b' && c1.fileName === 'FM-4471.pdf', 'certificate: number, station, dates, items, the PDF');
const c2 = certificateFor({ ...rep, number: 'fm-4471' }, ['c'], null, [c1], 'cert_2', 6);
ok(c2.id === 'cert_1' && c2.itemIds.join() === 'a,b,c' && c2.fileName === 'FM-4471.pdf', 'the same number again extends the certificate, keeps its file');
ok(remarkFor({ ...rep, issuer: '', number: '' }) === 'Serviced 12.10.2026', 'remark without station or number');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
