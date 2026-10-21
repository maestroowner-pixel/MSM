// ===================================
// Spares — the stores, as an engineer reads them.
//
// One list, grouped by where things are kept (store, shelf), because that is how
// a stocktake walks and how a part is found at 0300. The counts at the top answer
// the question asked before every order: what is out, and what is at or below
// its re-order level. "To order" narrows the list to exactly those lines.
//
// Stock is the sum of movements (types/spares.ts), worked out here per render;
// a vessel's stores run to hundreds of lines and thousands of movements, which
// is still nothing to add up.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { StockStatus, firstExpiry, makeMove, orderQty, priceText, qtyText, statusRank, stockByPart, stockStatus } from '../services/spares';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { formatDate } from '../utils/dates';
import { playSuccessSound } from '../utils/sound';
import { uid } from '../utils/id';
import * as XLSX from 'xlsx';
import { Dropdown } from '../components/Dropdown';
import { moduleOn } from '../constants/modules';
import { upcomingNeeds } from '../services/sparesNeed';
import { vesselHeader } from '../services/export';
import { todayIso } from '../services/pms';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { nextOrderNo } from '../services/orders';
import { ORDER_DEPTS, ORDER_DEPT_LABEL, OrderLine, PurchaseOrder } from '../types/orders';
import * as storage from '../services/storage';
import { t, tn, useT } from '../utils/i18n';

