// ===================================
// Settings — vessel info, import, data, about.
//
// Joining a vessel and managing devices live on their OWN screens (Enrol,
// Accounts). This screen used to carry the whole of it — an IMO + connection
// password field, Connect, Push and Pull — and that path is gone: a device is
// enrolled by name + PIN and sync then runs by itself.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch, Modal, TouchableWithoutFeedback, Keyboard, Linking, Image, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Card, Label, GlyphBadge, Glyph } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { PhotoUploadCard } from '../components/PhotoUploadCard';
import { ConnectionCard } from '../components/ConnectionCard';
import { SIZES, Palette, APP_CONFIG, THEME_ORDER, THEME_LABELS } from '../theme';
import { useTheme, useThemeName } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { VesselInfo, resetAllData } from '../services/storage';
import * as fb from '../services/firebaseService';
import { clearAttachmentsDir } from '../services/attachments';
import { exportTemplate } from '../services/export';
import { exportBackup, pickBackup, restoreBackup } from '../services/backup';
import * as snapshot from '../services/snapshot';
import { isSubscribed, onEntitlementChange } from '../services/purchases';
import { playSuccessSound, playErrorSound } from '../utils/sound';
import { requestPermission, rescheduleExpiryReminders, cancelAll, notificationsSupported } from '../services/notifications';
import { formatDateTime } from '../utils/dates';

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

