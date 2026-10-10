// ===================================
// Crew matrix — every person against every certificate, on one screen.
//
// Filled ONCE, at a crew change, and kept (9 Oct 2026): the person who signs
// off on leave keeps their row, their certificates and their next of kin in the
// vessel's records. When they come back, the Master or Chief Officer taps
// "Sign on" on that row — nothing is typed again. Rows: people aboard first,
// then (when shown) those signed off. Columns: the certificates the crew hold,
// most common first. A cell is the expiry date, red / amber / green; an empty
// cell is a certificate that person does not have — tap it to add one.
//
// Everything here is the crew list (`crew`) and the crew certificates (in the
// register), both stored on the vessel and synced to every device.
// ===================================

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MciIcon } from '../components/MciIcon';
import { usePinChange } from '../components/PinChange';
import { ADMIN_KEY, pinHolders } from '../services/signature';

import { Empty, Screen, ScreenTitle, statusColor } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { Certificate } from '../types/certificate';
import { CrewMember, isAboard } from '../types/crew';
import { roleAtLeast } from '../types/role';
import { statusFromDate } from '../utils/dates';
import { todayIso } from '../services/pms';
import { uid } from '../utils/id';
import { crewIssues, worstIssue } from '../services/crewIssues';

const NAME_W = 180;
const COL_W = 104;
const ROW_H = 54;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export default function CrewMatrixSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { crew, certificates, crewPrivate, saveCrewMember } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const [showOff, setShowOff] = useState(false);
  // Signing PINs on this device — the 🔒 by each name (components/PinChange).
  const changePin = usePinChange();
  const [pins, setPins] = useState<Set<string>>(new Set());
  const loadPins = useCallback(() => {
    void pinHolders().then((h) => setPins(new Set(h.map((x) => x.key))));
  }, []);
  useFocusEffect(loadPins);
  const isMaster = !sync.enrolled || sync.role === 'superadmin';

  const people = useMemo(() => {
    const live = crew.filter((c) => c.active && !c.deleted);
    const on = live.filter(isAboard).sort((a, b) => a.name.localeCompare(b.name));
    const off = live.filter((c) => !isAboard(c)).sort((a, b) => a.name.localeCompare(b.name));
    return { on, off };
  }, [crew]);
  const rows = showOff ? [...people.on, ...people.off] : people.on;
  // Who needs attention — expired, due, or details missing (services/crewIssues).
  const issues = useMemo(
    () => new Map(people.on.map((p) => [p.id, crewIssues(p, crewPrivate.find((x) => x.id === p.id), certificates, canEdit)])),
    [people.on, crewPrivate, certificates, canEdit]
  );
  const attention = [...issues.values()].filter((l) => l.length).length;

  // Each person's certificates by normalised name, and the columns: every name
  // held by anyone shown, most common first.
  const { cols, byPerson } = useMemo(() => {
    const byPerson = new Map<string, Map<string, Certificate>>();
    const count = new Map<string, { label: string; n: number }>();
    const ids = new Set(rows.map((r) => r.id));
    for (const c of certificates) {
      if (c.scope !== 'crew' || !c.crewId || !ids.has(c.crewId) || !c.name.trim()) continue;
      const k = norm(c.name);
      const m = byPerson.get(c.crewId) ?? new Map();
      const had = m.get(k);
      // Two of the same name: the one that lasts longest is the one in force.
      if (!had || (c.expiryDate ?? '') > (had.expiryDate ?? '')) m.set(k, c);
      byPerson.set(c.crewId, m);
      const e = count.get(k) ?? { label: c.name.trim(), n: 0 };
      e.n += 1;
      count.set(k, e);
    }
    const cols = [...count.entries()].sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label)).map(([k, v]) => ({ key: k, label: v.label }));
    return { cols, byPerson };
  }, [certificates, rows]);

  const openCell = (p: CrewMember, colKey: string, label: string) => {
    const have = byPerson.get(p.id)?.get(colKey);
    if (have) return nav.navigate('CertificateDetail', { id: have.id });
    if (!canEdit) return;
    const c: Certificate = { id: uid('cert'), scope: 'crew', crewId: p.id, holderName: p.name, name: label, itemIds: [], createdAt: Date.now(), updatedAt: Date.now() };
    nav.navigate('CertificateDetail', { id: null, draft: c });
  };

  const signOn = (p: CrewMember) => saveCrewMember({ ...p, onBoard: true, signOn: todayIso(), signOff: undefined });

  const short = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : 'no expiry');

  return (
    <Screen scroll>
      <ScreenTitle title="Crew matrix" subtitle={`${people.on.length} on board${people.off.length ? ` · ${people.off.length} signed off` : ''} · certificates by person`} help="Crew list and certificate matrix" />

      {attention ? (
        <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700', fontSize: SIZES.small, marginBottom: SIZES.sm }]}>
          {`⚠ ${attention} of ${people.on.length} on board need attention — documents expired or due, or details missing. Open a name to see what.`}
        </Text>
      ) : null}
      <View style={styles.tools}>
        {people.off.length ? (
          <TouchableOpacity onPress={() => setShowOff((v) => !v)} hitSlop={8}>
            <Text style={styles.link}>{showOff ? 'Hide signed off' : `Show signed off (${people.off.length})`}</Text>
          </TouchableOpacity>
        ) : <View />}
        {isMaster || pins.has(ADMIN_KEY) ? (
          <TouchableOpacity onPress={() => (isMaster || pins.has(ADMIN_KEY)) && changePin({ key: ADMIN_KEY, name: 'Master' }, { onDone: loadPins })} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MciIcon name={pins.has(ADMIN_KEY) ? 'lock' : 'lock-plus-outline'} size={16} color={pins.has(ADMIN_KEY) ? COLORS.success : COLORS.warning} />
            <Text style={styles.link}>{pins.has(ADMIN_KEY) ? 'Master PIN' : 'Set the Master PIN'}</Text>
          </TouchableOpacity>
        ) : null}
        {canEdit ? (
          <TouchableOpacity onPress={() => nav.navigate('CrewMember', { id: uid('crew'), isNew: true })} hitSlop={8}>
            <Text style={styles.link}>+ Add crew member</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <Empty text={canEdit ? 'Nobody on board yet. Add the crew — once. At the next crew change people are signed off and on, not typed again.' : 'The crew list is empty.'} />
      ) : (
        <View style={styles.table}>
          <View style={{ width: NAME_W }}>
            <View style={styles.head}><Text style={styles.headText}>Crew</Text></View>
            {rows.map((p) => {
              const off = !isAboard(p);
              return (
                <TouchableOpacity key={p.id} style={[styles.cell, styles.nameCell]} onPress={() => nav.navigate('CrewMember', { id: p.id })}>
                  <Text style={[styles.name, off && { color: COLORS.textLight }]} numberOfLines={1}>
                    {(() => {
                      const w = worstIssue(issues.get(p.id) ?? []);
                      return w ? <Text style={{ color: w === 'expired' ? COLORS.danger : COLORS.warning }}>⚠ </Text> : null;
                    })()}
                    {p.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.xs }}>
                    <Text style={styles.sub} numberOfLines={1}>{off ? 'Signed off' : p.rank || '—'}</Text>
                    {!off ? (
                      <TouchableOpacity onPress={() => changePin({ key: p.id, name: p.name }, { onDone: loadPins })} hitSlop={6} accessibilityLabel={`Signing PIN of ${p.name}`}>
                        <MciIcon name={pins.has(p.id) ? 'lock' : 'lock-open-outline'} size={14} color={pins.has(p.id) ? COLORS.success : COLORS.textLight} />
                      </TouchableOpacity>
                    ) : null}
                    {off && canEdit ? (
                      <TouchableOpacity onPress={() => void signOn(p)} hitSlop={6}>
                        <Text style={[styles.link, { fontSize: SIZES.tiny }]}>Sign on</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View>
              <View style={[styles.head, { flexDirection: 'row' }]}>
                {cols.map((c) => (
                  <View key={c.key} style={styles.colHead}>
                    <Text style={styles.headText} numberOfLines={3}>{c.label}</Text>
                  </View>
                ))}
                {cols.length === 0 ? <View style={[styles.colHead, { width: 220 }]}><Text style={styles.headText}>No crew certificates yet — open a person to add them.</Text></View> : null}
              </View>
              {rows.map((p) => (
                <View key={p.id} style={[styles.cell, { flexDirection: 'row' }]}>
                  {cols.map((c) => {
                    const cert = byPerson.get(p.id)?.get(c.key);
                    const st = cert ? statusFromDate(cert.expiryDate) : null;
                    return (
                      <TouchableOpacity key={c.key} style={styles.dateCell} onPress={() => openCell(p, c.key, c.label)}>
                        {cert ? (
                          <Text style={[styles.date, { color: st === 'none' ? COLORS.textLight : statusColor(st!) }]}>{short(cert.expiryDate)}</Text>
                        ) : (
                          <Text style={styles.missing}>{canEdit ? '+' : '—'}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      <Text style={styles.foot}>
        Dates are expiries — red expired, amber within 60 days. Tap a date to open the certificate, a “+” to add one. People who sign off keep their row and their papers; “Sign on” brings them back.
      </Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    tools: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.md, justifyContent: 'space-between', marginBottom: SIZES.md },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    table: { flexDirection: 'row', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, overflow: 'hidden' },
    head: { height: 64, justifyContent: 'flex-end', paddingHorizontal: SIZES.sm, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    headText: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.textLight },
    colHead: { width: COL_W, paddingHorizontal: 4, justifyContent: 'flex-end' },
    cell: { height: ROW_H, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight, alignItems: 'center' },
    nameCell: { alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: SIZES.sm },
    name: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.tiny, color: COLORS.textLight },
    dateCell: { width: COL_W, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
    date: { fontSize: SIZES.small, fontWeight: '800' },
    missing: { fontSize: SIZES.body, color: COLORS.border, fontWeight: '700' },
    foot: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: SIZES.md },
  });
