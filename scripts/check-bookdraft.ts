// npm run check:bookdraft — the record books' form drafts (services/bookDraft.ts, components/BookDraft.tsx):
// what counts as worth keeping, the round trip through storage, that the books' screens keep, clear and show
// the draft, and that erasing the device drops them.
import { readFileSync } from 'fs';

// AsyncStorage's web build in node: give it a window with a localStorage.
const mem = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  },
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const d = require('../services/bookDraft') as typeof import('../services/bookDraft');

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

(async () => {
  const blank = { code: 'D', date: '2026-11-21', time: '20:00', tank: '', quantity: '', method: '', remarks: '', amounts: {} as Record<string, string>, treated: null as boolean | null };
  ok(!d.draftWorth(blank, blank), 'a new form is not a draft');
  ok(!d.draftWorth({ ...blank, date: '2026-11-20', time: '09:15' }, blank), 'date and time alone are not a draft');
  ok(!d.draftWorth({ ...blank, remarks: '   ' }, blank), 'spaces are not a draft');
  ok(!d.draftWorth({ ...blank, amounts: { A: '' } }, blank), 'a category ticked with no amount and nothing else — still nothing typed');
  ok(d.draftWorth({ ...blank, tank: 'Sludge tank' }, blank), 'a typed field is a draft');
  ok(d.draftWorth({ ...blank, code: 'C' }, blank), 'another code chosen is a draft');
  ok(d.draftWorth({ ...blank, treated: false }, blank), 'a yes/no answered is a draft');
  ok(d.draftWorth({ ...blank, amounts: { A: '0.2' } }, blank), 'an amount is a draft');

  ok(await d.saveBookDraft('orb', { ...blank, tank: 'Sludge', quantity: '1.5' }, blank), 'kept');
  ok(mem.has(`${d.BOOK_DRAFT_PREFIX}orb`), `stored under ${d.BOOK_DRAFT_PREFIX}orb`);
  const back = await d.loadBookDraft('orb', { ...blank, extra: 'x' } as any);
  ok(!!back && (back.f as any).tank === 'Sludge' && (back.f as any).quantity === '1.5', 'comes back as typed');
  ok(!!back && (back.f as any).extra === 'x', 'a field added since takes its blank value');
  ok(!!back && Math.abs(back.at - Date.now()) < 5000, 'carries when it was kept');
  ok(!(await d.loadBookDraft('garbage', blank)), 'one book does not see another book\'s draft');
  ok(!(await d.saveBookDraft('orb', blank, blank)) && !mem.has(`${d.BOOK_DRAFT_PREFIX}orb`), 'an emptied form forgets the draft');
  await d.saveBookDraft('ballast', { ...blank, tank: 'WB 1' }, blank);
  await d.clearBookDraft('ballast');
  ok(!(await d.loadBookDraft('ballast', blank)), 'cleared after signing');
  mem.set(`${d.BOOK_DRAFT_PREFIX}ods`, '{not json');
  ok((await d.loadBookDraft('ods', blank)) === null, 'a broken draft is ignored, not thrown');

  // The screens.
  const src = (p: string) => readFileSync(p, 'utf8');
  for (const [file, store] of [['screens/OrbSc.tsx', 'appendRow(storage.ORB_KEY, e)'], ['screens/LogBookSc.tsx', 'appendRow(store.key, e)'], ['screens/GarbageSc.tsx', 'addGarbage(e)']]) {
    const s = src(file);
    ok(/useBookDraft\(\{ book: /.test(s), `${file}: keeps a draft`);
    ok(/\{bookDraft\.ui\}/.test(s), `${file}: shows it in the form`);
    const at = s.indexOf(store);
    ok(at > 0 && /bookDraft\.clear\(\)/.test(s.slice(at, at + 200)), `${file}: clears it once the entry is written`);
  }
  ok(/off: !!editing/.test(src('screens/GarbageSc.tsx')), 'Garbage: an amendment is not kept as the new entry\'s draft');
  ok(/if \(!editing\) bookDraft\.clear\(\)/.test(src('screens/GarbageSc.tsx')), 'Garbage: signing an amendment leaves the new entry\'s draft');
  ok(/book_draft:/.test(src('services/storage.ts').slice(src('services/storage.ts').indexOf('export async function resetAllData'))), 'erasing the device drops the drafts');
  ok(!/book_draft/.test(src('services/firebaseService.ts')) && !/book_draft|bookDraft/.test(src('services/backup.ts')), 'never synced, not in the .msm');
  const hook = src('components/BookDraft.tsx');
  ok(/setTimeout\([\s\S]{0,200}500\)/.test(hook), 'kept half a second after a change (ISO 21745: at least every 15 min)');
  ok(/pending\.current\) void saveBookDraft/.test(hook), 'closing the form or leaving the screen keeps the last change');

  console.log(fail ? `\n${fail} FAILED` : '\nAll passed');
  process.exit(fail ? 1 : 0);
})();
