// ===================================
// The Master's page (Settings → Master's page, 15 Oct 2026: "everything that can
// be allowed or delegated in one place, as a table — the menu and its sub-menus,
// pages and buttons — so nobody has to dig for where the permissions are; on
// glows, off is dim; the Master only").
//
// Rows follow the menu: each group, each entry (a tab), the pages under it, and
// the buttons on it that are given person by person (the gear). Columns are the
// devices aboard, each with its rank on top. A dot glows when that device has it.
//
//   Rank          Crew ↔ Officer, tapped (the Master is the Master — Accounts).
//   Entry         the tab on that device's menu (EnrolledDevice.tabs).
//   Page          a page under the entry (EnrolledDevice.hidePages).
//   ⚙ Gear        managing the places (EnrolledDevice.manage) — off by default.
//   By rank       what the rank decides and the server holds to (planning
//                 drills, the officers' documents): shown, not switched here —
//                 change the rank instead.
//
// Under the table, the rules for the whole vessel (signing).
//
// Like the tabs, entries and pages are tidiness, not a lock; the gear and the
// rank are enforced by firestore.rules.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { EnrolledDevice, ROLE_LABEL, Role, olderConnections, personName } from '../types/role';
import { ManageKey, TabKey, toggleManage, togglePage, toggleTab } from '../constants/access';
import { Row, masterCell, masterRows } from '../services/masterPage';
import { moduleOn } from '../constants/modules';
import { writeSigningPolicy } from '../services/policy';
import * as accounts from '../services/accounts';

const NAME_W = 230;
/** Widest a column gets; narrower to fit the window (15 Oct 2026: the right-hand columns were cut off). */
const COL_MAX = 84;
const COL_MIN = 44;
const ROW_H = 40;

