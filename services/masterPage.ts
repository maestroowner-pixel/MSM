// ===================================
// The Master's page (screens/MasterSc): its rows — the menu, its pages and
// buttons — and what each cell holds for one device. Pure, so check:access
// tests it.
// ===================================

import { MANAGE_COLUMNS, MANAGE_ROUTE, ManageKey, TabKey, pageKey, releasedTabs, visibleTabs } from '../constants/access';
import { moduleOn } from '../constants/modules';
import { MENU_CHILDREN, MENU_GROUPS, MENU_LABEL } from '../utils/navOrder';
import { StoreRoom, storeRooms } from '../types/stores';
import type { EnrolledDevice } from '../types/role';

export type Row =
  | { kind: 'group'; id: string; label: string }
  | { kind: 'fixed'; id: string; label: string; icon: string }
  | { kind: 'tab'; id: string; label: string; icon: string; tab: TabKey }
  | { kind: 'page'; id: string; label: string; icon: string; tab?: TabKey; page: string; officers?: boolean }
  | { kind: 'manage'; id: string; label: string; tab?: TabKey; manage: ManageKey }
  | { kind: 'rank'; id: string; label: string; tab?: TabKey };

/** What the rank decides on each entry — shown so the Master sees it in the same place. */
export const BY_RANK: Record<string, string[]> = {
  Drills: ['Plan drills, draw up the year'],
  Security: ['Close and sign a search; areas and teams'],
  Sopep: ['SOPEP docs (officers)'],
  Documents: ['Issue and revise documents'],
};


const FIXED = ['Dashboard', 'Equipment', 'Settings'];
const FIXED_ICON: Record<string, string> = { Dashboard: 'view-dashboard-outline', Equipment: 'toolbox-outline', Settings: 'cog-outline' };

/** The table's rows, in the menu's order — only what this build has. */
export function masterRows(storeRoomList: StoreRoom[]): Row[] {
  const released = new Map(releasedTabs().map((t) => [t.route, t]));
  const out: Row[] = [];
  for (const g of MENU_GROUPS) {
    const entries = g.routes.filter((r) => FIXED.includes(r) || released.has(r));
    if (!entries.length) continue;
    out.push({ kind: 'group', id: `g:${g.key}`, label: g.label || 'Always on' });
    for (const r of entries) {
      const t = released.get(r);
      const name = MENU_LABEL[r] ?? t?.label ?? r;
      if (!t) {
        out.push({ kind: 'fixed', id: r, label: name, icon: FIXED_ICON[r] ?? 'circle-small' });
        continue;
      }
      out.push({ kind: 'tab', id: r, label: name, icon: t.icon, tab: t.key });
      const kids = r === 'Stores'
        ? storeRooms(storeRoomList).map((x) => ({ view: x.id, label: x.name, icon: 'warehouse', officers: false, route: undefined as string | undefined }))
        : (MENU_CHILDREN[r] ?? []).filter((k) => !k.module || moduleOn(k.module)).map((k) => ({ view: k.view, label: k.label, icon: k.icon, officers: !!k.officers, route: k.route }));
      for (const k of kids) out.push({ kind: 'page', id: `${r}/${k.route ?? ''}:${k.view}`, label: k.label, icon: k.icon, tab: t.key, page: pageKey(k.route ?? r, k.view), officers: k.officers });
      const mc = MANAGE_COLUMNS.find((x) => x.key === MANAGE_ROUTE[r] && moduleOn(x.module));
      if (mc) out.push({ kind: 'manage', id: `m:${r}`, label: `⚙ ${mc.label}`, tab: t.key, manage: mc.key });
      for (const what of BY_RANK[r] ?? []) out.push({ kind: 'rank', id: `r:${r}:${what}`, label: what, tab: t.key });
    }
  }
  return out;
}

/**
 * One cell: does the device have it (glows), and may the Master switch it here
 * (`locked` when the rank decides, or its menu entry is off for that device).
 */
export function masterCell(r: Exclude<Row, { kind: 'group' }>, d: Pick<EnrolledDevice, 'role' | 'tabs' | 'hidePages' | 'manage'>): { on: boolean; locked: boolean; why?: string } {
  const master = d.role === 'superadmin';
  const officer = master || d.role === 'admin';
  const tabOn = (t?: TabKey) => !t || visibleTabs(d.tabs, master).has(t);
  switch (r.kind) {
    case 'fixed':
      return { on: true, locked: true, why: 'always on' };
    case 'tab':
      return { on: tabOn(r.tab), locked: master, ...(master ? { why: 'the Master has everything' } : {}) };
    case 'page': {
      if (r.officers && !officer) return { on: false, locked: true, why: 'officers only' };
      const parent = tabOn(r.tab);
      return { on: parent && (master || !(d.hidePages ?? []).includes(r.page)), locked: master || !parent, ...(!parent ? { why: 'its menu entry is off' } : {}) };
    }
    case 'manage': {
      const parent = tabOn(r.tab);
      return { on: parent && (master || (d.manage ?? []).includes(r.manage as ManageKey)), locked: master || !parent, ...(!parent ? { why: 'its menu entry is off' } : {}) };
    }
    case 'rank':
      return { on: tabOn(r.tab) && officer, locked: true, why: 'by rank' };
  }
}
