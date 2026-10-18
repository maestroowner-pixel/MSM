// ===================================
// Internal audits — ISM / MLC / custom checklist audits; findings raise NCs.
// Officers and Masters only (canEdit). History visible to all crew.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { Dropdown } from '../components/Dropdown';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { AUDIT_TYPE_LABEL, AuditType, InternalAudit } from '../types/audit';
import { roleAtLeast } from '../types/role';
import { auditSummary, defaultItems, nextAuditNo } from '../services/audit';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';

const AUDIT_TYPES: { value: AuditType; label: string }[] = [
  { value: 'ism', label: 'ISM Internal Audit' },
  { value: 'mlc', label: 'MLC Compliance Audit' },
  { value: 'custom', label: 'Custom Audit' },
];

export default function AuditsSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { internalAudits, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const [newType, setNewType] = useState<AuditType>('ism');
  const [creating, setCreating] = useState(false);

  const sorted = useMemo(
    () => [...internalAudits].sort((a, b) => b.updatedAt - a.updatedAt),
    [internalAudits]
  );

  const openCount = sorted.filter((a) => !a.closeDate).length;

  const startAudit = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const audit: InternalAudit = {
        id: uid(),
        type: newType,
        no: nextAuditNo(internalAudits),
        title: AUDIT_TYPE_LABEL[newType],
        items: defaultItems(newType),
        startDate: todayIso(),
        updatedAt: Date.now(),
      };
      await saveRow(storage.INTERNAL_AUDITS_KEY, audit);
      nav.navigate('InternalAudit', { id: audit.id });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle title="Internal Audits" subtitle="ISM · MLC · custom checklist" help="Internal audits" />

      {canEdit ? (
        <View style={styles.newRow}>
          <View style={{ flex: 1 }}>
            <Dropdown
              caption="AUDIT TYPE"
              value={newType}
              onChange={(v: AuditType) => setNewType(v)}
              options={AUDIT_TYPES}
            />
          </View>
          <TouchableOpacity style={[styles.btn, creating && { opacity: 0.5 }]} onPress={startAudit} disabled={creating}>
            <MciIcon name="plus" size={16} color={COLORS.textWhite} />
            <Text style={styles.btnText}>Start audit</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {sorted.length === 0 ? (
        <Empty text="No internal audits yet. Start an ISM or MLC audit — findings are raised as NCs." />
      ) : (
        sorted.map((a) => <AuditRow key={a.id} audit={a} onPress={() => nav.navigate('InternalAudit', { id: a.id })} styles={styles} COLORS={COLORS} />)
      )}

      {openCount > 0 ? (
        <Label style={{ marginTop: SIZES.md }}>{`${openCount} audit${openCount === 1 ? '' : 's'} in progress`}</Label>
      ) : null}
    </Screen>
  );
}

function AuditRow({ audit, onPress, styles, COLORS }: { audit: InternalAudit; onPress: () => void; styles: ReturnType<typeof makeStyles>; COLORS: Palette }) {
  const { ncs, obs } = auditSummary(audit);
  const closed = !!audit.closeDate;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.dot, { backgroundColor: closed ? COLORS.success : COLORS.warning }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowNo}>{audit.no}</Text>
        <Text style={styles.rowTitle}>{audit.title}</Text>
        <Text style={styles.rowMeta}>
          {formatDate(audit.startDate)}
          {audit.by ? ` · ${audit.by}` : ''}
          {closed ? ' · Closed' : ' · Open'}
        </Text>
      </View>
      <View style={styles.badges}>
        {ncs > 0 ? <View style={[styles.badge, { backgroundColor: COLORS.danger }]}><Text style={styles.badgeText}>NC {ncs}</Text></View> : null}
        {obs > 0 ? <View style={[styles.badge, { backgroundColor: COLORS.warning }]}><Text style={styles.badgeText}>Obs {obs}</Text></View> : null}
      </View>
      <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    newRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: SIZES.sm,
      marginBottom: SIZES.md,
    },
    btn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md, paddingVertical: 10,
    },
    btnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.small },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      ...COLORS.glassCard, borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
      marginBottom: SIZES.xs,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    rowNo: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.primary },
    rowTitle: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
    rowMeta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    badges: { flexDirection: 'row', gap: 4 },
    badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: SIZES.tiny, fontWeight: '800', color: '#fff' },
  });
