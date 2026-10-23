// ===================================
// Hospital (types/hospital.ts) — the menu opens it on one of five pages
// (utils/navOrder MENU_CHILDREN, 13 Oct 2026: "Hospital in the menu — Register,
// orders and their archive, inventory, log"):
//
//   Register    every item with what is aboard and in date, the soonest
//               expiry, what is short and what is on order; out of date and
//               expiring first. Controlled drugs filtered here, their register
//               printed here. Starts from Excel or the WHO IMGS scale.
//   Orders      open orders — what is still to come, line by line; overdue in red.
//   Archive     orders complete, or closed with what never came.
//   Inventory   count everything against the books; earlier counts.
//   Log         the medical log — the Master and the officers only.
//
// An item opens on MedItemSc, an order on MedOrderSc, a count on MedCountSc,
// a treatment on TreatmentSc.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { MedItem, MedMove, OUTCOME_LABEL } from '../types/hospital';
import { HOSPITAL_CATEGORY_LABEL, HospitalCategory, IMGS_REFERENCE, MED_SCALE, NURSING_SCALE } from '../constants/medScale';
import { MED_INFO_NOTICE, WHO_NOTICE } from '../constants/medNotice';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import {
  ItemStatus, ORDER_STATE_LABEL, chestCounts, chestStatus, daysTo, differences, followUpsDue, isArchived, itemKey, lastControlledCount,
  onOrderByItem, orderOverdue, isLanding, landingLinesFor, referenceOf, ChestSort, CHECK_KIND_LABEL, STOCK_LEVEL_LABEL, placeText, earliestExpiry, expiryState, matchesSearch, mmYY, purposeIcon, purposeOf, scaleEntry, sortChest, stockLevel, orderState, planImport, readSheet, receivedByLine, scaleItems, sortOrders, sortTreatments,
} from '../services/hospital';
import { pickSheetRows } from '../services/sheetFiles';
import { aiReadDocument, aiRenameHeadings } from '../services/aiImport';
import { aiReady } from '../services/ai';
import { pickDocForAi } from '../services/medFiles';
import { exportChestExcel, exportChestPdf, exportChestTemplate, exportControlledPdf, exportMedLogExcel, exportMedLogPdf, pickChestSheet } from '../services/hospitalReport';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, t as tt, tk, tn, useT } from '../utils/i18n';

export type HospitalView = 'register' | 'orders' | 'archive' | 'inventory' | 'log' | 'reference';
type Filter = 'all' | 'expired' | 'soon' | 'short' | 'empty' | 'low' | 'controlled';

const TITLE: Record<HospitalView, [string, string]> = {
  register: ['Hospital — register', 'Medicine chest: what is aboard, expiry, what is short'],
  orders: ['Hospital — orders', 'What has been ordered and is still to come'],
  archive: ['Hospital — orders archive', 'Orders complete, or closed with what never came'],
  inventory: ['Hospital — inventory', 'Count the chest against the books'],
  log: ['Hospital — medical log', 'Treatments — confidential, Master and officers only'],
  reference: ['Medicine reference', 'WHO IMGS — for information only'],
};


