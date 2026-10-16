// The setup code of one or more vessels: `npm run code -- 9967093 1234567`.
// Reads the BOOTSTRAP_CODE secret from Secret Manager (your firebase login) and
// prints only the derived codes — never the secret. See ../setupCode.js.
const { execSync } = require('child_process');
const { setupCodeFor } = require('../setupCode');

const imos = process.argv.slice(2).map((a) => a.replace(/\D/g, '')).filter(Boolean);
if (!imos.length) {
  console.error('Usage: npm run code -- <IMO> [<IMO> …]');
  process.exit(1);
}
const secret =
  process.env.BOOTSTRAP_CODE ||
  execSync('npx firebase-tools functions:secrets:access BOOTSTRAP_CODE --project marine-safety-manager', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
for (const imo of imos) {
  const c = setupCodeFor(imo, secret);
  console.log(`IMO ${imo}  setup code ${c.slice(0, 4)} ${c.slice(4, 8)} ${c.slice(8)}`);
}
