// check:publicfns — limits on the public HTTP endpoints (functions/publicLimits.js,
// submitObs, inspectView; plan item 61, 7 Nov 2026).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const fn = (f: string) => require(path.join(process.cwd(), 'functions', f)); // run from the repo root, where functions/ has its own node_modules
const L = fn('publicLimits');
const O = fn('submitObs');
const I = fn('inspectView');
const fs = require('fs');

let n = 0, bad = 0;
const ok = (c: boolean, label: string) => { n++; if (c) console.log(`✓ ${label}`); else { bad++; console.log(`✗ ${label}`); } };

// ---- the window counter
const H = 3600_000, T0 = 1_000 * H;
ok(JSON.stringify(L.nextCount(null, 3, H, T0)) === JSON.stringify({ since: T0, count: 1 }), 'first take opens a window');
ok(L.nextCount({ since: T0, count: 2 }, 3, H, T0 + 1000)?.count === 3, 'third of three is allowed');
ok(L.nextCount({ since: T0, count: 3 }, 3, H, T0 + 1000) === null, 'fourth within the window is refused');
ok(L.nextCount({ since: T0, count: 3 }, 3, H, T0 + H)?.count === 1, 'a new window starts after it');
ok(L.nextCount({ count: 99 }, 3, H, T0)?.count === 1, 'a broken record starts afresh');

// ---- an observation from the QR form
const good = { kind: 'near_miss', topic: 'Mooring', what: 'Line parted at bitt' };
ok(!O.readObs(good).error, 'a plain observation is read');
ok(O.readObs({ ...good, kind: 'x' }).error === 'invalid kind', 'unknown kind refused');
ok(!!O.readObs({ ...good, topic: '  ' }).error, 'empty topic refused');
ok(!!O.readObs({ ...good, topic: 7 }).error, 'topic that is not text refused');
ok(!!O.readObs({ ...good, what: 'ab' }).error, 'what under 3 characters refused');
ok(!!O.readObs({ ...good, what: 'x'.repeat(2001) }).error, 'what over 2000 characters refused');
ok(O.readObs({ ...good, what: 'x'.repeat(2000) }).what.length === 2000, '2000 characters accepted');
ok(O.readObs({ ...good, topic: 't'.repeat(500) }).topic.length === 120, 'topic capped at 120');
ok(O.readObs({ ...good, location: 'l'.repeat(500) }).location.length === 120, 'location capped at 120');
ok(O.readObs({ ...good, name: 'n'.repeat(500) }).name.length === 80, 'name capped at 80');
ok(O.readObs({ ...good, name: { a: 1 } }).name === '', 'a name that is not text is dropped');
ok(O.readObs(undefined).error === 'invalid kind', 'no body at all refused');
ok(O.OBS_PER_HOUR === 30, '30 observations an hour per vessel');

// ---- the inspector's page
const page = I.htmlPage({ name: '<img src=x onerror=alert(1)>', flag: '"Malta"', imo: '1234567', callSign: "9H<b>", expiry: '2026-12-01', byCat: {}, openDefects: null, openNcs: null, today: '2026-11-07' });
ok(!page.includes('<img src=x'), 'vessel name is not HTML on the inspector\'s page');
ok(page.includes('&lt;img src=x onerror=alert(1)&gt;'), '…it is shown as text');
ok(page.includes('&quot;Malta&quot;') && page.includes('9H&lt;b&gt;'), 'flag and call sign escaped too');
ok(L.escHtml(null) === '' && L.escHtml("a&b'") === 'a&amp;b&#39;', 'escHtml handles null, & and \'');

// ---- every public HTTP function has an instance cap
for (const f of ['submitObs.js', 'inspectView.js', 'icsCalendar.js', 'api.js']) {
  const src: string = fs.readFileSync(path.join(process.cwd(), 'functions', f), 'utf8');
  const calls = src.match(/onRequest\(\{[^}]*\}/g) || [];
  ok(calls.length > 0 && calls.every((c) => c.includes('maxInstances: PUBLIC_MAX_INSTANCES')), `${f}: onRequest capped`);
}
const all = fs.readdirSync(path.join(process.cwd(), 'functions')).filter((f: string) => f.endsWith('.js'));
const uncapped = all.filter((f: string) => {
  const src: string = fs.readFileSync(path.join(process.cwd(), 'functions', f), 'utf8');
  return (src.match(/onRequest\(\{[^}]*\}/g) || []).some((c) => !c.includes('maxInstances'));
});
ok(uncapped.length === 0, `no other onRequest without a cap${uncapped.length ? ': ' + uncapped.join(', ') : ''}`);

console.log(`\n${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
