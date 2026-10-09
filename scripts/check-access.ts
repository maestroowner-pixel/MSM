// npm run check:access — which tabs a device shows (constants/access.ts).
import { ALL_TABS, toggleTab, visibleTabs } from '../constants/access';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const list = (s: Set<string>) => [...s].sort().join(',');

ok(visibleTabs(undefined, false).size === ALL_TABS.length, 'never set → every tab (nothing vanishes on update)');
ok(visibleTabs(null, false).size === ALL_TABS.length, 'no record (not connected) → every tab');
ok(visibleTabs([], false).size === 0, 'set to nothing → only the fixed tabs');
ok(list(visibleTabs(['rest'], false)) === 'rest', 'deck phone: rest only');
ok(visibleTabs([], true).size === ALL_TABS.length, 'Master → every tab whatever is stored');
ok(list(visibleTabs(['rest', 'spares'], false)) === 'rest', 'unknown key from a newer version is ignored');
ok(!toggleTab(undefined, 'reports').includes('reports') && toggleTab(undefined, 'reports').length === ALL_TABS.length - 1,
  'first tap on a never-set device turns ONE tab off, not all on');
ok(toggleTab(['rest'], 'maintenance').includes('maintenance'), 'tap on red → green');
ok(toggleTab(['rest', 'spares'], 'rest').join() === 'spares', 'toggle keeps keys this version does not know');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
