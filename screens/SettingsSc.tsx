// ===================================
// Settings — vessel info, import, Firebase sync, about.
// ===================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Card, Label } from '../components/ui';
import { COLORS, SIZES, GLASS, APP_CONFIG } from '../theme';
import { useData } from '../contexts/DataContext';
import { VesselInfo } from '../services/storage';
import * as fb from '../services/firebaseService';
import { playSuccessSound, playErrorSound } from '../utils/sound';

export default function SettingsSc() {
  const nav = useNavigation<any>();
  const { vessel, setVessel, reload, flat } = useData();
  const [form, setForm] = useState<VesselInfo>({});
  const [busy, setBusy] = useState(false);

  // Cloud device state
  const [uid, setUid] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<fb.ApprovalStatus | null>(null);
  const [devices, setDevices] = useState<fb.ConnectedDevice[]>([]);
  const [pending, setPending] = useState<fb.PendingDevice[]>([]);
  const [devBusy, setDevBusy] = useState(false);
  const [connPassword, setConnPassword] = useState('');

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

  const saveVesselInfo = async () => {
    await setVessel(form);
    playSuccessSound();
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
      <ScreenTitle title="Settings" subtitle={`${flat.length} items on this device`} />

      <Card>
        <Label>Vessel</Label>
        <FormField label="Vessel name" value={form.vessel_name} onChange={(v) => setForm({ ...form, vessel_name: v })} />
        <FormField label="IMO number" value={form.imo} onChange={(v) => setForm({ ...form, imo: v })} keyboard="number-pad" />
        <FormField label="Flag" value={form.flag} onChange={(v) => setForm({ ...form, flag: v })} />
        <FormField label="Call sign" value={form.call_sign} onChange={(v) => setForm({ ...form, call_sign: v })} />
        <FormField label="MMSI" value={form.mmsi} onChange={(v) => setForm({ ...form, mmsi: v })} keyboard="number-pad" />
        <TouchableOpacity style={styles.primaryBtn} onPress={saveVesselInfo}>
          <Text style={styles.primaryBtnText}>Save vessel info</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <Label>Data</Label>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Import')}>
          <Text style={styles.linkEmoji}>📥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Import from Excel</Text>
            <Text style={styles.linkSub}>Load the LSA / FFE Inventories workbook</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Reports')}>
          <Text style={styles.linkEmoji}>📤</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Export reports</Text>
            <Text style={styles.linkSub}>PDF / XLSX register</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <Label>Help</Label>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Manual')}>
          <Text style={styles.linkEmoji}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>User Manual</Text>
            <Text style={styles.linkSub}>How to use the app</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Legal', { doc: 'privacy' })}>
          <Text style={styles.linkEmoji}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Privacy Policy</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Legal', { doc: 'terms' })}>
          <Text style={styles.linkEmoji}>📜</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Terms of Use</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <Label>Cloud sync</Label>
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
                <Text style={styles.devEmoji}>{d.role === 'master' ? '👑' : '📱'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.devName}>
                    {d.customName || d.platformLabel}{d.isThisDevice ? ' (this device)' : ''}
                  </Text>
                  <Text style={styles.devSub}>
                    {d.role === 'master' ? 'Master' : 'Member'} · {fmtWhen(d.lastSeen)}
                  </Text>
                </View>
                {isMaster && !d.isThisDevice && d.role !== 'master' ? (
                  <TouchableOpacity style={styles.devRemove} onPress={() => revoke(d)} hitSlop={8}>
                    <Text style={styles.devRemoveText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
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
      </Card>

      <Text style={styles.about}>
        {APP_CONFIG.name} v{APP_CONFIG.version} · {APP_CONFIG.company} · {APP_CONFIG.year}
      </Text>
    </Screen>
  );
}

function fmtWhen(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

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

const styles = StyleSheet.create({
  input: {
    ...GLASS.input,
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
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
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
  about: { textAlign: 'center', color: COLORS.textLight, fontSize: SIZES.tiny, marginTop: SIZES.lg },
});
