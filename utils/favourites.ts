// ===================================
// Favourites (17 Oct 2026: "a star at the top — a drop-down of favourites; any
// file or folder can be added and reached again at once, in two clicks").
//
// A favourite is a PLACE in the app: a screen with its parameters. A folder is a
// menu entry or one of its pages (DP → Checklists, Familiarisation → Safety, an
// equipment category); a file is a record opened from a list (a document, a
// certificate, a checklist, an item). So anything that has a screen can be kept,
// and opening one is navigating there — nothing is copied.
//
// Kept per device (AsyncStorage `msm:favourites`), as the menu order is: the
// bridge tablet and the engineer's phone keep different things at hand. A record
// deleted later stays on the list and opens its screen's own "not found".
// ===================================

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNavigationContainerRef } from '@react-navigation/native';

import { MENU_CHILDREN, MENU_LABEL } from './navOrder';
import { uid } from './id';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The app's one navigation container — index.tsx hands it to NavigationContainer. */
export const navRef = createNavigationContainerRef<any>();

export interface Favourite {
  id: string;
  label: string;
  icon: string;
  /** A tab inside Main (a menu entry), or a screen of its own (a record). */
  tab: boolean;
  route: string;
  params?: Record<string, any>;
  at: number;
}

export interface Place {
  tab: boolean;
  route: string;
  params?: Record<string, any>;
}

const KEY = 'msm:favourites';
let list: Favourite[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((s) => {
      if (s) {
        list = JSON.parse(s);
        emit();
      }
    })
    .catch(() => {});
}

function save(next: Favourite[]) {
  list = next;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export function useFavourites(): Favourite[] {
  load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => list,
    () => list,
  );
}

/** Parameters that say WHICH place — not how it was reached (a "new" form, a one-off flag). */
const TRANSIENT = new Set(['isNew', 'returnTo', 'fresh', 'scanned', 'from']);

