// ===================================
// Signer picker — "who is doing this?", as a bottom sheet.
//
// Shared by the inspection round and by closing a defect, because both are
// signed acts and both must draw from the same crew list: a rectification
// attributed to a name nobody recognises is no better than an anonymous one.
// ===================================

import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { CrewMember, crewLabel } from '../types/crew';

export function SignerPicker({
  visible,
  crew,
  selectedId,
  title = 'Who is carrying out this inspection?',
  onSelect,
  onClose,
  onManage,
}: {
  visible: boolean;
  crew: CrewMember[];
  selectedId?: string;
  title?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onManage?: () => void;
}) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {crew.length === 0 ? (
            <Text style={styles.note}>
              Nobody is on the crew list yet. Inspections are signed by name, so add the crew before
              the first round.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {crew.map((c) => (
                <TouchableOpacity key={c.id} style={styles.row} onPress={() => onSelect(c.id)}>
                  <MciIcon
                    name={c.id === selectedId ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={c.id === selectedId ? COLORS.primary : COLORS.textLight}
                  />
                  <Text style={styles.rowText}>{crewLabel(c)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {onManage ? (
            <TouchableOpacity style={styles.manage} onPress={onManage}>
              <MciIcon name="account-multiple-plus" size={18} color={COLORS.primary} />
              <Text style={styles.manageText}>Manage crew list</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: COLORS.cardSolid,
      borderTopLeftRadius: SIZES.radiusLg,
      borderTopRightRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      paddingBottom: SIZES.xxxl,
    },
    title: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark, marginBottom: SIZES.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, paddingVertical: SIZES.md },
    rowText: { fontSize: SIZES.body, color: COLORS.text },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    manage: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.sm,
      paddingTop: SIZES.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      marginTop: SIZES.sm,
    },
    manageText: { color: COLORS.primary, fontWeight: '700' },
  });
