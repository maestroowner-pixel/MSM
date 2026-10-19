// Dev-only: seed deck log, gangway visitors and landing reports.
// Called from DeckLogSc via __DEV__ guard — never ships in production.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeckEntry } from '../types/deckLog';
import { Visitor } from '../types/security';
import { LandingReport, ItemMovement } from '../types/movement';
import { EquipmentItem } from '../types/equipment';
import { DECK_LOG_KEY, VISITORS_KEY, LANDINGS_KEY, ITEM_MOVEMENTS_KEY } from './storage';
import { uid } from '../utils/id';

function isoDay(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const now = Date.now();

export function seedDeckLog(): DeckEntry[] {
  const entries: DeckEntry[] = [];

  // ── Day 0 (today) — At Sea ──────────────────────────────────────────────
  const d0 = isoDay(0);
  entries.push({
    id: uid(), date: d0, time: '00:00', period: '00-04',
    latDeg: 36, latMin: 42.3, latHem: 'N', lonDeg: 28, lonMin: 15.7, lonHem: 'E',
    courseGyro: 185, courseMagnetic: 182, variation: -3,
    speed: 12.4, rpm: 118, distanceRun: 49.6,
    windDir: 'NE', windBft: 4, seaState: 3, visibility: 'good', pressure: 1012, tempAir: 19,
    remarks: 'Watch commenced. Engine at full ahead. Autopilot engaged.',
    by: 'A. Kowalski', byRank: '2/O', at: now - 86400000 * 0 - 3600000 * 4,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d0, time: '04:00', period: '04-08',
    latDeg: 36, latMin: 10.1, latHem: 'N', lonDeg: 27, lonMin: 58.4, lonHem: 'E',
    courseGyro: 183, courseMagnetic: 180, variation: -3,
    speed: 12.1, rpm: 116, distanceRun: 48.4,
    windDir: 'NNE', windBft: 5, seaState: 4, visibility: 'good', pressure: 1010, tempAir: 18,
    remarks: 'Wind freshened. Reduced speed slightly. Crossed shipping lane, met two vessels.',
    by: 'M. Petrov', byRank: '3/O', at: now - 3600000 * 4,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d0, time: '08:00', period: '08-12',
    latDeg: 35, latMin: 38.9, latHem: 'N', lonDeg: 27, lonMin: 41.2, lonHem: 'E',
    courseGyro: 182, courseMagnetic: 179, variation: -3,
    speed: 12.6, rpm: 120, distanceRun: 50.2,
    windDir: 'N', windBft: 3, seaState: 2, visibility: 'good', pressure: 1013, tempAir: 22,
    remarks: 'Calm watch. Master on bridge 08:30–09:00. Altered course 2° to port.',
    by: 'S. Nikitin', byRank: 'C/O', at: now,
    updatedAt: now,
  });

  // ── Day 1 — At Sea, rougher weather ────────────────────────────────────
  const d1 = isoDay(1);
  entries.push({
    id: uid(), date: d1, time: '00:00', period: '00-04',
    latDeg: 38, latMin: 5.2, latHem: 'N', lonDeg: 29, lonMin: 33.1, lonHem: 'E',
    courseGyro: 188, courseMagnetic: 185, variation: -3,
    speed: 11.8, rpm: 115, distanceRun: 47.2,
    windDir: 'NW', windBft: 6, seaState: 5, visibility: 'moderate', pressure: 1005, tempAir: 17,
    remarks: 'Weather deteriorating. Rolling 8–10°. Speed reduced.',
    by: 'A. Kowalski', byRank: '2/O', at: now - 86400000,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d1, time: '08:00', period: '08-12',
    latDeg: 37, latMin: 22.4, latHem: 'N', lonDeg: 29, lonMin: 10.5, lonHem: 'E',
    courseGyro: 187, courseMagnetic: 184, variation: -3,
    speed: 10.5, rpm: 108, distanceRun: 42.0,
    windDir: 'NNW', windBft: 7, seaState: 6, visibility: 'moderate', pressure: 1002, tempAir: 16,
    remarks: 'Master on bridge. Speed further reduced to 10.5 kn. Fire and boat drill completed 10:00–10:45.',
    by: 'S. Nikitin', byRank: 'C/O', at: now - 86400000 + 3600000 * 4,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d1, time: '12:00', period: 'noon',
    latDeg: 37, latMin: 0.0, latHem: 'N', lonDeg: 28, lonMin: 55.0, lonHem: 'E',
    courseGyro: 185, speed: 10.5, distanceRun: 262.4,
    windDir: 'NNW', windBft: 7, seaState: 5, visibility: 'moderate', pressure: 1003, tempAir: 17,
    remarks: 'Noon position. Total distance since departure: 262.4 nm. Weather improving.',
    by: 'S. Nikitin', byRank: 'C/O', at: now - 86400000 + 3600000 * 8,
    updatedAt: now,
  });

  // ── Day 2 — In Port (Bodrum) ────────────────────────────────────────────
  const d2 = isoDay(2);
  entries.push({
    id: uid(), date: d2, time: '08:00', period: 'port', mode: 'port',
    wxCondition: 'Clear',
    remarks: 'Vessel moored at Bodrum quay No. 3 portside to. All moorings tight. Port agent on board.',
    by: 'S. Nikitin', byRank: 'C/O', at: now - 86400000 * 2,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d2, time: '12:00', period: 'port', mode: 'port',
    wxCondition: 'Clear',
    remarks: 'Cargo operations commenced. Customs clearance completed. Shore power connected.',
    by: 'M. Petrov', byRank: '3/O', at: now - 86400000 * 2 + 3600000 * 4,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d2, time: '20:00', period: 'port', mode: 'port',
    wxCondition: 'Clear',
    remarks: 'Cargo operations completed. All crew onboard. Departure preparations underway.',
    by: 'A. Kowalski', byRank: '2/O', at: now - 86400000 * 2 + 3600000 * 12,
    updatedAt: now,
  });

  // ── Day 3 — At Sea, fine weather ────────────────────────────────────────
  const d3 = isoDay(3);
  entries.push({
    id: uid(), date: d3, time: '00:00', period: '00-04',
    latDeg: 36, latMin: 30.0, latHem: 'N', lonDeg: 26, lonMin: 20.0, lonHem: 'E',
    courseGyro: 90, courseMagnetic: 87, variation: -3,
    speed: 13.0, rpm: 124, distanceRun: 52.0,
    windDir: 'S', windBft: 2, seaState: 1, visibility: 'good', pressure: 1018, tempAir: 21,
    remarks: 'Departed Bodrum 23:30. Fine weather. Full ahead.',
    by: 'M. Petrov', byRank: '3/O', at: now - 86400000 * 3,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d3, time: '04:00', period: '04-08',
    latDeg: 36, latMin: 29.8, latHem: 'N', lonDeg: 27, lonMin: 32.5, lonHem: 'E',
    courseGyro: 91, courseMagnetic: 88, variation: -3,
    speed: 13.2, rpm: 125, distanceRun: 52.8,
    windDir: 'SSE', windBft: 2, seaState: 1, visibility: 'good', pressure: 1019, tempAir: 20,
    remarks: 'Quiet watch. Passed Rhodes TSS northbound.',
    by: 'A. Kowalski', byRank: '2/O', at: now - 86400000 * 3 + 3600000 * 4,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d3, time: '20:00', period: '20-00',
    latDeg: 36, latMin: 31.4, latHem: 'N', lonDeg: 30, lonMin: 10.2, lonHem: 'E',
    courseGyro: 92, courseMagnetic: 89, variation: -3,
    speed: 12.9, rpm: 122, distanceRun: 51.6,
    windDir: 'E', windBft: 3, seaState: 2, visibility: 'good', pressure: 1016, tempAir: 22,
    remarks: 'ETA Antalya 06:00 tomorrow. Pilot request sent.',
    by: 'S. Nikitin', byRank: 'C/O', at: now - 86400000 * 3 + 3600000 * 20,
    updatedAt: now,
  });

  // ── Day 4 — At Sea → unsaved draft ─────────────────────────────────────
  const d4 = isoDay(4);
  entries.push({
    id: uid(), date: d4, time: '08:00', period: '08-12',
    latDeg: 37, latMin: 55.0, latHem: 'N', lonDeg: 31, lonMin: 44.0, lonHem: 'E',
    courseGyro: 276, courseMagnetic: 273, variation: -3,
    speed: 12.7, rpm: 121, distanceRun: 50.8,
    windDir: 'W', windBft: 3, seaState: 2, visibility: 'good', pressure: 1015, tempAir: 20,
    remarks: 'Passage from Istanbul. Bosphorus transit completed 04:30.',
    by: 'S. Nikitin', byRank: 'C/O', at: now - 86400000 * 4 + 3600000 * 8,
    updatedAt: now,
  });
  entries.push({
    id: uid(), date: d4, time: '12:00', period: 'noon',
    latDeg: 37, latMin: 54.1, latHem: 'N', lonDeg: 30, lonMin: 28.5, lonHem: 'E',
    courseGyro: 274, speed: 12.5, distanceRun: 301.0,
    windDir: 'W', windBft: 4, seaState: 3, visibility: 'good', pressure: 1013, tempAir: 19,
    remarks: '',
    by: '', at: 0, draft: true,
    updatedAt: now,
  });

  return entries;
}

// ── Inspector scenario: visitors + landing report ───────────────────────────

export function seedInspectorVisit(flat: EquipmentItem[]): {
  visitor: Visitor;
  landings: LandingReport[];
  movements: ItemMovement[];
  deckEntries: DeckEntry[];
} {
  const today = isoDay(0);
  const t = (h: number, m = 0) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  // Pick one fire extinguisher and one EEBD from the register (fallback to stubs).
  const fe = flat.find((i) => i.category === 'fire_extinguishers') ?? null;
  const eebd = flat.find((i) => i.category === 'eebd') ?? null;

  const feId = fe?.id ?? uid();
  const eebdId = eebd?.id ?? uid();
  const landingId = uid('lr');
  const mvFe = uid('mv');
  const mvEe = uid('mv');

  const visitor: Visitor = {
    id: uid('vis'),
    date: today,
    timeIn: t(9, 10),
    timeOut: t(11, 35),
    name: 'Cpt. R. Stavros',
    company: 'Flag State Inspection — Malta Flag',
    purpose: 'Port State Control Inspection',
    idType: 'Seaman\'s book',
    idNo: 'MSB-2024-0441',
    passNo: 'VIS-01',
    host: 'Master',
    port: 'Valletta, Malta',
    berth: 'Grand Harbour, Berth 7',
    inBy: 'A. Kowalski (2/O)',
    outBy: 'A. Kowalski (2/O)',
    remarks: 'PSC inspector. Accompanied by Master throughout. Took FE-07 (ABC portable) and EEBD-12 for sample testing. Landing Report LR-2026-01 issued.',
    updatedAt: now,
  };

  const movements: ItemMovement[] = [
    {
      id: mvFe,
      itemId: feId,
      itemCategory: 'fire_extinguishers',
      itemSnap: fe ? `${fe.no ?? ''} ${fe.type ?? ''} ${fe.position ?? ''}`.trim() : 'FE-07 ABC 6kg Bridge',
      dir: 'ashore',
      landingId,
      date: today,
      to: 'Port State Control — Malta',
      reason: 'PSC sample taken for testing',
      by: 'Cpt. R. Stavros (PSC Inspector)',
      updatedAt: now,
    },
    {
      id: mvEe,
      itemId: eebdId,
      itemCategory: 'eebd',
      itemSnap: eebd ? `${eebd.no ?? ''} ${eebd.type ?? ''} ${eebd.position ?? ''}`.trim() : 'EEBD-12 Engine Room',
      dir: 'ashore',
      landingId,
      date: today,
      to: 'Port State Control — Malta',
      reason: 'PSC sample taken for testing',
      by: 'Cpt. R. Stavros (PSC Inspector)',
      updatedAt: now,
    },
  ];

  const landing: LandingReport = {
    id: landingId,
    no: 'LR-2026-01',
    date: today,
    port: 'Valletta, Malta',
    to: 'Port State Control — Malta',
    dir: 'out',
    movementIds: [mvFe, mvEe],
    notes: 'Items removed by PSC Inspector Cpt. R. Stavros for sample testing. Return expected within 14 days.',
    by: 'S. Nikitin',
    byRank: 'C/O',
    updatedAt: now,
  };

  // Deck log entries for the same port day — created automatically by the inspector workflow.
  const deckEntries: DeckEntry[] = [
    {
      id: uid(),
      date: today,
      time: t(9, 10),
      period: 'port',
      mode: 'port',
      wxCondition: 'Clear',
      remarks: 'PSC Inspector Cpt. R. Stavros (Malta Flag) boarded at gangway. Pass VIS-01 issued. Hosted by Master.',
      by: 'A. Kowalski',
      byRank: '2/O',
      at: now - 3600000 * 2,
      updatedAt: now,
    },
    {
      id: uid(),
      date: today,
      time: t(9, 30),
      period: 'port',
      mode: 'port',
      wxCondition: 'Clear',
      remarks: 'Master and PSC Inspector commenced vessel inspection tour: Bridge → Engine Room → LSA locker → FFE stations.',
      by: 'A. Kowalski',
      byRank: '2/O',
      at: now - 3600000 * 1.5,
      updatedAt: now,
    },
    {
      id: uid(),
      date: today,
      time: t(11, 35),
      period: 'port',
      mode: 'port',
      wxCondition: 'Clear',
      remarks: 'PSC Inspector departed. Landing Report LR-2026-01 issued: 1 × portable fire extinguisher ABC 6kg (FE-07) and 1 × EEBD (EEBD-12) taken ashore for sample testing. Return expected within 14 days.',
      landingRef: landingId,
      landingNo: 'LR-2026-01',
      by: 'A. Kowalski',
      byRank: '2/O',
      at: now - 3600000 * 0.5,
      updatedAt: now,
    },
  ];

  return { visitor, landings: [landing], movements, deckEntries };
}

export async function clearDeckLog(): Promise<void> {
  await AsyncStorage.removeItem(DECK_LOG_KEY);
}
