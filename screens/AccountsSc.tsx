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
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { EnrolledDevice, Invite, ROLE_ORDER, Role, personName, olderConnections } from '../types/role';
import * as accounts from '../services/accounts';
import * as fb from '../services/firebaseService';
import { uiDateTime } from '../utils/dates';
import { newestVersion, versionStanding } from '../utils/version';
import { APP_CONFIG } from '../theme';
import { moduleOn } from '../constants/modules';
import { t, tk, tn, useT } from '../utils/i18n';

type Tab = 'invites' | 'devices';

// ROLE_LABEL (types/role) stays English for records and PDFs; the screen shows the role translated.
const roleName = (r: Role) => tk(`role.${r}`);
const verText = (s: ReturnType<typeof versionStanding>) =>
  s.kind === 'current' ? t('acc.verCurrent', { v: s.version }) : s.kind === 'behind' ? t('acc.verBehind', { v: s.version, newest: s.newest }) : t('acc.verUnknown');

export default function AccountsSc() {
  const COLORS = useTheme();
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { vessel, signingPolicy } = useData();
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
  const { role: myRole, me } = useSync();
  const isMaster = myRole === 'superadmin';
  const rankKnown = myRole !== null;

  // Devices first: what a Master comes here for most days. Issuing an account is a button and a sheet (15 Oct 2026).
  const [tab, setTab] = useState<Tab>('devices');
  const [issuing, setIssuing] = useState(false);
  const shownTab: Tab = isMaster ? tab : 'devices';
  const [invites, setInvites] = useState<Invite[]>([]);
  const [devices, setDevices] = useState<EnrolledDevice[]>([]);
  // Connections the server retired as duplicates (functions/devices.js) — out of the list unless asked for.
  const [showRetired, setShowRetired] = useState(false);
  const retired = useMemo(() => devices.filter((d) => d.disabled && d.retiredAt), [devices]);
  const older = useMemo(() => olderConnections(devices, me?.id), [devices, me?.id]);
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
  /**
   * The newest version anybody aboard is running — including THIS device, which
   * the list would otherwise not know about until its own next refresh. See
   * utils/version.ts for why the fleet's own newest is the yardstick rather than
   * some idea of what the stores have released.
   */
  const newest = useMemo(
    () => newestVersion([...devices.map((d) => d.appVersion), APP_CONFIG.version]),
    [devices]
  );

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
      setIssuing(false);
      setTab('invites');
      // Shown rather than merely written, because the next thing that happens is
      // the Master reading it out to somebody standing in front of them.
      Alert.alert(
        t('acc.issuedTitle', { name: personName(inv) }),
        t('acc.issuedBody', { pin: inv.pin })
      );
    } catch (e: any) {
      Alert.alert(t('acc.couldNotIssue'), e?.message ?? String(e));
    }
  }, [firstName, lastName, role, position, imo]);

  /**
   * Delete an invitation outright — offered only once it is revoked.
   *
   * Revoke is still the first step for somebody who has left, and for most
   * vessels the last. But a list that only ever grows stops being readable as
   * "who is aboard", and a vessel asked for exactly that after its first crew
   * change. Two steps on purpose: nobody deletes a working account by a slip.
   * It removes the invitation only — its devices are rows of their own under
   * Devices, and the dialog says so rather than leaving half the tidy-up unsaid.
   */
  const confirmDeleteInvite = (inv: Invite) => {
    const used = inv.activations?.length ?? 0;
    Alert.alert(
      t('acc.deleteQ'),
      t('acc.deleteBody', { name: personName(inv) }) + '\n\n' +
        (used ? t('acc.deleteUsed', { devices: tn('n.device', used) }) + '\n\n' : '') +
        t('acc.signedUntouched'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await accounts.deleteInvite(imo, inv.id);
            } catch (e: any) {
              Alert.alert(t('acc.couldNotDelete'), e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  const inviteActions = (inv: Invite) => {
    if (!isMaster) return; // unreachable — the tab is Master-only — but cheap insurance
    const used = inv.activations?.length ?? 0;
    Alert.alert(
      personName(inv),
      `PIN ${inv.pin} · ${roleName(inv.role)}\n` +
        (used ? t('acc.usedOn', { devices: tn('n.device', used) }) : t('acc.notUsed')),
      // Three buttons either way — Android's native dialog shows no more. A
      // revoked account trades "New PIN" for "Delete": Restore brings the PIN
      // options back, and a new PIN on an account being cleared out is no use.
      inv.revoked
        ? [
            { text: t('common.close'), style: 'cancel' },
            { text: t('acc.restore'), onPress: () => void accounts.restoreInvite(imo, inv.id) },
            { text: t('common.delete'), style: 'destructive' as const, onPress: () => confirmDeleteInvite(inv) },
          ]
        : [
            { text: t('common.close'), style: 'cancel' },
            {
              text: t('acc.newPin'),
              onPress: async () => {
                try {
                  const pin = await accounts.reissuePin(imo, inv.id);
                  Alert.alert(t('acc.newPin'), `${personName(inv)}: ${pin}`);
                } catch (e: any) {
                  Alert.alert(t('acc.failed'), e?.message ?? String(e));
                }
              },
            },
            {
              text: t('acc.revoke'),
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
      Alert.alert(t('acc.couldNotRename'), e?.message ?? String(e));
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
      t('acc.removeQ'),
      t('acc.removeBody', { who }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await accounts.removeDevice(imo, d.id);
            } catch (e: any) {
              Alert.alert(t('acc.couldNotRemove'), e?.message ?? String(e));
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
        `${roleName(d.role)} · ${d.approved ? t('acc.approved') : t('acc.waitingApproval')}` +
          (d.disabled ? t('acc.switchedOffLc') : '') +
          (d.id === myDeviceId ? t('acc.youUse') : '') +
          t('acc.onlyMaster'),
        [{ text: t('common.close'), style: 'cancel' }]
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

    const buttons: any[] = [{ text: t('common.close'), style: 'cancel' }];
    if (!d.approved) buttons.push({ text: t('acc.approve'), onPress: () => void accounts.approveDevice(imo, d.id) });
    // The Master's, and only the Master's — with `signAsDevice` on, the name on a
    // device IS the signature it files (firestore.rules says the same).
    if (isMaster) buttons.push({ text: t('acc.rename'), onPress: () => startRename(d) });
    if (!lastMaster) {
      // A shore account is not a device aboard and a device aboard is not a shore
      // account: neither is turned into the other here (functions/index.js).
      for (const r of ROLE_ORDER) {
        if (r !== d.role && r !== 'shore' && d.role !== 'shore') {
          buttons.push({ text: t('acc.make', { role: roleName(r) }), onPress: () => void accounts.setDeviceRole(imo, d.id, r) });
        }
      }
      buttons.push({
        text: d.disabled ? t('acc.switchOn') : t('acc.switchOff'),
        style: d.disabled ? 'default' : ('destructive' as const),
        onPress: () => void accounts.disableDevice(imo, d.id, !d.disabled),
      });
    }
    // Removing THIS device would revoke the session doing the removing — a Master
    // alone on board would lock the vessel out of its own accounts with one tap,
    // and no one left aboard could undo it.
    if (d.id !== myDeviceId) {
      buttons.push({ text: t('acc.removeFromList'), style: 'destructive' as const, onPress: () => confirmRemove(d) });
    }
    Alert.alert(
      personName(d) || d.id,
      `${roleName(d.role)} · ${d.approved ? t('acc.approved') : t('acc.waitingLc')}` +
        (d.id === myDeviceId ? t('acc.thisDeviceLc') : '') +
        (lastMaster ? t('acc.lastMaster') : ''),
      buttons
    );
  };

  if (!imo) {
    return (
      <Screen scroll>
        <ScreenTitle title={t('acc.title')} subtitle={t('acc.sub')} />
        <Card>
          <Label>{t('acc.imoRequired')}</Label>
          <Text style={styles.note}>{t('acc.imoBody')}</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle
        title={t('acc.title')}
        subtitle={isMaster ? t('acc.subMaster') : t('acc.subCrew')}
      />

      {error ? (
        <Card>
          <Label>{t('acc.notAvailable')}</Label>
          <Text style={styles.note}>{error}</Text>
        </Card>
      ) : null}

      {!rankKnown ? (
        <Card>
          <Label>{t('acc.rankUnknown')}</Label>
          <Text style={styles.note}>{t('acc.rankUnknownBody')}</Text>
        </Card>
      ) : null}

      {/* Nothing in Settings points a member here any more — this is the URL
          route. Read-only stays allowed rather than refused: the rules permit
          the read, and someone who arrived deliberately should be told where
          their own device stands instead of being shown a locked door. */}
      {rankKnown && !isMaster ? (
        <Card>
          <Label>{t('acc.readOnly', { role: roleName(myRole) })}</Label>
          <Text style={styles.note}>{t('acc.readOnlyBody')}</Text>
        </Card>
      ) : null}

      <View style={styles.tabs}>
        {(isMaster ? (['invites', 'devices'] as Tab[]) : (['devices'] as Tab[])).map((tb) => (
          <TouchableOpacity key={tb} style={[styles.tab, shownTab === tb && styles.tabOn]} onPress={() => setTab(tb)}>
            <Text style={[styles.tabText, shownTab === tb && styles.tabTextOn]}>
              {tb === 'invites' ? t('acc.invitationsN', { n: invites.length }) : t('acc.devicesN', { n: devices.length })}
            </Text>
          </TouchableOpacity>
        ))}
        {isMaster ? (
          <TouchableOpacity style={[styles.tab, styles.tabIssue]} onPress={() => setIssuing(true)} accessibilityLabel={t('acc.issue')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MciIcon name="account-plus" size={16} color={COLORS.textWhite} />
              <Text style={[styles.tabText, styles.tabTextOn]}>{t('acc.issue')}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {shownTab === 'invites' ? (
        <>

          <FlatList
            data={invites}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
            ListEmptyComponent={<Empty text={t('acc.noInvites')} />}
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
                          roleName(item.role),
                          item.revoked ? t('acc.revoked') : null,
                          item.activations?.length
                            ? tn('n.device', item.activations.length)
                            : t('acc.unused'),
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
        <>
        {/* Older connections of the same person (types/role.ts olderConnections): a
            new browser address or a reinstall joins as a new device. One tap
            switches them all off; the one in use, and this device, stay. */}
        {isMaster && older.size ? (
          <Card>
            <Text style={styles.name}>{tn('n.olderConn', older.size)}</Text>
            <Text style={styles.meta}>{t('acc.olderBody')}</Text>
            <TouchableOpacity
              style={[styles.waitPill, { alignSelf: 'flex-start', marginTop: SIZES.sm }]}
              onPress={() => Alert.alert(t('acc.switchOffOlderQ'), [...older.keys()].map((id) => { const d = devices.find((x) => x.id === id); return d ? `${personName(d)} · ${d.platform ?? ''} · ${t('acc.lastSeen', { when: d.lastSeenAt ? uiDateTime(d.lastSeenAt) : '—' })}` : id; }).join('\n'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('acc.switchOff'), style: 'destructive', onPress: () => void accounts.retireDevices(imo, older).catch((e) => Alert.alert(t('acc.devicesErr'), String(e?.message ?? e))) },
              ])}
            >
              <Text style={styles.waitText}>{t('acc.switchThemOff')}</Text>
            </TouchableOpacity>
          </Card>
        ) : null}
        <FlatList
          data={showRetired ? devices : devices.filter((d) => !(d.disabled && d.retiredAt))}
          keyExtractor={(d) => d.id}
          ListFooterComponent={retired.length ? (
            <TouchableOpacity onPress={() => setShowRetired(!showRetired)} style={{ paddingVertical: SIZES.sm }}>
              <Text style={styles.meta}>{showRetired ? t('acc.hideRetired') : t('acc.showRetired', { conns: tn('n.olderConn', retired.length) })}</Text>
            </TouchableOpacity>
          ) : null}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          ListEmptyComponent={<Empty text={t('acc.noDevices')} />}
          renderItem={({ item }) => (
            <Card>
              {/* Two controls side by side, NOT one inside the other. A rename
                  button nested in the row's own Touchable would fire both on web —
                  the sheet opening under the action dialog — which is the same
                  nesting mistake the rename backdrop used to make. */}
              <View style={styles.row}>
                <TouchableOpacity style={styles.rowMain} onPress={() => deviceActions(item)}>
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
                        roleName(item.role),
                        item.disabled ? (item.retiredAt ? t('acc.retiredAuto') : t('acc.switchedOff')) : item.approved ? t('acc.approvedCap') : t('acc.waiting'),
                        item.platform,
                        item.lastSeenAt ? uiDateTime(item.lastSeenAt) : null,
                        older.has(item.id) ? t('acc.olderConn') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {/* WHICH BUILD THAT PHONE IS ON. The version is re-recorded on
                        every refresh (functions `refresh`), so it says what the
                        device runs today rather than what it ran the day it
                        joined — and it answers the question a Master actually
                        has: is an old build why they cannot find the round I set
                        up? Amber only when something is behind; a fleet that is
                        current should look quiet. */}
                    <Text style={[styles.meta, versionStanding(item.appVersion, newest).kind === 'behind' && styles.behind]}>
                      {verText(versionStanding(item.appVersion, newest))}
                    </Text>
                  </View>
                  {!item.approved && !item.disabled ? (
                    <View style={styles.waitPill}>
                      <Text style={styles.waitText}>{t('acc.approveCaps')}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
                {/* Renaming is what a Master comes to this list to do at every crew
                    change, so it is a button and not the fourth option in a dialog.
                    The row itself still opens the rest. */}
                {isMaster ? (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    hitSlop={8}
                    accessibilityLabel={t('acc.renameWho', { who: personName(item) || item.id })}
                    onPress={() => startRename(item)}
                  >
                    <MciIcon name="account-edit" size={22} color={COLORS.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          )}
        />
        </>
      )}

      {/* Issuing an account (15 Oct 2026: a button and a sheet — the form used to
          sit on top of the lists, and the devices were below the fold). Same
          backdrop-as-sibling arrangement as the rename sheet below. */}
      <Modal visible={issuing} transparent animationType="slide" onRequestClose={() => setIssuing(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('common.close')} onPress={() => setIssuing(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('acc.issue')}</Text>
            <Text style={styles.note}>{t('acc.issueNote')}</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('common.firstName')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('common.lastName')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              value={position}
              onChangeText={setPosition}
              placeholder={t('acc.rankPh')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
            />
            {/* The rank the person holds ON THE SHIP, which is not what the app
                lets them do. A Second Engineer may hold a Crew account and a
                cadet an Officer one; keeping them apart stops every promotion
                aboard from being a permissions change. This is what appears
                beside their signature. */}
            <View style={styles.roleRow}>
              {ROLE_ORDER.filter((r) => r !== 'shore' || moduleOn('fleet')).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnOn]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextOn]}>{roleName(r)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, (!firstName.trim() || !lastName.trim()) && { opacity: 0.4 }]}
                disabled={!firstName.trim() || !lastName.trim()}
                onPress={issue}
              >
                <MciIcon name="account-plus" size={18} color={COLORS.textWhite} />
                <Text style={styles.primaryBtnText}>{t('acc.issueBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIssuing(false)}>
                <Text style={styles.tabText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
        <View style={styles.backdrop}>
          {/* THE BACKDROP IS A SIBLING, NOT A PARENT, and that is the fix for a
              bug a vessel reported on 25 Sep 2026: "every time I select the name
              to edit it, the box closes before I can complete the change".
              The sheet used to sit INSIDE a full-screen Touchable, relying on an
              `onStartShouldSetResponder` on the sheet to swallow taps meant for
              the fields. On react-native-web — the bridge browser, where this
              screen is mostly used — that claim does not stop the click reaching
              the Touchable underneath, so tapping into a text field dismissed the
              whole sheet. Absolutely positioned behind the sheet, the backdrop
              cannot receive a tap that landed on the sheet at all, on any
              platform, with nothing to get right. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t('common.close')}
            onPress={() => setRenaming(null)}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('acc.renameTitle')}</Text>
            <Text style={styles.note}>{t('acc.renameNote')}</Text>
            <TextInput
              style={styles.input}
              value={rnFirst}
              onChangeText={setRnFirst}
              placeholder={t('common.firstName')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={rnLast}
              onChangeText={setRnLast}
              placeholder={t('common.lastName')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={rnPosition}
              onChangeText={setRnPosition}
              placeholder={t('acc.rankPh')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
            />
            {/* What renaming DOES depends on the vessel's rule, and saying the
                wrong one here is worse than saying nothing. With "Sign as the
                device's account" on, this name is the signature every inspection
                from this device will carry — which is exactly why a vessel asked
                to be able to change it at a crew change. With the rule off, the
                signer is picked from the crew list and this is just a label. */}
            <Text style={styles.note}>
              {signingPolicy.signAsDevice
                ? t('acc.renameSignDevice')
                : t('acc.renameSignCrew')}
            </Text>
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.secondaryBtn, rnBusy && { opacity: 0.5 }]}
                disabled={rnBusy}
                onPress={() => setRenaming(null)}
              >
                <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
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
                <Text style={styles.primaryBtnText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    tabIssue: { backgroundColor: COLORS.success, borderColor: COLORS.success },
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
    behind: { color: COLORS.warning, fontWeight: '700' },
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
    iconBtn: { paddingHorizontal: SIZES.xs, paddingVertical: SIZES.xs },
    /** The tappable part of a device row: everything except the rename button. */
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
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
