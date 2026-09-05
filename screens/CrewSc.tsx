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

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { CrewMember } from '../types/crew';
import { uid } from '../utils/id';
import { useSync } from '../contexts/SyncContext';
import * as accounts from '../services/accounts';
import { EnrolledDevice, personName } from '../types/role';

export default function CrewSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { crew, vessel, inspections: trail, saveCrewMember, removeCrewMember } = useData();

  /**
   * Only a Master edits this list.
   *
   * Everyone else already IS on it: a device is bound to a named person when it
   * enrols, so asking an officer to type their own name again is asking the same
   * question twice and inviting two spellings of it. What the Master adds on top
   * is the RANK, and people who sign but carry no device — a bosun without a
   * phone still has to be a signer, which is why this list is not simply the
   * device list.
   */
  const { role: myRole } = useSync();
  const isMaster = myRole === 'superadmin';
  const rankKnown = myRole !== null;

  const imo = (vessel?.imo ?? '').replace(/\D/g, '');
  const [enrolled, setEnrolled] = useState<EnrolledDevice[]>([]);

  useEffect(() => {
    if (!imo || !isMaster) return;
    try {
      return accounts.watchDevices(imo, setEnrolled);
    } catch {
      return;
    }
  }, [imo, isMaster]);

  /** Enrolled people who are not on the signing list yet — one tap, no typing. */
  const missing = useMemo(() => {
    const have = new Set(crew.map((c) => c.name.trim().toLowerCase()));
    const seen = new Set<string>();
    return enrolled.filter((d) => {
      const n = personName(d).trim();
      if (!n || have.has(n.toLowerCase()) || seen.has(n.toLowerCase())) return false;
      seen.add(n.toLowerCase());
      return true;
    });
  }, [enrolled, crew]);

  const addEnrolled = async (d: EnrolledDevice) => {
    const now = Date.now();
    await saveCrewMember({
      id: uid('crew'),
      name: personName(d),
      // The rank came with the invitation, so the signature line is filled in
      // without anyone retyping it — and it reads the same on every device.
      ...(d.position ? { rank: d.position } : {}),
      active: true,
      addedAt: now,
      updatedAt: now,
    });
  };

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
          {isMaster ? (
            <>
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
            </>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenTitle
        title="Crew"
        subtitle={
          isMaster
            ? 'Who can sign an inspection. Names go on the record.'
            : 'Who can sign an inspection on this vessel.'
        }
      />

      {!rankKnown ? (
        <Card>
          <Label>Working out what this device may do</Label>
          <Text style={styles.meta}>
            The list opens once the vessel has confirmed this device's rank.
          </Text>
        </Card>
      ) : null}

      {/* Reachable by URL even though Settings no longer offers it to a member. */}
      {rankKnown && !isMaster ? (
        <Card>
          <Label>The Master keeps this list</Label>
          <Text style={styles.meta}>
            You are already on it — your name and rank came from the account you were issued, and
            you can sign an inspection without doing anything here. Additions and changes are the
            Master's.
          </Text>
        </Card>
      ) : null}

      {isMaster && missing.length ? (
        <Card>
          <Label>Already enrolled, not yet a signer</Label>
          <Text style={styles.meta}>
            These people have a device on this vessel. Adding them here takes the name from their
            account, so it cannot be spelled two ways.
          </Text>
          {missing.map((d) => (
            <TouchableOpacity key={d.id} style={styles.enrolRow} onPress={() => void addEnrolled(d)}>
              <MciIcon name="account-plus" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{personName(d)}</Text>
                {d.position ? <Text style={styles.meta}>{d.position}</Text> : null}
              </View>
              <Text style={styles.meta}>Add</Text>
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}

      {isMaster ? (
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
      ) : null}

      <FlatList
        data={sorted}
        keyExtractor={(c) => c.id}
        renderItem={renderRow}
        ListEmptyComponent={
          <Empty
            text={
              isMaster
                ? 'No crew yet.\nAdd the people who will be carrying out the rounds.'
                : 'The Master has not named any signers yet.'
            }
          />
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
    enrolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      paddingVertical: SIZES.sm,
    },
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
