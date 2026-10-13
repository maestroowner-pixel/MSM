// ===================================
// The notice board — the Dashboard when `board` is on (services/board.ts).
//
//   status line   ISPS level · persons on board · fuel on board
//   Needs attention   every module, worst first, for this person's rank
//   Plan          rounds of the week / month / quarter / year, surveys, services
//   Today         the day's routine, ticked as it is done
//   Sections      a tile per module switched on
//
// The old expiry list of LSA / FFE / lifting is its own screen now ("Expiries"),
// one tap away on the LSA / FFE tile.
// ===================================

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { TrialBanner } from '../components/TrialBanner';
import { MasterPinBanner } from '../components/MasterPinBanner';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { CATEGORY_MAP } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { personName } from '../types/role';
import { CategoryKey } from '../types/equipment';
import { buildBoard, Level } from '../services/board';
import { todayIso } from '../services/pms';
import { nowLocal } from '../services/permits';
import { formatDate } from '../utils/dates';

export default function BoardSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const data = useData();
  const sync = useSync();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  // Re-read "now" each time the board comes into view: the noon report and the
  // rounds change with the clock, not only with the data.
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));

  const role = !sync.enrolled ? 'superadmin' : (sync.role as 'user' | 'admin' | 'superadmin');
  const me = useMemo(() => {
    if (sync.me) return { key: `device:${sync.me.id}`, name: personName(sync.me) };
    const c = data.crew.find((x) => x.id === data.prefs?.lastCrewId && !x.deleted);
    return c ? { key: c.id, name: c.name } : null;
  }, [sync.me, data.crew, data.prefs?.lastCrewId]);

  const board = useMemo(
    () =>
      buildBoard({
        on: moduleOn,
        role,
        me,
        today: todayIso(),
        now: nowLocal(),
        labelOf: (k: CategoryKey) => data.categories.find((c) => c.key === k)?.label ?? CATEGORY_MAP[k]?.label ?? String(k),
        periodsOf: (k: CategoryKey) => periodsFor(k, data.templates),
        ...data,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, role, me, tick]
  );

  const color = (l?: Level) => (l === 'red' ? COLORS.danger : l === 'amber' ? COLORS.warning : l === 'blue' ? COLORS.primary : COLORS.success);
  const go = (route: string, params?: Record<string, unknown>) => nav.navigate(route, params);
  const st = board.status;
  const statusBits = [
    data.vessel?.vessel_name || null,
    st.isps ? `ISPS ${st.isps}` : null,
    st.pob ? `${st.pob.total} on board${st.pob.visitors ? ` (${st.pob.visitors} visitor${st.pob.visitors > 1 ? 's' : ''})` : ''}` : null,
    st.pob?.ashore ? `${st.pob.ashore} ashore` : null,
    st.rob ? `ROB ${Math.round(st.rob.litres).toLocaleString('en-GB').replace(/,/g, ' ')} L${st.rob.daysLeft != null ? ` ≈ ${st.rob.daysLeft} d` : ''}` : null,
  ].filter(Boolean);

  const attention = (
    <View style={styles.block}>
      <Text style={styles.head}>{board.attention.length ? `Needs attention · ${board.attention.length}` : 'Needs attention'}</Text>
      {board.attention.map((a) => (
        <TouchableOpacity key={a.key} style={styles.notice} onPress={() => go(a.route, a.params)} activeOpacity={0.7}>
          <View style={[styles.dot, { backgroundColor: color(a.level) }]} />
          <MciIcon name={a.icon} size={18} color={COLORS.textLight} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeText}>{a.title}</Text>
            {a.sub ? <Text style={styles.sub}>{a.sub}</Text> : null}
          </View>
          <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      ))}
      {!board.attention.length ? (
        <View style={styles.allGood}>
          <MciIcon name="check-circle-outline" size={20} color={COLORS.success} />
          <Text style={[styles.noticeText, { color: COLORS.success }]}>Nothing outstanding.</Text>
        </View>
      ) : null}
    </View>
  );

  const plan = board.plan.length ? (
    <View style={styles.block}>
      <Text style={styles.head}>Plan</Text>
      {board.plan.map((p) => (
        <TouchableOpacity key={p.key} style={styles.planRow} onPress={() => go(p.route, p.params)} activeOpacity={0.7}>
          <MciIcon name={p.icon} size={18} color={p.level ? color(p.level) : COLORS.textLight} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeText}>{p.title}</Text>
            <Text style={[styles.sub, p.level ? { color: color(p.level), fontWeight: '700' } : null]}>{p.sub}</Text>
            {p.progress != null ? (
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.round(p.progress * 100)}%`, backgroundColor: p.progress >= 1 ? COLORS.success : p.level ? color(p.level) : COLORS.primary }]} />
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  const today = board.today.length ? (
    <View style={styles.block}>
      <Text style={styles.head}>{`Today · ${formatDate(todayIso())}`}</Text>
      {board.today.map((t) => (
        <TouchableOpacity key={t.key} style={styles.todayRow} onPress={() => go(t.route, t.params)} activeOpacity={0.7}>
          <MciIcon name={t.done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={20} color={t.done ? COLORS.success : COLORS.textLight} />
          <Text style={[styles.noticeText, t.done && { color: COLORS.textLight, textDecorationLine: 'line-through' }]}>{t.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  // Summaries — the gangway and the hospital at a glance (13 Oct 2026).
  const summaries = board.summaries.map((g) => (
    <TouchableOpacity key={g.key} style={styles.block} onPress={() => go(g.route, g.params)} activeOpacity={0.85}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <MciIcon name={g.icon} size={18} color={COLORS.primary} />
        <Text style={[styles.head, { marginBottom: 0, flex: 1 }]}>{g.title}</Text>
        <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
      </View>
      {g.rows.map((r) => (
        <View key={r.label} style={styles.sumRow}>
          <Text style={styles.sumLabel}>{r.label}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeText, r.level ? { color: color(r.level), fontWeight: '700' } : null]}>{r.value}</Text>
            {r.more?.map((m) => <Text key={m} style={styles.sub}>{m}</Text>)}
          </View>
        </View>
      ))}
    </TouchableOpacity>
  ));

  const tiles = (
    <View style={styles.block}>
      <Text style={styles.head}>Sections</Text>
      <View style={styles.tiles}>
        {board.tiles.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tile, { borderTopColor: t.level ? color(t.level) : COLORS.borderLight }]} onPress={() => go(t.route, t.params)} activeOpacity={0.8}>
            <MciIcon name={t.icon} size={22} color={t.level ? color(t.level) : COLORS.primary} />
            <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
            <Text style={[styles.sub, t.level ? { color: color(t.level), fontWeight: '700' } : null]} numberOfLines={2}>{t.line}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Screen scroll>
      <ScreenTitle title="Board" subtitle={statusBits.length ? statusBits.join(' · ') : 'The vessel at a glance'} help="Board" onScan={() => nav.navigate('Scan')} />
      <TrialBanner />
      <MasterPinBanner />
      {wide ? (
        <View style={{ flexDirection: 'row', gap: SIZES.lg, alignItems: 'flex-start' }}>
          {/* Sections first, what needs attention under them; Today and the Plan on the right (11 Oct 2026). */}
          <View style={{ flex: 3 }}>{tiles}{attention}</View>
          <View style={{ flex: 2 }}>{today}{summaries}{plan}</View>
        </View>
      ) : (
        <>
          {tiles}
          {attention}
          {today}
          {summaries}
          {plan}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    block: { ...COLORS.glassCard, borderRadius: SIZES.radiusLg, padding: SIZES.md, marginBottom: SIZES.md },
    head: { fontSize: SIZES.small, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: SIZES.sm },
    notice: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    dot: { width: 8, height: 8, borderRadius: 4 },
    noticeText: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    sumRow: { flexDirection: 'row', gap: SIZES.sm, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
    sumLabel: { width: 118, fontSize: SIZES.small, color: COLORS.textLight, paddingTop: 2 },
    allGood: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm },
    planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm, paddingVertical: 8 },
    bar: { height: 5, borderRadius: 3, backgroundColor: COLORS.borderLight, marginTop: 5, overflow: 'hidden' },
    barFill: { height: 5, borderRadius: 3 },
    todayRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 7 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    tile: { flexGrow: 1, flexBasis: 150, maxWidth: 260, borderRadius: SIZES.radiusMd, padding: SIZES.md, backgroundColor: COLORS.cardSolid, borderTopWidth: 3, gap: 4 },
    tileLabel: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
  });
