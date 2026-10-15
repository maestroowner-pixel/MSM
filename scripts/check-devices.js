// check:devices — which connections the server retires as duplicates (functions/devices.js).
const assert = require('assert');
const { retirable } = require('../functions/devices');

const H = 60 * 60 * 1000, NOW = 100 * 24 * H;
const dev = (id, seenAgoH, x = {}) => ({ id, firstName: 'Master', lastName: 'Nemo', role: 'superadmin', platform: 'web', approved: true, lastSeenAt: NOW - seenAgoH * H, ...x });
const ids = (r) => r.map((x) => `${x.id}>${x.keep}`).sort();
let n = 0;
const t = (name, f) => { f(); n++; console.log('ok', name); };

t('sweep: the one seen last stays, older ones idle 3 days go', () => {
  assert.deepStrictEqual(ids(retirable([dev('a', 1), dev('b', 80), dev('c', 200)], { now: NOW })), ['b>a', 'c>a']);
});
t('sweep: a second browser used within 3 days stays', () => {
  assert.deepStrictEqual(ids(retirable([dev('a', 1), dev('b', 30)], { now: NOW })), []);
});
t('enrolment: the new one is kept, the others go whatever their age', () => {
  assert.deepStrictEqual(ids(retirable([dev('a', 1), dev('b', 0.1), dev('new', 0)], { keepId: 'new', now: NOW })), ['a>new', 'b>new']);
});
t('enrolment touches only its own group', () => {
  assert.deepStrictEqual(ids(retirable([dev('x', 200), dev('y', 300), dev('new', 0, { firstName: 'Jez' })], { keepId: 'new', now: NOW })), []);
});
t('different rank, kind of device, shore, waiting or switched off: not grouped', () => {
  const r = retirable([dev('a', 1), dev('b', 200, { role: 'admin' }), dev('c', 200, { platform: 'android' }), dev('d', 200, { role: 'shore' }), dev('e', 200, { approved: false }), dev('f', 200, { disabled: true })], { now: NOW });
  assert.deepStrictEqual(ids(r), []);
});
t('name compared without case and extra spaces; no name, no grouping', () => {
  assert.deepStrictEqual(ids(retirable([dev('a', 1), dev('b', 200, { firstName: 'master ', lastName: ' NEMO' })], { now: NOW })), ['b>a']);
  assert.deepStrictEqual(ids(retirable([dev('a', 1, { firstName: '', lastName: '' }), dev('b', 200, { firstName: '', lastName: '' })], { now: NOW })), []);
});
t('never seen: falls back to createdAt', () => {
  assert.deepStrictEqual(ids(retirable([dev('a', 1), { ...dev('b', 0), lastSeenAt: undefined, createdAt: NOW - 200 * H }], { now: NOW })), ['b>a']);
});
console.log(`check:devices — ${n} passed`);
