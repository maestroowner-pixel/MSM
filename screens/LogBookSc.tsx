// ===================================
// The record books kept alike — Sewage (MARPOL Annex IV), Ballast water
// (BWM Convention), Fuel oil changeover and ODS (Annex VI). The book comes from
// the route (Sewage / Ballast / FuelChangeover / Ods); its codes,
// fields, rules and lines from services/logbooks. One entry per operation,
// signed by the officer in charge; the form warns when the operation is against
// the rules (distance, speed, depth) before it can be signed. The Master signs
// the month and alone changes or deletes an entry, with the reason. PDF / Excel.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MonthPicker, monthName } from '../components/MonthPicker';
import { AmendButtons, AmendNote, useAmend } from '../components/Amend';
import { useVerification } from '../components/Verification';
import { useSignConfirm, withSeal } from '../components/SignConfirm';
import { chainHead } from '../services/seal';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { BookKey, LogEntry, LogField, LogMonthSign } from '../types/logbook';
import { BOOKS, printedCode } from '../services/logbooks';
import { exportLogExcel, exportLogPdf, logCopy } from '../services/logbookReport';
import { current } from '../services/versions';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { formatDate, uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { PositionInput } from '../components/PositionInput';
import { parsePosition } from '../utils/position';
import { playSuccessSound } from '../utils/sound';
import { useBookDraft } from '../components/BookDraft';
import { EntryOriginFields, ORIGIN_BLANK, OriginForm } from '../components/EntryOrigin';
import { laterEntry, originFields, originNote, originProblem } from '../services/entryOrigin';
import { t, tk, useT } from '../utils/i18n';
import { entryZone, shipHm } from '../utils/shipTime';

const STORE: Record<BookKey, { key: string; signs: string }> = {
  sewage: { key: storage.SEWAGE_KEY, signs: storage.SEWAGE_SIGNS_KEY },
  ballast: { key: storage.BALLAST_KEY, signs: storage.BALLAST_SIGNS_KEY },
  fuelChange: { key: storage.FUEL_CHANGE_KEY, signs: storage.FUEL_CHANGE_SIGNS_KEY },
  ods: { key: storage.ODS_KEY, signs: storage.ODS_SIGNS_KEY },
};
const ROUTE_BOOK: Record<string, BookKey> = { Sewage: 'sewage', Ballast: 'ballast', FuelChangeover: 'fuelChange', Ods: 'ods' };
const SIGNS: Record<BookKey, 'sewageSigns' | 'ballastSigns' | 'fuelChangeSigns' | 'odsSigns'> = { sewage: 'sewageSigns', ballast: 'ballastSigns', fuelChange: 'fuelChangeSigns', ods: 'odsSigns' };
const NUMERIC: LogField[] = ['quantity', 'distance', 'speed', 'depth', 'sulphur', 'mass', 'rob'];
const hhmm = () => shipHm();
const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

export default function LogBookSc() {
  useT();
  const route = useRoute();
  const bookKey: BookKey = ROUTE_BOOK[route.name] ?? 'sewage';
  const spec = BOOKS[bookKey];
  const store = STORE[bookKey];
  const codes = Object.keys(spec.codes);
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const data = useData();
  const { versionsOf, appendRow, vessel } = data;
  const signs = data[SIGNS[bookKey]];
  const sync = useSync();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const amend = useAmend();
  const today = todayIso();
  // The board's "awaiting verification" opens the month it is in.
  const [month, setMonth] = useState<string>((route.params as any)?.month ?? today.slice(0, 7));
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const all = versionsOf(store.key) as LogEntry[];
  const book = useMemo(() => current(all).filter((e) => e.date.startsWith(month)).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`)), [all, month]);
  const ver = useVerification({ all, book, signs, month, prefix: bookKey, what: `${spec.title} record`, isMaster, signer, picker, save: (x) => appendRow(store.signs, x), copy: (m, o) => logCopy(spec, current(all).filter((e) => e.date.startsWith(m) && (!o.only || o.only.includes(e.id))).sort((p, q) => `${p.date}${p.time ?? ''}`.localeCompare(`${q.date}${q.time ?? ''}`)), m, vessel, (o.signs as LogMonthSign[]) ?? signs, all, o.notes) });

  // ---- the form: text values, numbers parsed for the draft ----
  type Flag = 'method' | 'treated' | 'bwmp';
  type Form = { code: string; date: string; time: string; method: string; treated: boolean | null; bwmp: boolean | null; remarks: string } & OriginForm & Record<Exclude<LogField, Flag>, string>;
  const blank = (): Form => ({ code: codes[0], date: today, time: hhmm(), method: '', treated: null, bwmp: null, remarks: '', tank: '', quantity: '', place: '', placeEnd: '', start: '', stop: '', distance: '', speed: '', depth: '', receiptNo: '', sulphur: '', equipment: '', substance: '', mass: '', rob: '', treatment: '', facility: '', area: '', ...ORIGIN_BLANK });
  const [f, setF] = useState<Form>(blank);
  const bookDraft = useBookDraft({ book: bookKey, open: adding, f, setF, blank });
  const cs = spec.codes[f.code] ?? spec.codes[codes[0]];
  const draft: Partial<LogEntry> & { code: string } = { code: f.code, date: f.date, time: f.time };
  for (const k of cs.fields) {
    if (k === 'method') {
      if (f.method) draft.method = f.method;
    } else if (k === 'treated') {
      if (f.treated != null) draft.treated = f.treated;
    } else if (k === 'bwmp') {
      if (f.bwmp != null) draft.bwmp = f.bwmp;
    } else if (NUMERIC.includes(k)) {
      const n = num(f[k]);
      if (n != null && !Number.isNaN(n)) (draft as any)[k] = n;
    } else if (f[k].trim()) (draft as any)[k] = f[k].trim();
  }
  if (f.remarks.trim()) draft.remarks = f.remarks.trim();
  const later = laterEntry({ date: f.date, time: f.time, shipOffset: entryZone(f.date, f.time) }, current(all));
  const problem = spec.problem(draft) ?? (originProblem(!!later, f.lateWhy, f.fromPaper) ? t('origin.needWhy') : null);
  const preview = spec.text(draft);

  const save = async () => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    if (problem) return Alert.alert(spec.title, problem);
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${spec.title} record — ${printedCode({ book: bookKey, code: f.code })}` });
    if (!sig) return;
    const now = Date.now();
    const head = chainHead(all);
    const e: LogEntry = withSeal({ id: uid(bookKey), book: bookKey, ...(draft as any), ...originFields(!!later, f.lateWhy, f.fromPaper, f.paperPage), shipOffset: entryZone((draft as any).date, (draft as any).time), text: preview, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), byId: signer.key, at: now, ...(head ? { prev: head } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now }, sig);
    await appendRow(store.key, e);
    bookDraft.clear();
    setF(blank());
    setAdding(false);
    playSuccessSound();
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      void ver.note(kind);
      const w = kind === 'pdf' ? await exportLogPdf(spec, book, month, vessel, signs, all, ver.notes) : await exportLogExcel(spec, book, month, vessel, signs, all);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(spec.title, String(e?.message ?? e));
    }
  };

  // A plain function, not a component: a component declared here would remount
  // its TextInput on every keystroke and lose the focus.
  const input = (k: Exclude<LogField, Flag>) => (
    <TextInput key={k} style={styles.input} value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} placeholder={tk(`log.${k}`)} placeholderTextColor={COLORS.textLight} keyboardType={NUMERIC.includes(k) ? 'decimal-pad' : undefined} />
  );
  const timeRow = (k: 'start' | 'stop') => (
    <View key={k} style={[styles.pair, { alignItems: 'center' }]}>
      {input(k)}
      <TouchableOpacity onPress={() => setF((x) => ({ ...x, [k]: hhmm() }))} hitSlop={8}><Text style={{ color: COLORS.primary, fontWeight: '800', marginTop: SIZES.xs }}>{t('log.now')}</Text></TouchableOpacity>
    </View>
  );
  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? label} onPress={onPress} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text></TouchableOpacity>
  );
  const has = (k: LogField) => cs.fields.includes(k);

  return (
    <Screen scroll>
      <ScreenTitle
        title={`${spec.title} — ${monthName(month)}`}
        subtitle={spec.subtitle}
        help={spec.help}
        actions={<MonthPicker value={month} onChange={setMonth} months={[...new Set(all.map((e) => e.date.slice(0, 7)))]} />}
      />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => { setF(blank()); setAdding((v) => !v); }}><Text style={styles.btnText}>{adding ? t('common.close') : t('book.newEntry')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('pdf')}><Text style={styles.btnOutlineText}>PDF</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('xlsx')}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      </View>

      {adding ? (
        <Card>
          {bookDraft.ui}
          <Label>{t('log.operation')}</Label>
          <View style={styles.chips}>{codes.map((c) => chip(f.code === c, spec.codes[c].print ? `${spec.codes[c].print} · ${spec.codes[c].label}` : spec.codes[c].label, () => setF({ ...f, code: c, method: '' }), c))}</View>
          <View style={styles.pair}>
            <TextInput style={styles.input} value={f.date} onChangeText={(v) => setF({ ...f, date: v })} placeholder="yyyy-mm-dd" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={f.time} onChangeText={(v) => setF({ ...f, time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
          </View>
          {/* Which ECA comes first in the changeover book — it is what the entry is about. */}
          {bookKey === 'fuelChange' && has('method') && cs.methods ? (
            <>
              <Label>{t('log.eca')}</Label>
              <View style={styles.chips}>{Object.entries(cs.methods).map(([k, l]) => chip(f.method === k, l, () => setF({ ...f, method: k }), k))}</View>
            </>
          ) : null}
          {has('equipment') ? input('equipment') : null}
          <View style={styles.pair}>
            {has('substance') ? input('substance') : null}
            {has('mass') ? input('mass') : null}
          </View>
          {has('method') && bookKey === 'ballast' && cs.methods && f.code !== 'EXCH' ? <View style={styles.chips}>{Object.entries(cs.methods).map(([k, l]) => chip(f.method === k, l, () => setF({ ...f, method: k }), k))}</View> : null}
          {has('facility') && (f.code !== 'SED' || f.method === 'shore') ? input('facility') : null}
          {has('tank') ? input('tank') : null}
          <View style={styles.pair}>
            {has('quantity') ? input('quantity') : null}
            {has('rob') ? input('rob') : null}
            {has('sulphur') ? input('sulphur') : null}
          </View>
          {bookKey !== 'fuelChange' && (bookKey !== 'ballast' || f.code === 'EXCH') && has('method') && cs.methods ? <View style={styles.chips}>{Object.entries(cs.methods).map(([k, l]) => chip(f.method === k, l, () => setF({ ...f, method: k }), k))}</View> : null}
          {has('treated') ? <View style={styles.chips}>{chip(f.treated === true, t('log.treated'), () => setF({ ...f, treated: true }))}{chip(f.treated === false, t('log.notTreated'), () => setF({ ...f, treated: false }))}</View> : null}
          {has('bwmp') ? <View style={styles.chips}>{chip(f.bwmp === true, t('log.bwmp'), () => setF({ ...f, bwmp: true }))}{chip(f.bwmp === false, t('log.notBwmp'), () => setF({ ...f, bwmp: false }))}</View> : null}
          {has('treatment') ? input('treatment') : null}
          {/* An operation at sea with a start and an end: each is a time and a
              position (13 Oct 2026). Otherwise: position or port, and the times. */}
          {has('placeEnd') ? (
            <>
              <Label>{t('log.start')}</Label>
              {has('start') ? timeRow('start') : null}
              <PositionInput
                label={t('log.posStart')}
                position={parsePosition(f.place) ? f.place : ''}
                port={parsePosition(f.place) ? '' : f.place}
                onChange={(pos, port) => setF((x) => ({ ...x, place: pos || port }))}
                deckAt={{ date: f.date, time: f.start || f.time }}
              />
              <Label>{t('log.end')}</Label>
              {has('stop') ? timeRow('stop') : null}
              {cs.endPort ? (
                <PositionInput
                  label={t('log.placeEnd')}
                  position={parsePosition(f.placeEnd) ? f.placeEnd : ''}
                  port={parsePosition(f.placeEnd) ? '' : f.placeEnd}
                  onChange={(pos, port) => setF((x) => ({ ...x, placeEnd: pos || port }))}
                  deckAt={{ date: f.date, time: f.stop || f.time }}
                />
              ) : (
                <PositionInput label={t('log.placeEnd')} portAllowed={false} position={f.placeEnd} onChange={(pos) => setF((x) => ({ ...x, placeEnd: pos }))} deckAt={{ date: f.date, time: f.stop || f.time }} />
              )}
            </>
          ) : (
            <>
              {has('place') ? (
                <PositionInput
                  label={t('log.position')}
                  position={parsePosition(f.place) ? f.place : ''}
                  port={parsePosition(f.place) ? '' : f.place}
                  onChange={(pos, port) => setF((x) => ({ ...x, place: pos || port }))}
                  deckAt={{ date: f.date, time: f.start || f.time }}
                />
              ) : null}
              <View style={styles.pair}>
                {has('start') ? input('start') : null}
                {has('stop') ? input('stop') : null}
              </View>
            </>
          )}
          {f.code !== 'SED' || f.method !== 'shore' ? (
            <View style={styles.pair}>
              {has('distance') && (f.code !== 'SED' || f.method === 'sea') && !f.area.trim() ? input('distance') : null}
              {has('speed') ? input('speed') : null}
              {has('depth') && (f.code !== 'SED' || f.method === 'sea') && !(f.code === 'EXCH' && f.area.trim()) ? input('depth') : null}
            </View>
          ) : null}
          {has('area') ? input('area') : null}
          {has('receiptNo') && (f.code !== 'SED' || f.method === 'shore') ? input('receiptNo') : null}
          <TextInput style={[styles.input, { minHeight: 50 }]} value={f.remarks} onChangeText={(v) => setF({ ...f, remarks: v })} placeholder={t('book.remarks')} placeholderTextColor={COLORS.textLight} multiline />
          <EntryOriginFields later={later} value={f} onChange={(o) => setF({ ...f, ...o })} />
          <Text style={styles.previewLabel}>{t('book.inBook')}</Text>
          <Text style={styles.preview}>{`${printedCode({ book: bookKey, code: f.code })} · ${preview || '—'}`}</Text>
          {problem ? <Text style={styles.problem}>{`⚠ ${problem}`}</Text> : null}
          {picker ? <><Text style={styles.sub}>{t('book.oic')}</Text>{picker}</> : null}
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }, problem && { opacity: 0.5 }]} onPress={() => void save()}><Text style={styles.btnText}>{t('book.signEntry')}</Text></TouchableOpacity>
        </Card>
      ) : null}

      <Label>{t('book.entries', { n: book.length })}</Label>
      {book.map((e) => (
        <View key={e.id} style={[styles.entry, e.cancelled && { opacity: 0.6 }]}>
          <View style={styles.code}><Text style={styles.codeText} numberOfLines={1}>{printedCode(e)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, e.cancelled && { textDecorationLine: 'line-through' }]}>{e.text}</Text>
            <Text style={styles.sub}>{`${uiDate(e.date)}${e.time ? ` ${e.time}` : ''} · ${spec.codes[e.code]?.label ?? e.code} · ${e.byRank ? `${e.by} (${e.byRank})` : e.by}`}</Text>
            {originNote(e) ? <Text style={[styles.sub, { color: COLORS.warning }]}>{originNote(e)}</Text> : null}
            <AmendNote rec={e} all={all} summary={(p) => `${p.code} · ${p.text}`} />
            {ver.stage(e)}
          </View>
          {!e.cancelled ? (
            <AmendButtons
              isMaster={isMaster}
              onEdit={() => amend.edit({ store: store.key, record: e, what: `${spec.title} ${printedCode(e)}, ${formatDate(e.date)}`, fields: [{ key: 'date', label: t('book.fDate') }, { key: 'time', label: t('book.fTime') }, { key: 'text', label: t('book.fText'), kind: 'multiline' }] })}
              onDelete={() => amend.remove({ store: store.key, record: e, what: `${spec.title} ${printedCode(e)}, ${formatDate(e.date)}` })}
            />
          ) : null}
        </View>
      ))}
      {!book.length ? <Text style={styles.sub}>{t('book.noneMonth')}</Text> : null}

      {ver.section}
      {amend.ui}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, alignItems: 'center' },
    input: { flex: 1, minWidth: 140, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
    previewLabel: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, letterSpacing: 0.6, marginTop: SIZES.md, textTransform: 'uppercase' },
    preview: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 2 },
    problem: { color: COLORS.warning, fontWeight: '700', fontSize: SIZES.small, marginTop: SIZES.sm },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    entry: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs },
    code: { minWidth: 42, height: 30, paddingHorizontal: 6, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    codeText: { color: COLORS.textWhite, fontWeight: '900', fontSize: SIZES.small },
    text: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
  });
