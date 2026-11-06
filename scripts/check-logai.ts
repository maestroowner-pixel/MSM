// npm run check:logai — voice into the logs: only real fields and readings in range, empty boxes only, remarks added under (plan AI-8).
import { applyLog, paramsForAi, readDeck, readEngine } from '../services/logAi';
import { scrubNames, peopleOf } from '../services/incidentAi';
import { WatchParam } from '../types/watchLog';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

// Deck, at sea.
const d = readDeck({
  time: '1530',
  fields: {
    latDeg: 43, latMin: '21,5', latHem: 'n', lonDeg: 8, lonMin: 25, lonHem: 'W',
    courseGyro: 45, speed: '12', windDir: 'ne', windBft: 4, seaState: 3, visibility: 'Good', pressure: 1013,
    courseMagnetic: 400, rpm: 'about a hundred', windBftX: 3, wxCondition: 'Rain', tempAir: null,
  },
  remarks: ' 15:30 Pilot on board.\r\n\n\n\n15:45 Pilot ladder secured. ',
  unclear: ['Which engine?', '', 'a', 'b', 'c', 'd'],
}, 'sea');
ok(d.time === '15:30', 'time 1530 → 15:30');
ok(d.values.latDeg === '43' && d.values.latMin === '21.5' && d.values.latHem === 'N' && d.values.lonDeg === '8' && d.values.lonHem === 'W', 'position, a comma as the decimal point, hemisphere in capitals');
ok(d.values.windDir === 'NE' && d.values.visibility === 'good' && d.values.windBft === '4', 'wind direction and visibility to the form\'s words');
ok(!('courseMagnetic' in d.values) && !('rpm' in d.values) && !('windBftX' in d.values) && !('wxCondition' in d.values) && !('tempAir' in d.values), 'course over 360, words for a number, an unknown field, port weather at sea, null: left out');
ok(d.dropped === 4, `four counted as dropped (${d.dropped})`);
ok(d.remarks === '15:30 Pilot on board.\n\n15:45 Pilot ladder secured.', 'remarks trimmed, blank lines squeezed');
ok(d.unclear.length === 4 && d.unclear[0] === 'Which engine?', 'up to four questions, empty ones go');

// Deck, in port: only the port boxes.
const p = readDeck({ time: '25:10', fields: { speed: 0, latDeg: 43, windDir: 'SW', windBft: 2, wxCondition: 'rain', tempAir: '18' } }, 'port');
ok(!p.time, 'an impossible time goes');
ok(p.values.windDir === 'SW' && p.values.wxCondition === 'Rain' && p.values.tempAir === '18' && !('speed' in p.values) && !('latDeg' in p.values), 'in port: wind, conditions, air — no speed or position');
const h = readDeck({ fields: { latHem: 'S', windBft: 4.5, seaState: 10 } }, 'sea');
ok(!('latHem' in h.values) && !('windBft' in h.values) && !('seaState' in h.values), 'a hemisphere with no degrees, half a Beaufort, sea state 10: left out');

// Engine.
const params: WatchParam[] = [
  { id: 'rpm', name: 'ME RPM', unit: 'rpm', type: 'number', normalMin: 400, normalMax: 600 },
  { id: 'exh', name: 'Exhaust', unit: '°C', type: 'number' },
  { id: 'lo', name: 'LO pressure', unit: 'bar', type: 'number' },
  { id: 'gen', name: 'Generator on line', unit: '', type: 'text' },
];
const sent = paramsForAi(params);
ok(sent.params[0].key === 'P1' && sent.params[0].range === '≥ 400 – ≤ 600' && !('id' in sent.params[0]) && sent.ids.join() === 'rpm,exh,lo,gen', 'readings under P1…, range sent, ids stay aboard');
// The round changed since (exh removed) before the answer came.
const now = params.filter((q) => q.id !== 'exh');
const e = readEngine({ values: { P1: 520, P2: 380, P3: 'four', P4: 'DG2', P9: 1, P5: null }, remarks: 'Changed over fuel filter.' }, now, sent.ids);
ok(e.values.rpm === '520' && e.values.gen === 'DG2', 'a figure on its reading, words on a text reading');
ok(!('exh' in e.values) && !('lo' in e.values) && e.dropped === 3, `a reading gone from the round, words for a number, a key not sent: dropped (${e.dropped})`);

// Into the form.
const a = applyLog({ rpm: '', gen: 'DG1', lo: ' ' }, 'Fuel purifier cleaned.', e);
ok(a.values.rpm === '520' && a.values.gen === 'DG1' && a.filled === 1 && a.kept === 1, 'empty boxes filled, what was typed stays and is counted');
ok(a.remarks === 'Fuel purifier cleaned.\nChanged over fuel filter.', 'remarks under the ones there');
ok(applyLog({}, 'x. Changed over fuel filter.', e).remarks === 'x. Changed over fuel filter.', 'remarks already saying it are not repeated');
ok(applyLog({ rpm: '520' }, '', e).kept === 0, 'the same figure typed is not "kept"');
ok(applyLog({}, '', { values: {}, unclear: [], dropped: 0 }).remarks === '', 'nothing said, nothing changes');

// Names out before it goes.
const people = peopleOf({ crew: [{ name: 'Anna Berg', rank: '2nd Officer' }] });
ok(scrubNames('Anna Berg took over the watch', people).text === '[2nd Officer] took over the watch', 'a name goes as the rank');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
