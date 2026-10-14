// npm run check:crewlist — crew list import and FAL Form 5 rows (services/crewList.ts).
import * as XLSX from 'xlsx';
import { CREW_COLUMNS, crewListFileName, crewListGaps, crewListRows, crewTemplateBase64, crewSheetBase64, parseCrewWorkbook, planCrewImport } from '../services/crewList';
import { toCountryCode } from '../constants/countries';
import { CrewMember, CrewPrivate } from '../types/crew';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };

ok(toCountryCode('gb') === 'GB' && toCountryCode('British') === 'GB' && toCountryCode('UK') === 'GB', 'nationality: gb / British / UK → GB');
ok(toCountryCode('Ukrainian') === 'UA' && toCountryCode('Philippines') === 'PH' && toCountryCode('es') === 'ES', 'nationality: Ukrainian → UA, Philippines → PH, es → ES');
ok(toCountryCode('XX') === null && toCountryCode('Atlantis') === null, 'unknown nationality → null, never a guess');

// The template reads back, its example row skipped.
const tpl = parseCrewWorkbook(crewTemplateBase64());
ok(tpl.length === 0, 'blank template (with its example row) imports nobody');

// A filled sheet, columns re-ordered, dates as text and as Excel dates.
const wb = XLSX.utils.book_new();
const head = ['Rank / position', 'Full name ★', 'Nationality', 'Date of birth', 'Passport expiry', 'Port of embarkation', 'Next of kin — name'];
const ws = XLSX.utils.aoa_to_sheet([head, ['Bosun', 'Tom Reed', 'British', '12.03.1990', new Date(Date.UTC(2030, 5, 1)), 'Palma', ''], ['Deckhand', 'Ana Ruiz', 'es', '1995-07-02', '', 'Antibes', 'Pedro Ruiz'], ['Cook', 'Kai Lee', 'Atlantis', '', '', '', '']]);
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
const rows = parseCrewWorkbook(XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }));
ok(rows.length === 3 && rows[0].name === 'Tom Reed' && rows[0].rank === 'Bosun', 're-ordered columns found by heading');
ok(rows[0].nationality === 'GB' && rows[1].nationality === 'ES' && rows[2].nationalityUnknown === 'Atlantis', 'nationalities coded; unknown one reported');
ok(rows[0].dateOfBirth === '1990-03-12' && rows[0].passportExpiry === '2030-06-01', 'dates: dd.mm.yyyy text and real Excel dates');

// Merge with an existing list: Tom exists (signed off, with next of kin), Ana is new.
const T = 1;
const crew: CrewMember[] = [{ id: 'c1', name: 'tom reed', rank: 'AB', active: true, onBoard: false, signOff: '2026-09-01', addedAt: T, updatedAt: T }];
const priv: CrewPrivate[] = [{ id: 'c1', nextOfKin: { name: 'Mary Reed', phone: '+44' }, passportNo: 'P1', updatedAt: T }];
const plan = planCrewImport(rows.slice(0, 2), crew, priv, 100);
ok(plan.updated.join() === 'tom reed' && plan.added.join() === 'Ana Ruiz', 'matched by name (case-insensitive): 1 updated, 1 added');
const tom = plan.members.find((m) => m.id === 'c1')!;
ok(tom.onBoard === true && !('signOff' in tom) && tom.rank === 'Bosun' && tom.signOnPort === 'Palma', 'returning crew signed on, rank and port updated');
const tomP = plan.privates.find((p) => p.id === 'c1')!;
ok(tomP.nextOfKin?.name === 'Mary Reed' && tomP.passportNo === 'P1' && tomP.nationality === 'GB', 'empty cells do not wipe next of kin or passport');

// The list: Master first, gaps reported, file name.
const all: CrewMember[] = [...plan.members, { id: 'm', name: 'Nemo', rank: 'Master', active: true, addedAt: T, updatedAt: T }];
const list = crewListRows(all, plan.privates);
ok(list[0].name === 'Nemo' && list.length === 3, 'crew list: Master first, only those aboard');
ok(list.find((r) => r.name === 'tom reed')!.passport === 'P1, exp. 01.06.2030', 'passport column: number and expiry');
ok(crewListGaps(list).some((g) => g.startsWith('Nemo') && g.includes('nationality')), 'gaps: missing nationality reported');
ok(crewListFileName('MY Alpha', '2026-10-09') === 'Crew list-09102026-MY Alpha.pdf', 'file name');
ok(CREW_COLUMNS[0].startsWith('Full name'), 'template starts with the name column');

// Warnings (services/crewIssues)
import { crewIssues, issueSummary } from '../services/crewIssues';
{
  const today = new Date();
  const iso = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);
  const m: CrewMember = { id: 'x', name: 'Ann', rank: 'AB', active: true, signOn: '2026-01-01', signOnPort: 'Palma', addedAt: 1, updatedAt: 1 };
  const full: CrewPrivate = { id: 'x', dateOfBirth: '1990-01-01', placeOfBirth: 'Riga', nationality: 'LV', passportNo: 'P', passportExpiry: iso(30),
    nextOfKin: { lastName: 'Berg', firstName: 'Ola', phone: '+1', address: 'Riga' }, updatedAt: 1 };
  const certs: any[] = [{ id: 'c', scope: 'crew', crewId: 'x', name: 'ENG1', expiryDate: iso(-2), itemIds: [], createdAt: 1, updatedAt: 1 }];
  const a = crewIssues(m, full, certs, true);
  ok(a[0].level === 'expired' && a.some((i) => i.text === 'passport expires soon') && !a.some((i) => i.level === 'missing'), 'issues: expired cert first, passport due, nothing missing');
  const b = crewIssues(m, { id: 'x', nextOfKin: { name: 'Ola Berg' }, updatedAt: 1 }, [], true);
  ok(b.some((i) => i.text === 'next of kin phone') && b.some((i) => i.text === 'next of kin address') && !b.some((i) => i.text === 'next of kin name'), 'issues: next of kin phone and address required, old one-field name accepted');
  ok(crewIssues(m, undefined, [], false).length === 0, 'a crew device (no private data) reports no false "missing passport"');
  ok(issueSummary(a).startsWith('1 expired · 1 due'), `summary: ${issueSummary(a)}`);
}

