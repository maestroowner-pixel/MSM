// ===================================
// Crew cards and visitor passes as stickers for the label printer (Xprinter,
// TSPL over Bluetooth) — off the roll the ship already has for equipment
// labels, for a card holder or a lanyard tag. The printer draws the QR itself.
// Pure (no Expo), so check:gangway tests the payloads.
// ===================================

import { TsplLabelSpec } from './tspl';
import { crewQrPayload, passQrPayload, storeQrPayload } from './crewQr';
import { CrewMember } from '../types/crew';

/** The rolls a gangway sticker is worth printing on (sizes as services/qrLabel LABEL_STOCKS). */
export const GANGWAY_STOCKS = ['100x50', '60x40', '50x30'] as const;
export type GangwayStock = (typeof GANGWAY_STOCKS)[number];
export const GANGWAY_STOCK_MM: Record<GangwayStock, { widthMm: number; heightMm: number; qrMm: number }> = {
  '100x50': { widthMm: 100, heightMm: 50, qrMm: 34 },
  '60x40': { widthMm: 60, heightMm: 40, qrMm: 26 },
  '50x30': { widthMm: 50, heightMm: 30, qrMm: 20 },
};

export function crewCardSpecs(crew: Pick<CrewMember, 'id' | 'name' | 'rank'>[], vessel: { vessel_name?: string } | null, size: GangwayStock): TsplLabelSpec[] {
  const st = GANGWAY_STOCK_MM[size];
  return crew.map((c) => ({
    ...st,
    qrPayload: crewQrPayload(c.id),
    name: c.name,
    lines: [c.rank ?? '', vessel?.vessel_name ?? '', 'CREW CARD - scan at the gangway'].filter(Boolean),
  }));
}

export function visitorPassSpecs(count: number, vessel: { vessel_name?: string } | null, size: GangwayStock): TsplLabelSpec[] {
  const st = GANGWAY_STOCK_MM[size];
  return Array.from({ length: count }, (_, i) => {
    const no = String(i + 1).padStart(2, '0');
    return {
      ...st,
      qrPayload: passQrPayload(no),
      name: `VISITOR ${no}`,
      lines: [vessel?.vessel_name ?? '', 'Wear while on board', 'Return at the gangway'].filter(Boolean),
    };
  });
}

/** Store labels for the door or the shelf — the ID large, the name and place under it (types/stores.ts StoreRoom). */
export function storeLabelSpecs(rooms: { id: string; code: string; name: string; location?: string }[], vessel: { vessel_name?: string } | null, size: GangwayStock): TsplLabelSpec[] {
  const st = GANGWAY_STOCK_MM[size];
  return rooms.map((r) => ({
    ...st,
    qrPayload: storeQrPayload(r.id),
    name: r.code,
    lines: [r.name, r.location ?? '', vessel?.vessel_name ?? ''].filter(Boolean),
  }));
}
