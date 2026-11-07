// ===================================
// Chemicals aboard (types/chemicals.ts, plan item 65) — pure. What a card is
// missing, the SDS the AI read put onto a card, a risk assessment started from
// the card, and the order the list reads in.
//
// An SDS is reviewed when the supplier revises it; with no revision in five
// years it is asked for again (the usual company rule — REACH asks the supplier
// to revise it when anything is learnt, and five years without one is a sheet
// nobody is keeping). A hazardous product (a signal word on its SDS) wants a
// risk assessment made from its card and approved, where permits are on.
// ===================================

import type { Hazard, RiskAssessment } from '../types/permits';
import { CHEM_USE_EN, CHEM_USES, ChemUse, Chemical, ChemStock, FirstAid, GHS, GHS_EN, Ghs } from '../types/chemicals';

export const SDS_YEARS = 5;

export type ChemIssue = 'noSds' | 'oldSds' | 'noRa' | 'unchecked';

/** The SDS's date plus five years, yyyy-mm-dd — when it is to be asked for again. */
export const sdsReviewBy = (date: string) => `${Number(date.slice(0, 4)) + SDS_YEARS}${date.slice(4, 10)}`;

/** The newest assessment made from this card — an approved one first. */
export function raFor(c: Pick<Chemical, 'id'>, risks: RiskAssessment[]): RiskAssessment | undefined {
  const mine = risks.filter((r) => r.chemId === c.id && !r.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
  return mine.find((r) => r.approved) ?? mine[0];
}

export function chemIssues(c: Chemical, risks: RiskAssessment[], today: string, ptwOn: boolean): ChemIssue[] {
  const out: ChemIssue[] = [];
  if (!c.sds) out.push('noSds');
  else if (c.sdsDate && sdsReviewBy(c.sdsDate) < today) out.push('oldSds');
  if (ptwOn && c.signal && !raFor(c, risks)?.approved) out.push('noRa');
  if (c.sds && !c.checked) out.push('unchecked');
  return out;
}

export interface ChemBoard {
  noSds: Chemical[];
  oldSds: Chemical[];
  noRa: Chemical[];
  unchecked: Chemical[];
}

export function chemBoard(chems: Chemical[], risks: RiskAssessment[], today: string, ptwOn: boolean): ChemBoard {
  const b: ChemBoard = { noSds: [], oldSds: [], noRa: [], unchecked: [] };
  for (const c of chems) if (!c.deleted) for (const i of chemIssues(c, risks, today, ptwOn)) b[i].push(c);
  return b;
}

/** Dangerous first, then by name. */
export function sortChems(chems: Chemical[]): Chemical[] {
  const w = (c: Chemical) => (c.signal === 'danger' ? 0 : c.signal === 'warning' ? 1 : 2);
  return chems.filter((c) => !c.deleted).sort((a, b) => w(a) - w(b) || a.name.localeCompare(b.name));
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Search by name, maker, place, UN number or a hazard code. */
export function chemMatches(c: Chemical, q: string): boolean {
  const s = fold(q.trim());
  if (!s) return true;
  return [c.name, c.maker, c.un, ...c.stock.map((x) => x.place), ...(c.hazards ?? [])].some((v) => v && fold(v).includes(s));
}

export const stockLine = (s: ChemStock) => [s.place, s.qty != null ? `${s.qty}${s.unit ? ` ${s.unit}` : ''}` : s.unit].filter(Boolean).join(' — ');

// ---- the SDS read by the AI (functions/ai.js `sds`) ----

export interface SdsAiReply {
  isSds?: boolean;
  name?: string;
  maker?: string;
  date?: string;
  lang?: string;
  use?: string;
  signal?: string;
  ghs?: string[];
  hazards?: string[];
  ppe?: string;
  firstAid?: FirstAid;
  fire?: string;
  spill?: string;
  storage?: string;
  incompatible?: string;
  un?: string;
  unreadable?: string;
}

/** What the SDS gives, as the card holds it — the fields "Put into the card" writes. */
export type SdsFields = Pick<Chemical, 'sdsDate' | 'sdsLang' | 'signal' | 'ghs' | 'hazards' | 'ppe' | 'firstAid' | 'fire' | 'spill' | 'storage' | 'incompatible' | 'un'>;
export const SDS_FIELDS: (keyof SdsFields)[] = ['sdsDate', 'sdsLang', 'signal', 'ghs', 'hazards', 'ppe', 'firstAid', 'fire', 'spill', 'storage', 'incompatible', 'un'];

const txt = (v: unknown, max = 600) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A real calendar date or nothing — "2023-02-30" or "02/2023" is not one. */
function isoDate(v: unknown): string | undefined {
  const s = txt(v, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : undefined;
}

export interface SdsRead {
  isSds: boolean;
  name?: string;
  maker?: string;
  /** What it is for, as the AI judged from the sheet — only for a card not yet saved. */
  use?: ChemUse;
  fields: SdsFields;
  unreadable?: string;
}

/** The reply as the card can take it: pictograms only of the nine, a date only a real one, nothing empty. */
export function readSds(r: SdsAiReply): SdsRead {
  const ghs = [...new Set((r.ghs ?? []).map((g) => txt(g, 10).toUpperCase().replace(/^GHS\s*0?(\d)$/, 'GHS0$1')))].filter((g): g is Ghs => (GHS as string[]).includes(g)).sort();
  const hazards = [...new Set((r.hazards ?? []).map((h) => txt(h, 200)).filter(Boolean))].slice(0, 20);
  const fa: FirstAid = {};
  for (const k of ['eyes', 'skin', 'inhaled', 'swallowed'] as const) {
    const v = txt(r.firstAid?.[k], 400);
    if (v) fa[k] = v;
  }
  const signal = txt(r.signal, 10).toLowerCase();
  const fields: SdsFields = {};
  const date = isoDate(r.date);
  if (date) fields.sdsDate = date;
  if (txt(r.lang, 30)) fields.sdsLang = txt(r.lang, 30);
  if (signal === 'danger' || signal === 'warning') fields.signal = signal;
  if (ghs.length) fields.ghs = ghs;
  if (hazards.length) fields.hazards = hazards;
  if (Object.keys(fa).length) fields.firstAid = fa;
  for (const k of ['ppe', 'fire', 'spill', 'storage', 'incompatible'] as const) if (txt(r[k])) fields[k] = txt(r[k]);
  const un = txt(r.un, 12).replace(/^UN\s*/i, '');
  if (/^\d{4}$/.test(un)) fields.un = un;
  return {
    isSds: r.isSds !== false,
    ...(txt(r.name, 120) ? { name: txt(r.name, 120) } : {}),
    ...(txt(r.maker, 120) ? { maker: txt(r.maker, 120) } : {}),
    ...((CHEM_USES as string[]).includes(txt(r.use, 20)) ? { use: txt(r.use, 20) as ChemUse } : {}),
    fields,
    ...(txt(r.unreadable, 400) ? { unreadable: txt(r.unreadable, 400) } : {}),
  };
}

/**
 * The SDS onto the card: everything the SDS speaks for is replaced by what this
 * sheet says (an old sheet's PPE must not survive a new one's); the name and the
 * maker only when the card has none, what it is used for only on a card not yet
 * saved (`fresh`). The card then waits for an officer's check.
 */
export function applySds(c: Chemical, s: SdsRead, fresh = false): Chemical {
  const out: Chemical = { ...c };
  for (const k of SDS_FIELDS) delete out[k];
  Object.assign(out, s.fields);
  if (!out.name.trim() && s.name) out.name = s.name;
  if (!out.maker && s.maker) out.maker = s.maker;
  if (fresh && s.use) out.use = s.use;
  out.byAi = true;
  delete out.checked;
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Did what the SDS gives — or the file itself — change? Then the check no longer holds. */
export const sdsChanged = (a: Chemical, b: Chemical) => a.sds?.url !== b.sds?.url || SDS_FIELDS.some((k) => !same(a[k], b[k]));

// ---- a risk assessment from the card ----

type H = Omit<Hazard, 'id'>;
const and = (...parts: (string | undefined)[]) => parts.map((p) => p?.trim().replace(/\.$/, '')).filter(Boolean).join('; ');

/**
 * The hazards of using the product, from its pictograms, with the card's PPE,
 * fire, spill and storage advice as the controls. Ratings are a starting point
 * the officer changes; nothing here is approved.
 */
export function chemHazards(c: Chemical, enclosed: boolean): H[] {
  const g = new Set(c.ghs ?? []);
  const ppe = c.ppe ? `PPE: ${c.ppe}` : 'PPE as the SDS says';
  const out: H[] = [];
  const add = (on: boolean, h: H) => on && out.push(h);
  add(g.has('GHS01'), { hazard: 'Explosion', consequence: 'Fatal injury, fire', likelihood: 2, severity: 5, controls: and('Kept cool, away from heat, shock and friction', 'only the quantity needed', c.storage), residualLikelihood: 1, residualSeverity: 4 });
  add(g.has('GHS02'), { hazard: 'Flammable vapour or liquid catching fire', consequence: 'Burns, fire spreading', likelihood: 3, severity: 4, controls: and('No hot work, smoking or naked lights nearby', 'container closed when not in use', 'ventilation', c.fire ? `Extinguishing: ${c.fire}` : 'extinguisher at hand'), residualLikelihood: 1, residualSeverity: 4 });
  add(g.has('GHS03'), { hazard: 'Oxidiser feeding a fire', consequence: 'Fire spreading fast', likelihood: 2, severity: 4, controls: and('Stored apart from flammables and combustibles', c.incompatible ? `Keep away from: ${c.incompatible}` : undefined), residualLikelihood: 1, residualSeverity: 3 });
  add(g.has('GHS04'), { hazard: 'Gas cylinder under pressure', consequence: 'Cylinder failure, burns or asphyxia', likelihood: 2, severity: 4, controls: and('Cylinder secured upright, valve protected', 'away from heat', 'leak checked'), residualLikelihood: 1, residualSeverity: 3 });
  add(g.has('GHS05'), { hazard: 'Corrosive splash to skin or eyes', consequence: 'Chemical burns, eye damage', likelihood: 3, severity: 4, controls: and(ppe, 'eyewash or clean water at hand', 'pour low, never add water to the concentrate'), residualLikelihood: 1, residualSeverity: 3 });
  add(g.has('GHS06'), { hazard: 'Toxic by breathing, skin contact or swallowing', consequence: 'Poisoning', likelihood: 2, severity: 5, controls: and(ppe, 'ventilation', 'no eating or drinking while working', 'first aid as the SDS says'), residualLikelihood: 1, residualSeverity: 4 });
  add(g.has('GHS07') && !g.has('GHS06'), { hazard: 'Irritation of skin, eyes or airways', consequence: 'Dermatitis, eye or throat irritation', likelihood: 3, severity: 2, controls: and(ppe, 'ventilation'), residualLikelihood: 1, residualSeverity: 2 });
  add(g.has('GHS08'), { hazard: 'Long-term health effects (sensitising, organ damage, cancer)', consequence: 'Lasting illness', likelihood: 2, severity: 4, controls: and(ppe, 'exposure kept short', 'ventilation or a respirator as the SDS says'), residualLikelihood: 1, residualSeverity: 3 });
  add(g.has('GHS09'), { hazard: 'Release to the sea', consequence: 'Pollution, a fine', likelihood: 2, severity: 3, controls: and('Drip tray under it', 'spill kit at hand, scuppers plugged on deck', c.spill), residualLikelihood: 1, residualSeverity: 2 });
  add(!!c.incompatible && !g.has('GHS03'), { hazard: 'Mixing with an incompatible product', consequence: 'Heat, toxic gas or fire', likelihood: 2, severity: 4, controls: and(`Keep away from: ${c.incompatible}`, 'never mixed in one container', 'stored apart'), residualLikelihood: 1, residualSeverity: 3 });
  const vapour = ['GHS02', 'GHS06', 'GHS07', 'GHS08'].some((k) => g.has(k as Ghs)) || (c.hazards ?? []).some((h) => /inhal|vapou?r|fume|gas/i.test(h));
  add(enclosed && vapour, { hazard: 'Vapour building up in a closed space', consequence: 'Asphyxia, poisoning, fire', likelihood: 3, severity: 5, controls: 'Forced ventilation before and during the work; gas test before entry and while working; enclosed space entry permit; a person standing by outside', residualLikelihood: 1, residualSeverity: 4 });
  if (!out.length) out.push({ hazard: 'Contact with the product', consequence: 'Skin or eye irritation', likelihood: 2, severity: 2, controls: ppe, residualLikelihood: 1, residualSeverity: 2 });
  if (c.spill && !g.has('GHS09')) out.push({ hazard: 'Spill', consequence: 'Slips, exposure', likelihood: 2, severity: 2, controls: c.spill, residualLikelihood: 1, residualSeverity: 2 });
  return out;
}

/** The assessment's title and task, in English like the library. */
export function chemRaTitle(c: Chemical, enclosed: boolean) {
  return {
    title: `${c.name} — use${enclosed ? ' in an enclosed space' : ''}`,
    task: [`Using ${c.name}${c.maker ? ` (${c.maker})` : ''}, ${CHEM_USE_EN[c.use].toLowerCase()}.`, c.hazards?.length ? `SDS: ${c.hazards.join('; ')}.` : ''].filter(Boolean).join(' '),
    location: c.stock.map((s) => s.place).filter(Boolean).join(', '),
  };
}

/** The pictograms as words: "Flammable, Corrosive". */
export const ghsLine = (ghs?: Ghs[]) => (ghs ?? []).map((g) => GHS_EN[g]).join(', ');
