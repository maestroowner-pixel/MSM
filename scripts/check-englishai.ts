// npm run check:englishai — into English before it goes ashore: names leave as tokens and come back (plan AI-9).
import { maskPeople, readEnglish } from '../services/englishAi';
import { peopleOf } from '../services/incidentAi';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const people = peopleOf({
  crew: [{ name: 'Anna Berg', rank: '2nd Officer' }, { name: 'Иван Петров', rank: 'Chief Engineer' }, { name: 'Al', rank: 'AB' }],
  passengers: [{ name: 'Lord Smith' }],
  medTreatments: [{ patient: 'Olga Kim', patientRank: 'Stewardess' }],
});

const m = maskPeople('@Anna Berg, Иван сказал, что Петров и Anna проверили насос. @Office: Smith тоже. Annapurna, Alarm.', people);
ok(!/Anna[ ,]|Berg|Иван|Петров|Smith/.test(m.text), `no name leaves (${m.text})`);
ok(m.text.startsWith('@[P1],'), 'the whole name is one token, the @ stays');
ok(m.text.includes('@Office') && m.text.includes('Annapurna') && m.text.includes('Alarm'), '@Office, a word that starts like a name, a two-letter name: untouched');
ok(Object.keys(m.tokens).length === 5 && m.tokens['[P1]'] === 'Anna Berg', `five tokens, each what was written (${JSON.stringify(m.tokens)})`);

const same = maskPeople('Anna and anna', people);
ok(same.text === '[P1] and [P2]' && same.tokens['[P2]'] === 'anna', 'the same name written differently comes back as written');

const pre = maskPeople('Ref [P1] by Anna', people);
ok(pre.text === 'Ref [P1] by [P2]', 'a [P1] already in the text is not taken for a name');

const r = readEnglish({ english: '@[P1], [P5] said that [P2] and [P4] checked the pump.\r\n\n\n\n@Office: [P3] too. [P9] left.', from: 'Russian' }, m.text, m.tokens, 'orig');
ok(!!r && r.english.startsWith('@Anna Berg, Иван said that Петров and Anna checked the pump.\n\n@Office: Smith too.'), `names back, blank lines squeezed (${r?.english})`);
ok(!!r && r.english.endsWith('[P9] left.'), 'a token the AI made up stays as it is');
ok(!!r && r.lost.length === 0 && r.from === 'Russian' && !r.same, 'nothing lost, the language read');

const lost = readEnglish({ english: '[P1] checked it.' }, m.text, m.tokens, 'orig');
ok(!!lost && lost.lost.length === 4 && lost.lost.includes('Smith'), `names the English left out are listed (${lost?.lost})`);

ok(readEnglish({ english: '  ' }, '', {}, 'x') === null && readEnglish({ english: 42 } as any, '', {}, 'x') === null && readEnglish(null as any, '', {}, 'x') === null, 'empty or not text: nothing');
const s = readEnglish({ english: 'Pump leaking.', from: 'English' }, 'Pump leaking.', {}, ' Pump leaking. ');
ok(!!s && s.same, 'given back unchanged: said so, nothing to take');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
