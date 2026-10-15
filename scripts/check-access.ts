// npm run check:access — which tabs a device shows (constants/access.ts).
import { ALL_TABS, MANAGE_ROUTE, canManage, toggleManage, toggleTab, visibleTabs } from '../constants/access';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const list = (s: Set<string>) => [...s].sort().join(',');

ok(visibleTabs(undefined, false).size === ALL_TABS.length, 'never set → every tab (nothing vanishes on update)');
ok(visibleTabs(null, false).size === ALL_TABS.length, 'no record (not connected) → every tab');
ok(visibleTabs([], false).size === 0, 'set to nothing → only the fixed tabs');
ok(list(visibleTabs(['rest'], false)) === 'rest', 'deck phone: rest only');
ok(visibleTabs([], true).size === ALL_TABS.length, 'Master → every tab whatever is stored');
ok(list(visibleTabs(['rest', 'future_tab'], false)) === 'rest', 'unknown key from a newer version is ignored');
ok(!toggleTab(undefined, 'reports').includes('reports') && toggleTab(undefined, 'reports').length === ALL_TABS.length - 1,
  'first tap on a never-set device turns ONE tab off, not all on');
ok(toggleTab(['rest'], 'maintenance').includes('maintenance'), 'tap on red → green');
ok(toggleTab(['rest', 'future_tab'], 'rest').join() === 'future_tab', 'toggle keeps keys this version does not know');

// The menu's own order (utils/navOrder.ts)
import { applyOrder, move } from '../utils/navOrder';
{
  const avail = ['Dashboard', 'Equipment', 'Documents', 'Maintenance', 'Settings'];
  ok(applyOrder(avail, null).join() === avail.join(), 'menu: no saved order → standard order');
  ok(applyOrder(avail, ['Maintenance', 'Gone', 'Dashboard']).join() === 'Maintenance,Dashboard,Equipment,Documents,Settings',
    'menu: saved order first, a screen no longer shown dropped, new screens after');
  ok(move(['A', 'B', 'C'], 'C', -1).join() === 'A,C,B' && move(['A', 'B'], 'A', -1).join() === 'A,B', 'menu: ↑ swaps, top stays top');
}

// Menu groups (utils/navOrder)
import { flatGrouped, grouped, moveInGroup } from '../utils/navOrder';
{
  const order = ['Settings', 'HoursOfRest', 'Documents', 'Dashboard', 'CrewMatrix', 'Equipment', 'Certificates'];
  ok(grouped(order).map((g) => g.group.key).join() === 'ops,crew,docs,system', 'groups in fixed order: inspections, crew, documents, settings last');
  ok(flatGrouped(order).join() === 'Dashboard,Equipment,HoursOfRest,CrewMatrix,Documents,Certificates,Settings', 'flat order keeps the person\'s order inside each group');
  const up = moveInGroup(order, 'CrewMatrix', -1);
  ok(flatGrouped(up).slice(2, 4).join() === 'CrewMatrix,HoursOfRest', '↑ moves within its group');
  ok(moveInGroup(order, 'Dashboard', -1).join() === order.join(), 'top of a group stays there (no jumping groups)');
}


// the gears — only where the Master allows (15 Oct 2026)
ok(!canManage(undefined, 'stores', false, true) && !canManage([], 'sopep', false, true), 'gear: closed by default for a crew or officer device');
ok(canManage(['stores'], 'stores', false, true) && !canManage(['stores'], 'sopep', false, true), 'gear: open only for what the Master switched on');
ok(canManage(undefined, 'sopep', true, true) && canManage(undefined, 'stores', false, false), 'gear: the Master always; a device not joined to a vessel is its own Master');
ok(toggleManage(undefined, 'sopep').join() === 'sopep' && toggleManage(['sopep', 'stores'], 'sopep').join() === 'stores', 'gear: switched on and off');
ok(MANAGE_ROUTE.Stores === 'stores' && MANAGE_ROUTE.Sopep === 'sopep', 'gear: the menu entries it belongs to');
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
