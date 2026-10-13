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
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Screen, ScreenTitle } from '../components/ui';
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
  onOrderByItem, orderOverdue, ChestSort, earliestExpiry, expiryState, matchesName, purposeOf, scaleEntry, sortChest, orderState, planImport, readSheet, receivedByLine, scaleItems, sortOrders, sortTreatments,
} from '../services/hospital';
import { exportChestExcel, exportChestPdf, exportChestTemplate, exportControlledPdf, exportMedLogExcel, exportMedLogPdf, pickChestSheet } from '../services/hospitalReport';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

export type HospitalView = 'register' | 'orders' | 'archive' | 'inventory' | 'log' | 'reference';
type Filter = 'all' | 'expired' | 'soon' | 'short' | 'controlled';

const TITLE: Record<HospitalView, [string, string]> = {
  register: ['Hospital — register', 'Medicine chest: what is aboard, expiry, what is short'],
  orders: ['Hospital — orders', 'What has been ordered and is still to come'],
  archive: ['Hospital — orders archive', 'Orders complete, or closed with what never came'],
  inventory: ['Hospital — inventory', 'Count the chest against the books'],
  log: ['Hospital — medical log', 'Treatments — confidential, Master and officers only'],
  reference: ['Medicine reference', 'WHO IMGS — for information only'],
};


