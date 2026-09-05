// ===================================
// Crew — the list of people who can sign an inspection.
//
// Not accounts, and not a login: see types/crew.ts for why a shared bridge
// tablet at 0300 is the wrong place for per-person passwords. This screen is the
// vocabulary the signature picker draws on, and it travels with the vessel.
//
// Retiring vs deleting is the only decision on the screen, and it matters:
// somebody who has signed off two years of monthly rounds should be retired when
// they leave, so the history keeps a live link and the picker stays short.
// Deleting is offered because a typo shouldn't be permanent — and it is safe,
// because a signature stores the NAME, not a reference to this row.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { CrewMember } from '../types/crew';
import { uid } from '../utils/id';

export default function CrewSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { crew, inspections: trail, saveCrewMember, removeCrewMember } = useData();

  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [editing, setEditing] = useState<CrewMember | null>(null);

  const sorted = useMemo(
    () => [...crew].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [crew]
  );

  // How many signatures each person is carrying — shown so the master can see at
  // a glance that deleting somebody is throwing away a link to real history.
  const signedCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of trail) {
      if (i.byId) counts.set(i.byId, (counts.get(i.byId) ?? 0) + 1);
    }
    return counts;
  }, [trail]);

  const reset = () => {
    setName('');
    setRank('');
    setEditing(null);
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    const now = Date.now();
    if (editing) {
      await saveCrewMember({ ...editing, name: n, rank: rank.trim() || undefined });
    } else {
      await saveCrewMember({
        id: uid('crew'),
        name: n,
        rank: rank.trim() || undefined,
        active: true,
        addedAt: now,
        updatedAt: now,
      });
    }
    reset();
  };

  const startEdit = (c: CrewMember) => {
    setEditing(c);
    setName(c.name);
    setRank(c.rank ?? '');
  };

  const toggleActive = (c: CrewMember) => saveCrewMember({ ...c, active: !c.active });

  const confirmDelete = (c: CrewMember) => {
    const n = signedCount.get(c.id) ?? 0;
    Alert.alert(
      'Remove from crew list',
      n > 0
        ? `${c.name} has signed ${n} inspection${n === 1 ? '' : 's'}. Those records keep the name and stay exactly as they are — but the link back to this entry is lost. Retiring instead keeps everything joined up.`
        : `Remove ${c.name} from the crew list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(c.active ? [{ text: 'Retire instead', onPress: () => void toggleActive(c) }] : []),
        { text: 'Remove', style: 'destructive' as const, onPress: () => void removeCrewMember(c.id) },
      ]
    );
  };

  const renderRow = ({ item: c }: { item: CrewMember }) => {
    const n = signedCount.get(c.id) ?? 0;
    return (
      <Card>
        <View style={styles.row}>
          <MciIcon
            name={c.active ? 'account' : 'account-off'}
            size={24}
            color={c.active ? COLORS.primary : COLORS.textLight}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, !c.active && { color: COLORS.textLight }]}>{c.name}</Text>
            <Text style={styles.meta}>
              {[c.rank, c.active ? null : 'Retired', n ? `${n} signed` : null].filter(Boolean).join(' · ') ||
                'No rank set'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => startEdit(c)} hitSlop={10} style={styles.rowBtn}>
            <MciIcon name="pencil" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleActive(c)} hitSlop={10} style={styles.rowBtn}>
            <MciIcon
              name={c.active ? 'account-arrow-right' : 'account-arrow-left'}
              size={20}
              color={COLORS.textLight}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(c)} hitSlop={10} style={styles.rowBtn}>
            <MciIcon name="delete" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenTitle
        title="Crew"
        subtitle="Who can sign an inspection. Names go on the record."
      />

      <Card>
        <Label>{editing ? 'Edit crew member' : 'Add crew member'}</Label>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          value={rank}
          onChangeText={setRank}
          placeholder="Rank / role (Third Officer, Bosun…)"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
          onSubmitEditing={submit}
        />
        <View style={styles.formBtns}>
          {editing ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, !name.trim() && { opacity: 0.4 }]}
            onPress={submit}
            disabled={!name.trim()}
          >
            <Text style={styles.primaryBtnText}>{editing ? 'Save' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <FlatList
        data={sorted}
        keyExtractor={(c) => c.id}
        renderItem={renderRow}
        ListEmptyComponent={
          <Empty text={'No crew yet.\nAdd the people who will be carrying out the rounds.'} />
        }
        contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    rowBtn: { padding: SIZES.xs },
    name: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    meta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      color: COLORS.text,
      backgroundColor: COLORS.card,
      marginTop: SIZES.sm,
    },
    formBtns: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
    primaryBtn: {
      flex: 1,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700' },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: '700' },
  });