export default function MasterSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const { vessel, storeRoomList, signingPolicy, setSigningPolicy } = useData();
  const sync = useSync();
  const imo = (vessel?.imo ?? '').replace(/\D/g, '');
  const isMaster = sync.role === 'superadmin';

  const [devices, setDevices] = useState<EnrolledDevice[]>([]);
  const [pending, setPending] = useState<Record<string, Partial<EnrolledDevice>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imo || !isMaster) return;
    let stop = () => {};
    try {
      stop = accounts.watchDevices(imo, (rows) => {
        setDevices(rows);
        setPending({});
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
    return () => stop();
  }, [imo, isMaster]);

  const older = useMemo(() => olderConnections(devices, sync.me?.id), [devices, sync.me?.id]);
  const cols = useMemo(
    () =>
      devices
        .filter((d) => d.approved && !d.disabled && d.role !== 'shore' && !older.has(d.id))
        .map((d) => ({ ...d, ...(pending[d.id] ?? {}) }))
        .sort((a, b) => rankOrder(a.role) - rankOrder(b.role) || label(a).localeCompare(label(b))),
    [devices, pending, older]
  );

  const rows: Row[] = useMemo(() => masterRows(storeRoomList), [storeRoomList]);
  // The table's own width, measured: the columns share what is left after the names, so every one shows.
  const [tableW, setTableW] = useState(0);
  const colW = tableW ? Math.max(COL_MIN, Math.min(COL_MAX, Math.floor((tableW - NAME_W - 2) / Math.max(1, cols.length)))) : COL_MAX;
  const styles = useMemo(() => makeStyles(COLORS, colW), [COLORS, colW]);

  // ---- writes ----
  const write = async (d: EnrolledDevice, patch: Partial<EnrolledDevice>, send: () => Promise<void>) => {
    setPending((p) => ({ ...p, [d.id]: { ...(p[d.id] ?? {}), ...patch } }));
    setError(null);
    try {
      await send();
    } catch (e: any) {
      setPending((p) => {
        const { [d.id]: _, ...rest } = p;
        return rest;
      });
      setError(e?.message ?? String(e));
    }
  };
  const flipTab = (d: EnrolledDevice, k: TabKey) => { const tabs = toggleTab(d.tabs, k); void write(d, { tabs }, () => accounts.setDeviceTabs(imo, d.id, tabs)); };
  const flipPage = (d: EnrolledDevice, k: string) => { const hidePages = togglePage(d.hidePages, k); void write(d, { hidePages }, () => accounts.setDeviceHidePages(imo, d.id, hidePages)); };
  const flipManage = (d: EnrolledDevice, k: ManageKey) => { const manage = toggleManage(d.manage, k); void write(d, { manage }, () => accounts.setDeviceManage(imo, d.id, manage)); };
  const flipRank = (d: EnrolledDevice) => {
    const to: Role = d.role === 'admin' ? 'user' : 'admin';
    Alert.alert(`${label(d)} — ${ROLE_LABEL[to]}?`, to === 'admin' ? 'An Officer plans drills, signs searches, rectifies defects and sees the officers’ documents.' : 'Back to Crew: no officers’ documents, no planning.', [
      { text: 'Cancel', style: 'cancel' },
      { text: `Make ${ROLE_LABEL[to]}`, onPress: () => void write(d, { role: to }, () => accounts.setDeviceRole(imo, d.id, to)) },
    ]);
  };

  const policy = async (patch: Partial<typeof signingPolicy>) => {
    const { error: e } = await writeSigningPolicy(signingPolicy, patch as any, setSigningPolicy, { synced: sync.status === 'synced', isMaster: true });
    if (e) Alert.alert('Saved on this device only', `The vessel did not accept the change: ${e}. It will be sent again when this device reconnects.`);
  };

  if (!moduleOn('access') || !isMaster) {
    return (
      <Screen scroll>
        <ScreenTitle title="Master's page" subtitle="Who may see and do what" />
        <Empty text={!sync.enrolled ? 'Join this device to the vessel as the Master first (Settings → Vessel) — the page sets what each device aboard may see and do.' : 'For the Master only.'} />
      </Screen>
    );
  }

  // ---- a cell ----
  const Dot = ({ on, locked, onPress, a11y, icon }: { on: boolean; locked?: boolean; onPress?: () => void; a11y: string; icon?: string }) => (
    <TouchableOpacity style={styles.cellBox} disabled={locked || !onPress} onPress={onPress} hitSlop={4} accessibilityRole="switch" accessibilityState={{ checked: on, disabled: locked }} accessibilityLabel={a11y}>
      <View style={[styles.dot, on ? styles.dotOn : styles.dotOff, locked && { opacity: on ? 0.75 : 0.25 }]}>
        {locked ? <MciIcon name="lock" size={11} color={on ? COLORS.textWhite : COLORS.textLight} /> : icon ? <MciIcon name={icon} size={12} color={on ? COLORS.textWhite : COLORS.textLight} /> : null}
      </View>
    </TouchableOpacity>
  );

  const cell = (r: Row, d: EnrolledDevice) => {
    if (r.kind === 'group') return <View style={styles.cellBox} />;
    const c = masterCell(r, d);
    const who = `${r.label} — ${label(d)}${c.why ? `: ${c.why}` : ''}`;
    const tap = c.locked ? undefined : r.kind === 'tab' ? () => flipTab(d, r.tab) : r.kind === 'page' ? () => flipPage(d, r.page) : r.kind === 'manage' ? () => flipManage(d, r.manage) : undefined;
    return <Dot on={c.on} locked={c.locked} onPress={tap} a11y={who} icon={r.kind === 'manage' ? 'cog' : undefined} />;
  };

  return (
    <Screen scroll>
      <ScreenTitle title="Master's page" subtitle="Who may see and do what — every device, every menu, page and button" help="Access — which tabs each device shows" />
      <Text style={styles.lead}>
        Tap a dot: it glows when that device has it, dim when not. Pages and the ⚙ gear follow their menu entry. Rows marked by rank follow the rank — tap the rank on top to change it. The phone follows on its next sync.
      </Text>
      {error ? <Card><Text style={{ color: COLORS.danger }}>{error}</Text></Card> : null}
      {older.size ? (
        <TouchableOpacity onPress={() => nav.navigate('Accounts')}>
          <Text style={[styles.lead, { color: COLORS.warning }]}>{`${older.size} older connection${older.size === 1 ? '' : 's'} of the same people not shown — switch them off in Accounts → Devices ›`}</Text>
        </TouchableOpacity>
      ) : null}

      {!imo ? (
        <Empty text="Set the vessel's IMO number in Settings and connect it first." />
      ) : !cols.length ? (
        <Empty text="No approved devices yet. Issue accounts in Settings → Accounts; each device that joins appears here." />
      ) : (
        <View style={styles.table} onLayout={(e) => setTableW(e.nativeEvent.layout.width)}>
          <View style={{ width: NAME_W }}>
            <View style={[styles.head, { alignItems: 'flex-start' }]}><Text style={styles.headText}>Menu · page · button</Text></View>
            <View style={[styles.row, styles.rankRow]}><Text style={styles.rowStrong}>Rank</Text></View>
            {rows.map((r) => (
              <View key={r.id} style={[styles.row, r.kind === 'group' && styles.groupRow, (r.kind === 'page' || r.kind === 'manage' || r.kind === 'rank') && { paddingLeft: SIZES.lg }]}>
                {r.kind === 'group' ? (
                  <Text style={styles.groupText}>{r.label}</Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {'icon' in r ? <MciIcon name={r.icon} size={r.kind === 'page' ? 14 : 18} color={r.kind === 'page' ? COLORS.textLight : COLORS.textDark} /> : null}
                    <Text style={[r.kind === 'tab' || r.kind === 'fixed' ? styles.rowStrong : styles.rowText, r.kind === 'manage' && { color: COLORS.primary }, r.kind === 'rank' && { fontStyle: 'italic' }]} numberOfLines={1}>
                      {r.kind === 'rank' ? `${r.label} · by rank` : r.kind === 'page' && r.officers ? `${r.label}` : r.label}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View>
              <View style={[styles.head, { flexDirection: 'row' }]}>
                {cols.map((d) => (
                  <View key={d.id} style={styles.colHead}>
                    <Text style={styles.colName} numberOfLines={2}>{label(d)}{d.id === sync.me?.id ? ' (you)' : ''}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.row, styles.rankRow, { flexDirection: 'row', paddingHorizontal: 0 }]}>
                {cols.map((d) => (
                  <TouchableOpacity key={d.id} style={styles.cellBox} disabled={d.role === 'superadmin'} onPress={() => flipRank(d)} accessibilityLabel={`Rank — ${label(d)}: ${ROLE_LABEL[d.role]}`}>
                    <View style={[styles.rankChip, d.role !== 'user' ? styles.rankOn : styles.rankOff]}>
                      <Text style={[styles.rankText, { color: d.role !== 'user' ? COLORS.textWhite : COLORS.textDark }]}>{ROLE_LABEL[d.role]}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {rows.map((r) => (
                <View key={r.id} style={[styles.row, { flexDirection: 'row', paddingHorizontal: 0 }, r.kind === 'group' && styles.groupRow]}>
                  {cols.map((d) => <React.Fragment key={d.id}>{cell(r, d)}</React.Fragment>)}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <Card>
        <Label>The whole vessel</Label>
        {([
          ['requireScan', 'Scan the QR label before signing', 'Crew and Officers scan the item before they sign its inspection'],
          ['signAsDevice', 'Each device signs as its own account', 'No picking a colleague’s name — the account is the signature'],
          ...(moduleOn('signConfirm') ? [['confirmSignature', 'Confirm every signature', 'PIN, fingerprint or face — the signer’s own'] as const] : []),
        ] as const).map(([k, t, sub]) => {
          const on = !!(signingPolicy as any)[k];
          return (
            <View key={k} style={styles.ruleRow}>
              <View style={[styles.dot, on ? styles.dotOn : styles.dotOff]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowStrong, !on && { color: COLORS.textLight }]}>{t}</Text>
                <Text style={styles.rowText}>{sub}</Text>
              </View>
              <Switch value={on} onValueChange={(v) => void policy({ [k]: v } as any)} accessibilityLabel={t} />
            </View>
          );
        })}
      </Card>

      <Card>
        <TouchableOpacity style={styles.ruleRow} onPress={() => nav.navigate('Accounts')}>
          <MciIcon name="key" size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowStrong}>Accounts</Text>
            <Text style={styles.rowText}>Issue a name + PIN, approve a device, make a Master, switch a device off</Text>
          </View>
          <Text style={styles.rowText}>›</Text>
        </TouchableOpacity>
      </Card>
    </Screen>
  );
}

const label = (d: EnrolledDevice) => personName(d) || 'Unnamed device';
const rankOrder = (r: Role) => (r === 'superadmin' ? 0 : r === 'admin' ? 1 : 2);

const makeStyles = (COLORS: Palette, COL_W: number = COL_MAX) =>
  StyleSheet.create({
    lead: { fontSize: SIZES.small, color: COLORS.textLight, marginBottom: SIZES.md },
    table: { flexDirection: 'row', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, overflow: 'hidden', marginBottom: SIZES.md },
    head: { height: 56, justifyContent: 'flex-end', paddingHorizontal: SIZES.sm, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    headText: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.textLight },
    colHead: { width: COL_W, alignItems: 'center', justifyContent: 'flex-end' },
    colName: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' },
    row: { height: ROW_H, justifyContent: 'center', paddingHorizontal: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    groupRow: { backgroundColor: COLORS.primary + '0F', height: 30 },
    groupText: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6 },
    rankRow: { height: 46, backgroundColor: COLORS.primary + '08' },
    rowStrong: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark },
    rowText: { fontSize: SIZES.small, color: COLORS.textLight },
    cellBox: { width: COL_W, height: '100%', alignItems: 'center', justifyContent: 'center' },
    dot: { width: COL_W < 56 ? 20 : 24, height: COL_W < 56 ? 20 : 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    // On glows; off is dim.
    dotOn: { backgroundColor: COLORS.success, shadowColor: COLORS.success, shadowOpacity: 0.9, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
    dotOff: { backgroundColor: COLORS.border, opacity: 0.45 },
    rankChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    rankOn: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.6, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
    rankOff: { backgroundColor: 'transparent' },
    rankText: { fontSize: SIZES.tiny, fontWeight: '800' },
    ruleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm },
  });
