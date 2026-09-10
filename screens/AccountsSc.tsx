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
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

  /**
   * The device being renamed, and the fields while it is.
   *
   * A sheet rather than a prompt: three fields, and `Alert.prompt` is iOS-only —
   * on web and Android it does not exist at all, and this screen's whole reason
   * for being is the browser on the bridge.
   */
  const [renaming, setRenaming] = useState<EnrolledDevice | null>(null);
  const [rnFirst, setRnFirst] = useState('');
  const [rnLast, setRnLast] = useState('');
  const [rnPosition, setRnPosition] = useState('');
  const [rnBusy, setRnBusy] = useState(false);

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

  const startRename = (d: EnrolledDevice) => {
    setRnFirst(d.firstName ?? '');
    setRnLast(d.lastName ?? '');
    setRnPosition(d.position ?? '');
    setRenaming(d);
  };

  const saveRename = useCallback(async () => {
    if (!renaming || !rnFirst.trim() || !rnLast.trim()) return;
    setRnBusy(true);
    try {
      await accounts.setDeviceIdentity(imo, renaming.id, {
        firstName: rnFirst,
        lastName: rnLast,
        position: rnPosition,
      });
      // No success alert. The list is a live subscription, so the row has
      // already changed behind the sheet — saying so as well would be the app
      // telling the user something they are looking at.
      setRenaming(null);
    } catch (e: any) {
      Alert.alert('Could not rename', e?.message ?? String(e));
    } finally {
      setRnBusy(false);
    }
  }, [renaming, rnFirst, rnLast, rnPosition, imo]);

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
    /**
     * The vessel's only Master, and therefore the one row that must not be
     * demoted or switched off.
     *
     * Every write on this screen is gated on the `superadmin` claim, so losing
     * the last Master is not a change of mind — it is a lockout: nobody left
     * aboard can promote anybody, approve a device, or issue an account, and
     * the only way back is the setup code. A vessel did exactly this in its
     * first week by tapping "Make Officer" on its own row, which read like an
     * ordinary setting and was not one.
     *
     * The rule is deliberately about the LAST Master rather than about your own
     * row: handing the ship over means promoting the relief first, and that
     * order is the safe one whichever device is doing it.
     */
    const lastMaster =
      d.role === 'superadmin' &&
      devices.filter((x) => x.role === 'superadmin' && x.approved && !x.disabled).length <= 1;

    const buttons: any[] = [{ text: 'Close', style: 'cancel' }];
    if (!d.approved) buttons.push({ text: 'Approve', onPress: () => void accounts.approveDevice(imo, d.id) });
    buttons.push({ text: 'Rename', onPress: () => startRename(d) });
    if (!lastMaster) {
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
    }
    // Removing THIS device would revoke the session doing the removing — a Master
    // alone on board would lock the vessel out of its own accounts with one tap,
    // and no one left aboard could undo it.
    if (d.id !== myDeviceId) {
      buttons.push({ text: 'Remove from list', style: 'destructive' as const, onPress: () => confirmRemove(d) });
    }
    Alert.alert(
      personName(d) || d.id,
      `${ROLE_LABEL[d.role]} · ${d.approved ? 'approved' : 'waiting'}` +
        (d.id === myDeviceId ? ' · this device' : '') +
        (lastMaster
          ? '\n\nThis is the vessel\'s only Master, so its rank cannot be changed and it cannot ' +
            'be switched off here — there would be nobody left who could undo it. Make another ' +
            'device a Master first, and this one is then free to change.'
          : ''),
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
            the device has not joined yet — the “This device” card at the top of Settings.
          </Text>
        </Card>
      ) : null}

      {/* Nothing in Settings points a member here any more — this is the URL
          route. Read-only stays allowed rather than refused: the rules permit
          the read, and someone who arrived deliberately should be told where
          their own device stands instead of being shown a locked door. */}
      {rankKnown && !isMaster ? (
        <Card>
          <Label>{ROLE_LABEL[myRole]} — read only</Label>
          <Text style={styles.note}>
            Accounts, approvals and ranks are the Master's. Your own device — its name, rank and
            whether it is approved — is under Settings → This device.
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

      {/* Rename. The bridge computer two officers rotate through is not called
          by either of their names, and until this existed the name typed on the
          day the vessel was set up was permanent. It renames the DEVICE only —
          signatures come from the crew list, so no signed record moves. */}
      <Modal
        visible={!!renaming}
        transparent
        animationType="slide"
        onRequestClose={() => setRenaming(null)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setRenaming(null)}>
          {/* Claims the touch so a tap on the sheet's own padding does not
              close it — the backdrop above is a Touchable and would otherwise
              catch it mid-edit. */}
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>Rename this device</Text>
            <Text style={styles.note}>
              What this device is called in the list, and on its own “This device” card. Use a
              rank — “Third Officer” — for a shared computer that changes hands at every crew
              change.
            </Text>
            <TextInput
              style={styles.input}
              value={rnFirst}
              onChangeText={setRnFirst}
              placeholder="First name"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={rnLast}
              onChangeText={setRnLast}
              placeholder="Last name"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={rnPosition}
              onChangeText={setRnPosition}
              placeholder="Rank aboard (Third Officer, Bosun…) — optional"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
            />
            {/* Said here rather than discovered later: renaming a device is not
                renaming a signer, and the two lists are edited in different
                places. */}
            <Text style={styles.note}>
              Signatures are not affected — those are chosen from the crew list when a round is
              signed, and inspections already signed keep the name they carry.
            </Text>
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.secondaryBtn, rnBusy && { opacity: 0.5 }]}
                disabled={rnBusy}
                onPress={() => setRenaming(null)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { flex: 1, marginTop: 0 },
                  (rnBusy || !rnFirst.trim() || !rnLast.trim()) && { opacity: 0.4 },
                ]}
                disabled={rnBusy || !rnFirst.trim() || !rnLast.trim()}
                onPress={() => void saveRename()}
              >
                <MciIcon name="content-save" size={18} color={COLORS.textWhite} />
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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

    backdrop: { flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: COLORS.cardSolid,
      borderTopLeftRadius: SIZES.radiusLg,
      borderTopRightRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      paddingBottom: SIZES.xxxl,
    },
    sheetTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    sheetBtns: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.lg },
    secondaryBtn: {
      paddingVertical: SIZES.md,
      paddingHorizontal: SIZES.lg,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSolid,
    },
    secondaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: SIZES.small },
  });
