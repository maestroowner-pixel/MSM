// ===================================
// The emissions year on paper — PDF and Excel, for the verifier and the company,
// who do the submitting. English always. The figures, how they were reached, and
// everything that is missing or does not add up.
// ===================================

import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { vesselHeader } from './export';
import { exportPmsHistory } from './pmsHistoryReport';
import { MachineHistory } from './pmsHistory';
import { applicability, CF_CH4, CF_CO2, CF_N2O, EM_GAP_EN, EmApplies, EmGap, EmYear, splitTotal } from './emissions';
import { EM_CONSUMER_EN, EM_CONSUMERS, EM_METHOD_EN, EM_SHIP_TYPE_EN, EmStatement, EmVessel } from '../types/emissions';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

const n = (x: number | undefined, p = 1) => (x == null ? '—' : x.toLocaleString('en-GB', { maximumFractionDigits: p, minimumFractionDigits: 0 }));
const when = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
const dmyT = (at: number) => new Date(at).toISOString().slice(0, 16).replace('T', ' ');
const APPLIES: Record<EmApplies, string> = { applies: 'Applies', no: 'Does not apply', check: 'Depends on commercial use: confirm with the flag or verifier', unknown: 'Gross tonnage not entered' };
const who = (by: string, rank?: string) => (rank ? `${by} (${rank})` : by);

function particulars(v?: EmVessel) {
  if (!v) return 'Particulars not entered';
  return [EM_SHIP_TYPE_EN[v.type], v.gt != null ? `${n(v.gt, 0)} GT` : '', v.dwt != null ? `${n(v.dwt, 0)} DWT` : '', v.commercial === 'yes' ? 'commercial' : v.commercial === 'no' ? 'not commercial' : ''].filter(Boolean).join(' · ');
}

const totals = (y: EmYear): (string | number)[][] => [
  ['Fuel oil consumed (MGO / diesel)', `${n(y.litres)} L`],
  ['Density used', y.density == null ? '—' : `${n(y.density, 4)} kg/L at 15 °C, ${y.densityFrom === 'year' ? "litre-weighted from the year's BDNs" : 'last BDN before the year'}`],
  ['Fuel oil consumed', `${n(y.tonnes, 3)} t`],
  ['CO2', `${n(y.co2, 3)} t`],
  ['CH4', `${n(y.ch4, 4)} t`],
  ['N2O', `${n(y.n2o, 4)} t`],
  ['Distance travelled under way', `${n(y.distance)} nm`],
  ['Hours under way (FAOP to EOSP)', `${n(y.hours)} h`],
  ['Laden distance', `${n(y.laden)} nm`],
  ['Transport work (cargo t or passengers x nm)', n(y.transportWork, 0)],
];

const mrvRows = (y: EmYear): (string | number)[][] => [
  ['Voyages between EU / EEA ports', `${n(y.mrv.intra)} L`, `${n(y.mrv.co2Intra, 3)} t`],
  ['Voyages from an EU / EEA port', `${n(y.mrv.from)} L`, `${n(y.mrv.co2From, 3)} t`],
  ['Voyages to an EU / EEA port', `${n(y.mrv.to)} L`, `${n(y.mrv.co2To, 3)} t`],
  ['At berth in EU / EEA ports', `${n(y.mrv.berth)} L`, `${n(y.mrv.co2Berth, 3)} t`],
  ['Total in scope', `${n(y.mrv.total)} L`, `${n(y.mrv.co2, 3)} t`],
];

const ciiRows = (y: EmYear): (string | number)[][] => (y.cii ? [
  ['Capacity', n(y.cii.capacity, 0)],
  ['Attained CII', `${n(y.cii.attained, 3)} g CO2 / capacity-nm`],
  [`Required CII (Z = ${y.cii.z} %)`, `${n(y.cii.required, 3)} g CO2 / capacity-nm`],
  ['Rating boundaries A/B | B/C | C/D | D/E', y.cii.bounds.map((b) => n(b, 3)).join(' | ')],
  [`Rating${y.ytd ? ' (year to date, not final)' : ''}`, y.cii.rating],
] : []);

const splitRows = (s: EmStatement): (string | number)[][] => [
  ...EM_CONSUMERS.map((c) => [EM_CONSUMER_EN[c], n(s.split[c].u, 3), n(s.split[c].n, 3)]),
  ['Total', n(EM_CONSUMERS.reduce((a, c) => a + s.split[c].u, 0), 3), n(EM_CONSUMERS.reduce((a, c) => a + s.split[c].n, 0), 3)],
];