export default function SettingsSc() {
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { name: themeName, setTheme } = useThemeName();
  // A button that fills the line is right on a phone, where the line IS the
  // button's natural size. On the web build the card is over a metre of pixels
  // wide and the same rule turns "Save vessel info" into a banner, so past
  // tablet width the two full-bleed buttons shrink to their own size.
  const wide = useWindowDimensions().width >= 600;
  const { vessel, setVessel, reload, flat, prefs, setPrefs } = useData();
  const sync = useSync();
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
  const [busy, setBusy] = useState(false);
  const [snaps, setSnaps] = useState<snapshot.SnapshotInfo[]>([]);
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
  const [open, setOpen] = useState<Record<string, boolean>>({ vessel: true });
  const toggleSection = (k: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, [k]: !o[k] }));
  };

  const toggleNotifications = async (v: boolean) => {
    if (!v) {
      await setPrefs({ notificationsEnabled: false });
      await cancelAll();
      return;
    }
    if (!notificationsSupported()) {
      Alert.alert('Not available', 'Reminders need a development or production build (not available in Expo Go).');
      return;
    }
    const ok = await requestPermission();
    if (!ok) {
      Alert.alert('Permission needed', 'Allow notifications for Marine Safety Manager in system settings to receive expiry reminders.');
      return;
    }
    await setPrefs({ notificationsEnabled: true });
    const n = await rescheduleExpiryReminders(flat);
    playSuccessSound();
    Alert.alert(
      'Reminders on',
      n > 0
        ? `Scheduled ${n} upcoming reminder${n === 1 ? '' : 's'} (60 / 30 / 7 days before each date).`
        : 'Reminders enabled — they will be scheduled as items with dates are added.'
    );
  };

  useEffect(() => {
    if (vessel) setForm(vessel);
  }, [vessel]);

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
    const load = () => void snapshot.listSnapshots().then(setSnaps).catch(() => {});
    load();
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [busy, focused]);

  const downloadTemplate = async () => {
    try {
      await exportTemplate();
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Template failed', String(e?.message ?? e));
    }
  };

  const backupExport = async () => {
    setBusy(true);
    try {
      const s = await exportBackup(vessel ?? form);
      playSuccessSound();
      Alert.alert(
        'Backup created',
        `${s.items} items, ${s.certificates} certificates and ${s.files} file${s.files === 1 ? '' : 's'} saved to a .msm file.`
      );
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Backup failed', String(e?.message ?? e));
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
        'Restore backup?',
        (summary.fileName ? `Read ${summary.fileName}.\n\n` : '') +
          `This replaces ALL data on this device with:\n\n` +
          `• ${summary.items} items in ${summary.categories} categories\n` +
          `• ${summary.certificates} certificates\n` +
          `• ${summary.inspections} signed inspection${summary.inspections === 1 ? '' : 's'}\n` +
          `• ${summary.crew} crew member${summary.crew === 1 ? '' : 's'}\n` +
          `• ${summary.files} attached file${summary.files === 1 ? '' : 's'}\n` +
          (summary.vessel ? `• Vessel: ${summary.vessel}\n` : '') +
          `\nThis cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
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
                  'Restored',
                  `${summary.items} items restored from backup.\n\n` +
                    (shared
                      ? 'The vessel now holds this register — the other devices on board will pick it up.'
                      : 'This device only: it is not currently syncing, so the vessel still holds its own copy.')
                );
              } catch (e: any) {
                playErrorSound();
                Alert.alert('Restore failed', String(e?.message ?? e));
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Restore failed', String(e?.message ?? e));
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
  const restoreSnapshot = () => {
    if (!snaps.length) {
      Alert.alert(
        'Nothing to roll back to',
        'A snapshot is saved automatically each time the app opens, once there is something to save. ' +
          'The first one will be there next time you open the app.'
      );
      return;
    }
    const newest = snaps[0];
    const reaches = isMaster
      ? 'Anything entered since is lost, and on a syncing device the roll-back reaches the vessel too.'
      : "Anything entered since is lost ON THIS DEVICE. The vessel's register is not changed — " +
        'this repairs the handset in your hand, and the next sync reconciles it with the ship. ' +
        'Ask the Master if the vessel\'s own copy is the problem.';
    Alert.alert(
      `Roll back to ${formatDateTime(newest.at)}?`,
      `Everything on this device goes back to how it was then: ${newest.items} items, ` +
        `${newest.certificates} certificates, ${newest.inspections} inspections, ${newest.crew} crew.\n\n` +
        reaches +
        '\n\nPhotographs and documents are not part of a snapshot — the files on this device ' +
        'stay where they are and remain linked.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...snaps.map((s, i) => ({
          text: i === 0 ? 'Roll back' : `Older · ${formatDateTime(s.at)} (${s.items})`,
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
                'Rolled back',
                `${done.items} items, ${done.inspections} inspections and ${done.crew} crew from ` +
                  `${formatDateTime(done.at)}.\n\n` +
                  (isMaster
                    ? shared
                      ? 'The vessel now holds this register.'
                      : 'This device only — it is not currently syncing.'
                    : "This device only. The vessel's register is unchanged.")
              );
            } catch (e: any) {
              playErrorSound();
              Alert.alert('Could not restore', e?.message ?? String(e));
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
      Alert.alert('Incorrect password', 'The data was NOT reset.');
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
          'This erases the whole vessel',
          'This device is syncing, so clearing it here clears the register on the vessel and on ' +
            "every other device aboard — not just this one.\n\nTo clear only this handset, " +
            'leave the vessel first: the “This device” card in Settings → Sign off & erase.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Erase everywhere', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
      if (!go) return;
    }
    setBusy(true);
    try {
      await resetAllData();
      await clearAttachmentsDir();
      // The snapshots hold the register that was just erased. Leaving them would
      // make "delete everything" untrue.
      await snapshot.clearSnapshots();
      setSnaps([]);
      await reload();
      setForm({});
      playSuccessSound();
      Alert.alert('Data reset', 'All equipment, certificates, compressor logs, attached files and vessel info were removed.');
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Reset failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const saveVesselInfo = async () => {
    const required: (keyof VesselInfo)[] = ['vessel_name', 'imo', 'flag', 'call_sign', 'mmsi'];
    if (required.some((k) => !String(form[k] ?? '').trim())) {
      playErrorSound();
      Alert.alert('All fields required', 'Please fill in every vessel field before saving.');
      return;
    }
    if (!/^\d{7}$/.test(String(form.imo).trim())) {
      playErrorSound();
      Alert.alert('Invalid IMO', 'IMO number must be exactly 7 digits.');
      return;
    }
    if (!/^\d{9}$/.test(String(form.mmsi).trim())) {
      playErrorSound();
      Alert.alert('Invalid MMSI', 'MMSI must be exactly 9 digits.');
      return;
    }
    await setVessel(form);
    playSuccessSound();
    // Collapse the card like the other sections once saved.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, vessel: false }));
    Alert.alert('Saved', 'Vessel info updated.');
  };

  return (
    <Screen scroll>
      {/* The theme lives in the header now, not in a card of its own. It was a
          panel at the top of Settings that a person reads once and never again —
          the appearance of the app is not a setting you go looking for, it is one
          you flick. Three marks say it without a word: sun, moon, star. */}
      <ScreenTitle
        title="Settings"
        subtitle={`${flat.length} items on this device`}
        help={0}
        actions={
          <View style={styles.headerActions}>
            {/* PRO, as a badge rather than a card. Green when the vessel is
                licensed, blue when it is not — the state is the whole message,
                and a card three lines long was spending the top of the screen to
                say it. Still opens the same screen. */}
            <TouchableOpacity
              onPress={() => nav.navigate('Paywall')}
              hitSlop={8}
              accessibilityLabel={pro ? 'MSM Pro is active' : 'Get MSM Pro'}
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
                accessibilityLabel={THEME_LABELS[t]}
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

      <ConnectionCard />

      <Card>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('vessel')} activeOpacity={0.7}>
          <Label>Vessel</Label>
          <Text style={styles.sectionChev}>{open.vessel ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {open.vessel ? (
          <>
        <FormField label="Vessel name" value={form.vessel_name} onChange={(v) => setForm({ ...form, vessel_name: v })} />
        <FormField label="IMO number" value={form.imo} onChange={(v) => setForm({ ...form, imo: v })} keyboard="number-pad" />
        <FormField label="Flag" value={form.flag} onChange={(v) => setForm({ ...form, flag: v })} />
        <FormField label="Call sign" value={form.call_sign} onChange={(v) => setForm({ ...form, call_sign: v })} />
        <FormField label="MMSI" value={form.mmsi} onChange={(v) => setForm({ ...form, mmsi: v })} keyboard="number-pad" />
        <TouchableOpacity style={[styles.primaryBtn, wide && styles.btnCompact]} onPress={saveVesselInfo}>
          <Text style={styles.primaryBtnText}>Save vessel info</Text>
        </TouchableOpacity>

          </>
        ) : null}
      </Card>

      <PhotoUploadCard />

      {/* Crew and accounts — both Master-only, so the whole card is. Defects
          moved to the Dashboard: an open defect is work waiting, and work
          waiting belongs where the officer already looks, not filed under
          Settings behind the crew list. */}
      {sync.role === 'superadmin' ? (
      <Card>
        <Label>Crew &amp; accounts</Label>
        {/* Master only. The crew list is a MANAGEMENT screen — for anyone else it
            is a page with nothing to do on it, and often nothing on it at all,
            since a vessel that adds its signers from enrolled people keeps the
            list short. Signing does not go through here: the picker inside an
            inspection reads the same list, and every rank still signs. */}
        {sync.role === 'superadmin' ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Crew')}>
            <GlyphBadge emoji="👥" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Crew</Text>
              <Text style={styles.linkSub}>Who can sign an inspection</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {/* Issuing accounts is the Master's, so only a Master is offered it. The
            row used to be shown to everyone with "(Master only)" in the subtitle,
            which put a door in front of the crew and a notice on it saying the
            door is not theirs. A member who wants the read-only roster can still
            reach /accounts by URL, where the screen explains itself. */}
        {sync.role === 'superadmin' ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Accounts')}>
            <GlyphBadge emoji="🔑" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Accounts</Text>
              <Text style={styles.linkSub}>Issue a name + PIN; approve devices and set ranks</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
      ) : null}

      {/* Shown to EVERY rank, unlike Crew and Accounts above. Those are management
          screens with nothing on them for a crew member; this one answers a
          question anybody about to do a round has — what am I going to be asked?
          Editing is gated inside the screen (and by firestore.rules), so the door
          is not being held open on something that will refuse them. */}
      <Card>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('CategoriesEdit')}>
          <GlyphBadge emoji="🗂️" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Categories</Text>
            <Text style={styles.linkSub}>Headings of your own, on top of the 23 built in</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Checklists')}>
          <GlyphBadge emoji="📋" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Checklists</Text>
            <Text style={styles.linkSub}>
              {sync.role === 'admin' || sync.role === 'superadmin'
                ? 'What each round asks — word them for this vessel'
                : 'What each round asks'}
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      </Card>

      {canHandleData ? (
      <Card>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('data')} activeOpacity={0.7}>
          <Label>Data</Label>
          <Text style={styles.sectionChev}>{open.data ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {open.data ? (
          <>
        <TouchableOpacity style={styles.linkRow} onPress={downloadTemplate}>
          <GlyphBadge emoji="⬇️" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Download import template</Text>
            <Text style={styles.linkSub}>Blank .xlsx — one sheet per category</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Import')}>
          <GlyphBadge emoji="📥" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Import from Excel</Text>
            <Text style={styles.linkSub}>Load the LSA / FFE Inventories workbook</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={backupExport} disabled={busy}>
          <GlyphBadge emoji="💾" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Export backup (.msm)</Text>
            <Text style={styles.linkSub}>Items, certificates, inspections, crew & attached files</Text>
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
            <GlyphBadge emoji="🕗" size={18} />
            <View style={{ flex: 1 }}>
              {/* The DATE is the offer. "Restore a snapshot" makes a person open
                  the dialog to find out whether it is worth anything; the moment
                  it would take them back to answers that on the row itself. */}
              <Text style={styles.linkTitle}>
                {snaps.length ? `Roll back to ${formatDateTime(snaps[0].at)}` : 'Nothing to roll back to yet'}
              </Text>
              <Text style={styles.linkSub}>
                {snaps.length
                  ? `${snaps[0].items} items, ${snaps[0].inspections} inspections · saved when the app opened`
                  : 'A snapshot is saved automatically each time the app opens'}
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
            <GlyphBadge emoji="♻️" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Restore backup (.msm)</Text>
              <Text style={styles.linkSub}>Replace all data from a .msm file</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
          </>
        ) : null}
      </Card>
      ) : null}

      <Card>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('modules')} activeOpacity={0.7}>
          <Label>Modules</Label>
          <Text style={styles.sectionChev}>{open.modules ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {open.modules ? (
          <>
        <View style={styles.toggleRow}>
          <GlyphBadge emoji="🔔" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Expiry reminders</Text>
            <Text style={styles.linkSub}>Notify 60 / 30 / 7 days before inspection or expiry</Text>
          </View>
          <Switch
            value={!!prefs.notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <GlyphBadge emoji="⏱️" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>BA Compressor log</Text>
            <Text style={styles.linkSub}>Running-time counter & maintenance (FIFI outfit)</Text>
          </View>
          <Switch
            value={!!prefs.compressorEnabled}
            onValueChange={(v) => setPrefs({ compressorEnabled: v })}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
          />
        </View>
        {prefs.compressorEnabled ? (
          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Compressor')}>
            <GlyphBadge emoji="📈" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Open compressor log</Text>
              <Text style={styles.linkSub}>Also available from the FIFI / BA category</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
          </>
        ) : null}
      </Card>

      <Card>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('help')} activeOpacity={0.7}>
          <Label>Help</Label>
          <Text style={styles.sectionChev}>{open.help ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {open.help ? (
          <>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Manual')}>
          <GlyphBadge emoji="📖" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>User Manual</Text>
            <Text style={styles.linkSub}>How to use the app</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Legal', { doc: 'privacy' })}>
          <GlyphBadge emoji="🔒" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Privacy Policy</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Legal', { doc: 'terms' })}>
          <GlyphBadge emoji="📜" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Terms of Use</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
          </>
        ) : null}
      </Card>


      {/* Master only, and it is the most destructive control in the app: on a
          syncing device it does not clear a handset, it clears the ship. Anyone
          who wants their own device empty has Sign off & erase, which leaves the
          vessel's copy alone. */}
      {isMaster ? (
        <TouchableOpacity style={[styles.resetBtn, wide && styles.btnCompact, wide && { alignSelf: 'center' }]} onPress={() => { setResetPw(''); setResetVisible(true); }} disabled={busy}>
          <Text style={styles.resetBtnText}>Reset all data</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.aboutBox}>
        <Image source={require('../assets/octopus.png')} style={styles.octopus} resizeMode="contain" />
        <Text style={styles.about}>
          {APP_CONFIG.name} v{APP_CONFIG.version} · {APP_CONFIG.company} · {APP_CONFIG.year}
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(`https://${APP_CONFIG.website}`)} hitSlop={8}>
          <Text style={styles.website}>{APP_CONFIG.website}</Text>
        </TouchableOpacity>
      </View>

      {/* Password-gated reset confirmation */}
      <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={closeReset}>
        <TouchableWithoutFeedback onPress={closeReset}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reset all data</Text>
            <Text style={styles.modalText}>
              This permanently deletes every equipment item, certificate, compressor log, attached file and the
              vessel info on this device. This cannot be undone.
              {sync.status === 'synced' ? ' While this device is syncing it clears the vessel and every other device aboard as well.' : ''}
            </Text>
            <Text style={styles.modalText}>
              Type the password <Text style={{ fontWeight: '800' }}>Reset all data</Text> to confirm.
            </Text>
            <TextInput
              style={styles.input}
              value={resetPw}
              onChangeText={setResetPw}
              placeholder="Password"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderWidth: 1, borderColor: COLORS.border }]}
                onPress={closeReset}
              >
                <Text style={styles.modalBtnCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.danger, opacity: resetPw.trim() === RESET_PASSWORD ? 1 : 0.5 }]}
                onPress={doReset}
                disabled={resetPw.trim() !== RESET_PASSWORD}
              >
                <Text style={styles.modalBtnConfirm}>Delete everything</Text>
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

const makeStyles = (COLORS: Palette) => StyleSheet.create({
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionChev: { fontSize: SIZES.h5, color: COLORS.textLight, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
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
  octopus: { width: 96, height: 96, opacity: 0.18, marginBottom: SIZES.xs },
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