export default function HospitalSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => ({ ...makeStyles(COLORS), ...StyleSheet.create({ badgeBox: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, minWidth: 54, alignItems: 'center' }, badgeQty: { fontSize: SIZES.small, fontWeight: '800' }, badgeExp: { fontSize: 10, fontWeight: '700' }, infoBtn: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, infoBtnText: { fontSize: 12, fontWeight: '800', fontStyle: 'italic', fontFamily: 'Georgia', lineHeight: 14 }, infoBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md }, infoCard: { borderRadius: SIZES.radiusLg, padding: SIZES.lg, width: '100%', maxWidth: 560 } }) }), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { medItems, medMoves, medTreatments, medOrders, medChecks, saveRows, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const { signer } = useSigner();
  const today = todayIso();

  const asked = route.params?.view as HospitalView | undefined;
  const [view, setView] = useState<HospitalView>(asked && TITLE[asked] ? asked : 'register');
  // The menu opens a page by setting `view` again on the same screen.
  const [seen, setSeen] = useState(asked);
  if (asked !== seen) {
    setSeen(asked);
    if (asked && TITLE[asked]) setView(asked);
  }
  const shownView: HospitalView = view === 'log' && !officer ? 'register' : view;

  const [filter, setFilter] = useState<Filter>((['expired', 'soon', 'short', 'empty', 'low', 'controlled'] as Filter[]).includes(route.params?.filter) ? route.params.filter : 'all');
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosingCat, setChoosingCat] = useState(false);
  const [refPart, setRefPart] = useState<'medicines' | 'scale' | 'equipment'>('medicines');
  const [openRef, setOpenRef] = useState<string | null>(null);
  // The "i" on an item's panel: its reference entry in a pop-up, with what to do next.
  const [info, setInfo] = useState<ItemStatus | null>(null);

  const rows = useMemo(() => chestStatus(medItems, medMoves, today), [medItems, medMoves, today]);
  const counts = chestCounts(rows);
  const onOrder = useMemo(() => onOrderByItem(medOrders, medMoves), [medOrders, medMoves]);
  const [sortBy, setSortBy] = useState<ChestSort>('attention');
  const [group, setGroup] = useState<string | null>(null);
  const shown = useMemo(
    () =>
      sortChest(
        rows
          .filter((r) => filter === 'all' || (filter === 'expired' ? r.expired > 0 : filter === 'soon' ? r.nextState === 'soon' : filter === 'short' ? r.short > 0 : filter === 'empty' ? stockLevel(r) === 'empty' : filter === 'low' ? ['critical', 'low'].includes(stockLevel(r)) : !!r.item.controlled))
          .filter((r) => !group || purposeOf(r.item) === group)
          .filter((r) => matchesSearch(r.item, q)),
        sortBy
      ),
    [rows, filter, q, sortBy, group]
  );
  // The groups present, for MHM's pills — the most items first.
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(purposeOf(r.item), (m.get(purposeOf(r.item)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows]);
  const levels = useMemo(() => ({ empty: rows.filter((r) => stockLevel(r) === 'empty').length, low: rows.filter((r) => ['critical', 'low'].includes(stockLevel(r))).length }), [rows]);
  const controlled = rows.filter((r) => r.item.controlled);
  const lastCount = lastControlledCount(medItems, medMoves);
  const orders = useMemo(() => sortOrders(medOrders).map((o) => ({ o, st: orderState(o, medMoves) })), [medOrders, medMoves]);
  const open = orders.filter((x) => !isArchived(x.st));
  const archived = orders.filter((x) => isArchived(x.st));
  const log = useMemo(() => sortTreatments(medTreatments), [medTreatments]);
  const due = followUpsDue(medTreatments, today);
  const checks = useMemo(() => [...medChecks].sort((a, b) => b.at - a.at), [medChecks]);
  const expiredLines = useMemo(() => ({ other: landingLinesFor(rows, today, false).length, cd: landingLinesFor(rows, today, true).length }), [rows, today]);

  const run = async (what: string, f: () => Promise<string | null | void>) => {
    try {
      const w = await f();
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(what, String(e?.message ?? e));
    }
  };

  const addScale = async (cat: HospitalCategory) => {
    setBusy(true);
    setChoosingCat(false);
    const list = scaleItems(cat);
    await saveRows(storage.MED_ITEMS_KEY, list.map((x, i) => ({ id: uid('med'), ...x, order: i }) as MedItem));
    setBusy(false);
    playSuccessSound();
  };

  // Load the vessel's own list: items matched by name and strength are updated,
  // the rest added; every line with a quantity counts that batch.
  // With the AI: a list with its own column names (the AI names them; the list stays here), or a photo / PDF of a paper one.
  const loadAi = async (how: 'sheet' | 'doc') => {
    try {
      if (how === 'sheet') {
        const file = await pickSheetRows();
        if (!file) return;
        setSaved(t('pax.aiReading'));
        const r = await aiRenameHeadings(file.rows, 'medicine');
        setSaved(null);
        return load({ name: file.name, rows: r.rows }, `Columns read by the AI: ${r.mapped.map((m) => `${m.from} → ${m.to}`).join('; ')}.`);
      }
      const doc = await pickDocForAi();
      if (!doc) return;
      setSaved(t('st.aiReadingDoc', { name: doc.name }));
      const r = await aiReadDocument(doc.dataUri, 'medicine');
      setSaved(null);
      return load({ name: doc.name, rows: r.rows }, `Read by the AI — check the lines.${r.unreadable ? ` Not readable: ${r.unreadable}` : ''}`);
    } catch (e: any) {
      setSaved(null);
      Alert.alert(t('hos.chest'), String(e?.message ?? e));
    }
  };

  const load = async (given?: { name: string; rows: unknown[][] }, note?: string) => {
    const f = given ?? (await pickChestSheet());
    if (!f) return;
    const { lines, skipped } = readSheet(f.rows);
    if (!lines.length) return Alert.alert(t('hos.chest'), t('hos.noItems', { file: f.name }));
    const plan = planImport(lines, medItems);
    const go = async () => {
      setBusy(true);
      const now = Date.now();
      const byKey = new Map(medItems.map((i) => [itemKey(i.name, i.strength), i.id]));
      let n = medItems.length;
      const added = plan.add.map((a) => {
        const id = uid('med');
        byKey.set(itemKey(a.name, a.strength), id);
        return { id, ...a, order: n++, updatedAt: now } as MedItem;
      });
      await saveRows(storage.MED_ITEMS_KEY, [...plan.update, ...added]);
      const counted: MedMove[] = [];
      for (const c of plan.counts) {
        const itemId = byKey.get(c.key);
        if (!itemId) continue;
        const m: MedMove = { id: uid('mmv'), itemId, kind: 'count', qty: c.line.qty!, ...(c.line.batchNo ? { batchNo: c.line.batchNo } : {}), ...(c.line.expiry ? { expiry: c.line.expiry } : {}), date: today, note: `Loaded from ${f.name}`, by: signer?.name ?? 'Officer', ...(signer?.rank ? { byRank: signer.rank } : {}), at: now, updatedAt: now };
        counted.push(m);
      }
      await saveRows(storage.MED_MOVES_KEY, counted);
      setBusy(false);
      playSuccessSound();
      Alert.alert(t('hos.chest'), `${t('hos.loaded', { a: plan.add.length, u: plan.update.length, c: plan.counts.length })}${skipped ? `; ${t('hos.skipped', { n: skipped })}` : ''}.`);
    };
    Alert.alert(t('hos.loadList'), `${note ? `${note}\n\n` : ''}${f.name}: ${t('hos.loadSummary', { a: plan.add.length, u: plan.update.length, c: plan.counts.length })}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mt2.load'), onPress: () => void go() },
    ]);
  };

  const stateColor = (r: ItemStatus) => (r.expired ? COLORS.danger : r.nextState === 'soon' || r.short ? COLORS.warning : COLORS.success);

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  // Where an item is kept — the map-marker icon, not an emoji.
  const Place = ({ text }: { text: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <MciIcon name="map-marker-outline" size={14} color={COLORS.textLight} />
      <Text style={[styles.sub, { color: COLORS.textDark, marginTop: 0, flexShrink: 1 }]}>{text}</Text>
    </View>
  );

  const pages: [HospitalView, string][] = [
    ['register', t('hos.tabRegister', { n: rows.length })],
    ['orders', t('hos.tabOrders', { n: open.length })],
    ['archive', t('drills.archiveN', { n: archived.length })],
    ['inventory', t('mc.inventory')],
    ...(officer ? [['log', `${t('hos.log')}${due.length ? ` · ${t('hos.followUps', { n: due.length })}` : ''}`] as [HospitalView, string]] : []),
    ['reference', t('hos.reference')],
  ];

  return (
    <Screen scroll>
      <ScreenTitle title={tk(`hos.t.${shownView}`)} subtitle={tk(`hos.t.${shownView}.sub`)} help="Hospital" />
      <View style={styles.chips}>
        {pages.map(([k, l]) => <Chip key={k} on={shownView === k} label={l} onPress={() => setView(k)} />)}
      </View>

      {shownView === 'register' ? (
        <>
          {rows.length ? (
            <>
              <TextInput style={[styles.input, { marginTop: 0, marginBottom: SIZES.sm }]} value={q} onChangeText={setQ} placeholder={t('hos.searchPh')} placeholderTextColor={COLORS.textLight} />
              {/* Group, what to show and the order — three drop-downs side by side (13 Oct 2026: "filters and sorting as drop-down menus"). */}
              <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm, gap: SIZES.xs }]}>
                <Dropdown caption={t('pax.group')} value={group ?? ''} onChange={(v: string) => setGroup(v || null)} options={[{ value: '', label: t('pax.showAll', { n: rows.length }), icon: 'pill' }, ...groups.map(([g, n]) => ({ value: g, label: `${g} · ${n}`, icon: purposeIcon(g) }))]} style={{ flex: 1, minWidth: 200 }} />
                <Dropdown caption={t('pax.show')} value={filter} onChange={setFilter} style={{ flex: 1, minWidth: 200 }} options={[
                  { value: 'all' as Filter, label: t('lb.all') },
                  { value: 'expired' as Filter, label: t('st.showExpired', { n: counts.expired }) },
                  { value: 'soon' as Filter, label: t('hos.fSoon', { n: counts.soon }) },
                  { value: 'empty' as Filter, label: t('hos.fEmpty', { n: levels.empty }) },
                  { value: 'low' as Filter, label: t('hos.fLow', { n: levels.low }) },
                  { value: 'short' as Filter, label: t('hos.fShort', { n: counts.short }) },
                  ...(controlled.length ? [{ value: 'controlled' as Filter, label: t('hos.fCd', { n: controlled.length }) }] : []),
                ]} />
                <Dropdown caption={t('docs.sort')} value={sortBy} onChange={setSortBy} style={{ flex: 1, minWidth: 200 }} options={([['attention', t('hos.sAttention')], ['purpose', t('hos.sPurpose')], ['expiry', t('mc.expiry')], ['name', 'A–Z'], ['place', t('risk.location')], ['list', t('hos.sList')]] as [ChestSort, string][]).map(([value, label]) => ({ value, label }))} />
              </View>
              {filter === 'controlled' ? (
                <Text style={[styles.sub, { marginBottom: SIZES.sm, color: !lastCount || daysTo(lastCount, today) > 31 ? COLORS.warning : COLORS.textLight }]}>
                  {`${lastCount ? t('hos.lastCounted', { date: uiDate(lastCount) }) : t('hos.neverCounted')} — ${t('hos.cdNote')}`}
                </Text>
              ) : null}
              {filter === 'expired' && officer && (expiredLines.other || expiredLines.cd) ? (
                <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm }]}>
                  <Text style={[styles.sub, { flexBasis: '100%' }]}>{t('hos.expiredNote')}</Text>
                  {expiredLines.other ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedLanding', { id: 'new' })}><Text style={styles.smallText}>{`${t('ml.titleExp')} · ${expiredLines.other}`}</Text></TouchableOpacity> : null}
                  {expiredLines.cd ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedLanding', { id: 'new', mode: 'cd' })}><Text style={styles.smallText}>{`${t('ml.titleCd')} · ${expiredLines.cd}`}</Text></TouchableOpacity> : null}
                </View>
              ) : null}
            </>
          ) : null}
          {shown.map((r, i) => {
            const coming = onOrder.get(r.item.id);
            // By purpose: a heading where the group changes.
            const head = sortBy === 'purpose' && (i === 0 || purposeOf(shown[i - 1].item) !== purposeOf(r.item)) ? purposeOf(r.item) : null;
            const exp = earliestExpiry(r);
            return (
              <React.Fragment key={r.item.id}>
              {head ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SIZES.md, marginBottom: 4 }}><MciIcon name={purposeIcon(head)} size={16} color={COLORS.textDark} /><Text style={[styles.sub, { fontWeight: '800', color: COLORS.textDark, marginTop: 0 }]}>{`${head} · ${shown.filter((x) => purposeOf(x.item) === head).length}`}</Text></View> : null}
              <TouchableOpacity style={[styles.item, { borderLeftColor: stateColor(r), flexDirection: 'row', gap: SIZES.sm }]} onPress={() => nav.navigate('MedItem', { id: r.item.id })} activeOpacity={0.7}>
                <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MciIcon name={purposeIcon(purposeOf(r.item))} size={18} color={COLORS.primary} />
                  <Text style={[styles.name, { flexShrink: 1 }]} numberOfLines={1}>{r.item.name}</Text>
                  {r.item.controlled ? <MciIcon name="lock" size={15} color={COLORS.warning} /> : null}
                  <TouchableOpacity onPress={() => setInfo(r)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('hos.reference')} — ${r.item.name}`} style={[styles.infoBtn, { borderColor: COLORS.primary }]}>
                    <Text style={[styles.infoBtnText, { color: COLORS.primary }]}>i</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.sub}>{[r.item.listNo ? t('round.no', { n: r.item.listNo }) : null, r.item.strength].filter(Boolean).join(' · ')}</Text>
                {placeText(r.item) ? <Place text={placeText(r.item)} /> : null}
                <Text style={[styles.sub, { color: stateColor(r), fontWeight: '700' }]}>{[`${r.usable} / ${r.item.required} ${r.item.unit}`, STOCK_LEVEL_LABEL[stockLevel(r)], r.short ? t('sop.short', { n: r.short }) : null, r.expired ? t('st.outOfDate', { n: r.expired }) : r.nextState === 'soon' ? t('hos.expiring') : null].filter(Boolean).join(' · ')}</Text>
                {coming ? <Text style={[styles.sub, { color: COLORS.primary }]}>{`${coming} on order`}</Text> : null}
                {sortBy === 'expiry' && exp ? <Text style={[styles.sub, { color: expiryState(today, exp) === 'expired' ? COLORS.danger : COLORS.textLight }]}>{t('hos.soonest', { date: uiDate(exp) })}</Text> : null}
                {sortBy === 'purpose' ? <Text style={styles.sub} numberOfLines={1}>{scaleEntry(r.item).med?.indication ?? ''}</Text> : null}
                </View>
                {/* One row on the right (13 Oct 2026): the out-of-date batches, then those in date (quantity and MM/YY, as MHM), then Issue. */}
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', alignSelf: 'center' }}>
                  {!r.batches.length ? (
                    <View style={[styles.badgeBox, { borderColor: COLORS.danger }]}><Text style={[styles.badgeQty, { color: COLORS.danger }]}>0</Text><Text style={[styles.badgeExp, { color: COLORS.danger }]}>{t('hos.empty')}</Text></View>
                  ) : (
                    [...r.batches].sort((x, y) => (expiryState(today, x.expiry) === 'expired' ? 0 : 1) - (expiryState(today, y.expiry) === 'expired' ? 0 : 1)).slice(0, 3).map((b) => {
                      const s = expiryState(today, b.expiry);
                      const c = s === 'expired' ? COLORS.danger : s === 'soon' ? COLORS.warning : COLORS.success;
                      return <View key={b.key} style={[styles.badgeBox, { borderColor: c }]}><Text style={[styles.badgeQty, { color: c }]}>{b.qty}</Text><Text style={[styles.badgeExp, { color: c }]}>{mmYY(b.expiry)}</Text></View>;
                    })
                  )}
                  {r.batches.length > 3 ? <View style={[styles.badgeBox, { borderColor: COLORS.border }]}><Text style={[styles.badgeQty, { color: COLORS.textLight }]}>{`+${r.batches.length - 3}`}</Text><Text style={[styles.badgeExp, { color: COLORS.textLight }]}>{t('hos.more')}</Text></View> : null}
                  {/* Issue: a new entry in the medical log with this item already in it. */}
                  {officer && r.usable > 0 ? (
                    <TouchableOpacity onPress={() => nav.navigate('Treatment', { id: 'new', issue: r.item.id })} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Issue — ${r.item.name}`} style={[styles.badgeBox, { borderColor: COLORS.primary, backgroundColor: COLORS.primary }]}>
                      <MciIcon name="hand-heart-outline" size={15} color={COLORS.textWhite} />
                      <Text style={[styles.badgeExp, { color: COLORS.textWhite }]}>{t('hos.issue')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
              </React.Fragment>
            );
          })}
          {rows.length && !shown.length ? <Text style={styles.sub}>{t('st.nothingHere')}</Text> : null}
          {!rows.length ? (
            <Card>
              <Text style={styles.body}>{t('hos.noList')}</Text>
              <Text style={styles.sub}>{t('hos.noListBody')}</Text>
              {officer ? (
                choosingCat ? (
                  <View style={{ marginTop: SIZES.sm, gap: SIZES.xs }}>
                    {(['C', 'B', 'A'] as HospitalCategory[]).map((c) => (
                      <TouchableOpacity key={c} style={styles.small} disabled={busy} onPress={() => void addScale(c)}><Text style={styles.smallText}>{HOSPITAL_CATEGORY_LABEL[c]}</Text></TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setChoosingCat(false)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.btn} disabled={busy} onPress={() => setChoosingCat(true)}><Text style={styles.btnText}>{t('hos.startScale')}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void load()}><Text style={styles.smallText}>{t('hos.loadExcel')}</Text></TouchableOpacity>
                    {aiReady(sync.enrolled) ? <><TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} disabled={busy} onPress={() => void loadAi('sheet')}><MciIcon name="creation" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Any list (AI)</Text></TouchableOpacity><TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} disabled={busy} onPress={() => void loadAi('doc')}><MciIcon name="camera-outline" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Photo / PDF (AI)</Text></TouchableOpacity></> : null}
                    <TouchableOpacity onPress={() => void run(t('hos.excelList'), () => exportChestTemplate([]))}><Text style={styles.link}>{t('hos.excelLayout')}</Text></TouchableOpacity>
                  </View>
                )
              ) : null}
              {busy ? <Text style={styles.sub}>{t('hos.adding')}</Text> : null}
              <Text style={[styles.sub, { fontSize: 11, marginTop: SIZES.sm }]}>{WHO_NOTICE}</Text>
            </Card>
          ) : null}
          {officer && rows.length ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedItem', { id: 'new' })}><Text style={styles.smallText}>+ Item</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void load()}><Text style={styles.smallText}>{t('hos.loadExcel')}</Text></TouchableOpacity>
                    {aiReady(sync.enrolled) ? <><TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} disabled={busy} onPress={() => void loadAi('sheet')}><MciIcon name="creation" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Any list (AI)</Text></TouchableOpacity><TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} disabled={busy} onPress={() => void loadAi('doc')}><MciIcon name="camera-outline" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Photo / PDF (AI)</Text></TouchableOpacity></> : null}
              <TouchableOpacity onPress={() => void run(t('hos.excelList'), () => exportChestTemplate(rows))}><Text style={styles.link}>{t('hos.excelFill')}</Text></TouchableOpacity>
            </View>
          ) : null}
          {rows.length ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => void run(t('hos.chest'), () => exportChestPdf(rows, today, vessel))}><Text style={styles.btnText}>{t('hos.invPdf')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => void run(t('hos.chest'), () => exportChestExcel(rows, today, vessel))}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
              {controlled.length ? <TouchableOpacity style={styles.btn} onPress={() => void run(t('med.cd'), () => exportControlledPdf(medItems, medMoves, today, vessel))}><Text style={styles.btnText}>{`${t('mi.cdRegister')} (PDF)`}</Text></TouchableOpacity> : null}
            </View>
          ) : null}
        </>
      ) : shownView === 'orders' || shownView === 'archive' ? (
        <>
          {shownView === 'orders' && officer ? (
            <View style={[styles.row, { marginTop: 0 }]}>
              <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('MedOrder', { id: 'new', fill: 'short' })}><Text style={styles.btnText}>{t('hos.orderShort')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedOrder', { id: 'new' })}><Text style={styles.smallText}>{t('hos.emptyOrder')}</Text></TouchableOpacity>
            </View>
          ) : null}
          {(shownView === 'orders' ? open : archived).map(({ o, st }) => {
            const got = receivedByLine(o, medMoves);
            const lines = o.lines.length;
            const full = o.lines.filter((l) => (got.get(l.id) ?? 0) >= l.qty).length;
            const late = orderOverdue(o, medMoves, today);
            const color = st === 'done' ? COLORS.success : st === 'closed' ? COLORS.textLight : late ? COLORS.danger : st === 'part' ? COLORS.warning : COLORS.primary;
            return (
              <TouchableOpacity key={o.id} style={[styles.item, { borderLeftColor: color }]} onPress={() => nav.navigate('MedOrder', { id: o.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${o.no}${o.supplier ? ` · ${o.supplier}` : ''}`}</Text>
                <Text style={styles.sub}>{[t('hos.ordered', { date: uiDate(o.date) }), o.ref, o.port, o.due ? t('hos.expected', { date: uiDate(o.due) }) : null].filter(Boolean).join(' · ')}</Text>
                <Text style={[styles.sub, { color, fontWeight: '700' }]}>{[ORDER_STATE_LABEL[st], `${full} of ${lines} lines in full`, late ? 'OVERDUE' : null].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
            );
          })}
          {!(shownView === 'orders' ? open : archived).length ? <Text style={styles.sub}>{shownView === 'orders' ? t('hos.nothingOrder') : t('hos.noArchive')}</Text> : null}
        </>
      ) : shownView === 'reference' ? (
        <>
          <View style={[styles.item, { borderLeftColor: COLORS.warning }]}>
            <Text style={[styles.body, { fontWeight: '700' }]}>{MED_INFO_NOTICE}</Text>
            <Text style={[styles.sub, { marginTop: SIZES.xs }]}>{WHO_NOTICE}</Text>
          </View>
          <View style={styles.chips}>
            <Chip on={refPart === 'medicines'} label={`${t('tr.medicines')} · ${IMGS_REFERENCE.length}`} onPress={() => setRefPart('medicines')} />
            <Chip on={refPart === 'scale'} label={`${t('hos.scale')} A / B / C · ${MED_SCALE.length}`} onPress={() => setRefPart('scale')} />
            <Chip on={refPart === 'equipment'} label={`${t('cat.title')} · ${NURSING_SCALE.length}`} onPress={() => setRefPart('equipment')} />
          </View>
          <TextInput style={[styles.input, { marginTop: 0, marginBottom: SIZES.sm }]} value={q} onChangeText={setQ} placeholder={t('hos.refSearchPh')} placeholderTextColor={COLORS.textLight} />
          {(refPart === 'medicines'
            ? IMGS_REFERENCE.map((r) => ({ key: r.name, title: r.name, sub: r.text.split('\n')[1] ?? '', text: r.text }))
            : refPart === 'scale'
            ? MED_SCALE.map((m) => ({ key: `${m.name}|${m.strength}`, title: `${m.name}${m.controlled ? ' · CD' : ''}`, sub: [m.strength, m.group, m.atc ? `ATC ${m.atc}` : null, `A ${m.req.A ?? '—'} · B ${m.req.B ?? '—'} · C ${m.req.C ?? '—'}`].filter(Boolean).join(' · '), text: [m.indication, m.ref].filter(Boolean).join('\n\n') }))
            : NURSING_SCALE.map((n) => ({ key: n.code, title: `${n.code} ${n.name}`, sub: [n.group, `qty ${n.qty}`].join(' · '), text: [n.description, n.ref].filter(Boolean).join('\n\n') }))
          )
            .filter((r) => q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => `${r.title} ${r.sub} ${r.text}`.toLowerCase().includes(w)))
            .map((r) => (
              <TouchableOpacity key={r.key} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => setOpenRef(openRef === r.key ? null : r.key)} activeOpacity={0.7}>
                <Text style={styles.name}>{r.title}</Text>
                <Text style={styles.sub} numberOfLines={openRef === r.key ? undefined : 1}>{r.sub}</Text>
                {openRef === r.key && r.text ? <Text style={[styles.body, { lineHeight: 21, marginTop: SIZES.xs }]}>{r.text}</Text> : null}
              </TouchableOpacity>
            ))}
        </>
      ) : shownView === 'inventory' ? (
        <>
          <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{t('hos.invIntro')}</Text>
          {officer && rows.length ? (
            <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.md }]}>
              <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('MedCount', { id: 'new' })}><Text style={styles.btnText}>{t('hos.startInv')}</Text></TouchableOpacity>
              {controlled.length ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedCount', { id: 'new', mode: 'cd' })}><Text style={styles.smallText}>{t('mc.titleCd')}</Text></TouchableOpacity> : null}
              {controlled.length ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedCount', { id: 'new', mode: 'handover' })}><Text style={styles.smallText}>{t('mc.titleHo')}</Text></TouchableOpacity> : null}
            </View>
          ) : null}
          {officer && rows.length ? (
            <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.md }]}>
              <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedLanding', { id: 'new' })}><Text style={styles.smallText}>{`${t('ml.titleExp')}${expiredLines.other ? ` · ${expiredLines.other}` : ''}`}</Text></TouchableOpacity>
              {controlled.length ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedLanding', { id: 'new', mode: 'cd' })}><Text style={styles.smallText}>{`${t('ml.titleCd')}${expiredLines.cd ? ` · ${expiredLines.cd}` : ''}`}</Text></TouchableOpacity> : null}
            </View>
          ) : null}
          {!rows.length ? <Text style={styles.sub}>{t('hos.makeFirst')}</Text> : null}
          {checks.map((c) => {
            const diff = differences(c).length;
            return (
              <TouchableOpacity key={c.id} style={[styles.item, { borderLeftColor: isLanding(c) ? COLORS.primary : diff ? COLORS.warning : COLORS.success }]} onPress={() => nav.navigate(isLanding(c) ? 'MedLanding' : 'MedCount', { id: c.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${c.no} · ${CHECK_KIND_LABEL[c.kind ?? 'inventory']} · ${uiDate(c.date)}`}</Text>
                <Text style={styles.sub}>{isLanding(c) ? [t('mc.lines', { n: c.lines.length }), c.port, `${c.by} → ${[c.receiver, c.receiverOrg].filter(Boolean).join(', ')}`].filter(Boolean).join(' · ') : [t('mc.lines', { n: c.lines.length }), diff ? t('mc.diffs', { n: diff }) : t('mc.asBooks'), c.kind === 'handover' ? `${c.by} → ${c.witness}` : c.witness ? t('mo.witnessL', { who: c.witness }) : null, c.kind === 'handover' ? null : c.byRank ? `${c.by} (${c.byRank})` : c.by].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
            );
          })}
        </>
      ) : (
        <>
          <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{t('hos.logConf')}</Text>
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.md }]} onPress={() => nav.navigate('Treatment', { id: 'new' })}><Text style={styles.btnText}>+ New treatment</Text></TouchableOpacity>
          {due.map((t) => (
            <TouchableOpacity key={`fu-${t.id}`} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => nav.navigate('Treatment', { id: 'new', followUpOf: t.id })}>
              <Text style={styles.name}>{`Follow-up due — ${t.patient}`}</Text>
              <Text style={styles.sub}>{`${t.no} ${t.complaint} · due ${uiDate(t.followUp)}`}</Text>
            </TouchableOpacity>
          ))}
          {log.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.item, { borderLeftColor: t.outcome === 'fit' ? COLORS.success : t.outcome === 'light' ? COLORS.warning : COLORS.danger }]} onPress={() => nav.navigate('Treatment', { id: t.id })} activeOpacity={0.7}>
              <Text style={styles.name}>{`${t.no} · ${t.patient}`}</Text>
              <Text style={styles.sub}>{[`${uiDate(t.date)}${t.time ? ` ${t.time}` : ''}`, t.complaint, t.diagnosis].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.sub}>{[tk(`tr.out.${t.outcome}`), t.issued.length ? tn('hos.medsN', t.issued.length) : null, t.tmas ? tt('hos.radio') : null, t.files?.length ? tn('n.file', t.files.length) : null, t.byRank ? `${t.by} (${t.byRank})` : t.by].filter(Boolean).join(' · ')}</Text>
            </TouchableOpacity>
          ))}
          {!log.length ? <Text style={styles.sub}>{t('hos.noTreatment')}</Text> : null}
          {log.length ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => void run(t('hos.medLog'), () => exportMedLogPdf(medTreatments, today, vessel))}><Text style={styles.btnText}>{`${t('hos.medLog')} (PDF)`}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => void run(t('hos.medLog'), () => exportMedLogExcel(medTreatments, today, vessel))}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
      {saved ? <Text style={styles.sub}>{saved}</Text> : null}
      <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <TouchableOpacity style={styles.infoBack} activeOpacity={1} onPress={() => setInfo(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.infoCard, { ...COLORS.glassCard, backgroundColor: COLORS.cardSolid }]}>
            {info ? (() => {
              const ref = referenceOf(info.item);
              return (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MciIcon name={purposeIcon(purposeOf(info.item))} size={22} color={COLORS.primary} />
                    <Text style={[styles.name, { fontSize: 18, flexShrink: 1 }]}>{info.item.name}</Text>
                    {info.item.controlled ? <MciIcon name="lock" size={18} color={COLORS.warning} /> : null}
                  </View>
                  <Text style={styles.sub}>{[info.item.strength, `${info.usable} / ${info.item.required} ${info.item.unit} · ${STOCK_LEVEL_LABEL[stockLevel(info)]}`].filter(Boolean).join(' · ')}</Text>
                  {placeText(info.item) ? <Place text={placeText(info.item)} /> : null}
                  {ref.facts.length ? <Text style={[styles.sub, { color: COLORS.textDark, marginTop: SIZES.xs }]}>{ref.facts.join(' · ')}</Text> : null}
                  <ScrollView style={{ maxHeight: 360, marginTop: SIZES.sm }}>
                    <Text style={[styles.body, { lineHeight: 21 }]}>{ref.text || t('hos.noRef')}</Text>
                    {ref.text ? <Text style={[styles.sub, { marginTop: SIZES.sm, fontWeight: '700' }]}>{MED_INFO_NOTICE}</Text> : null}
                    {ref.text ? <Text style={[styles.sub, { fontSize: 11, marginTop: SIZES.xs }]}>{WHO_NOTICE}</Text> : null}
                  </ScrollView>
                  <View style={[styles.row, { marginTop: SIZES.md }]}>
                    <TouchableOpacity style={styles.btn} onPress={() => { const id = info.item.id; setInfo(null); nav.navigate('MedItem', { id }); }}><Text style={styles.btnText}>Open the item</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.small} onPress={() => { const n = info.item.name; setInfo(null); setQ(n); setRefPart(scaleEntry(info.item).nursing ? 'equipment' : 'medicines'); setView('reference'); }}><Text style={styles.smallText}>{t('hos.inRef')}</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setInfo(null)}><Text style={styles.link}>{t('common.close')}</Text></TouchableOpacity>
                  </View>
                </>
              );
            })() : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
