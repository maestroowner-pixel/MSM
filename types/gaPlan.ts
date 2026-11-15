// ===================================
// The ship's plan (GA) — deck sheets and the points on them (flag gaPlan,
// 14 Nov 2026; competitor-features.md item 69).
//
// A SHEET is one picture of one deck (Main deck, Tank top…), uploaded once by
// an officer. Its image travels as a photo of the sheet record (services/
// photoQueue → Storage under the sheet's id), so the record stays small and a
// new picture is a new photo id, never an overwrite of the old file.
//
// A PIN puts a record on a sheet: x and y are 0–1 of the picture's width and
// height, so a pin stays put whatever size the picture is drawn at. Pins are
// their own collection, keyed by the record — `defect_<id>`, `yard_<id>` — and
// NOT a field on the defect or the yard job: an app older than 2.75 rewriting
// a defect would drop a field it does not know, and the pin with it. One pin
// per record; moving it rewrites it; taking it off is `removed`, never a delete
// (lists merge by union, a deleted row would come back on the next pull).
// ===================================

import { Attachment } from './equipment';

export interface GaSheet {
  id: string;
  /** "Main deck", "Tank top", "Profile" — what the crew call it. */
  name: string;
  /** Order on the tabs, 1, 2, 3… */
  order: number;
  /** The picture: one photo (a JPEG or PNG). A new picture is a new photo, not a changed one. */
  photos: Attachment[];
  /** Size of the picture in pixels, taken when it was added — the pins are fractions of it. */
  w: number;
  h: number;
  by: string;
  at: number;
  /** Taken off the plan — kept so its pins still name a deck in old papers. */
  removed?: { by: string; at: number };
  updatedAt: number;
}

export type GaPinKind = 'defect' | 'yard';
export const GA_PIN_KINDS: GaPinKind[] = ['defect', 'yard'];

export interface GaPin {
  /** `<kind>_<record id>` — one pin per record. */
  id: string;
  kind: GaPinKind;
  /** The PmsDefect or YardJob id. */
  ref: string;
  sheetId: string;
  /** 0–1 across and down the picture. */
  x: number;
  y: number;
  by: string;
  at: number;
  removed?: { by: string; at: number };
  updatedAt: number;
}

export const gaPinId = (kind: GaPinKind, ref: string) => `${kind}_${ref.replace(/\//g, '_')}`;