export function cleanParams(p?: Record<string, any>): Record<string, any> | undefined {
  if (!p) return undefined;
  const out: Record<string, any> = {};
  for (const k of Object.keys(p).sort()) {
    const v = p[k];
    if (TRANSIENT.has(k) || v === undefined || typeof v === 'function' || (typeof v === 'object' && v !== null)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export const placeKey = (p: Place) => `${p.tab ? 'tab' : 'screen'}:${p.route}:${JSON.stringify(cleanParams(p.params) ?? {})}`;

export function findFavourite(favs: Favourite[], p: Place | null): Favourite | undefined {
  if (!p) return undefined;
  const k = placeKey(p);
  return favs.find((f) => placeKey(f) === k);
}

/** Where the app is now: the tab and its page, or the screen on top with its record. */
export function currentPlace(): Place | null {
  if (!navRef.isReady()) return null;
  const r = navRef.getCurrentRoute();
  if (!r) return null;
  const root = navRef.getRootState();
  const top = root?.routes?.[root.index ?? 0];
  const tab = top?.name === 'Main';
  return { tab, route: r.name, params: cleanParams(r.params as any) };
}

export function addFavourite(p: Place, label: string, icon: string) {
  if (findFavourite(list, p)) return;
  save([...list, { id: uid('fav'), label, icon, tab: p.tab, route: p.route, params: cleanParams(p.params), at: Date.now() }]);
}

export function removeFavourite(id: string) {
  save(list.filter((f) => f.id !== id));
}

export function renameFavourite(id: string, label: string) {
  const t = label.trim();
  if (t) save(list.map((f) => (f.id === id ? { ...f, label: t } : f)));
}

export function moveFavourite(id: string, by: -1 | 1) {
  const i = list.findIndex((f) => f.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  save(next);
}

export function openFavourite(f: Favourite) {
  if (!navRef.isReady()) return;
  if (f.tab) navRef.navigate('Main', { screen: f.route, params: f.params });
  else navRef.navigate(f.route, f.params);
}

/** A record's screen, in words — used when the record itself has no name to give. */
export const SCREEN_LABEL: Record<string, string> = {
  CategoryItems: 'Equipment',
  ItemDetail: 'Equipment item',
  CertificateDetail: 'Certificate',
  InspectionDetail: 'Inspection',
  Doc: 'Document',
  DpCheck: 'Checklist',
  DpTemplates: 'DP checklists',
  CrewMember: 'Crew member',
  Machine: 'Machine',
  PmsJob: 'Maintenance job',
  PmsDefect: 'Defect',
  PmsProject: 'Project',
  Permit: 'Permit to work',
  Risk: 'Risk assessment',
  Nc: 'Non-conformity',
  Drill: 'Drill',
  Meeting: 'Meeting',
  MedItem: 'Medicine',
  Treatment: 'Treatment',
  SparePart: 'Spare part',
  Round: 'Round',
  RestDay: 'Rest day',
  Manual: 'Manual',
  Crew: 'Crew list',
  CrewMatrix: 'Crew matrix',
  Defects: 'Open defects',
  Flagged: 'Flagged',
  Checklists: 'Checklists',
  Handover: 'Handover',
  ServiceReport: 'Service report',
  Fleet: 'Fleet',
  FleetVessel: 'Vessel',
  Expiries: 'LSA / FFE expiries',
};

const SCREEN_ICON: Record<string, string> = {
  CategoryItems: 'folder-outline',
  ItemDetail: 'lifebuoy',
  CertificateDetail: 'certificate-outline',
  Doc: 'file-document-outline',
  DpCheck: 'clipboard-check-outline',
  CrewMember: 'account-outline',
  Machine: 'engine-outline',
  PmsJob: 'wrench-outline',
  Permit: 'file-sign',
  Risk: 'alert-outline',
};

/** A menu page by its tab and view: "Familiarisation › Safety familiarisation". */
export function pageLabel(route: string, view?: string, extra?: { view: string; label: string }[]): { label: string; icon?: string } {
  const head = MENU_LABEL[route] ?? route;
  if (!view) return { label: head };
  for (const [parent, kids] of Object.entries(MENU_CHILDREN)) {
    const k = kids.find((x) => (x.route ?? parent) === route && x.view === view);
    if (k) return { label: parent === route ? `${head} › ${k.label}` : `${MENU_LABEL[parent] ?? parent} › ${k.label}`, icon: k.icon };
  }
  const e = extra?.find((x) => x.view === view);
  if (e) return { label: `${head} › ${e.label}` };
  if (view === 'manage') return { label: `${head} › Settings`, icon: 'cog-outline' };
  return { label: `${head} › ${view.charAt(0).toUpperCase()}${view.slice(1).replace(/[-_]/g, ' ')}` };
}

/**
 * A record's own name, found by its id among the app's lists (documents,
 * certificates, checklists, crew …) — whatever list holds an entry with that id.
 */
export function recordName(data: Record<string, any>, id?: string): string | undefined {
  if (!id) return undefined;
  for (const v of Object.values(data)) {
    if (!Array.isArray(v) || !v.length || typeof v[0] !== 'object') continue;
    const r = v.find((x: any) => x && x.id === id);
    if (!r) continue;
    const name = r.title ?? r.name ?? (r.firstName || r.lastName ? `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() : undefined) ?? r.type ?? r.description;
    const num = r.docNo ?? r.number ?? r.no;
    if (name) return num && !String(name).startsWith(String(num)) ? `${num} ${name}` : String(name);
  }
  return undefined;
}

/** What a place is called and its icon, for the list. */
export function describe(p: Place, data: Record<string, any>, tabIcons: Record<string, string>, extra?: { view: string; label: string }[]): { label: string; icon: string } {
  if (p.tab) {
    const l = pageLabel(p.route, p.params?.view, extra);
    return { label: l.label, icon: l.icon ?? tabIcons[p.route] ?? 'star-outline' };
  }
  const base = SCREEN_LABEL[p.route] ?? p.route.replace(/([a-z])([A-Z])/g, '$1 $2');
  const icon = SCREEN_ICON[p.route] ?? 'file-outline';
  if (p.route === 'CategoryItems' && p.params?.category) {
    const cat = (data.categoryLabel as ((k: string) => string) | undefined)?.(p.params.category);
    return { label: `Equipment › ${cat ?? p.params.category}`, icon };
  }
  if (p.route === 'DpCheck' && p.params?.templateId && !p.params?.id) {
    const t = (data.dpTemplateTitle as ((k: string) => string | undefined) | undefined)?.(p.params.templateId);
    return { label: `New: ${t ?? 'checklist'}`, icon };
  }
  const name = recordName(data, p.params?.id);
  return { label: name ? `${base} · ${name}` : base, icon };
}