export default function HospitalSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
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

  const [filter, setFilter] = useState<Filter>((['expired', 'soon', 'short', 'controlled'] as Filter[]).includes(route.params?.filter) ? route.params.filter : 'all');
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosingCat, setChoosingCat] = useState(false);
  const [refPart, setRefPart] = useState<'medicines' | 'scale' | 'equipment'>('medicines');
  const [openRef, setOpenRef] = useState<string | null>(null);

  const rows = useMemo(() => chestStatus(medItems, medMoves, today), [medItems, medMoves, today]);
  const counts = chestCounts(rows);
  const onOrder = useMemo(() => onOrderByItem(medOrders, medMoves), [medOrders, medMoves]);
  const [sortBy, setSortBy] = useState<ChestSort>('attention');
  const shown = useMemo(
    () =>
      sortChest(
        rows
          .filter((r) => filter === 'all' || (filter === 'expired' ? r.expired > 0 : filter === 'soon' ? r.nextState === 'soon' : filter === 'short' ? r.short > 0 : !!r.item.controlled))
          .filter((r) => matchesName(r.item, q)),
        sortBy
      ),
    [rows, filter, q, sortBy]
  );
  const controlled = rows.filter((r) => r.item.controlled);
  const lastCount = lastControlledCount(medItems, medMoves);
  const orders = useMemo(() => sortOrders(medOrders).map((o) => ({ o, st: orderState(o, medMoves) })), [medOrders, medMoves]);
  const open = orders.filter((x) => !isArchived(x.st));
  const archived = orders.filter((x) => isArchived(x.st));
  const log = useMemo(() => sortTreatments(medTreatments), [medTreatments]);
  const due = followUpsDue(medTreatments, today);
  const checks = useMemo(() => [...medChecks].sort((a, b) => b.at - a.at), [medChecks]);

  const run = async (what: string, f: () => Promise<string | null | void>) => {
    try {
      const w = await f();
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
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
  const load = async () => {
    const f = await pickChestSheet();
    if (!f) return;
    const { lines, skipped } = readSheet(f.rows);
    if (!lines.length) return Alert.alert('Medicine chest', `No items found in “${f.name}”. The first row needs a “Name” column — download the Excel list to see the layout.`);
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
      Alert.alert('Medicine chest', `${plan.add.length} added, ${plan.update.length} updated, ${plan.counts.length} batches counted${skipped ? `; ${skipped} rows without a name skipped` : ''}.`);
    };
    Alert.alert('Load the list', `${f.name}: ${plan.add.length} new items, ${plan.update.length} to update, ${plan.counts.length} batches with a quantity (counted as aboard now).`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Load', onPress: () => void go() },
    ]);
  };

  const stateColor = (r: ItemStatus) => (r.expired ? COLORS.danger : r.nextState === 'soon' || r.short ? COLORS.warning : COLORS.success);
  const expLine = (r: ItemStatus) => {
    if (!r.batches.length) return 'None aboard';
    return [r.expired ? `${r.expired} out of date` : null, r.next ? (r.nextState === 'soon' ? `expires in ${daysTo(today, r.next)} d` : `exp ${r.next.slice(0, 7)}`) : null, r.batches.length > 1 ? `${r.batches.length} batches` : null].filter(Boolean).join(' · ');
  };

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  const pages: [HospitalView, string][] = [
    ['register', `Register · ${rows.length}`],
    ['orders', `Orders · ${open.length}`],
    ['archive', `Archive · ${archived.length}`],
    ['inventory', 'Inventory'],
    ...(officer ? [['log', `Log${due.length ? ` · ${due.length} follow-up` : ''}`] as [HospitalView, string]] : []),
    ['reference', 'Reference'],
  ];

  return (
    <Screen scroll>
      <ScreenTitle title={TITLE[shownView][0]} subtitle={TITLE[shownView][1]} help="Hospital" />
      <View style={styles.chips}>
        {pages.map(([k, l]) => <Chip key={k} on={shownView === k} label={l} onPress={() => setView(k)} />)}
      </View>

      {shownView === 'register' ? (
        <>
          {rows.length ? (
            <>
              <TextInput style={[styles.input, { marginTop: 0, marginBottom: SIZES.sm }]} value={q} onChangeText={setQ} placeholder="Search by name" placeholderTextColor={COLORS.textLight} />
              <View style={[styles.chips, { alignItems: 'center' }]}>
                <Text style={[styles.sub, { marginTop: 0 }]}>Sort</Text>
                {([['attention', 'Attention'], ['purpose', 'Purpose'], ['expiry', 'Expiry'], ['name', 'A–Z']] as [ChestSort, string][]).map(([k, l]) => (
                  <Chip key={k} on={sortBy === k} label={l} onPress={() => setSortBy(k)} />
                ))}
              </View>
              <View style={styles.chips}>
                <Chip on={filter === 'all'} label="All" onPress={() => setFilter('all')} />
                <Chip on={filter === 'expired'} label={`Out of date · ${counts.expired}`} onPress={() => setFilter('expired')} />
                <Chip on={filter === 'soon'} label={`Expiring ≤ 30 d · ${counts.soon}`} onPress={() => setFilter('soon')} />
                <Chip on={filter === 'short'} label={`Short · ${counts.short}`} onPress={() => setFilter('short')} />
                {controlled.length ? <Chip on={filter === 'controlled'} label={`Controlled · ${controlled.length}`} onPress={() => setFilter('controlled')} /> : null}
              </View>
              {filter === 'controlled' ? (
                <Text style={[styles.sub, { marginBottom: SIZES.sm, color: !lastCount || daysTo(lastCount, today) > 31 ? COLORS.warning : COLORS.textLight }]}>
                  {`${lastCount ? `Last counted ${formatDate(lastCount)}` : 'Never counted'} — the Master counts them monthly, with a witness (Inventory). Every move of a controlled drug is witnessed.`}
                </Text>
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
              {head ? <Text style={[styles.sub, { fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.md, marginBottom: 4 }]}>{`${head} · ${shown.filter((x) => purposeOf(x.item) === head).length}`}</Text> : null}
              <TouchableOpacity style={[styles.item, { borderLeftColor: stateColor(r) }]} onPress={() => nav.navigate('MedItem', { id: r.item.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${r.item.name}${r.item.controlled ? '  · CD' : ''}`}</Text>
                <Text style={styles.sub}>{[r.item.strength, r.item.location].filter(Boolean).join(' · ')}</Text>
                <Text style={[styles.sub, { color: stateColor(r), fontWeight: '700' }]}>{[`${r.usable} / ${r.item.required} ${r.item.unit}`, r.short ? `${r.short} short` : null, expLine(r)].filter(Boolean).join(' · ')}</Text>
                {coming ? <Text style={[styles.sub, { color: COLORS.primary }]}>{`${coming} on order`}</Text> : null}
                {sortBy === 'expiry' && exp ? <Text style={[styles.sub, { color: expiryState(today, exp) === 'expired' ? COLORS.danger : COLORS.textLight }]}>{`Soonest expiry ${formatDate(exp)}`}</Text> : null}
                {sortBy === 'purpose' ? <Text style={styles.sub} numberOfLines={1}>{scaleEntry(r.item).med?.indication ?? ''}</Text> : null}
              </TouchableOpacity>
              </React.Fragment>
            );
          })}
          {rows.length && !shown.length ? <Text style={styles.sub}>Nothing here.</Text> : null}
          {!rows.length ? (
            <Card>
              <Text style={styles.body}>No medicine chest list yet.</Text>
              <Text style={styles.sub}>Start from the WHO IMGS scale for the vessel’s hospital category — medicines with the quantity required, and the medical equipment — or load your own list from Excel (Name, Strength / form, Unit, Required, Location, Controlled, Batch, Expiry, Quantity). Edit the quantities to your flag’s scale afterwards.</Text>
              {officer ? (
                choosingCat ? (
                  <View style={{ marginTop: SIZES.sm, gap: SIZES.xs }}>
                    {(['C', 'B', 'A'] as HospitalCategory[]).map((c) => (
                      <TouchableOpacity key={c} style={styles.small} disabled={busy} onPress={() => void addScale(c)}><Text style={styles.smallText}>{HOSPITAL_CATEGORY_LABEL[c]}</Text></TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setChoosingCat(false)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.btn} disabled={busy} onPress={() => setChoosingCat(true)}><Text style={styles.btnText}>Start from the WHO IMGS scale</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void load()}><Text style={styles.smallText}>Load from Excel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => void run('Excel list', () => exportChestTemplate([]))}><Text style={styles.link}>Excel layout</Text></TouchableOpacity>
                  </View>
                )
              ) : null}
              {busy ? <Text style={styles.sub}>Adding…</Text> : null}
              <Text style={[styles.sub, { fontSize: 11, marginTop: SIZES.sm }]}>{WHO_NOTICE}</Text>
            </Card>
          ) : null}
          {officer && rows.length ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedItem', { id: 'new' })}><Text style={styles.smallText}>+ Item</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void load()}><Text style={styles.smallText}>Load from Excel</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => void run('Excel list', () => exportChestTemplate(rows))}><Text style={styles.link}>Excel list to fill in</Text></TouchableOpacity>
            </View>
          ) : null}
          {rows.length ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => void run('Medicine chest', () => exportChestPdf(rows, today, vessel))}><Text style={styles.btnText}>Inventory & to order (PDF)</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => void run('Medicine chest', () => exportChestExcel(rows, today, vessel))}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
              {controlled.length ? <TouchableOpacity style={styles.btn} onPress={() => void run('Controlled drugs', () => exportControlledPdf(medItems, medMoves, today, vessel))}><Text style={styles.btnText}>Controlled drugs register (PDF)</Text></TouchableOpacity> : null}
            </View>
          ) : null}
        </>
      ) : shownView === 'orders' || shownView === 'archive' ? (
        <>
          {shownView === 'orders' && officer ? (
            <View style={[styles.row, { marginTop: 0 }]}>
              <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('MedOrder', { id: 'new', fill: 'short' })}><Text style={styles.btnText}>+ Order what is short or expiring</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => nav.navigate('MedOrder', { id: 'new' })}><Text style={styles.smallText}>+ Empty order</Text></TouchableOpacity>
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
                <Text style={styles.sub}>{[`ordered ${formatDate(o.date)}`, o.ref, o.port, o.due ? `expected ${formatDate(o.due)}` : null].filter(Boolean).join(' · ')}</Text>
                <Text style={[styles.sub, { color, fontWeight: '700' }]}>{[ORDER_STATE_LABEL[st], `${full} of ${lines} lines in full`, late ? 'OVERDUE' : null].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
            );
          })}
          {!(shownView === 'orders' ? open : archived).length ? <Text style={styles.sub}>{shownView === 'orders' ? 'Nothing on order.' : 'No order completed or closed yet.'}</Text> : null}
        </>
      ) : shownView === 'reference' ? (
        <>
          <View style={[styles.item, { borderLeftColor: COLORS.warning }]}>
            <Text style={[styles.body, { fontWeight: '700' }]}>{MED_INFO_NOTICE}</Text>
            <Text style={[styles.sub, { marginTop: SIZES.xs }]}>{WHO_NOTICE}</Text>
          </View>
          <View style={styles.chips}>
            <Chip on={refPart === 'medicines'} label={`Medicines · ${IMGS_REFERENCE.length}`} onPress={() => setRefPart('medicines')} />
            <Chip on={refPart === 'scale'} label={`Scale A / B / C · ${MED_SCALE.length}`} onPress={() => setRefPart('scale')} />
            <Chip on={refPart === 'equipment'} label={`Equipment · ${NURSING_SCALE.length}`} onPress={() => setRefPart('equipment')} />
          </View>
          <TextInput style={[styles.input, { marginTop: 0, marginBottom: SIZES.sm }]} value={q} onChangeText={setQ} placeholder="Search — name, use, ATC, code" placeholderTextColor={COLORS.textLight} />
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
          {officer && rows.length ? (
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.md }]} onPress={() => nav.navigate('MedCount', { id: 'new' })}><Text style={styles.btnText}>Start an inventory</Text></TouchableOpacity>
          ) : null}
          {!rows.length ? <Text style={styles.sub}>Make the register first — then count it here.</Text> : null}
          {checks.map((c) => {
            const diff = differences(c).length;
            return (
              <TouchableOpacity key={c.id} style={[styles.item, { borderLeftColor: diff ? COLORS.warning : COLORS.success }]} onPress={() => nav.navigate('MedCount', { id: c.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${c.no} · ${formatDate(c.date)}`}</Text>
                <Text style={styles.sub}>{[`${c.lines.length} lines`, diff ? `${diff} differences` : 'as the books', c.witness ? `witness ${c.witness}` : null, c.byRank ? `${c.by} (${c.byRank})` : c.by].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
            );
          })}
        </>
      ) : (
        <>
          <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>Confidential — the Master and the officers see the medical log; the crew and the shore do not.</Text>
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.md }]} onPress={() => nav.navigate('Treatment', { id: 'new' })}><Text style={styles.btnText}>+ New treatment</Text></TouchableOpacity>
          {due.map((t) => (
            <TouchableOpacity key={`fu-${t.id}`} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => nav.navigate('Treatment', { id: 'new', followUpOf: t.id })}>
              <Text style={styles.name}>{`Follow-up due — ${t.patient}`}</Text>
              <Text style={styles.sub}>{`${t.no} ${t.complaint} · due ${formatDate(t.followUp)}`}</Text>
            </TouchableOpacity>
          ))}
          {log.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.item, { borderLeftColor: t.outcome === 'fit' ? COLORS.success : t.outcome === 'light' ? COLORS.warning : COLORS.danger }]} onPress={() => nav.navigate('Treatment', { id: t.id })} activeOpacity={0.7}>
              <Text style={styles.name}>{`${t.no} · ${t.patient}`}</Text>
              <Text style={styles.sub}>{[`${formatDate(t.date)}${t.time ? ` ${t.time}` : ''}`, t.complaint, t.diagnosis].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.sub}>{[OUTCOME_LABEL[t.outcome], t.issued.length ? `${t.issued.length} medicine${t.issued.length > 1 ? 's' : ''}` : null, t.tmas ? 'radio advice' : null, t.files?.length ? `${t.files.length} file${t.files.length > 1 ? 's' : ''}` : null, t.byRank ? `${t.by} (${t.byRank})` : t.by].filter(Boolean).join(' · ')}</Text>
            </TouchableOpacity>
          ))}
          {!log.length ? <Text style={styles.sub}>No treatment recorded.</Text> : null}
          {log.length ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => void run('Medical log', () => exportMedLogPdf(medTreatments, today, vessel))}><Text style={styles.btnText}>Medical log (PDF)</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => void run('Medical log', () => exportMedLogExcel(medTreatments, today, vessel))}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
      {saved ? <Text style={styles.sub}>{saved}</Text> : null}
    </Screen>
  );
}