export default function SparesSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { spares, spareMoves, pmsJobs, machines, pmsDeferrals, vessel, purchaseOrders, saveRow, addSpareMoves } = useData();
  const { signer, picker } = useSigner('COUNTED BY');
  const confirmSign = useSignConfirm();
  // Parts the coming PMS jobs will use that are not on the shelf (services/sparesNeed).
  const [horizon, setHorizon] = useState(30);
  const [saved, setSaved] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [toOrder, setToOrder] = useState(false);

  const stock = useMemo(() => stockByPart(spareMoves), [spareMoves]);
  const today = todayIso();
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 90 * 86400000).toISOString().slice(0, 10);
  const rows = useMemo(
    () => spares.map((p) => {
      const onHand = stock.get(p.id) ?? 0;
      // The first shelf-life date still on the shelf (services/spares batchesOnHand).
      const exp = firstExpiry(spareMoves.filter((m) => m.partId === p.id));
      return { p, onHand, status: stockStatus(p, onHand), exp };
    }),
    [spares, stock, spareMoves]
  );
  const expiring = rows.filter((r) => r.exp && r.exp.expiry! <= soon).length;

  // ---- Stocktake of one location at once (TM Master's mass update) ----
  const [counting, setCounting] = useState<{ loc: string; qty: Record<string, string> } | null>(null);
  const startCount = (loc: string, list: { p: { id: string }; onHand: number }[]) =>
    setCounting({ loc, qty: Object.fromEntries(list.map((r) => [r.p.id, String(r.onHand)])) });
  const saveCount = async () => {
    if (!counting) return;
    const changed = rows.filter((r) => counting.qty[r.p.id] != null).map((r) => ({ r, n: Number(counting.qty[r.p.id].replace(',', '.')) }));
    if (changed.some((c) => !counting.qty[c.r.p.id].trim() || !Number.isFinite(c.n) || c.n < 0)) return Alert.alert(t('sp.stocktake'), t('sp.everyLine'));
    const diff = changed.filter((c) => c.n !== c.r.onHand);
    if (!signer) return Alert.alert(t('mc.whoCounted'), t('round.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Stocktake: ${counting.loc} — ${changed.length} line${changed.length === 1 ? '' : 's'}` });
    if (!sig) return;
    // Every line counted is recorded — an unchanged count is the evidence it was checked.
    const moves = changed.map((c) => {
      const m = makeMove(c.r.p, 'count', c.n, c.r.onHand, { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}) }, today, { note: `Stocktake ${counting.loc}` });
      return sig.proof ? { ...m, signedWith: sig.proof } : m;
    });
    await addSpareMoves(moves);
    setCounting(null);
    playSuccessSound();
    Alert.alert(t('sp.stocktake'), t('sp.counted', { x: tn('n.line', changed.length), n: diff.length }));
  };
  const needs = useMemo(() => (moduleOn('pms') ? upcomingNeeds(pmsJobs, machines, pmsDeferrals, spares, stock, horizon) : []), [pmsJobs, machines, pmsDeferrals, spares, stock, horizon]);
  const requisition = async () => {
    try {
      const lowOnly = rows.filter((r) => r.status !== 'ok' && !needs.some((n) => n.part.id === r.p.id));
      // The usual supplier's reference, price and lead time — what the purchaser needs to place it.
      const sup = (p: (typeof spares)[number], qty: number) => {
        const x = p.suppliers?.[0];
        return [x?.name ?? '', x?.ref ?? '', x?.price != null ? priceText(x) : '', x?.price != null ? Number((x.price * qty).toFixed(2)) : '', x?.leadDays != null ? x.leadDays : ''];
      };
      const head = ['Part', 'Part No.', 'IMPA', 'Maker', 'Unit', 'Needed for jobs', 'In stock', 'Order', 'For', 'Supplier', 'Their ref.', 'Unit price', 'Line total', 'Lead, days'];
      const body = [
        ...needs.map((n) => {
          // Enough for the jobs, and the line back up to its maximum when it has one.
          const qty = Math.max(n.order, orderQty(n.part, n.onHand - n.need));
          return [n.part.name, n.part.partNo ?? '', n.part.impa ?? '', n.part.maker ?? '', n.part.unit ?? 'pcs', n.need, n.onHand, qty, n.forJobs.join('; '), ...sup(n.part, qty)];
        }),
        ...lowOnly.map((r) => {
          const qty = orderQty(r.p, r.onHand);
          return [r.p.name, r.p.partNo ?? '', r.p.impa ?? '', r.p.maker ?? '', r.p.unit ?? 'pcs', '', r.onHand, qty, r.p.maxQty != null ? 'below re-order level — up to the maximum' : 'below re-order level', ...sup(r.p, qty)];
        }),
      ];
      const ws = XLSX.utils.aoa_to_sheet([[`Spares requisition — jobs within ${horizon} days`], [vesselHeader(vessel)], [], head, ...body]);
      ws['!cols'] = head.map((h) => ({ wch: h === 'For' ? 60 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Requisition');
      const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
      const d = todayIso();
      const name = `Spares requisition-${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(2, 4)}${v ? `-${v}` : ''}.xlsx`;
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (onWeb) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const w = await saveFileWeb(new Blob([bytes], { type: mime }), name, 'reports');
        if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
      } else await deliverFile(name, b64, true, mime);
    } catch (e: any) {
      Alert.alert(t('sp.requisition'), String(e?.message ?? e));
    }
  };
  const newOrderFromSpares = () => {
    const lowOnly = rows.filter((r) => r.status !== 'ok' && !needs.some((n) => n.part.id === r.p.id));
    const allNeeds = needs;
    const allLow = lowOnly;
    const total = allNeeds.length + allLow.length;
    if (total === 0) {
      Alert.alert(t('sp.newOrder'), t('sp.nothingToOrder'));
      return;
    }

    // Group lines by department assigned to each spare. Parts with no dept go into
    // a catch-all 'engine' order (most common on a vessel).
    const linesByDept = new Map<string, OrderLine[]>();
    const push = (dept: string, line: OrderLine) => {
      if (!linesByDept.has(dept)) linesByDept.set(dept, []);
      linesByDept.get(dept)!.push(line);
    };
    for (const n of allNeeds) {
      push(n.part.dept ?? 'engine', {
        id: uid('ol'),
        description: n.part.name,
        qty: Math.max(n.order, orderQty(n.part, n.onHand - n.need)),
        unit: n.part.unit ?? 'pcs',
        partNo: n.part.partNo,
        impa: n.part.impa,
        maker: n.part.maker,
        notes: n.forJobs.join('; '),
        spareId: n.part.id,
      });
    }
    for (const r of allLow) {
      push(r.p.dept ?? 'engine', {
        id: uid('ol'),
        description: r.p.name,
        qty: orderQty(r.p, r.onHand),
        unit: r.p.unit ?? 'pcs',
        partNo: r.p.partNo,
        impa: r.p.impa,
        maker: r.p.maker,
        spareId: r.p.id,
      });
    }

    const deptKeys = ORDER_DEPTS.filter((d) => linesByDept.has(d));
    // Also capture any keys not in ORDER_DEPTS (shouldn't happen but be safe)
    for (const k of linesByDept.keys()) if (!deptKeys.includes(k as any)) deptKeys.push(k as any);

    const summary = deptKeys.map((d) => `${ORDER_DEPT_LABEL[d] ?? d}: ${tn('n.line', linesByDept.get(d)!.length)}`).join('\n');
    Alert.alert(
      t('sp.createOrders'),
      `${tn('sp.willCreate', deptKeys.length)}\n\n${summary}`,
      [
        {
          text: t('sp.create'),
          onPress: () => void (async () => {
            // nextOrderNo must be called sequentially to avoid duplicate numbers
            let nos = purchaseOrders;
            let firstId: string | null = null;
            for (const dept of deptKeys) {
              const lines = linesByDept.get(dept)!;
              const order: PurchaseOrder = {
                id: uid('po'),
                no: nextOrderNo(nos, dept),
                dept,
                status: 'draft',
                date: today,
                by: '',
                lines,
                at: Date.now(),
                updatedAt: Date.now(),
              };
              await saveRow(storage.PURCHASE_ORDERS_KEY, order);
              // Simulate the saved order being in the list for the next no calculation
              nos = [...nos, order];
              if (!firstId) firstId = order.id;
            }
            if (firstId) nav.navigate('Order', { id: firstId });
          })(),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  };

  const out = rows.filter((r) => r.status === 'out').length;
  const low = rows.filter((r) => r.status === 'low').length;

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = rows
      .filter((r) => !toOrder || r.status !== 'ok')
      .filter((r) => !needle || [r.p.name, r.p.partNo, r.p.maker, r.p.location].some((v) => v?.toLowerCase().includes(needle)));
    const byLoc = new Map<string, typeof shown>();
    for (const r of shown) {
      const k = r.p.location?.trim() || 'No location';
      byLoc.set(k, [...(byLoc.get(k) ?? []), r]);
    }
    return [...byLoc.entries()]
      .sort(([a], [b]) => (a === 'No location' ? 1 : b === 'No location' ? -1 : a.localeCompare(b)))
      .map(([loc, list]) => ({
        loc,
        list: list.sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.p.name.localeCompare(b.p.name)),
      }));
  }, [rows, q, toOrder]);

  const color = (s: StockStatus) => (s === 'out' ? COLORS.danger : s === 'low' ? COLORS.warning : COLORS.textDark);
  const addPart = () => nav.navigate('SparePart', { id: uid('part'), isNew: true });

  return (
    <Screen scroll>
      <ScreenTitle title={t('sp.title')} subtitle={t('sp.sub')} help="Spare parts" />

      <Card>
        <View style={styles.stats}>
          <Stat value={String(out)} label={t('sp.out')} color={out ? COLORS.danger : COLORS.textDark} />
          <Stat value={String(low)} label={t('sp.low')} color={low ? COLORS.warning : COLORS.textDark} />
          <Stat value={String(expiring)} label={t('sp.expiring')} color={expiring ? COLORS.warning : COLORS.textDark} />
          <Stat value={String(spares.length)} label={t('mo.lines')} color={COLORS.textDark} />
        </View>
      </Card>

      {moduleOn('pms') ? (
        <Card>
          <View style={styles.needHead}>
            <Text style={styles.needTitle}>{t('sp.forJobs', { n: needs.length })}</Text>
            <Dropdown caption={t('sp.within')} value={horizon} onChange={setHorizon} options={[30, 60, 90].map((d) => ({ value: d, label: tn('n.day', d) }))} style={{ minWidth: 150 }} />
            <TouchableOpacity style={styles.reqBtn} onPress={() => void requisition()}><Text style={styles.reqBtnText}>{t('sp.reqExcel')}</Text></TouchableOpacity>
            {moduleOn('orders') ? <TouchableOpacity style={[styles.reqBtn, styles.reqBtnFill]} onPress={newOrderFromSpares}><Text style={[styles.reqBtnText, styles.reqBtnFillText]}>{`→ ${t('sp.newOrder')}`}</Text></TouchableOpacity> : null}
          </View>
          {saved ? <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: 12 }}>{`✓ ${saved}`}</Text> : null}
          {needs.map((n) => (
            <TouchableOpacity key={n.part.id} style={styles.needRow} onPress={() => nav.navigate('SparePart', { id: n.part.id })} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.needName}>{`${n.part.name}${n.part.partNo ? ` · ${n.part.partNo}` : ''}`}</Text>
                <Text style={styles.needSub} numberOfLines={2}>{n.forJobs.join(' · ')}</Text>
              </View>
              <Text style={styles.needQty}>{t('sp.needHave', { need: n.need, have: n.onHand, order: n.order })}</Text>
            </TouchableOpacity>
          ))}
          {!needs.length ? <Text style={styles.needSub}>{t('sp.allOnShelf', { n: horizon })}</Text> : null}
        </Card>
      ) : null}

      <View style={styles.tools}>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder={t('sp.searchPh')}
          placeholderTextColor={COLORS.textLight}
        />
        <TouchableOpacity style={[styles.chip, toOrder && styles.chipOn]} onPress={() => setToOrder((v) => !v)}>
          <Text style={[styles.chipText, toOrder && styles.chipTextOn]}>To order{out + low ? ` · ${out + low}` : ''}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.head}>
        <Label>{t('sp.parts')}</Label>
        <TouchableOpacity onPress={addPart} hitSlop={10}>
          <Text style={styles.add}>{t('sp.addPart')}</Text>
        </TouchableOpacity>
      </View>

      {spares.length === 0 ? (
        <Empty text={t('sp.empty')} />
      ) : groups.length === 0 ? (
        <Empty text={toOrder ? t('sp.nothingBelow') : t('sp.noMatch')} />
      ) : (
        groups.map(({ loc, list }) => (
          <View key={loc}>
            <View style={styles.locHead}>
              <Text style={styles.loc}>{loc === 'No location' ? t('sp.noLoc') : loc}</Text>
              {counting?.loc === loc ? null : (
                <TouchableOpacity onPress={() => startCount(loc, list)} hitSlop={8} disabled={!!counting}>
                  <Text style={[styles.add, !!counting && { opacity: 0.35 }]}>{t('sp.stocktake')}</Text>
                </TouchableOpacity>
              )}
            </View>
            {counting?.loc === loc ? (
              <Text style={styles.sub}>{t('sp.countHint')}</Text>
            ) : null}
            {list.map(({ p, onHand, status, exp }) => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => (counting?.loc === loc ? undefined : nav.navigate('SparePart', { id: p.id }))} activeOpacity={0.7}>
                <View style={[styles.bar, { backgroundColor: status === 'ok' ? COLORS.success : color(status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[p.partNo, p.maker, p.minQty != null ? t('sp.min', { n: p.minQty }) : null, p.maxQty != null ? t('sp.max', { n: p.maxQty }) : null].filter(Boolean).join(' · ') || '—'}
                  </Text>
                  {exp && exp.expiry! <= soon ? (
                    <Text style={[styles.sub, { color: exp.expiry! < today ? COLORS.danger : COLORS.warning, fontWeight: '700' }]}>{`${exp.expiry! < today ? t('sp.expired', { date: formatDate(exp.expiry) }) : t('sp.expires', { date: formatDate(exp.expiry) })} · ${qtyText(exp.qty, p)}`}</Text>
                  ) : null}
                </View>
                {counting?.loc === loc ? (
                  <TextInput
                    style={[styles.search, styles.countIn]}
                    value={counting.qty[p.id] ?? ''}
                    onChangeText={(v) => setCounting({ ...counting, qty: { ...counting.qty, [p.id]: v } })}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={[styles.qty, { color: color(status) }]}>{qtyText(onHand, p)}</Text>
                )}
              </TouchableOpacity>
            ))}
            {counting?.loc === loc ? (
              <View style={styles.countBar}>
                {picker}
                <TouchableOpacity style={styles.reqBtn} onPress={() => void saveCount()}><Text style={styles.reqBtnText}>{t('sp.record')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCounting(null)}><Text style={styles.add}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))
      )}
    </Screen>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  const COLORS = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: SIZES.h4, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: SIZES.tiny, color: COLORS.textLight }}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    needHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.sm },
    needTitle: { flex: 1, fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
    reqBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 8, paddingHorizontal: SIZES.md },
    reqBtnText: { color: COLORS.primary, fontWeight: '800' },
    reqBtnFill: { backgroundColor: COLORS.primary },
    reqBtnFillText: { color: COLORS.textWhite },
    needRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
    needName: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    needSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    needQty: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.warning },
    stats: { flexDirection: 'row', gap: SIZES.sm },
    tools: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm },
    search: { flex: 1, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text },
    chip: { paddingVertical: 8, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.md },
    add: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    loc: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SIZES.sm, marginBottom: SIZES.xs },
    row: { flexDirection: 'row', alignItems: 'center', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingRight: SIZES.md, marginBottom: SIZES.sm, overflow: 'hidden', gap: SIZES.xs },
    bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.sm },
    title: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    qty: { fontSize: SIZES.h5, fontWeight: '800', marginLeft: SIZES.sm },
    locHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    countIn: { flex: 0, width: 80, textAlign: 'center', fontWeight: '800' },
    countBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.md, marginBottom: SIZES.md },
  });
