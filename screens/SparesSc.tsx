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
import { StockStatus, qtyText, statusRank, stockByPart, stockStatus } from '../services/spares';
import { uid } from '../utils/id';
import * as XLSX from 'xlsx';
import { Dropdown } from '../components/Dropdown';
import { moduleOn } from '../constants/modules';
import { upcomingNeeds } from '../services/sparesNeed';
import { vesselHeader } from '../services/export';
import { todayIso } from '../services/pms';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

export default function SparesSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { spares, spareMoves, pmsJobs, machines, pmsDeferrals, vessel } = useData();
  // Parts the coming PMS jobs will use that are not on the shelf (services/sparesNeed).
  const [horizon, setHorizon] = useState(30);
  const [saved, setSaved] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [toOrder, setToOrder] = useState(false);

  const stock = useMemo(() => stockByPart(spareMoves), [spareMoves]);
  const rows = useMemo(
    () => spares.map((p) => {
      const onHand = stock.get(p.id) ?? 0;
      return { p, onHand, status: stockStatus(p, onHand) };
    }),
    [spares, stock]
  );
  const needs = useMemo(() => (moduleOn('pms') ? upcomingNeeds(pmsJobs, machines, pmsDeferrals, spares, stock, horizon) : []), [pmsJobs, machines, pmsDeferrals, spares, stock, horizon]);
  const requisition = async () => {
    try {
      const lowOnly = rows.filter((r) => r.status !== 'ok' && !needs.some((n) => n.part.id === r.p.id));
      const head = ['Part', 'Part No.', 'Maker', 'Unit', 'Needed for jobs', 'In stock', 'Order', 'For'];
      const body = [
        ...needs.map((n) => [n.part.name, n.part.partNo ?? '', n.part.maker ?? '', n.part.unit ?? 'pcs', n.need, n.onHand, n.order, n.forJobs.join('; ')]),
        ...lowOnly.map((r) => [r.p.name, r.p.partNo ?? '', r.p.maker ?? '', r.p.unit ?? 'pcs', '', r.onHand, Math.max(1, (r.p.minQty ?? 0) - r.onHand + 1), 'below re-order level']),
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
        if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
      } else await deliverFile(name, b64, true, mime);
    } catch (e: any) {
      Alert.alert('Requisition', String(e?.message ?? e));
    }
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
      <ScreenTitle title="Spares" subtitle="Spare parts and stores" help="Spare parts" />

      <Card>
        <View style={styles.stats}>
          <Stat value={String(out)} label="Out of stock" color={out ? COLORS.danger : COLORS.textDark} />
          <Stat value={String(low)} label="Low" color={low ? COLORS.warning : COLORS.textDark} />
          <Stat value={String(spares.length)} label="Lines" color={COLORS.textDark} />
        </View>
      </Card>

      {moduleOn('pms') ? (
        <Card>
          <View style={styles.needHead}>
            <Text style={styles.needTitle}>{`For jobs ahead · ${needs.length}`}</Text>
            <Dropdown caption="WITHIN" value={horizon} onChange={setHorizon} options={[30, 60, 90].map((d) => ({ value: d, label: `${d} days` }))} style={{ minWidth: 150 }} />
            <TouchableOpacity style={styles.reqBtn} onPress={() => void requisition()}><Text style={styles.reqBtnText}>Requisition (Excel)</Text></TouchableOpacity>
          </View>
          {saved ? <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: 12 }}>{`✓ ${saved}`}</Text> : null}
          {needs.map((n) => (
            <TouchableOpacity key={n.part.id} style={styles.needRow} onPress={() => nav.navigate('SparePart', { id: n.part.id })} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.needName}>{`${n.part.name}${n.part.partNo ? ` · ${n.part.partNo}` : ''}`}</Text>
                <Text style={styles.needSub} numberOfLines={2}>{n.forJobs.join(' · ')}</Text>
              </View>
              <Text style={styles.needQty}>{`need ${n.need} · have ${n.onHand} · order ${n.order}`}</Text>
            </TouchableOpacity>
          ))}
          {!needs.length ? <Text style={styles.needSub}>{`Everything the PMS jobs of the next ${horizon} days use is on the shelf.`}</Text> : null}
        </Card>
      ) : null}

      <View style={styles.tools}>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search name, part no., maker, location…"
          placeholderTextColor={COLORS.textLight}
        />
        <TouchableOpacity style={[styles.chip, toOrder && styles.chipOn]} onPress={() => setToOrder((v) => !v)}>
          <Text style={[styles.chipText, toOrder && styles.chipTextOn]}>To order{out + low ? ` · ${out + low}` : ''}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.head}>
        <Label>Parts</Label>
        <TouchableOpacity onPress={addPart} hitSlop={10}>
          <Text style={styles.add}>+ Add part</Text>
        </TouchableOpacity>
      </View>

      {spares.length === 0 ? (
        <Empty text="No spare parts yet. Add what the vessel keeps — filters, impellers, belts, oil — with where it is stored and the level at which to re-order." />
      ) : groups.length === 0 ? (
        <Empty text={toOrder ? 'Nothing to order — every line is above its re-order level.' : 'No part matches.'} />
      ) : (
        groups.map(({ loc, list }) => (
          <View key={loc}>
            <Text style={styles.loc}>{loc}</Text>
            {list.map(({ p, onHand, status }) => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => nav.navigate('SparePart', { id: p.id })} activeOpacity={0.7}>
                <View style={[styles.bar, { backgroundColor: status === 'ok' ? COLORS.success : color(status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[p.partNo, p.maker, p.minQty != null ? `min ${p.minQty}` : null].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                <Text style={[styles.qty, { color: color(status) }]}>{qtyText(onHand, p)}</Text>
              </TouchableOpacity>
            ))}
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
  });
