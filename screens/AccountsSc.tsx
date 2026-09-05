// ===================================
// Accounts — the Master issues them here.
//
// Two lists, and they answer different questions. INVITATIONS is "who may join",
// and is the thing a Master hands out: a name and an eight-digit PIN. DEVICES is
// "who actually did", and is where a phone is approved, promoted or switched off.
//
// The PIN is shown in full. There is no point hiding a credential from the only
// person allowed to read it — the Master is the one who has to read it out — and
// pretending otherwise would only mean re-issuing it every time somebody forgets.
// What protects it is firestore.rules, where nobody below Master can read this
// collection at all.
// ===================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import {
  EnrolledDevice,
  Invite,
  ROLE_LABEL,
  ROLE_ORDER,
  Role,
  personName,
} from '../types/role';
import * as accounts from '../services/accounts';
import * as fb from '../services/firebaseService';
import { formatDateTime } from '../utils/dates';

type Tab = 'invites' | 'devices';

export default function AccountsSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { vessel } = useData();
  const imo = (vessel?.imo ?? '').replace(/\D/g, '');

  /**
   * What THIS device may do here — not what it is looking at.
   *
   * `role` is null until the token comes back from `refresh`, and that gap is the
   * reason this is a state and not a boolean: showing the Master's controls while
   * we do not yet know beats showing them to a deck hand, but only just. Until the
   * rank is known the screen offers nothing, then opens to what the rank allows.
   * The server refuses the writes either way — firestore.rules gates invites and
   * device records on the `superadmin` claim — but an interface that offers a
   * button which always fails is telling the user something untrue about their
   * own authority.
   */
  const { role: myRole } = useSync();
  const isMaster = myRole === 'superadmin';
  const rankKnown = myRole !== null;

  const [tab, setTab] = useState<Tab>('invites');
  const shownTab: Tab = isMaster ? tab : 'devices';
  const [invites, setInvites] = useState<Invite[]>([]);
  const [devices, setDevices] = useState<EnrolledDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** This device's own id — it must not be able to remove itself (see below). */
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>('user');
  /** Rank aboard — free text, separate from the app role. See types/role.ts. */
  const [position, setPosition] = useState('');

  useEffect(() => {
    void fb.getLocalDeviceId().then(setMyDeviceId).catch(() => {});
  }, []);

  useEffect(() => {
    if (!imo) return;
    let un1 = () => {};
    let un2 = () => {};
    try {
      // Invitations carry PINs and are Master-only in firestore.rules. Subscribing
      // as anyone else is a guaranteed permission error, which would land on the
      // screen as a red card for doing nothing wrong.
      if (isMaster) un1 = accounts.watchInvites(imo, setInvites);
      un2 = accounts.watchDevices(imo, setDevices);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
    return () => {
      un1();
      un2();
    };
  }, [imo, isMaster]);

  const issue = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    try {
      const inv = await accounts.issueInvite(imo, firstName, lastName, role, position);
      setFirstName('');
      setLastName('');
      setPosition('');
      setRole('user');
      // Shown rather than merely written, because the next thing that happens is
      // the Master reading it out to somebody standing in front of them.
      Alert.alert(
        `Account issued — ${personName(inv)}`,
        `PIN: ${inv.pin}\n\nThey enter their name and this PIN on their own device. ` +
          `You can read it back from this list at any time.`
      );
    } catch (e: any) {
      Alert.alert('Could not issue', e?.message ?? String(e));
    }
  }, [firstName, lastName, role, position, imo]);

  const inviteActions = (inv: Invite) => {
    if (!isMaster) return; // unreachable — the tab is Master-only — but cheap insurance
    const used = inv.activations?.length ?? 0;
    Alert.alert(
      personName(inv),
      `PIN ${inv.pin} · ${ROLE_LABEL[inv.role]}\n` +
        (used ? `Used on ${used} device${used === 1 ? '' : 's'}.` : 'Not used yet.'),
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'New PIN',
          onPress: async () => {
            try {
              const pin = await accounts.reissuePin(imo, inv.id);
              Alert.alert('New PIN', `${personName(inv)}: ${pin}`);
            } catch (e: any) {
              Alert.alert('Failed', e?.message ?? String(e));
            }
          },
        },
        inv.revoked
          ? { text: 'Restore', onPress: () => void accounts.restoreInvite(imo, inv.id) }
          : {
              text: 'Revoke',
              style: 'destructive' as const,
              onPress: () => void accounts.revokeInvite(imo, inv.id),
            },
      ]
    );
  };

  /**
   * Delete a device record outright.
   *
   * "Switch off" remains the right answer for a handset that is lost or a person
   * who has left: the row stays, so it is still visible WHY that device can no
   * longer sign, and re-enrolling on the same install cannot quietly undo it.
   * Removing erases that trail, and the device may join again with a fresh
   * invitation — which is exactly what is wanted for a phone that was replaced,
   * a duplicate row, or someone enrolled by mistake. The difference is worth
   * spelling out, because from the list the two look like the same act.
   */
  const confirmRemove = (d: EnrolledDevice) => {
    const who = personName(d) || d.id;
    Alert.alert(
      'Remove this device?',
      `${who} will be taken off the list and will lose access at once.\n\n` +
        'This erases the record of the device rather than switching it off, and it can enrol ' +
        'again with a new invitation. Signed inspections it has already made are untouched — ' +
        'they carry the signature, not the device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await accounts.removeDevice(imo, d.id);
            } catch (e: any) {
              Alert.alert('Could not remove', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  const deviceActions = (d: EnrolledDevice) => {
    // A member may LOOK at the crew list — that is useful and the rules allow the
    // read. What it must not get is a menu of actions the server will refuse.
    if (!isMaster) {
      Alert.alert(
        personName(d) || d.id,
        `${ROLE_LABEL[d.role]} · ${d.approved ? 'approved' : 'waiting for approval'}` +
          (d.disabled ? ' · switched off' : '') +
          (d.id === myDeviceId ? '\n\nThis is the device you are using.' : '') +
          '\n\nOnly the Master can approve, re-rank or remove a device.',
        [{ text: 'Close', style: 'cancel' }]
      );
      return;
    }
    const buttons: any[] = [{ text: 'Close', style: 'cancel' }];
    if (!d.approved) buttons.push({ text: 'Approve', onPress: () => void accounts.approveDevice(imo, d.id) });
    for (const r of ROLE_ORDER) {
      if (r !== d.role) {
        buttons.push({ text: `Make ${ROLE_LABEL[r]}`, onPress: () => void accounts.setDeviceRole(imo, d.id, r) });
      }
    }
    buttons.push({
      text: d.disabled ? 'Switch on' : 'Switch off',
      style: d.disabled ? 'default' : ('destructive' as const),
      onPress: () => void accounts.disableDevice(imo, d.id, !d.disabled),
    });
    // Removing THIS device would revoke the session doing the removing — a Master
    // alone on board would lock the vessel out of its own accounts with one tap,
    // and no one left aboard could undo it.
    if (d.id !== myDeviceId) {
      buttons.push({ text: 'Remove from list', style: 'destructive' as const, onPress: () => confirmRemove(d) });
    }
    Alert.alert(
      personName(d) || d.id,
      `${ROLE_LABEL[d.role]} · ${d.approved ? 'approved' : 'waiting'}` +
        (d.id === myDeviceId ? ' · this device' : ''),
      buttons
    );
  };

  if (!imo) {
    return (
      <Screen scroll>
        <ScreenTitle title="Accounts" subtitle="Who may use this vessel's register" />
        <Card>
          <Label>Vessel IMO required</Label>
          <Text style={styles.note}>
            Accounts are issued per vessel, and the IMO number is what identifies it. Set it in
            Settings → Vessel first.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle
        title="Accounts"
        subtitle={isMaster ? 'Issue, revoke and approve' : 'Who is aboard this vessel'}
      />

      {error ? (
        <Card>
          <Label>Not available</Label>
          <Text style={styles.note}>{error}</Text>
        </Card>
      ) : null}

      {!rankKnown ? (
        <Card>
          <Label>Working out what this device may do</Label>
          <Text style={styles.note}>
            Accounts open once the vessel has confirmed this device's rank. If it stays like this,
            the device has not joined yet — Settings → Vessel → Join this vessel.
          </Text>
        </Card>
      ) : null}

      {rankKnown && !isMaster ? (
        <Card>
          <Label>{ROLE_LABEL[myRole]} — read only</Label>
          <Text style={styles.note}>
            Issuing accounts, approving devices and changing ranks belong to the Master. You can
            see who is aboard; ask the Master to make a change.
          </Text>
        </Card>
      ) : null}

      <View style={styles.tabs}>
        {(isMaster ? (['invites', 'devices'] as Tab[]) : (['devices'] as Tab[])).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, shownTab === t && styles.tabOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, shownTab === t && styles.tabTextOn]}>
              {t === 'invites' ? `Invitations (${invites.length})` : `Devices (${devices.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {shownTab === 'invites' ? (
        <>
          <Card>
            <Label>Issue an account</Label>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              value={position}
              onChangeText={setPosition}
              placeholder="Rank aboard (Third Officer, Bosun…) — optional"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
            />
            {/* The rank the person holds ON THE SHIP, which is not what the app
                lets them do. A Second Engineer may hold a Crew account and a
                cadet an Officer one; keeping them apart stops every promotion
                aboard from being a permissions change. This is what appears
                beside their signature. */}
            <View style={styles.roleRow}>
              {ROLE_ORDER.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnOn]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextOn]}>{ROLE_LABEL[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, (!firstName.trim() || !lastName.trim()) && { opacity: 0.4 }]}
              disabled={!firstName.trim() || !lastName.trim()}
              onPress={issue}
            >
              <MciIcon name="account-plus" size={18} color={COLORS.textWhite} />
              <Text style={styles.primaryBtnText}>Issue</Text>
            </TouchableOpacity>
          </Card>

          <FlatList
            data={invites}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
            ListEmptyComponent={<Empty text={'No accounts issued yet.'} />}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => inviteActions(item)}>
                <Card>
                  <View style={styles.row}>
                    <MciIcon
                      name={item.revoked ? 'account-cancel' : 'account-key'}
                      size={22}
                      color={item.revoked ? COLORS.textLight : COLORS.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, item.revoked && { color: COLORS.textLight }]}>
                        {personName(item)}
                      </Text>
                      <Text style={styles.meta}>
                        {[
                          item.position || null,
                          ROLE_LABEL[item.role],
                          item.revoked ? 'Revoked' : null,
                          item.activations?.length
                            ? `${item.activations.length} device${item.activations.length === 1 ? '' : 's'}`
                            : 'Unused',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.pin}>{item.pin}</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          ListEmptyComponent={<Empty text={'No devices have enrolled yet.'} />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => deviceActions(item)}>
              <Card>
                <View style={styles.row}>
                  <MciIcon
                    name={item.disabled ? 'cellphone-off' : item.approved ? 'cellphone-check' : 'cellphone-cog'}
                    size={22}
                    color={item.disabled ? COLORS.danger : item.approved ? COLORS.success : COLORS.warning}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{personName(item) || item.id}</Text>
                    <Text style={styles.meta}>
                      {[
                        item.position || null,
                        ROLE_LABEL[item.role],
                        item.disabled ? 'Switched off' : item.approved ? 'Approved' : 'Waiting',
                        item.platform,
                        item.lastSeenAt ? formatDateTime(item.lastSeenAt) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {!item.approved && !item.disabled ? (
                    <View style={styles.waitPill}>
                      <Text style={styles.waitText}>APPROVE</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
    tab: {
      flex: 1,
      paddingVertical: SIZES.md,
      borderRadius: SIZES.radiusMd,
      alignItems: 'center',
      backgroundColor: COLORS.cardSolid,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    tabOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    tabText: { fontWeight: '700', color: COLORS.text, fontSize: SIZES.small },
    tabTextOn: { color: COLORS.textWhite },

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
    roleRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
    roleBtn: {
      flex: 1,
      paddingVertical: SIZES.sm,
      borderRadius: SIZES.radiusMd,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSolid,
    },
    roleBtnOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    roleText: { fontSize: SIZES.small, fontWeight: '600', color: COLORS.text },
    roleTextOn: { color: COLORS.textWhite },

    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      marginTop: SIZES.md,
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700' },

    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    name: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    meta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    pin: {
      fontSize: SIZES.body,
      fontWeight: '800',
      color: COLORS.primaryDark,
      letterSpacing: 1,
    },
    waitPill: {
      backgroundColor: COLORS.warning,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.md,
      paddingVertical: 3,
    },
    waitText: { color: COLORS.textWhite, fontSize: SIZES.tiny, fontWeight: '800' },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
  });
