// ===================================
// Settings — vessel info, import, Firebase sync, about.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch, Modal, TouchableWithoutFeedback, Keyboard, Linking, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Card, Label, GlyphBadge } from '../components/ui';
import { SIZES, Palette, APP_CONFIG, THEME_ORDER, THEME_LABELS } from '../theme';
import { useTheme, useThemeName } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { VesselInfo, resetAllData } from '../services/storage';
import * as fb from '../services/firebaseService';
import { clearAttachmentsDir } from '../services/attachments';
import { exportTemplate } from '../services/export';
import { exportBackup, pickBackup, restoreBackup } from '../services/backup';
import { playSuccessSound, playErrorSound } from '../utils/sound';
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
  const [form, setForm] = useState<VesselInfo>({});
  const [busy, setBusy] = useState(false);

  // Cloud device state
  const [uid, setUid] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<fb.ApprovalStatus | null>(null);
  const [devices, setDevices] = useState<fb.ConnectedDevice[]>([]);
  const [pending, setPending] = useState<fb.PendingDevice[]>([]);
  const [devBusy, setDevBusy] = useState(false);
  const [connPassword, setConnPassword] = useState('');

  // Reset-all-data (password gated)
  const [resetVisible, setResetVisible] = useState(false);
  const [resetPw, setResetPw] = useState('');

  // Collapsible sections (open on tap).
  const [open, setOpen] = useState<Record<string, boolean>>({ vessel: true });

  // Auto-hide: collapse the info panels after 4s of inactivity (the Vessel form
  // is left open — it collapses on Save instead). Any tap/scroll resets the timer.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpActivity = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOpen((o) => ({ vessel: o.vessel }));
    }, 4000);
  };
  useEffect(() => {
    bumpActivity();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const toggleSection = (k: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, [k]: !o[k] }));
    bumpActivity();
  };

  useEffect(() => {
    if (vessel) setForm(vessel);
  }, [vessel]);

  useEffect(() => {
    fb.getSavedPassword().then((pw) => { if (pw) setConnPassword(pw); });
  }, []);

  const isMaster = myStatus === 'master';

  const refreshDevices = async (vesselUid: string) => {
    const [devs, pend] = await Promise.all([
      fb.getConnectedDevices(vesselUid),
      fb.getPendingDevices(vesselUid),
    ]);
    setDevices(devs);
    setPending(pend);
  };

  /** Sign in by IMO, register this device, and load the device lists. */
  const connect = async () => {
    if (!fb.isConfigured()) {
      Alert.alert('Firebase not configured', 'Add your Firebase web config in services/firebaseService.ts to enable cloud sync.');
      return;
    }
    if (!form.imo) {
      Alert.alert('IMO required', 'Enter the vessel IMO number first (used as the cloud account).');
      return;
    }
    if (connPassword.trim().length < fb.MIN_PASSWORD_LENGTH) {
      Alert.alert('Connection password required', `Enter a connection password of at least ${fb.MIN_PASSWORD_LENGTH} characters. The first device sets it; other devices must enter the same password.`);
      return;
    }
    setDevBusy(true);
    try {
      const vesselUid = await fb.signInVessel(form.imo, connPassword);
      await fb.savePassword(connPassword.trim());
      const status = await fb.registerDevice(vesselUid);
      setUid(vesselUid);
      setMyStatus(status);
      await refreshDevices(vesselUid);
      if (status === 'pending') {
        Alert.alert('Awaiting approval', 'This device is pending approval by the Master device. Ask the Master to approve it in Settings → Cloud sync.');
      } else if (status === 'master') {
        playSuccessSound();
        Alert.alert('Connected', 'This device is the Master for this vessel. You can approve other devices here.');
      } else {
        playSuccessSound();
        Alert.alert('Connected', 'This device is approved and can sync.');
      }
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Connection failed', String(e?.message ?? e));
    } finally {
      setDevBusy(false);
    }
  };

  const approve = async (deviceId: string) => {
    if (!uid) return;
    setDevBusy(true);
    try {
      await fb.approveDevice(uid, deviceId);
      playSuccessSound();
      await refreshDevices(uid);
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Approve failed', String(e?.message ?? e));
    } finally {
      setDevBusy(false);
    }
  };

  const reject = async (deviceId: string) => {
    if (!uid) return;
    setDevBusy(true);
    try {
      await fb.rejectDevice(uid, deviceId);
      await refreshDevices(uid);
    } catch (e: any) {
      Alert.alert('Reject failed', String(e?.message ?? e));
    } finally {
      setDevBusy(false);
    }
  };

  const revoke = (d: fb.ConnectedDevice) => {
    if (!uid) return;
    Alert.alert('Remove device', `Disconnect "${d.customName || d.platformLabel}"? It will need re-approval to reconnect.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDevBusy(true);
          try {
            await fb.removeDevice(uid, d.deviceId);
            await refreshDevices(uid);
          } catch (e: any) {
            Alert.alert('Remove failed', String(e?.message ?? e));
          } finally {
            setDevBusy(false);
          }
        },
      },
    ]);
  };

  // Master action: hand the Master role to another approved device.
  const makeMaster = (d: fb.ConnectedDevice) => {
    if (!uid) return;
    Alert.alert(
      'Transfer Master',
      `Make "${d.customName || d.platformLabel}" the Master? This device becomes a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Master',
          onPress: async () => {
            setDevBusy(true);
            try {
              await fb.transferMaster(uid, d.deviceId);
              setMyStatus('approved');
              await refreshDevices(uid);
              playSuccessSound();
            } catch (e: any) {
              playErrorSound();
              Alert.alert('Transfer failed', String(e?.message ?? e));
            } finally {
              setDevBusy(false);
            }
          },
        },
      ]
    );
  };

  // Take over the Master role on THIS device (e.g. the old Master is gone).
  const takeOverMaster = () => {
    if (!uid) return;
    Alert.alert(
      'Take over as Master',
      'Make THIS device the Master? Use this if the current Master device is lost or unavailable — it will be demoted to a member.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take over',
          style: 'destructive',
          onPress: async () => {
            setDevBusy(true);
            try {
              await fb.resetMaster(uid);
              setMyStatus('master');
              await refreshDevices(uid);
              playSuccessSound();
            } catch (e: any) {
              playErrorSound();
              Alert.alert('Take over failed', String(e?.message ?? e));
            } finally {
              setDevBusy(false);
            }
          },
        },
      ]
    );
  };

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
      if (!picked) return;
      const { backup, summary } = picked;
      Alert.alert(
        'Restore backup?',
        `This replaces ALL data on this device with:\n\n` +
          `• ${summary.items} items in ${summary.categories} categories\n` +
          `• ${summary.certificates} certificates\n` +
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
                playSuccessSound();
                Alert.alert('Restored', `${summary.items} items restored from backup.`);
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

  const sync = async (dir: 'push' | 'pull') => {
    if (!fb.isConfigured()) {
      Alert.alert(
        'Firebase not configured',
        'Add your Firebase web config in services/firebaseService.ts to enable cloud sync.'
      );
      return;
    }
    if (!form.imo) {
      Alert.alert('IMO required', 'Enter the vessel IMO number first (used as the cloud account).');
      return;
    }
    if (connPassword.trim().length < fb.MIN_PASSWORD_LENGTH) {
      Alert.alert('Connection password required', `Enter the vessel's connection password (at least ${fb.MIN_PASSWORD_LENGTH} characters) before syncing.`);
      return;
    }
    setBusy(true);
    try {
      const vesselUid = uid ?? (await fb.signInVessel(form.imo, connPassword));
      await fb.savePassword(connPassword.trim());
      const status = myStatus ?? (await fb.registerDevice(vesselUid));
      setUid(vesselUid);
      setMyStatus(status);
      if (status === 'pending') {
        await refreshDevices(vesselUid);
        Alert.alert('Awaiting approval', 'This device is pending approval by the Master device.');
        return;
      }
      if (dir === 'push') {
        const n = await fb.pushAll(vesselUid);
        playSuccessSound();
        Alert.alert('Synced', `Pushed ${n} items to the cloud.`);
      } else {
        const n = await fb.pullAll(vesselUid);
        await reload();
        playSuccessSound();
        Alert.alert('Synced', `Pulled ${n} items from the cloud.`);
      }
      await refreshDevices(vesselUid);
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Sync failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View onTouchStart={bumpActivity}>
      <ScreenTitle title="Settings" subtitle={`${flat.length} items on this device`} />

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
          </>
        ) : null}
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
            <Text style={styles.linkSub}>Items, certificates, vessel & attached files</Text>
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

      <Card>
        <TouchableOpacity style={styles.sectionHead} onPress={() => toggleSection('cloud')} activeOpacity={0.7}>
          <Label>Cloud sync</Label>
          <Text style={styles.sectionChev}>{open.cloud ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {open.cloud ? (
          <>
        <Text style={styles.syncStatus}>
          {!fb.isConfigured()
            ? '⚠️ Firebase not configured (local-only)'
            : myStatus === 'master'
            ? '👑 This device is the Master'
            : myStatus === 'approved'
            ? '✅ This device is approved'
            : myStatus === 'pending'
            ? '⏳ Pending approval by the Master'
            : '☁️ Firebase configured — tap Connect'}
        </Text>

        {/* Connection password — gates who can join the vessel */}
        {fb.isConfigured() ? (
          <View style={{ marginBottom: SIZES.sm }}>
            <Label>Connection password</Label>
            <TextInput
              style={styles.input}
              value={connPassword}
              onChangeText={setConnPassword}
              placeholder={`At least ${fb.MIN_PASSWORD_LENGTH} characters`}
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.pwHint}>The first device sets this. Other devices must enter the same password to join.</Text>
          </View>
        ) : null}

        {/* Connect / refresh */}
        {devBusy ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SIZES.sm }} />
        ) : (
          <TouchableOpacity style={styles.connectBtn} onPress={connect}>
            <Text style={styles.connectBtnText}>{uid ? '↻ Refresh devices' : '🔗 Connect this device'}</Text>
          </TouchableOpacity>
        )}

        {/* Pending approvals — only the Master can act */}
        {isMaster && pending.length > 0 ? (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>Pending approval ({pending.length})</Text>
            {pending.map((p) => (
              <View key={p.deviceId} style={styles.devRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.devName}>{p.platformLabel}{p.isThisDevice ? ' (this device)' : ''}</Text>
                  <Text style={styles.devSub}>{p.vesselName || '—'} · {fmtWhen(p.requestedAt)}</Text>
                </View>
                <TouchableOpacity style={[styles.devAction, { backgroundColor: COLORS.success }]} onPress={() => approve(p.deviceId)}>
                  <Text style={styles.devActionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.devAction, { backgroundColor: COLORS.danger }]} onPress={() => reject(p.deviceId)}>
                  <Text style={styles.devActionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {/* Connected devices */}
        {devices.length > 0 ? (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>Connected devices ({devices.length})</Text>
            {devices.map((d) => (
              <View key={d.deviceId} style={styles.devRow}>
                <GlyphBadge emoji={d.role === 'master' ? '👑' : '📱'} size={16} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.devName}>
                    {d.customName || d.platformLabel}{d.isThisDevice ? ' (this device)' : ''}
                  </Text>
                  <Text style={styles.devSub}>
                    {d.role === 'master' ? 'Master' : 'Member'} · {fmtWhen(d.lastSeen)}
                  </Text>
                </View>
                {isMaster && !d.isThisDevice && d.role !== 'master' ? (
                  <>
                    <TouchableOpacity style={styles.devMaster} onPress={() => makeMaster(d)} hitSlop={6}>
                      <Text style={styles.devMasterText}>👑 Make master</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.devRemove} onPress={() => revoke(d)} hitSlop={8}>
                      <Text style={styles.devRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            ))}
            {/* Take over Master from this device (e.g. the old Master is gone). */}
            {myStatus === 'approved' ? (
              <TouchableOpacity style={styles.takeoverBtn} onPress={takeOverMaster}>
                <Text style={styles.takeoverText}>👑 Take over as Master on this device</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Push / Pull */}
        {busy ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SIZES.md }} />
        ) : (
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.syncBtn, { backgroundColor: COLORS.primary }]} onPress={() => sync('push')}>
              <Text style={styles.syncBtnText}>⬆ Push</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.syncBtn, { backgroundColor: COLORS.secondary }]} onPress={() => sync('pull')}>
              <Text style={styles.syncBtnText}>⬇ Pull</Text>
            </TouchableOpacity>
          </View>
        )}
          </>
        ) : null}
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
      </View>
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
  devEmoji: { fontSize: 18 },
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
  syncBtn: { flex: 1, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, alignItems: 'center' },
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
