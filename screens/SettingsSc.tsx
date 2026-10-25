// ===================================
// Settings — vessel info, import, data, about.
//
// Joining a vessel and managing devices live on their OWN screens (Enrol,
// Accounts). This screen used to carry the whole of it — an IMO + connection
// password field, Connect, Push and Pull — and that path is gone: a device is
// enrolled by name + PIN and sync then runs by itself.
// ===================================

import { Dropdown } from '../components/Dropdown';
import { OFFSETS, deviceOffset, offsetAt, offsetText, shipAndUtc } from '../utils/shipTime';
import { ClockChanges } from '../components/ClockChanges';
import { uid as newId } from '../utils/id';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch, Modal, TouchableWithoutFeedback, Keyboard, Linking, Image, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { Screen, ScreenTitle, Card, Label, IconChip, BackButton } from '../components/ui';
import { goBackOr } from '../utils/nav';
import { MciIcon } from '../components/MciIcon';
import { PhotoUploadCard } from '../components/PhotoUploadCard';
import { ConnectionCard } from '../components/ConnectionCard';
import { SIZES, Palette, APP_CONFIG, THEME_ORDER, THEME_LABELS } from '../theme';
import { useTheme, useThemeName } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { moduleOn } from '../constants/modules';
import { setUiLang, tk, tn, useT } from '../utils/i18n';
import { LANGS, LANG_NAMES, Lang, chosenLang, deviceLang } from '../utils/locale';
import { canRememberFolder, chooseFolder, forgetFolder, rememberedFolders } from '../utils/webSave';
import { ADMIN_KEY, PinHolder, pinHolders, resetPin } from '../services/signature';
import { usePinChange } from '../components/PinChange';
import { personName } from '../types/role';
import { VesselInfo, resetAllData } from '../services/storage';
import * as fb from '../services/firebaseService';
import { clearAttachmentsDir } from '../services/attachments';
import { exportTemplate } from '../services/export';
import { GROUP_ORDER } from '../constants/categories';
import { Group } from '../types/equipment';
import { exportBackup, pickBackup, restoreBackup, saveCopyAsFile } from '../services/backup';
import * as snapshot from '../services/snapshot';
import { isSubscribed, onEntitlementChange } from '../services/purchases';
import { playSuccessSound, playErrorSound } from '../utils/sound';
import { PolicyPatch, writeSigningPolicy } from '../services/policy';
import { requestPermission, rescheduleExpiryReminders, cancelAll, notificationsSupported } from '../services/notifications';
import { formatDateTime, uiDateTime } from '../utils/dates';

const RESET_PASSWORD = 'Reset all data';