const passageRows = (y: EmYear): (string | number)[][] => y.parts.map((p) => {
  const x = p.passage;
  return [`${x.fromPort}${x.fromEu ? ' (EU)' : ''}`, `${x.toPort}${x.toEu ? ' (EU)' : ''}`, when(x.depAt), when(x.faopAt), when(x.eospAt), when(x.arrAt), n(p.distance), n(p.hours), n(p.litres), x.carried != null ? n(x.carried, 0) : ''];
});
const PASSAGE_HEAD = ['From', 'To', 'Left berth (UTC)', 'FAOP (UTC)', 'EOSP (UTC)', 'At berth (UTC)', 'nm', 'Hours', 'Litres', 'Carried'];

const METHOD_NOTE = `CO2 ${CF_CO2}, CH4 ${CF_CH4}, N2O ${CF_N2O} t per t of MGO / diesel (Regulation (EU) 2015/757 Annex I). CII on total fuel and distance, no correction factors or voyage adjustments. Tank soundings in litres, converted at the density at 15 °C with no temperature correction. Other fuels are not recorded.`;

const gapLine = (g: EmGap) => EM_GAP_EN[g.key](g.params ?? {});

/** The year as one history record: facts and tables. */
export function emissionsHistory(y: EmYear, v: EmVessel | undefined, s: EmStatement | undefined, gaps: EmGap[]): MachineHistory {
  const a = applicability(v);
  return {
    title: `Emissions ${y.year}${y.ytd ? ' — year to date' : ''}`,
    facts: [
      particulars(v),
      `IMO DCS (MARPOL Annex VI reg. 27): ${APPLIES[a.dcs]} · CII (reg. 28): ${APPLIES[a.cii]} · EU MRV (Regulation 2015/757): ${APPLIES[a.mrv]}`,
      s ? `Statement signed by ${who(s.by, s.byRank)}, ${dmyT(s.at)} UTC. Consumption per consumer by ${EM_METHOD_EN[s.method]}.` : 'Statement not signed.',
      METHOD_NOTE,
      'The vessel\'s record for the verifier. Verification and submission are the company\'s.',
    ],
    tables: [
      { title: 'The year', head: ['Item', 'Figure'], rows: totals(y).map((r) => r.map(String)), widths: { 0: 110, 1: 160 } },
      ...(s ? [{
        title: `Fuel per consumer, t — total ${n(splitTotal(s.split), 3)} t`, head: ['Consumer', 'Under way', 'Not under way'], rows: splitRows(s).map((r) => r.map(String)), widths: { 0: 110, 1: 80, 2: 80 },
      }, {
        title: 'Other Appendix IX items', head: ['Item', 'Figure'], rows: [['Onshore power supplied', s.shoreKwh != null ? `${n(s.shoreKwh, 0)} kWh` : 'None entered'], ['Innovative technologies', s.innovative || 'None entered'], ...(s.note ? [['Note', s.note]] : [])], widths: { 0: 110, 1: 160 },
      }] : []),
      ...(a.cii === 'applies' && y.cii ? [{ title: 'CII', head: ['Item', 'Figure'], rows: ciiRows(y).map((r) => r.map(String)), widths: { 0: 110, 1: 160 } }] : []),
      ...(a.mrv === 'applies' || a.mrv === 'check' ? [{ title: 'EU MRV — fuel and CO2 by voyage', head: ['Item', 'Fuel', 'CO2'], rows: mrvRows(y).map((r) => r.map(String)), widths: { 0: 110, 1: 80, 2: 80 } }] : []),
      ...(y.parts.length ? [{ title: 'Passages', head: PASSAGE_HEAD, rows: passageRows(y).map((r) => r.map(String)) }] : []),
      ...(gaps.length ? [{ title: 'Missing or not adding up', head: ['Item'], rows: gaps.map((g) => [gapLine(g)]) }] : []),
    ],
    drawings: s?.signedWith?.drawing ? [{ title: `Signed — ${who(s.by, s.byRank)}`, path: s.signedWith.drawing, w: 300, h: 100 }] : [],
  };
}

export const emissionsFile = (year: number) => `Emissions ${year}`;

