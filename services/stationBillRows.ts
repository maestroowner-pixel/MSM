// ===================================
// The muster list on paper — one sheet per alarm (fire, abandon ship, man
// overboard, oil spill, security by ISPS level), or the whole list: the roster,
// every alarm, the areas of responsibility. English always, like every paper.
// Pure, so check:stationbill reaches it; services/stationBillReport.ts prints it.
// ===================================

import type { MachineHistory } from './pmsHistory';
import { AlarmKind, ALARMS, BillRow, DutyKey, StationBill, ZoneKind } from '../types/stationBill';

export const ALARM_EN: Record<AlarmKind, string> = {
  fire: 'Fire',
  abandon: 'Abandon ship',
  mob: 'Man overboard',
  sopep: 'Oil spill (SOPEP)',
  security: 'Security',
};
const LEVEL_KEYS: DutyKey[] = ['sec1', 'sec2', 'sec3'];
const ZONE_EN: Record<ZoneKind, string> = { space: 'Space', boat: 'Boat / raft', station: 'Station', other: 'Other' };

const dmy = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const nameOf = (r: BillRow) => r.name ?? '— not filled —';

function facts(b: StationBill, today: string, current: boolean): string[] {
  return [
    `Revision ${b.rev}, in force from ${dmy(b.issuedAt)}`,
    current ? 'Current revision' : 'SUPERSEDED',
    `Issued by ${b.issuedBy}`,
    `Printed ${today.split('-').reverse().join('.')}`,
  ];
}

/** Station, duty, area — the columns of one alarm, for one duty key. */
function dutyTable(b: StationBill, key: DutyKey, title: string) {
  const zones = new Map(b.zones.map((z) => [z.id, z.name]));
  const rows = b.rows
    .filter((r) => r.duties[key])
    .map((r) => {
      const d = r.duties[key]!;
      return [String(r.no), r.position, nameOf(r), d.station ?? '', d.duty, d.zoneId ? zones.get(d.zoneId) ?? '' : ''];
    });
  return { title, head: ['No.', 'Position', 'Name', 'Station', 'Duty', 'Area'], rows: rows.length ? rows : [['', '', '', '', 'No duties on this list', '']], widths: { 0: 10, 1: 32, 2: 38, 3: 40, 4: 117, 5: 40 } };
}

const signTable = (b: StationBill) => ({
  title: 'Master',
  head: ['Name', 'Signature', 'Date', 'Ship’s stamp'],
  rows: [[b.issuedBy, '', dmy(b.issuedAt), '']],
  widths: { 0: 70, 1: 90, 2: 40, 3: 77 },
});

/** One alarm: its signal, then who does what. Security has a table per ISPS level. */
export function alarmSheet(b: StationBill, kind: AlarmKind, today: string, current = true): MachineHistory {
  const signal = b.signals[kind];
  const tables = kind === 'security'
    ? LEVEL_KEYS.map((k, i) => dutyTable(b, k, `ISPS security level ${i + 1}`))
    : [dutyTable(b, kind, 'Duties')];
  return {
    title: `Muster list — ${ALARM_EN[kind]}`,
    facts: [...facts(b, today, current), ...(signal ? [`Signal: ${signal}`] : [])],
    tables: [...tables, signTable(b)],
  };
}

/** The whole list: the roster with deputies, every alarm, the areas of responsibility, the signals. */
export function billSheets(b: StationBill, today: string, current = true): MachineHistory[] {
  const roster: MachineHistory = {
    title: 'Muster list',
    facts: facts(b, today, current),
    tables: [
      ...(b.note ? [{ title: 'What changed', head: [''], rows: [[b.note]], widths: { 0: 277 } }] : []),
      {
        title: 'Signals',
        head: ['Alarm', 'Signal'],
        rows: ALARMS.map((k) => [ALARM_EN[k], b.signals[k] ?? '']),
        widths: { 0: 50, 1: 227 },
      },
      {
        title: 'Positions',
        head: ['No.', 'Position', 'Name', 'Stands in for them'],
        rows: b.rows.map((r) => {
          const dep = r.deputyNo ? b.rows.find((x) => x.no === r.deputyNo) : undefined;
          return [String(r.no), r.position, nameOf(r), dep ? `${dep.no} — ${dep.position}` : ''];
        }),
        widths: { 0: 12, 1: 70, 2: 95, 3: 100 },
      },
      {
        title: 'Areas of responsibility',
        head: ['Area', 'Kind'],
        rows: b.zones.filter((z) => !z.removed).map((z) => [z.name, ZONE_EN[z.kind]]),
        widths: { 0: 200, 1: 77 },
      },
      signTable(b),
    ],
  };
  return [roster, ...ALARMS.map((k) => alarmSheet(b, k, today, current))];
}

/** A person's own duties as lines — their card and "My documents". */
export function personLines(b: StationBill, rows: BillRow[]): { key: DutyKey; text: string }[] {
  const zones = new Map(b.zones.map((z) => [z.id, z.name]));
  const out: { key: DutyKey; text: string }[] = [];
  for (const r of rows) {
    for (const key of ['fire', 'abandon', 'mob', 'sopep', 'sec1', 'sec2', 'sec3'] as DutyKey[]) {
      const d = r.duties[key];
      if (!d) continue;
      out.push({ key, text: [d.station, d.duty, d.zoneId ? zones.get(d.zoneId) : ''].filter(Boolean).join(' · ') });
    }
  }
  return out;
}