/** Sun, moon, star — one mark per theme, in THEME_ORDER. */
const THEME_ICON: Record<string, string> = {
  light: 'white-balance-sunny',
  dark: 'moon-waning-crescent',
  colorful: 'star',
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Is the vessel identified? The same five fields `saveVesselInfo` insists on —
 * they are what the register, the reports and the enrolment are filed under, so
 * anything less than all five is still a form to finish.
 */
function vesselComplete(v: VesselInfo | null | undefined): boolean {
  if (!v) return false;
  return (['vessel_name', 'imo', 'flag', 'call_sign', 'mmsi'] as (keyof VesselInfo)[]).every((k) =>
    String(v[k] ?? '').trim()
  );
}

/**
 * Settings in groups (25 Oct 2026: "very many items — organise it as cards of
 * types, each opening a card with cards of the items"). The tab shows one card
 * per group; a group opens as its own page (route SettingsGroup) where every
 * item is a card of its own. The same component draws both, so each item keeps
 * its state and logic in one place.
 */
export type SettingsGroup = 'vessel' | 'crew' | 'signing' | 'data' | 'app' | 'help';
const GROUPS: { key: SettingsGroup; icon: string }[] = [
  { key: 'vessel', icon: 'ferry' },
  { key: 'crew', icon: 'account-group-outline' },
  { key: 'signing', icon: 'clipboard-check-outline' },
  { key: 'data', icon: 'database-outline' },
  { key: 'app', icon: 'tune-variant' },
  { key: 'help', icon: 'help-circle-outline' },
];

export default function SettingsSc() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const grp: SettingsGroup | undefined = route.params?.group;
  const show = (g: SettingsGroup) => grp === g;
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, !!grp), [COLORS, grp]);
  const { name: themeName, setTheme } = useThemeName();
  const tr = useT();
  // A button that fills the line is right on a phone, where the line IS the
  // button's natural size. On the web build the card is over a metre of pixels
  // wide and the same rule turns "Save vessel info" into a banner, so past
  // tablet width the two full-bleed buttons shrink to their own size.
  const wide = useWindowDimensions().width >= 600;
  const { vessel, setVessel, reload, flat, certificates, prefs, setPrefs, signingPolicy, setSigningPolicy } = useData();
  const sync = useSync();
  const [folders, setFolders] = useState<{ kind: string; name: string; folder: string }[]>([]);
  const readFolders = () => void rememberedFolders().then(setFolders);
  useEffect(readFolders, []);
  // Who has a signing PIN on this device, for the Master's reset list.
  const changePin = usePinChange();
  const [pinHoldersHere, setPinHoldersHere] = useState<PinHolder[]>([]);
  useEffect(() => {
    if (moduleOn('signConfirm')) void pinHolders().then(setPinHoldersHere);
  }, []);
  /**
   * Who may touch the register wholesale.
   *
   * Import and Restore REPLACE it, and on a syncing device the replacement
   * reaches the whole vessel — so they are not personal settings, they are acts
   * on the ship's records. Crew get neither. An Officer keeps import and export,
   * because loading a workbook and taking a copy away is the work; Restore is
   * the Master's, because it overwrites what everyone else has already signed
   * against. Reset is the Master's for the same reason, only more so.
   */
  /**
   * A device that has NOT joined a vessel answers to nobody: the register is its
   * own, nothing it does reaches anyone else, and it still has to be able to
   * import the workbook to be useful at all. Gating on rank alone took Import
   * away from every new install — the rank is null until enrolment, so the first
   * thing a new user must do became the one thing they could not.
   */
  const solo = !sync.enrolled;
  const isMaster = solo || sync.role === 'superadmin';
  const canHandleData = solo || isMaster || sync.role === 'admin';
  const [form, setForm] = useState<VesselInfo>({});

  /**
   * Switch "scan before signing". Stored here first, so the rule holds on this
   * device at once; then sent to the vessel, which every other device listens to.
   * Offline, SyncContext sends it on the next connection (the newer copy wins).
   */
  const changeSigningPolicy = async (patch: PolicyPatch) => {
    const { error } = await writeSigningPolicy(signingPolicy, patch, setSigningPolicy, {
      synced: sync.status === 'synced',
      isMaster: sync.role === 'superadmin',
    });
    if (error) {
      Alert.alert(
        tr('common.savedLocalOnly'),
        tr('common.notAccepted', { error })
      );
    }
  };
  /** How many categories the scan rule is waived for — the subtitle of its row. */
  const scanExemptCount = (signingPolicy.scanExempt ?? []).length;
  const [busy, setBusy] = useState(false);
  const [snaps, setSnaps] = useState<snapshot.SnapshotInfo[]>([]);
  const [importSnaps, setImportSnaps] = useState<snapshot.SnapshotInfo[]>([]);
  /**
   * Is the vessel licensed? Only for the colour of the PRO badge in the header.
   * Re-read when the entitlement changes, because activating a key happens on
   * the paywall — a screen that sits OVER this one, so Settings may never lose
   * and regain focus and the badge would go on saying "not paid" after it was.
   */
  const [pro, setPro] = useState(false);

  // Reset-all-data (password gated)
  const [resetVisible, setResetVisible] = useState(false);
  const [resetPw, setResetPw] = useState('');


  // Collapsible sections (open on tap; they stay open until tapped again).
  /**
   * Which cards are open. The Vessel card starts open only while the vessel
   * information is still INCOMPLETE.
   *
   * A vessel reported this as a bug, and it was one: the card opened on every
   * visit to Settings, showing five filled fields and a "Save vessel info"
   * button, which reads as an unsaved form — the app asking again for something
   * that was entered weeks ago. Once the five fields are in, the card is history:
   * it collapses, and the details are one tap away when a call sign changes.
   *
   * `touched` is what keeps the rule honest. The vessel arrives from storage a
   * moment after this screen mounts, so a card opened BY HAND has to survive that
   * arrival; without it the effect below would shut it again under the user's
   * finger.
   */
  const [open, setOpen] = useState<Record<string, boolean>>({ vessel: !vesselComplete(vessel) });
  // Inside a group every card is open — the page IS the section.
  const opened: Record<string, boolean> = grp ? { vessel: true, data: true, modules: true, help: true } : open;
  const touched = useRef(false);
  const toggleSection = (k: string) => {
    if (k === 'vessel') touched.current = true;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, [k]: !o[k] }));
  };

  useEffect(() => {
    if (touched.current) return;
    setOpen((o) => (o.vessel === !vesselComplete(vessel) ? o : { ...o, vessel: !vesselComplete(vessel) }));
  }, [vessel]);

  const toggleNotifications = async (v: boolean) => {
    if (!v) {
      await setPrefs({ notificationsEnabled: false });
      await cancelAll();
      return;
    }
    if (!notificationsSupported()) {
      Alert.alert(tr('set.notAvail'), tr('set.notAvailBody'));
      return;
    }
    const ok = await requestPermission();
    if (!ok) {
      Alert.alert(tr('set.permNeeded'), tr('set.permBody'));
      return;
    }
    await setPrefs({ notificationsEnabled: true });
    const n = await rescheduleExpiryReminders(flat, certificates);
    playSuccessSound();
    Alert.alert(
      tr('set.remOn'),
      n > 0
        ? tr('set.remScheduled', { what: tn('n.reminder', n) })
        : tr('set.remEnabled')
    );
  };

  useEffect(() => {
    if (vessel) setForm(vessel);
  }, [vessel]);

  /** Does the form differ from what is stored? What makes Save mean something. */
  const vesselDirty = useMemo(
    () =>
      (['vessel_name', 'imo', 'flag', 'call_sign', 'mmsi', 'ship_utc_offset'] as (keyof VesselInfo)[]).some(
        (k) => String(form[k] ?? '').trim() !== String(vessel?.[k] ?? '').trim()
      ),
    [form, vessel]
  );

  useEffect(() => {
    const read = () => void isSubscribed().then(setPro).catch(() => setPro(false));
    read();
    return onEntitlementChange(read);
  }, []);

  /**
   * Re-read the snapshot list on focus, and once more shortly after mount.
   *
   * The launch snapshot is written when DataContext finishes loading, which can
   * be AFTER this screen has already asked for the list — open Settings quickly
   * enough and the row said "nothing to roll back to" while a snapshot was being
   * written a moment later. Focus covers the normal case (you navigate here); the
   * delayed re-read covers arriving straight at Settings, which is what a saved
   * URL on the web does.
   */
  const focused = useIsFocused();
  useEffect(() => {
    const load = () => {
      void snapshot.listSnapshots().then(setSnaps).catch(() => {});
      void snapshot.listSnapshots('import').then(setImportSnaps).catch(() => {});
    };
    load();
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [busy, focused]);

  const downloadTemplate = async (group?: Group) => {
    try {
      await exportTemplate(group);
    } catch (e: any) {
      playErrorSound();
      Alert.alert(tr('set.templateFailed'), String(e?.message ?? e));
    }
  };

  /**
   * A second template appears only when a second register exists. The lifting
   * module has its own columns (SWL, breaking load, certificates), so it has its
   * own workbook — see `templateColumns`.
   */
  const hasLifting = GROUP_ORDER.includes('LIFTING');

  const backupExport = async () => {
    setBusy(true);
    try {
      const s = await exportBackup(vessel ?? form);
      playSuccessSound();
      Alert.alert(
        tr('set.backupCreated'),
        tr('set.backupBody', { items: tn('n.item', s.items), certs: tn('n.certificate', s.certificates), files: tn('n.file', s.files) })
      );
    } catch (e: any) {
      playErrorSound();
      Alert.alert(tr('set.backupFailed'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const backupImport = async () => {
    try {
      const picked = await pickBackup();
      if (!picked) return; // cancelled — the picker only reports a real cancel now
      const { backup, summary } = picked;
      Alert.alert(
        tr('set.restoreQ'),
        (summary.fileName ? tr('set.read', { file: summary.fileName }) + '\n\n' : '') +
          tr('set.replacesAll') + '\n\n' +
          `• ${tr('set.itemsIn', { items: tn('n.item', summary.items), cats: tn('n.category', summary.categories) })}\n` +
          `• ${tn('n.certificate', summary.certificates)}\n` +
          `• ${tn('n.signedInspection', summary.inspections)}\n` +
          `• ${tn('n.crewMember', summary.crew)}\n` +
          `• ${tn('n.attachedFile', summary.files)}\n` +
          (summary.vessel ? `• ${tr('set.vesselIs', { name: summary.vessel })}\n` : '') +
          '\n' + tr('set.cannotUndo'),
        [
          { text: tr('common.cancel'), style: 'cancel' },
          {
            text: tr('set.restore'),
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await restoreBackup(backup);
                await reload();
                // Hand the restored register to the vessel straight away. Without
                // this the cloud copy is untouched and the listener puts it back
                // on the next launch, so the restore looks like it worked and
                // then quietly undoes itself.
                const shared = await sync.pushLocalNow().catch(() => false);
                playSuccessSound();
                Alert.alert(
                  tr('set.restored'),
                  tr('set.restoredBody', { items: tn('n.item', summary.items) }) + '\n\n' +
                    (shared
                      ? tr('set.restoredShared')
                      : tr('set.restoredLocal'))
                );
              } catch (e: any) {
                playErrorSound();
                Alert.alert(tr('set.restoreFailed'), String(e?.message ?? e));
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      playErrorSound();
      Alert.alert(tr('set.restoreFailed'), String(e?.message ?? e));
    }
  };

  /**
   * Put back one of the automatic snapshots.
   *
   * Offered beside Restore because it answers the same question and is the one
   * that will actually be there: nobody exports a `.msm` the morning before the
   * accident, but the app took a copy on the way in. It restores RECORDS, not
   * attached files — those were never copied (see services/snapshot.ts) and are
   * still on disk under their own names, so the links survive. That distinction
   * is spelled out rather than left for someone to discover afterwards.
   */
  /**
   * Save one of the copies on this device as a file — without rolling back. The
   * way an old register is handed over for repair (DreamBoat, Oct 2026: the copy
   * from before a re-import was on one officer's phone, and the only button
   * there would have rolled the whole device back).
   */
  const saveCopy = () => {
    const all = [...importSnaps, ...snaps].sort((a, b) => b.at - a.at);
    if (!all.length) return Alert.alert(tr('set.noCopies'), tr('set.noCopiesBody'));
    Alert.alert(
      tr('set.saveCopy'),
      tr('set.saveCopyBody'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        ...all.map((c) => ({
          text: `${c.kind === 'import' ? tr('set.beforeImport') : tr('set.onOpening')} · ${uiDateTime(c.at)} (${tn('n.item', c.items)}, ${tn('n.inspection', c.inspections)})`,
          onPress: async () => {
            try {
              await saveCopyAsFile(await snapshot.snapshotBody(c.slot, c.kind));
            } catch (e: any) {
              Alert.alert(tr('common.couldNotSave'), e?.message ?? String(e));
            }
          },
        })),
      ]
    );
  };

  const restoreSnapshot = () => {
    if (!snaps.length) {
      Alert.alert(
        tr('set.nothingRoll'),
        tr('set.nothingRollBody')
      );
      return;
    }
    const newest = snaps[0];
    const reaches = isMaster
      ? tr('set.reachesMaster')
      : tr('set.reachesOfficer');
    Alert.alert(
      tr('set.rollQ', { when: uiDateTime(newest.at) }),
      tr('set.rollBody', { items: tn('n.item', newest.items), certs: tn('n.certificate', newest.certificates), insp: tn('n.inspection', newest.inspections), crew: newest.crew }) + '\n\n' +
        reaches +
        '\n\n' + tr('set.rollFiles'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        ...snaps.map((s, i) => ({
          text: i === 0 ? tr('set.rollBack') : tr('set.older', { when: uiDateTime(s.at), n: s.items }),
          style: 'destructive' as const,
          onPress: async () => {
            setBusy(true);
            try {
              let done: snapshot.SnapshotInfo;
              let shared = false;
              if (isMaster) {
                done = await snapshot.restoreSnapshot(s.slot);
                await reload();
                shared = await sync.pushLocalNow().catch(() => false);
              } else {
                // An officer repairs the device, not the ship. The write and the
                // render it causes are wrapped so the change is not sent up —
                // any local edit schedules a push, and without this a private
                // recovery would quietly become everyone's.
                let inner: snapshot.SnapshotInfo | null = null;
                await sync.applyLocally(async () => {
                  inner = await snapshot.restoreSnapshot(s.slot);
                  await reload();
                });
                done = inner!;
              }
              playSuccessSound();
              Alert.alert(
                tr('set.rolledBack'),
                tr('set.rolledBody', { items: tn('n.item', done.items), insp: tn('n.inspection', done.inspections), crew: done.crew, when: uiDateTime(done.at) }) + '\n\n' +
                  (isMaster
                    ? shared
                      ? tr('set.nowHolds')
                      : tr('set.localNotSync')
                    : tr('set.localUnchanged'))
              );
            } catch (e: any) {
              playErrorSound();
              Alert.alert(tr('set.couldNotRestore'), e?.message ?? String(e));
            } finally {
              setBusy(false);
            }
          },
        })),
      ]
    );
  };

  const closeReset = () => {
    Keyboard.dismiss();
    setResetVisible(false);
    setResetPw('');
  };

  const doReset = async () => {
    if (resetPw.trim() !== RESET_PASSWORD) {
      playErrorSound();
      Alert.alert(tr('set.badPw'), tr('set.notReset'));
      return;
    }
    setResetVisible(false);
    setResetPw('');
    // On a syncing device this is NOT a local action. Wiping storage fires the
    // data-change push, and pushAll sends whatever it finds — including nothing
    // at all — so the vessel's register and every other device's copy go with
    // it, within seconds and with no warning. That exact accident happened to a
    // user on the sibling app. Say it plainly and make them choose it.
    if (sync.status === 'synced' || sync.status === 'pending') {
      const go = await new Promise<boolean>((resolve) => {
        Alert.alert(
          tr('set.erasesVessel'),
          tr('set.erasesVesselBody'),
          [
            { text: tr('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: tr('set.eraseEverywhere'), style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
      if (!go) return;
    }
    setBusy(true);
    try {
      // The crew list has to be retired in the vessel BEFORE local storage goes:
      // unlike the register it syncs as a union, so a plain wipe here was undone
      // by the first pull after reconnecting — every name came straight back.
      if (sync.status === 'synced') {
        const uid = await fb.currentVesselKey();
        if (uid) await fb.retireAllCrew(uid);
      }
      await resetAllData();
      await clearAttachmentsDir();
      // The snapshots hold the register that was just erased. Leaving them would
      // make "delete everything" untrue.
      await snapshot.clearSnapshots();
      setSnaps([]);
      await reload();
      setForm({});
      playSuccessSound();
      Alert.alert(tr('set.dataReset'), tr('set.dataResetBody'));
    } catch (e: any) {
      playErrorSound();
      Alert.alert(tr('set.resetFailed'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const saveVesselInfo = async () => {
    const required: (keyof VesselInfo)[] = ['vessel_name', 'imo', 'flag', 'call_sign', 'mmsi'];
    if (required.some((k) => !String(form[k] ?? '').trim())) {
      playErrorSound();
      Alert.alert(tr('set.allReq'), tr('set.allReqBody'));
      return;
    }
    if (!/^\d{7}$/.test(String(form.imo).trim())) {
      playErrorSound();
      Alert.alert(tr('set.badImo'), tr('set.badImoBody'));
      return;
    }
    if (!/^\d{9}$/.test(String(form.mmsi).trim())) {
      playErrorSound();
      Alert.alert(tr('set.badMmsi'), tr('set.badMmsiBody'));
      return;
    }
    // Ship's time changed by hand: kept in the history too, so past days keep their zone.
    const was = offsetAt(Date.now(), vessel);
    const changed = (form.ship_utc_offset ?? '') !== (was ?? '') && (was || form.ship_utc_offset || (vessel?.ship_time_changes ?? []).length);
    await setVessel(changed
      ? { ...form, ship_time_changes: [...(vessel?.ship_time_changes ?? []), { id: newId('clk'), at: Date.now(), from: was ?? deviceOffset(), to: form.ship_utc_offset ?? deviceOffset(), madeAt: Date.now() }] }
      : form);
    playSuccessSound();
    // Collapse the card like the other sections once saved.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, vessel: false }));
    Alert.alert(tr('set.saved'), tr('set.vesselUpdated'));
  };

  // Crew & accounts is a management group: the Master, or an officer keeping the crew list, or the office console.
  const crewTile = sync.role === 'superadmin' || (moduleOn('crewCerts') && (sync.role === 'admin' || !sync.enrolled)) || moduleOn('fleet');
  /** What a group card says about itself — the vessel's own facts first. */
  const tileSub = (g: SettingsGroup): string => {
    if (g === 'vessel') {
      if (!vesselComplete(vessel)) return tr('setg.vesselFill');
      const off = offsetAt(Date.now(), vessel);
      return `${vessel?.vessel_name ?? ''} · IMO ${vessel?.imo ?? ''} · UTC${off ?? deviceOffset()}`;
    }
    if (g === 'help') return `${tk('setg.helpSub')} · v${APP_CONFIG.version}`;
    return tk(`setg.${g}Sub`);
  };

  return (
    <Screen scroll>
      {/* The theme lives in the header now, not in a card of its own. It was a
          panel at the top of Settings that a person reads once and never again —
          the appearance of the app is not a setting you go looking for, it is one
          you flick. Three marks say it without a word: sun, moon, star. */}
      {grp ? (
        <>
          {Platform.OS !== 'web' ? <BackButton onPress={() => goBackOr(nav)} /> : null}
          <ScreenTitle title={tk(`setg.${grp}`)} subtitle={tk(`setg.${grp}Sub`)} />
        </>
      ) : (
      <ScreenTitle
          title={tr('tab.Settings')}
          subtitle={tr('set.onDevice', { items: tn('n.item', flat.length) })}
          help="Getting started"
          actions={
            <View style={styles.headerActions}>
              {/* PRO, as a badge rather than a card. Green when the vessel is
                  licensed, blue when it is not — the state is the whole message,
                  and a card three lines long was spending the top of the screen to
                  say it. Still opens the same screen. */}
              <TouchableOpacity
                onPress={() => nav.navigate('Paywall')}
                hitSlop={8}
                accessibilityLabel={pro ? tr('set.proActive') : tr('set.getPro')}
                style={[styles.proPill, { backgroundColor: pro ? COLORS.success : COLORS.primary }]}
              >
                <Text style={styles.proPillText}>PRO</Text>
              </TouchableOpacity>
            <View style={styles.themeIcons}>
              {THEME_ORDER.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTheme(t)}
                  hitSlop={8}
                  accessibilityLabel={tr(`set.theme.${t}` as any)}
                  style={[styles.themeIcon, themeName === t && styles.themeIconOn]}
                >
                  <MciIcon
                    name={THEME_ICON[t]}
                    size={20}
                    color={themeName === t ? COLORS.textWhite : COLORS.textLight}
                  />
              </TouchableOpacity>
            ))}
          </View>
          </View>
        }
      />
      )}

      {!grp ? (
        <>
      <ConnectionCard />

        </>
      ) : null}

      {!grp ? (
        <View style={[styles.tiles, wide && styles.tilesWide]}>
          {GROUPS.filter((g) => g.key !== 'crew' || crewTile).map((g) => {
            const warn = g.key === 'vessel' && !vesselComplete(vessel);
            return (
              <TouchableOpacity
                key={g.key}
                style={[styles.tile, wide && styles.tileWide, warn && { borderColor: COLORS.warning }]}
                onPress={() => nav.navigate('SettingsGroup', { group: g.key })}
                activeOpacity={0.8}
              >
                <IconChip name={g.icon} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tileTitle}>{tk(`setg.${g.key}`)}</Text>
                  <Text style={[styles.linkSub, warn && { color: COLORS.warning, fontWeight: '700' }]} numberOfLines={2}>{tileSub(g.key)}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {show('app') ? (
        <>
      {/* Interface language — only once the `i18n` module is released. */}
      {moduleOn('i18n') ? (
        <Card>
          <Label>{tr('settings.language.label')}</Label>
          <Dropdown
            caption={tr('settings.language.caption')}
            value={chosenLang() ?? ''}
            onChange={(v: string) => void setUiLang(v ? (v as Lang) : null)}
            options={[
              { value: '', label: tr('settings.language.auto', { lang: LANG_NAMES[deviceLang()] }) },
              ...LANGS.map((l) => ({ value: l, label: LANG_NAMES[l] })),
            ]}
          />
          <Text style={{ fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4 }}>{tr('settings.language.note')}</Text>
        </Card>
      ) : null}
        </>
      ) : null}

      {show('vessel') ? (
        <>
      <Card>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('vessel')} activeOpacity={0.7}>
          <Label>{tr('certs.tab.vessel')}</Label>
          {/* Collapsed, the card still has to say WHICH vessel — otherwise closing
              it by default hides the one fact a person opens Settings to check. */}
          {!opened.vessel && vesselComplete(vessel) ? (
            <Text style={styles.sectionSummary} numberOfLines={1}>
              {vessel?.vessel_name} · IMO {vessel?.imo}
            </Text>
          ) : null}
          <Text style={styles.sectionChev}>{opened.vessel ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {opened.vessel ? (
          <>
        <FormField label={tr('set.vesselName')} value={form.vessel_name} onChange={(v) => setForm({ ...form, vessel_name: v })} />
        <FormField label={tr('set.imo')} value={form.imo} onChange={(v) => setForm({ ...form, imo: v })} keyboard="number-pad" />
        <FormField label={tr('set.flag')} value={form.flag} onChange={(v) => setForm({ ...form, flag: v })} />
        <FormField label={tr('set.callSign')} value={form.call_sign} onChange={(v) => setForm({ ...form, call_sign: v })} />
        <FormField label="MMSI" value={form.mmsi} onChange={(v) => setForm({ ...form, mmsi: v })} keyboard="number-pad" />
        {/* Ship's time — the reports' header shows it beside UTC (13 Oct 2026). */}
        <View style={{ marginTop: SIZES.sm }}>
          <Dropdown
            caption={tr('set.shipTime')}
            value={form.ship_utc_offset ?? ''}
            onChange={(v: string) => setForm({ ...form, ship_utc_offset: v || undefined })}
            options={[{ value: '', label: tr('set.asDevice', { utc: `UTC${offsetText(-new Date().getTimezoneOffset())}` }) }, ...(form.ship_utc_offset && !OFFSETS.includes(form.ship_utc_offset) ? [form.ship_utc_offset] : []).concat(OFFSETS).map((o) => ({ value: o, label: `UTC${o}` }))]}
          />
          <Text style={{ fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4 }}>{tr('set.now', { line: ((s) => `${s.ship} ${tr('clock.shipTime')} (${s.zone}) · ${s.utc.slice(s.ship.slice(0, 10) === s.utc.slice(0, 10) ? 11 : 0)} UTC`)(shipAndUtc(Date.now(), form.ship_utc_offset)) })}</Text>
          <ClockChanges />
        </View>
        {/* Nothing to save is said by the button itself. A live "Save" beside five
            filled fields is the app asking for something it already has. */}
        <TouchableOpacity
          style={[styles.primaryBtn, wide && styles.btnCompact, !vesselDirty && { opacity: 0.4 }]}
          disabled={!vesselDirty}
          onPress={saveVesselInfo}
        >
          <Text style={styles.primaryBtnText}>
            {vesselComplete(vessel) ? (vesselDirty ? tr('set.saveChanges') : tr('set.saved')) : tr('set.saveVessel')}
          </Text>
        </TouchableOpacity>

          </>
        ) : null}
      </Card>
        </>
      ) : null}

      {show('crew') ? (
        <>
      {/* Planned maintenance and Hours of rest were cards here; they are tabs now,
          shown per device as the Master sets on Access (constants/access.ts). */}
      {sync.role === 'superadmin' || (moduleOn('crewCerts') && (sync.role === 'admin' || !sync.enrolled)) ? (
      <Card style={grp ? styles.flatCard : undefined}>
        <Label>{tr('set.crewAccounts')}</Label>
        {/* Master only. The crew list is a MANAGEMENT screen — for anyone else it
            is a page with nothing to do on it, and often nothing on it at all,
            since a vessel that adds its signers from enrolled people keeps the
            list short. Signing does not go through here: the picker inside an
            inspection reads the same list, and every rank still signs. */}
        {sync.role === 'superadmin' || (moduleOn('crewCerts') && (sync.role === 'admin' || !sync.enrolled)) ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Crew')}>
            <IconChip name="account-multiple" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('menu.group.crew')}</Text>
              {/* A vessel asked what this list is for (2 Oct 2026) — fairly: with
                  "Sign as the device's account" on, the names it changes in
                  Accounts ARE the signatures and this list is not consulted. */}
              <Text style={styles.linkSub}>
                {signingPolicy.signAsDevice
                  ? tr('set.crewNotUsed')
                  : tr('set.crewSub')}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {/* Issuing accounts is the Master's, so only a Master is offered it. The
            row used to be shown to everyone with "(Master only)" in the subtitle,
            which put a door in front of the crew and a notice on it saying the
            door is not theirs. A member who wants the read-only roster can still
            reach /accounts by URL, where the screen explains itself. */}
        {/* Everything the Master can allow or delegate, as one table (screens/MasterSc). */}
        {sync.role === 'superadmin' && moduleOn('access') ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('MasterPage')}>
            <IconChip name="shield-crown-outline" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('master.title')}</Text>
              <Text style={styles.linkSub}>{tr('set.masterSub')}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {sync.role === 'superadmin' ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Accounts')}>
            <IconChip name="key" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('acc.title')}</Text>
              <Text style={styles.linkSub}>{tr('set.accountsSub')}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {sync.role === 'superadmin' && sync.enrolled ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('EmailReport')}>
            <IconChip name="email-outline" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('set.emailReport')}</Text>
              <Text style={styles.linkSub}>{tr('set.emailSub')}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
      ) : null}
        </>
      ) : null}

      {show('crew') ? (
        <>
      {/* Crew and accounts — both Master-only, so the whole card is. Defects
          moved to the Dashboard: an open defect is work waiting, and work
          waiting belongs where the officer already looks, not filed under
          Settings behind the crew list. */}
      {moduleOn('fleet') ? (
        <Card style={grp ? styles.flatCard : undefined}>
          <Label>{tr('set.super')}</Label>
          {/* The office side: a shore account a Master lets into this vessel
              (Accounts → Superintendent). Its own sign-in; see screens/FleetSc. */}
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Fleet')}>
            <IconChip name="ferry" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('set.fleet')}</Text>
              <Text style={styles.linkSub}>{tr('set.fleetSub')}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        </Card>
      ) : null}
        </>
      ) : null}

      {show('signing') ? (
        <>
      {/* Shown to EVERY rank, unlike Crew and Accounts above. Those are management
          screens with nothing on them for a crew member; this one answers a
          question anybody about to do a round has — what am I going to be asked?
          Editing is gated inside the screen (and by firestore.rules), so the door
          is not being held open on something that will refuse them. */}
      <Card style={grp ? styles.flatCard : undefined}>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('CategoriesEdit')}>
          <IconChip name="view-grid-outline" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('ce.title')}</Text>
            <Text style={styles.linkSub}>{tr('set.catsSub')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('LabelBatch')}>
          <IconChip name="tag-outline" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('ui.labels')}</Text>
            <Text style={styles.linkSub}>{tr('set.labelsSub')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Checklists')}>
          <IconChip name="clipboard-text-outline" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('cl.title')}</Text>
            <Text style={styles.linkSub}>
              {sync.role === 'admin' || sync.role === 'superadmin'
                ? tr('set.clSubOfficer')
                : tr('set.clSub')}
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        {/* The vessel's rule, shown to every rank so a crew member knows why the
            Inspect button asks for a scan — but only a Master's switch moves. The
            same is enforced for the vessel copy by firestore.rules. */}
        <View style={styles.toggleRow}>
          <IconChip name="qrcode-scan" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.scanFirst')}</Text>
            <Text style={styles.linkSub}>
              {isMaster
                ? tr('set.scanMaster')
                : signingPolicy.requireScan
                  ? tr('set.scanOn')
                  : tr('set.scanOff')}
            </Text>
          </View>
          <Switch
            value={signingPolicy.requireScan}
            disabled={!isMaster}
            onValueChange={(v) => void changeSigningPolicy({ requireScan: v })}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
        {/* The exceptions to the rule above, per category — an inventory like the
            rescue boat's equipment is checked off a list, not label by label
            (screens/ScanRulesSc.tsx). Shown only while the rule is on: an
            exception to a rule nobody is keeping is a row that explains nothing. */}
        {signingPolicy.requireScan ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('ScanRules')}>
            <IconChip name="qrcode-edit" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('scan.title')}</Text>
              <Text style={styles.linkSub}>
                {scanExemptCount
                  ? tn('n.exemptCat', scanExemptCount)
                  : tr('set.allScan')}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {/* The other half of the same rule: WHO signs. Off, the crew list is a
            vocabulary anyone on the device may pick from; on, an enrolled device
            signs as the person it was issued to and the picker is gone. Names are
            managed where the devices are — Settings → Accounts (rename). */}
        <View style={styles.toggleRow}>
          <IconChip name="cellphone" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.signAsDevice')}</Text>
            <Text style={styles.linkSub}>
              {isMaster
                ? tr('set.sadMaster')
                : signingPolicy.signAsDevice
                  ? tr('set.sadOn')
                  : tr('set.sadOff')}
            </Text>
          </View>
          <Switch
            value={!!signingPolicy.signAsDevice}
            disabled={!isMaster}
            onValueChange={(v) => void changeSigningPolicy({ signAsDevice: v })}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
        {moduleOn('signConfirm') ? (
          <>
            {/* Fingerprint, hand-drawn signature or the signer's own PIN on every
                signature (components/SignConfirm). Always on with the module. Never a face. */}
            <View style={styles.toggleRow}>
              <IconChip name="fingerprint" size={18} />
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{tr('set.confirmed')}</Text>
                <Text style={styles.linkSub}>{tr('set.confirmedSub')}</Text>
              </View>
            </View>
            {/* Setting or changing a PIN (components/PinChange): the Master PIN opens
                a new one, the owner's own PIN or the Master PIN a change. */}
            {sync.me ? (
              <TouchableOpacity style={styles.linkRow} onPress={() => changePin({ key: `device:${sync.me!.id}`, name: personName(sync.me!) }, { onDone: () => void pinHolders().then(setPinHoldersHere) })}>
                <IconChip name="dialpad" size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle}>{tr('set.myPin')}</Text>
                  <Text style={styles.linkSub}>{pinHoldersHere.some((h) => h.key === `device:${sync.me!.id}`) ? tr('set.myPinSet') : tr('set.myPinNotSet')}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ) : null}
            {isMaster ? (
              <TouchableOpacity style={styles.linkRow} onPress={() => changePin({ key: ADMIN_KEY, name: tr('role.superadmin') }, { onDone: () => void pinHolders().then(setPinHoldersHere) })}>
                <IconChip name="lock" size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle}>{tr('pc.masterPin')}</Text>
                  <Text style={[styles.linkSub, !pinHoldersHere.some((h) => h.key === ADMIN_KEY) && { color: COLORS.warning, fontWeight: '700' }]}>{pinHoldersHere.some((h) => h.key === ADMIN_KEY) ? tr('set.masterPinChanged') : tr('set.masterPinDefault')}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ) : null}
            {moduleOn('crewCerts') ? (
              <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('CrewMatrix')}>
                <IconChip name="account-lock-outline" size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle}>{tr('set.crewPins')}</Text>
                  <Text style={styles.linkSub}>{tr('set.crewPinsSub')}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ) : null}
            {isMaster && pinHoldersHere.filter((h) => h.key !== ADMIN_KEY).length ? (
              <View style={{ marginTop: SIZES.sm }}>
                <Text style={styles.linkSub}>{tr('set.pinsHere')}</Text>
                {pinHoldersHere.filter((h) => h.key !== ADMIN_KEY).map((h) => (
                  <View key={h.key} style={[styles.linkRow, { paddingVertical: SIZES.xs }]}>
                    <Text style={[styles.linkTitle, { flex: 1 }]} numberOfLines={1}>{h.name}</Text>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() =>
                        Alert.alert(tr('set.resetPinT'), tr('set.resetPinBody', { name: h.name }), [
                          { text: tr('common.cancel'), style: 'cancel' },
                          { text: tr('set.reset'), style: 'destructive', onPress: async () => { await resetPin(h.key); setPinHoldersHere(await pinHolders()); } },
                        ])
                      }
                    >
                      <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{tr('set.reset')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </Card>
        </>
      ) : null}

      {show('data') ? (
        <>
      {canHandleData ? (
      <Card style={grp ? styles.flatCard : undefined}>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('data')} activeOpacity={0.7}>
          <Label>{tr('set.data')}</Label>
          <Text style={styles.sectionChev}>{opened.data ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {opened.data ? (
          <>
        <TouchableOpacity style={styles.linkRow} onPress={() => void downloadTemplate()}>
          <IconChip name="tray-arrow-down" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>
              {hasLifting ? tr('set.tplLsa') : tr('set.tplImport')}
            </Text>
            <Text style={styles.linkSub}>{tr('set.tplSub')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        {hasLifting ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => void downloadTemplate('LIFTING')}>
            <IconChip name="tray-arrow-down" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('set.tplLifting')}</Text>
              <Text style={styles.linkSub}>{tr('set.tplLiftingSub')}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Import')}>
          <IconChip name="tray-arrow-down" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.importXl')}</Text>
            <Text style={styles.linkSub}>{tr('set.importXlSub')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={backupExport} disabled={busy}>
          <IconChip name="content-save" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.exportBk')}</Text>
            <Text style={styles.linkSub}>{tr('set.exportBkSub')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        {/* The automatic net, and unlike Restore it is NOT the Master's alone.
            Rolling this device back to how it was an hour ago is repairing the
            handset in your hand; replacing the register from a file somebody
            carried aboard is a different act with a different blast radius. An
            officer's roll-back therefore stays on the device — see the dialog. */}
        {canHandleData ? (
          <TouchableOpacity
            style={[styles.linkRow, !snaps.length && { opacity: 0.45 }]}
            onPress={restoreSnapshot}
            disabled={busy}
          >
            <IconChip name="history" size={18} />
            <View style={{ flex: 1 }}>
              {/* The DATE is the offer. "Restore a snapshot" makes a person open
                  the dialog to find out whether it is worth anything; the moment
                  it would take them back to answers that on the row itself. */}
              <Text style={styles.linkTitle}>
                {snaps.length ? tr('set.rollTo', { when: uiDateTime(snaps[0].at) }) : tr('set.nothingRollYet')}
              </Text>
              <Text style={styles.linkSub}>
                {snaps.length
                  ? tr('set.snapSub', { items: tn('n.item', snaps[0].items), insp: tn('n.inspection', snaps[0].inspections) })
                  : tr('set.snapAuto')}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {canHandleData ? (
          <TouchableOpacity style={[styles.linkRow, !(snaps.length + importSnaps.length) && { opacity: 0.45 }]} onPress={saveCopy} disabled={busy}>
            <IconChip name="content-save-outline" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('set.saveCopy')}</Text>
              <Text style={styles.linkSub}>
                {tn('n.copyHere', snaps.length + importSnaps.length) + (importSnaps.length ? tr('set.beforeImportAt', { when: uiDateTime(importSnaps[0].at) }) : '') + tr('set.noRollback')}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {/* Master only. Restore replaces the register and then hands it to the
            vessel, so it overwrites what other officers have already worked
            against — the one button here that can undo somebody else's day. */}
        {isMaster ? (
          <TouchableOpacity style={styles.linkRow} onPress={backupImport} disabled={busy}>
            <IconChip name="backup-restore" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('set.restoreBk')}</Text>
              <Text style={styles.linkSub}>{tr('set.restoreBkSub')}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
          </>
        ) : null}
      </Card>
      ) : null}
        </>
      ) : null}

      {show('data') ? (
        <>
      <PhotoUploadCard />
        </>
      ) : null}

      {show('data') ? (
        <>
      {/* Only the reports that save into a folder (rest, crew list, fuel, garbage,
          gangway) use it — none of them is on, nothing to choose. */}
      {canRememberFolder() && (['rest', 'crewCerts', 'fuel', 'garbage', 'security'] as const).some((m) => moduleOn(m)) ? (
        <Card style={grp ? styles.flatCard : undefined}>
          <Label>{tr('set.folders')}</Label>
          {/* A folder per section on this computer (utils/webSave): the first save in a section asks for it. */}
          <Text style={[styles.linkSub, { marginBottom: SIZES.xs }]}>{tr('set.foldersSub')}</Text>
          {!folders.length ? <Text style={styles.linkSub}>{tr('set.noFolder')}</Text> : null}
          {folders.map((f) => (
            <View key={f.kind} style={styles.linkRow}>
              <IconChip name="folder-outline" size={18} />
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{f.name}</Text>
                <Text style={styles.linkSub}>{`→ ${f.folder}`}</Text>
              </View>
              <TouchableOpacity onPress={() => void chooseFolder(f.kind).then(readFolders)} hitSlop={8}>
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{tr('set.change')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void forgetFolder(f.kind).then(readFolders)} hitSlop={8}>
                <Text style={{ color: COLORS.textLight, fontWeight: '700', marginLeft: SIZES.sm }}>{tr('prn.forget')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      ) : null}
        </>
      ) : null}

      {show('app') ? (
        <>
      <Card style={grp ? styles.flatCard : undefined}>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('modules')} activeOpacity={0.7}>
          <Label>{tr('set.modules')}</Label>
          <Text style={styles.sectionChev}>{opened.modules ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {opened.modules ? (
          <>
        <View style={styles.toggleRow}>
          <IconChip name="bell-ring" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.reminders')}</Text>
            <Text style={styles.linkSub}>{tr('set.remindersSub')}</Text>
          </View>
          <Switch
            value={!!prefs.notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <IconChip name="volume-high" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.sounds')}</Text>
            <Text style={styles.linkSub}>{tr('set.soundsSub')}</Text>
          </View>
          <Switch
            value={!prefs.soundsMuted}
            onValueChange={(v) => setPrefs({ soundsMuted: !v })}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <IconChip name="timer-outline" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.compLog')}</Text>
            <Text style={styles.linkSub}>{tr('set.compLogSub')}</Text>
          </View>
          <Switch
            value={!!prefs.compressorEnabled}
            onValueChange={(v) => setPrefs({ compressorEnabled: v })}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
        {prefs.compressorEnabled ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Compressor')}>
            <IconChip name="chart-line" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{tr('set.compOpen')}</Text>
              <Text style={styles.linkSub}>{tr('set.compOpenSub')}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
          </>
        ) : null}
      </Card>
        </>
      ) : null}

      {show('help') ? (
        <>
      <Card style={grp ? styles.flatCard : undefined}>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('help')} activeOpacity={0.7}>
          <Label>{tr('hb.help')}</Label>
          <Text style={styles.sectionChev}>{opened.help ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {opened.help ? (
          <>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Manual')}>
          <IconChip name="book-open-variant" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.manual')}</Text>
            <Text style={styles.linkSub}>{tr('set.manualSub')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Legal', { doc: 'privacy' })}>
          <IconChip name="lock" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.privacy')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Legal', { doc: 'terms' })}>
          <IconChip name="certificate" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tr('set.terms')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
          </>
        ) : null}
      </Card>
        </>
      ) : null}

      {show('help') ? (
        <>
      {/* Master only, and it is the most destructive control in the app: on a
          syncing device it does not clear a handset, it clears the ship. Anyone
          who wants their own device empty has Sign off & erase, which leaves the
          vessel's copy alone. */}
      {isMaster ? (
        <TouchableOpacity style={[styles.resetBtn, wide && styles.btnCompact, wide && { alignSelf: 'center' }]} onPress={() => { setResetPw(''); setResetVisible(true); }} disabled={busy}>
          <Text style={styles.resetBtnText}>{tr('set.resetAll')}</Text>
        </TouchableOpacity>
      ) : null}
        </>
      ) : null}

      {!grp ? (
        <>
      <View style={styles.aboutBox}>
        <Image source={require('../assets/ismpilot-mark.png')} style={styles.footMark} resizeMode="contain" />
        <Text style={styles.about}>
          {APP_CONFIG.name} v{APP_CONFIG.version} · {APP_CONFIG.company} · {APP_CONFIG.year}
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(`https://${APP_CONFIG.website}`)} hitSlop={8}>
          <Text style={styles.website}>{APP_CONFIG.website}</Text>
        </TouchableOpacity>
      </View>

        </>
      ) : null}

      {/* Password-gated reset confirmation */}
      <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={closeReset}>
        <TouchableWithoutFeedback onPress={closeReset}>
          <View style={styles.modalOverlay}>
            {/* The inner touchable exists so a tap inside the box does not reach the
                overlay's close. On a phone it also hides the keyboard — but NOT on
                web: there `Keyboard.dismiss()` blurs whatever has focus, and since
                it fires on every click inside the box, it fired on the very click
                that put the cursor in the password field. The field could never
                hold focus, and Reset could not be typed at all. */}
            <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? () => {} : Keyboard.dismiss}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{tr('set.resetAll')}</Text>
            <Text style={styles.modalText}>
              {tr('set.resetBody')}
              {sync.status === 'synced' ? tr('set.resetSynced') : ''}
            </Text>
            <Text style={styles.modalText}>
              {tr('set.typePw1')}<Text style={{ fontWeight: '800' }}>{RESET_PASSWORD}</Text>{tr('set.typePw2')}
            </Text>
            <TextInput
              style={styles.input}
              value={resetPw}
              onChangeText={setResetPw}
              placeholder={tr('set.password')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderWidth: 1, borderColor: COLORS.border }]}
                onPress={closeReset}
              >
                <Text style={styles.modalBtnCancel}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.danger, opacity: resetPw.trim() === RESET_PASSWORD ? 1 : 0.5 }]}
                onPress={doReset}
                disabled={resetPw.trim() !== RESET_PASSWORD}
              >
                <Text style={styles.modalBtnConfirm}>{tr('set.deleteAll')}</Text>
              </TouchableOpacity>
            </View>
          </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </Screen>
  );
}

const fmtWhen = formatDateTime;

function FormField({
  label,
  value,
  onChange,
  keyboard,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  keyboard?: 'default' | 'number-pad';
}) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={{ marginBottom: SIZES.sm }}>
      <Label>{label}</Label>
      <TextInput
        style={styles.input}
        value={value ?? ''}
        onChangeText={onChange}
        keyboardType={keyboard ?? 'default'}
        placeholder="—"
        placeholderTextColor={COLORS.textLight}
      />
    </View>
  );
}

/** An item as a card of its own, inside a group page. */
const itemCard = (COLORS: Palette) => ({
  backgroundColor: COLORS.card, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.border,
  paddingHorizontal: SIZES.md, paddingVertical: SIZES.md, marginBottom: SIZES.sm,
});

const makeStyles = (COLORS: Palette, asCards = false) => StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  proPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: SIZES.sm,
  },
  proPillText: { color: '#FFFFFF', fontSize: SIZES.tiny, fontWeight: '800', letterSpacing: 0.8 },
  themeIcons: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: SIZES.xs },
  themeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  themeIconOn: { backgroundColor: COLORS.primary },
  input: {
    ...COLORS.glassInput,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
    marginTop: SIZES.sm,
  },
  primaryBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.body },
  // Roughly a quarter of a wide card, floored so the label never wraps.
  btnCompact: { alignSelf: 'flex-start', maxWidth: '25%', minWidth: 180, paddingHorizontal: SIZES.xl },
  sectionHead: asCards ? { display: 'none' } : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // What a collapsed card says about itself, on the right of its heading.
  sectionSummary: {
    flex: 1,
    textAlign: 'right',
    fontSize: SIZES.small,
    color: COLORS.textLight,
    marginRight: SIZES.sm,
  },
  sectionChev: { fontSize: SIZES.h5, color: COLORS.textLight, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm, ...(asCards ? itemCard(COLORS) : null) },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm, ...(asCards ? itemCard(COLORS) : null) },
  // Inside a group the card around the items goes; each item is the card.
  flatCard: { backgroundColor: 'transparent', borderWidth: 0, padding: 0, shadowOpacity: 0, elevation: 0 },
  tiles: { gap: SIZES.sm, marginBottom: SIZES.md },
  tilesWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, padding: SIZES.md, borderRadius: SIZES.radiusLg, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  tileWide: { width: '49.6%', minHeight: 84 },
  tileTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '700' },
  linkEmoji: { fontSize: 22 },
  linkTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '600' },
  linkSub: { fontSize: SIZES.small, color: COLORS.textLight },
  chev: { fontSize: SIZES.h3, color: COLORS.textLight },
  pwHint: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 4 },
  changePwHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SIZES.sm },
  changePwTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.primaryDark },
  connectBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.sm,
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  connectBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  devSection: { marginTop: SIZES.sm, marginBottom: SIZES.xs },
  devSectionTitle: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '700', textTransform: 'uppercase', marginBottom: SIZES.xs },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  devRowMe: {
    borderTopWidth: 0,
    borderWidth: 1.5,
    borderColor: COLORS.info,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.sm,
    marginVertical: 2,
  },
  devRowMaster: {
    borderTopWidth: 0,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.sm,
    marginVertical: 2,
  },
  devEmoji: { fontSize: 18 },
  devRename: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devRenameText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  devName: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
  devSub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
  devAction: { paddingHorizontal: SIZES.sm, paddingVertical: 6, borderRadius: SIZES.radiusSm },
  devActionText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.tiny },
  devMaster: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: 5,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  devMasterText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.tiny },
  takeoverBtn: {
    marginTop: SIZES.sm,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  takeoverText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  devRemove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devRemoveText: { color: COLORS.textWhite, fontSize: 13, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: SIZES.sm },
  syncBtn: { flex: 1, flexDirection: 'row', gap: SIZES.xs, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, alignItems: 'center', justifyContent: 'center' },
  syncBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.body },
  aboutBox: { alignItems: 'center', marginTop: SIZES.lg },
  footMark: { width: 72, height: 73, opacity: 0.35, marginBottom: SIZES.xs },
  about: { textAlign: 'center', color: COLORS.textLight, fontSize: SIZES.tiny },
  website: { textAlign: 'center', color: COLORS.primary, fontSize: SIZES.small, fontWeight: '700', marginTop: 4 },
  resetBtn: {
    marginTop: SIZES.xl,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: 'center',
  },
  resetBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.body },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SIZES.lg },
  modalBox: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: COLORS.cardSolid ?? '#fff',
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.danger, marginBottom: SIZES.sm },
  modalText: { fontSize: SIZES.small, color: COLORS.text, lineHeight: 19, marginBottom: SIZES.sm },
  modalBtnRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
  modalBtn: { flex: 1, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, alignItems: 'center' },
  modalBtnCancel: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.body },
  modalBtnConfirm: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.body },
});
