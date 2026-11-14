// npm run check:modules — a vessel's module list adds to the build and takes away
// from it, and Fleet's office parts agree.
import { MODULES, ModuleKey, STANDALONE_MODULES, cleanModules, isStandalone, moduleListed, moduleLocked, moduleOn, moduleOnFor, setStandalone, setVesselModules, vesselModuleKeys } from '../constants/modules';
import { officeParts } from '../services/officeInbox';

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${what}`); };

const released = 'dp' as ModuleKey;
const dark = 'dpEditor' as ModuleKey;
ok(MODULES[released] && !MODULES[dark], 'the test uses one module on in the build and one off');

ok(moduleOn(released) && !moduleOn(dark), 'no list: as the build');
setVesselModules({ [released]: false, [dark]: true });
ok(!moduleOn(released), 'false takes away a module the build has on');
ok(moduleOn(dark), 'true adds a module the build has off');
ok(vesselModuleKeys().join() === dark, 'the vessel\'s additions are only what it added');
ok(setVesselModules({ [released]: false, [dark]: true }) === false, 'the same list again changes nothing');
ok(setVesselModules({}) === true && moduleOn(released) && !moduleOn(dark), 'list gone: back to the build');

const clean = cleanModules({ dp: false, ai: true, moc: 'yes', nonsense: true, fuel: null });
ok(JSON.stringify(clean) === JSON.stringify({ ai: true, dp: false }), 'typed by hand: only known keys with true or false survive');
ok(JSON.stringify(cleanModules(null)) === '{}', 'no field at all: nothing');

ok(!moduleOnFor(released, { [released]: false }) && moduleOnFor(dark, { [dark]: true }), 'from outside the vessel: the same answer');
ok(moduleOnFor(released, undefined) && !moduleOnFor(dark, null), 'from outside, no list: the build');

// A device without a vessel: the register only.
ok(!isStandalone(), 'no browser storage, nothing said: as the build');
ok(setStandalone(true) === true && !moduleOn(released) && moduleOn('pms') && moduleOn('crewCerts'), 'without a vessel: the register, no DP');
ok(!moduleOn('chat') && !moduleOn('ai') && !moduleOn('board'), 'without a vessel: no chat, AI or Board');
ok(moduleListed(released) && moduleLocked(released) && !moduleLocked('pms'), 'without a vessel: DP listed with a lock, PMS open');
ok(!moduleListed(dark) && !moduleLocked(dark), 'a module off in the build is not even listed');
ok([...STANDALONE_MODULES].every((k) => MODULES[k]), 'the standalone set is all released modules');
setVesselModules({ chat: true });
ok(!moduleOn('chat'), 'a stale vessel list does not open a module without a vessel');
ok(moduleOnFor(released, undefined), 'Fleet reading a vessel is not this device');
ok(setStandalone(false) === true && moduleOn(released) && moduleOn('chat') && !moduleLocked(released), 'joined a vessel: all of it back, nothing locked');
setVesselModules({});
ok(setStandalone(false) === false, 'the same again changes nothing');

const parts = officeParts({ modules: { poApproval: false, moc: true } }, () => true);
ok(!parts.po && parts.moc && parts.office, 'Fleet\'s office parts: the vessel\'s word first');
ok(!officeParts({ modules: {} }, () => false).po, 'Fleet\'s office parts: else the build');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
