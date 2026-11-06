// npm run check:smsai — a new SMS revision read by the AI changes nothing by itself; keys and lines it makes up are dropped (plan AI-5).
import { changeNoteDraft, currentNote, docsForAi, listsForAi, otherDocs, prevOf, readSms, revText, vesselLists, MAX_LINES } from '../services/smsAi';
import { IsmDoc } from '../types/docs';
import { EquipmentItem } from '../types/equipment';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const item = (category: string): EquipmentItem => ({ id: `i-${category}`, category, updatedAt: 1 } as any);
const lists = vesselLists({ flat: [item('liferafts'), item('fire_extinguishers')], templates: [], dpTemplates: [], watchTemplates: [{ id: 'w1', name: 'ME', params: [{ id: 'p1', name: 'LO pressure', unit: 'bar', type: 'number' } as any], updatedAt: 1 }, { id: 'w2', name: 'Old', params: [], updatedAt: 1, deleted: true }], on: (m) => m === 'ptw' || m === 'watchLog' });
ok(lists.some((l) => l.id.startsWith('round:liferafts.')) && !lists.some((l) => l.id.startsWith('round:lifebuoys')), 'rounds only for the categories the register uses');
ok(lists.some((l) => l.id === 'permit:general') && !lists.some((l) => l.kind === 'dp' || l.kind === 'watch'), 'permits with ptw on; no DP or watch lists with those modules off');
ok(lists.some((l) => l.id === 'engine:w1' && l.lines[0] === 'LO pressure (bar)') && !lists.some((l) => l.id === 'engine:w2'), 'the engine round\'s readings, a deleted round left out');
ok(lists.reduce((n, l) => n + l.lines.length, 0) <= MAX_LINES, 'within the line limit');
const all = vesselLists({ flat: [item('liferafts')], templates: [], dpTemplates: [], watchTemplates: [], on: () => true });
ok(all.some((l) => l.kind === 'dp') && all.some((l) => l.kind === 'watch') && all.every((l) => l.lines.every((x) => !/[{}]/.test(x))), 'DP and watch lists with the modules on, without the {answer} options');
const sent = listsForAi(lists);
ok(sent[0].key === 'K1' && sent.length === lists.length, 'lists under K1…');

const d = (id: string, p: Partial<IsmDoc> = {}): IsmDoc => ({ id, title: id, category: 'procedure', revision: 1, issued: '2026-01-01', updatedAt: 1, ...p });
const docs = [d('a', { docNo: 'SMS-07-03', title: 'Enclosed space entry', revision: 4, body: 'secret words' }), d('b', { title: 'Permit to work' }), d('c', { deleted: true })];
const others = otherDocs(docs, 'a');
ok(others.map((x) => x.id).join() === 'b', 'other documents: not itself, not withdrawn');
ok(!/secret/.test(JSON.stringify(docsForAi(docs))) && docsForAi(docs)[0].docNo === 'SMS-07-03', 'documents go by number and title, not their words');

const K = lists.map((l) => l);
const iL = lists.findIndex((l) => l.id.startsWith('round:liferafts.'));
const key = `K${iL + 1}`;
const r = readSms({
  same: 'yes', summary: 'Gas test every 30 min now.',
  changes: [{ section: '5.2', kind: 'changed', was: 'every hour', now: 'every 30 minutes', crew: true }, { section: '1', kind: 'bogus', now: 'Wording', crew: false }, { kind: 'added' }],
  affected: [
    { key, lines: [1, 99, 1, 'x'], issue: 'conflict', says: 'a', should: 'b', section: '5.2' },
    { key, lines: [1], issue: 'conflict', should: 'dup' },
    { key: 'K999', lines: [1], issue: 'conflict', should: 'made up' },
    { key, lines: [], issue: 'conflict', should: 'no line' },
    { key, lines: [], issue: 'missing', should: 'add a line for X' },
    { key, lines: [2], issue: 'outdated', should: '' },
  ],
  docs: [{ key: 'D1', why: 'refers to it' }, { key: 'D1', why: 'again' }, { key: 'D7', why: 'made up' }, { key: 'D1' }],
}, K, others, true);
ok(r.changes.length === 2 && r.changes[1].kind === 'changed', 'an unknown kind reads as changed; a change with neither was nor now dropped');
ok(r.issues.length === 2 && r.issues[0].lines.map((l) => l.n).join() === '1' && r.issues[0].lines[0].text === lists[iL].lines[0], 'line numbers out of range and repeats dropped; the line\'s own words shown');
ok(r.issues[1].issue === 'missing' && !r.issues.some((x) => x.should === 'made up' || x.should === 'no line' || x.should === 'dup'), 'a made-up key, a conflict without a line, a repeat and an empty "should" are dropped; "missing" may have no line');
ok(r.docs.length === 1 && r.docs[0].doc.id === 'b', 'documents only by a key sent, once');
const alone = readSms({ same: 'no', changes: [{ was: 'x', now: 'y' }] }, K, others, false);
ok(alone.changes.length === 0 && alone.same === 'yes', 'without a revision before there are no changes to show');
ok(readSms({ same: 'no' }, K, others, true).same === 'no', 'different documents are said');
const note = changeNoteDraft(r);
ok(note.startsWith('Gas test') && /5\.2: every 30 minutes \(was: every hour\)/.test(note) && /Other changes:\n- 1: Wording/.test(note), 'the crew note: summary, what changes the work, then the rest');

const a = docs[0];
const p = prevOf({ ...a, fileUri: 'https://x/f.pdf', fileName: 'f.pdf', text: 'T', prev: { revision: 2, issued: '2025-01-01' }, changeNote: { revision: 4, text: 'n', at: 1 } } as IsmDoc);
ok(p.revision === 4 && p.fileUri === 'https://x/f.pdf' && p.body === 'secret words' && !('prev' in p) && !('changeNote' in p), 'the revision before keeps file and words, one step back');
ok(!prevOf({ ...a, fileUri: 'file:///local.pdf', filePending: true }).fileUri, 'a file not shared yet is not kept as the old revision\'s link');
ok(!currentNote({ ...a, changeNote: { revision: 3, text: 'old', at: 1 } }) && !!currentNote({ ...a, changeNote: { revision: 4, text: 'now', at: 1 } }), 'the note shows only for its own revision');
ok(revText({ body: ' ', text: 'x' }) === 'x' && revText({}) === null, 'a revision\'s words: body and file text, nothing when empty');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
