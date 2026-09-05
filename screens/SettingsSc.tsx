// ===================================
// Settings — vessel info, import, data, about.
//
// Joining a vessel and managing devices live on their OWN screens (Enrol,
// Accounts). This screen used to carry the whole of it — an IMO + connection
// password field, Connect, Push and Pull — and that path is gone: a device is
// enrolled by name + PIN and sync then runs by itself.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch, Modal, TouchableWithoutFeedback, Keyboard, Linking, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Card, Label, GlyphBadge, Glyph } from '../components/ui';
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
import { playSuccessSound, playErrorSound } from '../utils/sound';
import { requestPermission, rescheduleExpiryReminders, cancelAll, notificationsSupported } from '../services/notifications';
import { formatDateTime } from '../utils/dates';

const RESET_PASSWORD = 'Reset all data';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsSc() {
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { name: themeName, setTheme } = useThemeName();
  const { vessel, setVessel, reload, flat, prefs, setPrefs } = useData();
  const sync = useSync();
  const [form, setForm] = useState<VesselInfo>({});
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await resetAllData();
      await clearAttachmentsDir();
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
      <ScreenTitle title="Settings" subtitle={`${flat.length} items on this device`} help={0} />

      <Card>
        <Label>Appearance</Label>
        <View style={styles.themeRow}>
          {THEME_ORDER.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.themeChip, themeName === t && styles.themeChipOn]}
              onPress={() => setTheme(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeChipText, themeName === t && styles.themeChipTextOn]}>{THEME_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <TouchableOpacity activeOpacity={0.85} onPress={() => nav.navigate('Paywall')}>
        <Card>
          <View style={styles.proRow}>
            <GlyphBadge emoji="⚓" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.proTitle}>{APP_CONFIG.name} Pro</Text>
              <Text style={styles.proSub}>2 months free, then yearly — unlock everything</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

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
        <TouchableOpacity style={styles.primaryBtn} onPress={saveVesselInfo}>
          <Text style={styles.primaryBtnText}>Save vessel info</Text>
        </TouchableOpacity>

        {/* Joining belongs HERE, under the ship's own details and last in them:
            the IMO above is what a device joins, so the two questions are one
            sequence read top to bottom. It used to sit among the inspection
            links, where it read as another weekly task rather than as the last
            step of naming the vessel.

            Once the device is aboard the same row stops inviting and starts
            reporting — the screen behind it does the same. */}
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Enrol')}>
          <GlyphBadge emoji="📱" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>
              {sync.enrolled ? 'This device' : 'Join this vessel'}
            </Text>
            <Text style={styles.linkSub}>
              {sync.enrolled
                ? 'Who it signs as, and how to sign off'
                : 'Enrol this device with the name and PIN you were given'}
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
          </>
        ) : null}
      </Card>

      <PhotoUploadCard />

      {/* Inspections — the crew list and the defect log. Above Data because
          these are used weekly; an import or a backup is a once-a-voyage job. */}
      <Card>
        <Label>Inspections</Label>
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
            door is not theirs. The read-only view of who is aboard stays
            available to all, lower down under Cloud sync. */}
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
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Defects')}>
          <GlyphBadge emoji="🛠️" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Defects</Text>
            <Text style={styles.linkSub}>Everything raised and still outstanding</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      </Card>

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
        <TouchableOpacity style={styles.linkRow} onPress={backupImport} disabled={busy}>
          <GlyphBadge emoji="♻️" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Restore backup (.msm)</Text>
            <Text style={styles.linkSub}>Replace all data from a .msm file</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
          </>
        ) : null}
      </Card>

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

      {/* The old "Cloud sync" panel — connection password, Connect, Push and Pull
          — is gone. It described a model the app no longer has, and it was worse
          than clutter: the field invited people to paste the vessel SETUP CODE
          into a password box that means something else entirely, and Push/Pull
          implied sync waits to be asked when it has been continuous since the
          move to Firestore.
          What replaced it: the card at the top of Settings says where this device
          stands, and Accounts holds devices, approvals and roles. */}
      <Card>
        <Label>Cloud sync</Label>
        <Text style={styles.syncStatus}>
          Sync runs by itself once this device has joined the vessel — records reach the crew's
          other devices within seconds. There is nothing to push or pull.
        </Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Accounts')}>
          <GlyphBadge emoji="🔑" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Devices &amp; approvals</Text>
            <Text style={styles.linkSub}>Who is connected, and who is waiting</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      </Card>

      <TouchableOpacity style={styles.resetBtn} onPress={() => { setResetPw(''); setResetVisible(true); }} disabled={busy}>
        <Text style={styles.resetBtnText}>Reset all data</Text>
      </TouchableOpacity>

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
  themeRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
  themeChip: {
    flex: 1,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSolid,
    alignItems: 'center',
  },
  themeChipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  themeChipText: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.text },
  themeChipTextOn: { color: COLORS.textWhite },
  proRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  proTitle: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.primaryDark },
  proSub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionChev: { fontSize: SIZES.h5, color: COLORS.textLight, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
  linkEmoji: { fontSize: 22 },
  linkTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '600' },
  linkSub: { fontSize: SIZES.small, color: COLORS.textLight },
  chev: { fontSize: SIZES.h3, color: COLORS.textLight },
  syncStatus: { fontSize: SIZES.small, color: COLORS.textLight, marginVertical: SIZES.sm },
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