// SDM backup import (services/sdmImport)
import { parseSdm, planSdmImport, sdmDate } from '../services/sdmImport';
{
  ok(sdmDate('1977-04.30') === '1977-04-30' && sdmDate('30.04.1977') === '1977-04-30' && sdmDate('x') === '', 'SDM dates: odd separators and day-first');
  const sdm = parseSdm(JSON.stringify({
    personal: { firstName: 'Ivan', lastName: 'Petrenko', birthDate: '1980-02.03', birthPlace: 'Odesa', nationality: 'Ukranian', phone: '+380', email: 'i@p.ua', address: 'Street 1', city: 'Odesa', postalCode: '65000', country: 'Ukraine', appliedPosition: 'Chief Officer' },
    nextOfKin: { name: 'Olena Petrenko', relationship: 'Wife', phone: '+380 1', email: '', address: 'Street 1, Odesa' },
    documents: [
      { category: 'Passport', name: 'Passport', number: 'FA111', expiryDate: '2028-01-01' },
      { category: 'Passport', name: 'Passport', number: 'FB222', expiryDate: '2033-05-05' },
      { category: "Seaman's Book", name: "Seaman's Book", number: 'AB777', expiryDate: '2030-01-01' },
      { category: 'stcw', name: 'Basic Safety Training', number: 'B1', issueDate: '2024-01-01', expiryDate: '2029-01-01', issuePlace: 'Ukraine' },
      { category: 'Diplomas', name: 'CoC Chief Mate', number: 'C9', noExpiryDate: true },
    ],
  }));
  const plan = planSdmImport(sdm, [], [], []);
  ok(plan.isNew && plan.member.name === 'Ivan Petrenko' && plan.member.rank === 'Chief Officer' && plan.member.onBoard === true, 'SDM: new person, named, rank from applied position, signed on');
  ok(plan.priv.passportNo === 'FB222' && plan.priv.passportExpiry === '2033-05-05' && plan.priv.seamansBookNo === 'AB777', 'SDM: latest passport kept; seaman\'s book number');
  ok(plan.priv.nationality === 'UA' && plan.priv.dateOfBirth === '1980-02-03' && plan.priv.homeAddress === 'Street 1, 65000 Odesa, Ukraine', 'SDM: misspelt nationality → UA, date fixed, address joined');
  ok(plan.priv.nextOfKin?.lastName === 'Petrenko' && plan.priv.nextOfKin?.firstName === 'Olena' && plan.priv.nextOfKin?.phone === '+380 1', 'SDM: next of kin split into family / given name');
  const names = plan.certificates.map((c) => c.name).sort().join('|');
  ok(names === 'Basic Safety Training|CoC Chief Mate|Passport', `SDM: certificates — passport once, no seaman's book (${names})`);
  ok(!plan.certificates.find((c) => c.name === 'Passport')!.number, 'SDM: passport certificate carries no number (kept private)');
  // Same file again into the same person: nothing new.
  const again = planSdmImport(sdm, [plan.member], [plan.priv], plan.certificates);
  ok(!again.isNew && again.certificates.length === 0, 'SDM: importing the same file twice adds nothing');
}

// export → import: the crew as it stands comes back in as it is (14 Oct 2026)
{
  const crewA: CrewMember[] = [{ id: 'c1', name: 'Jez Dodd', rank: 'Third Officer', active: true, addedAt: 0, updatedAt: 0, signOn: '2026-09-01', signOnPort: 'Palma' } as any, { id: 'c2', name: 'Old Hand', active: false, addedAt: 0, updatedAt: 0 } as any];
  const privA: CrewPrivate[] = [{ id: 'c1', dateOfBirth: '1990-01-02', nationality: 'GB', passportNo: '123456789', passportExpiry: '2031-01-01', nextOfKin: { lastName: 'Dodd', firstName: 'Ann', phone: '+44 1' }, updatedAt: 0 }];
  const back = parseCrewWorkbook(crewSheetBase64(crewA, privA));
  ok(back.length === 1 && back[0].name === 'Jez Dodd' && back[0].rank === 'Third Officer' && back[0].passportNo === '123456789' && back[0].dateOfBirth === '1990-01-02' && back[0].signOnPort === 'Palma' && back[0].kinFirst === 'Ann', 'export → import: the signed-on crew, papers and next of kin, round trip');
  const plan = planCrewImport(back, crewA, privA);
  ok(plan.updated.length === 1 && !plan.added.length, 'the exported crew imports back as updates, nobody new');
  // an agent's list: surname and given names in two columns
  const ws = XLSX.utils.aoa_to_sheet([['Crew — MY Aurora'], ['Surname', 'Given names', 'Rank / position', 'Passport no.'], ['DODD', 'Jez', '3/O', '999']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'x');
  const two = parseCrewWorkbook(XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }));
  ok(two.length === 1 && two[0].name === 'Jez DODD' && two[0].passportNo === '999', `surname + given names read: ${JSON.stringify(two[0])}`);
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
