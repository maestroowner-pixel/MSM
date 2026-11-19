// The web's Content-Security-Policy (firebase.json) names the outside libraries
// by their exact version path (15 Nov 2026): a whole CDN in script-src would let
// anyone's file on it run in our origin. So a version bumped in the app must be
// bumped there too — this fails until it is.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ver = (f) => /const VER = '([^']+)'/.exec(read(f))[1];
const want = [
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${ver('utils/pdfText.web.ts')}/`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${ver('utils/photoEdit.web.ts')}/`,
  // expo-camera's web QR scanner: its worker importScripts() jsQR from jsdelivr (the version is expo-camera's).
  `https://cdn.jsdelivr.net/npm/jsqr@${/jsqr@([\d.]+)\//.exec(read('node_modules/expo-camera/build/web/useWebQRScanner.js'))[1]}/`,
];
let bad = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad++; };
for (const site of JSON.parse(read('firebase.json')).hosting) {
  const csp = (site.headers ?? []).flatMap((x) => x.headers).find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
  const src = (d) => (csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${d} `)) ?? '').split(/\s+/).slice(1);
  ok(!!csp, `${site.target ?? site.site}: has a CSP`);
  for (const d of ['script-src', 'connect-src']) {
    ok(want.every((w) => src(d).includes(w)), `${site.target ?? site.site}: ${d} names pdf.js, MediaPipe and jsQR at the versions the app loads`);
    ok(!src(d).some((x) => /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\/?$/.test(x)), `${site.target ?? site.site}: ${d} does not open a whole CDN`);
  }
  // App Check on the web (services/appCheck.ts): reCAPTCHA Enterprise loads its script and an invisible frame from Google.
  const recaptcha = ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'];
  ok(recaptcha.every((w) => src('script-src').includes(w)), `${site.target ?? site.site}: script-src lets reCAPTCHA in (App Check)`);
  ok(src('frame-src').includes('https://www.google.com/recaptcha/'), `${site.target ?? site.site}: frame-src lets reCAPTCHA's frame in (App Check)`);
  ok(src('connect-src').includes('https://*.googleapis.com'), `${site.target ?? site.site}: connect-src reaches content-firebaseappcheck.googleapis.com`);
  ok(!src('script-src').includes("'unsafe-inline'") && !src('script-src').includes("'unsafe-eval'"), `${site.target ?? site.site}: no inline or eval scripts`);
}
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
