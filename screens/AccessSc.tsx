// ===================================
// Access — which tabs each device shows. The Master's matrix.
//
// One row per device on the vessel, one column per optional tab, and a dot in
// every cell: green, the tab is on that phone; red, it is not. A tap flips it and
// the phone follows on its next sync. Asked for in exactly that shape (9 Oct
// 2026): "he taps, it was red, it turns green, and the deckhand has a new tab".
//
// Rows are DEVICES, not people, because a device is what shows tabs — the bridge
// tablet two officers share is one row. Each is labelled with who it belongs to,
// which the Master sets in Accounts → Rename.
//
// A Master's device is always all-green and locked: see constants/access.ts.
// Pending and switched-off devices are left out; they show nothing at all.
//
// The name column stays put and the dots scroll sideways, so the matrix still
// reads on a phone once more modules add columns.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { EnrolledDevice, ROLE_LABEL, personName } from '../types/role';
import { TabKey, releasedTabs, toggleTab, visibleTabs } from '../constants/access';
import { moduleOn } from '../constants/modules';
import * as accounts from '../services/accounts';

const ROW_H = 58;
const COLUMNS = releasedTabs();
const COL_W = 64;
const NAME_W = 170;

const PLATFORM: Record<string, string> = { ios: 'iPhone / iPad', android: 'Android', web: 'Web', windows: 'Windows', macos: 'Mac' };

export default function AccessSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { vessel } = useData();
  const { role, me } = useSync();
  const imo = (vessel?.imo ?? '').replace(/\D/g, '');
  const isMaster = role === 'superadmin';

  const [devices, setDevices] = useState<EnrolledDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Taps not yet confirmed by the listener: device id → tabs as tapped. */
  const [pending, setPending] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!imo) return;
    let stop = () => {};
    try {
      stop = accounts.watchDevices(imo, (rows) => {
        setDevices(rows);
        // The listener now carries what was written; drop the optimistic copy.
        setPending((p) => {
          const next = { ...p };
          for (const d of rows) if (next[d.id] && same(next[d.id], d.tabs)) delete next[d.id];
          return next;
        });
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
    return () => stop();
  }, [imo]);

  const rows = useMemo(
    () =>
      devices
        .filter((d) => d.approved && !d.disabled)
        .sort((a, b) => rank(a) - rank(b) || label(a).localeCompare(label(b))),
    [devices]
  );

  const flip = async (d: EnrolledDevice, key: TabKey) => {
    const current = pending[d.id] ?? d.tabs;
    const next = toggleTab(current, key);
    setPending((p) => ({ ...p, [d.id]: next }));
    setError(null);
    try {
      await accounts.setDeviceTabs(imo, d.id, next);
    } catch (e: any) {
      setPending((p) => {
        const { [d.id]: _, ...rest } = p;
        return rest;
      });
      setError(e?.message ?? String(e));
    }
  };

  if (!isMaster || !moduleOn('access')) {
    return (
      <Screen scroll>
        <ScreenTitle title="Access" subtitle="Which tabs each device shows" />
        <Empty text="Only the Master sets which tabs each device shows." />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title="Access" subtitle="Which tabs each device shows" help="Access — which tabs each device shows" />

      <Text style={styles.lead}>
        Tap a dot to switch a tab on (green) or off (red) for that device. The phone follows on its next sync.
        Dashboard, Equipment and Settings are always on.
      </Text>

      {error ? (
        <Card>
          <Text style={{ color: COLORS.danger }}>{error}</Text>
        </Card>
      ) : null}

      {!imo ? (
        <Empty text="Set the vessel's IMO number in Settings and connect it first — access is kept with the vessel." />
      ) : rows.length === 0 ? (
        <Empty text="No approved devices yet. Issue accounts in Settings → Accounts; each device that joins appears here." />
      ) : (
        <View style={styles.table}>
          {/* Fixed name column */}
          <View style={{ width: NAME_W }}>
            <View style={[styles.head, { alignItems: 'flex-start' }]}>
              <Text style={styles.headText}>Device</Text>
            </View>
            {rows.map((d) => (
              <View key={d.id} style={[styles.cell, styles.nameCell]}>
                <Text style={styles.name} numberOfLines={1}>
                  {label(d)}
                  {d.id === me?.id ? <Text style={styles.you}> (you)</Text> : null}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {[d.position || ROLE_LABEL[d.role], PLATFORM[d.platform ?? ''] ?? d.platform].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))}
          </View>

          {/* Dots, scrolling sideways */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View>
              <View style={[styles.head, { flexDirection: 'row' }]}>
                {COLUMNS.map((t) => (
                  <View key={t.key} style={styles.colHead}>
                    <MciIcon name={t.icon} size={18} color={COLORS.textLight} />
                    <Text style={styles.headText} numberOfLines={1}>{t.column}</Text>
                  </View>
                ))}
              </View>
              {rows.map((d) => {
                const locked = d.role === 'superadmin';
                const on = visibleTabs(pending[d.id] ?? d.tabs, locked);
                return (
                  <View key={d.id} style={[styles.cell, { flexDirection: 'row' }]}>
                    {COLUMNS.map((t) => {
                      const green = on.has(t.key);
                      return (
                        <TouchableOpacity
                          key={t.key}
                          style={styles.dotCell}
                          disabled={locked}
                          onPress={() => flip(d, t.key)}
                          hitSlop={4}
                          accessibilityRole="switch"
                          accessibilityState={{ checked: green, disabled: locked }}
                          accessibilityLabel={`${t.label} for ${label(d)}`}
                        >
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: green ? COLORS.success : COLORS.danger, opacity: locked ? 0.45 : 1 },
                            ]}
                          >
                            {locked ? <MciIcon name="lock" size={12} color="#fff" /> : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      <Text style={styles.foot}>
        A Master's device always shows every tab. This keeps each screen to what its holder needs; it is not a lock —
        what a device may change is still set by its rank in Accounts.
      </Text>
    </Screen>
  );
}

function label(d: EnrolledDevice): string {
  return personName(d) || 'Unnamed device';
}

function rank(d: EnrolledDevice): number {
  return d.role === 'superadmin' ? 0 : d.role === 'admin' ? 1 : 2;
}

function same(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((k) => b.includes(k));
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    lead: { fontSize: SIZES.small, color: COLORS.textLight, marginBottom: SIZES.md },
    table: { flexDirection: 'row', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, overflow: 'hidden' },
    head: { height: 52, justifyContent: 'flex-end', paddingHorizontal: SIZES.sm, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    headText: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.textLight },
    colHead: { width: COL_W, alignItems: 'center', gap: 2 },
    cell: { height: ROW_H, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight, alignItems: 'center' },
    nameCell: { alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: SIZES.sm },
    name: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark },
    you: { fontWeight: '400', color: COLORS.textLight },
    sub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
    dotCell: { width: COL_W, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    foot: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: SIZES.md },
  });