export async function exportEmissionsPdf(y: EmYear, v: EmVessel | undefined, s: EmStatement | undefined, gaps: EmGap[], vessel: VesselInfo | null) {
  return exportPmsHistory(`Emissions ${y.year}`, emissionsFile(y.year), vessel, [emissionsHistory(y, v, s, gaps)]);
}

export async function exportEmissionsExcel(y: EmYear, v: EmVessel | undefined, s: EmStatement | undefined, gaps: EmGap[], vessel: VesselInfo | null): Promise<string | null | void> {
  const wb = XLSX.utils.book_new();
  const sheet = (name: string, aoa: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = (aoa[0] ?? []).map((_, i) => ({ wch: i ? 22 : 42 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  // Numbers as numbers, for the verifier's own sums; the unit is in its own column.
  const r3 = (x?: number) => (x == null ? '' : Math.round(x * 1000) / 1000);
  sheet('Year', [
    [`Emissions ${y.year}${y.ytd ? ' (year to date)' : ''}`, vesselHeader(vessel)], ['Vessel', particulars(v)], [],
    ['Fuel oil consumed (MGO / diesel)', y.litres, 'L'], ['Density used', r3(y.density), 'kg/L at 15 °C'], ['Fuel oil consumed', r3(y.tonnes), 't'],
    ['CO2', r3(y.co2), 't'], ['CH4', y.ch4 == null ? '' : Math.round(y.ch4 * 1e4) / 1e4, 't'], ['N2O', y.n2o == null ? '' : Math.round(y.n2o * 1e4) / 1e4, 't'],
    ['Distance travelled under way', y.distance, 'nm'], ['Hours under way (FAOP to EOSP)', y.hours, 'h'], ['Laden distance', y.laden, 'nm'], ['Transport work', y.transportWork, 'cargo t or passengers x nm'],
    ...(y.cii ? [[], ['Capacity', y.cii.capacity], ['Attained CII', r3(y.cii.attained), 'g CO2 / capacity-nm'], [`Required CII (Z = ${y.cii.z} %)`, r3(y.cii.required), 'g CO2 / capacity-nm'], ['Boundary A/B', r3(y.cii.bounds[0])], ['Boundary B/C', r3(y.cii.bounds[1])], ['Boundary C/D', r3(y.cii.bounds[2])], ['Boundary D/E', r3(y.cii.bounds[3])], [`Rating${y.ytd ? ' (year to date, not final)' : ''}`, y.cii.rating]] : []),
    [], ['Method', METHOD_NOTE],
  ]);
  sheet('EU MRV', [
    ['Item', 'Fuel, L', 'CO2, t'], ['Voyages between EU / EEA ports', y.mrv.intra, r3(y.mrv.co2Intra)], ['Voyages from an EU / EEA port', y.mrv.from, r3(y.mrv.co2From)],
    ['Voyages to an EU / EEA port', y.mrv.to, r3(y.mrv.co2To)], ['At berth in EU / EEA ports', y.mrv.berth, r3(y.mrv.co2Berth)], ['Total in scope', y.mrv.total, r3(y.mrv.co2)],
  ]);
  if (s) sheet('Per consumer', [['Consumer, t', 'Under way', 'Not under way'], ...EM_CONSUMERS.map((c) => [EM_CONSUMER_EN[c], s.split[c].u, s.split[c].n]), [], ['Method', EM_METHOD_EN[s.method]], ['Onshore power, kWh', s.shoreKwh ?? ''], ['Innovative technologies', s.innovative ?? ''], ['Signed', `${who(s.by, s.byRank)}, ${dmyT(s.at)} UTC`]]);
  sheet('Passages', [PASSAGE_HEAD, ...y.parts.map((p) => { const x = p.passage; return [x.fromPort + (x.fromEu ? ' (EU)' : ''), x.toPort + (x.toEu ? ' (EU)' : ''), when(x.depAt), when(x.faopAt), when(x.eospAt), when(x.arrAt), p.distance, p.hours, p.litres, x.carried ?? '']; })]);
  sheet('Missing', [['Missing or not adding up'], ...gaps.map((g) => [gapLine(g)])]);
  const vName = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const fileName = `${emissionsFile(y.year)}${vName ? `-${vName}` : ''}.xlsx`;
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: mime }), fileName, 'reports');
  }
  await deliverFile(fileName, b64, true, mime);
}
