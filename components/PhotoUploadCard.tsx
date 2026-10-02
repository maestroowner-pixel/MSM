// ===================================
// Photo upload — the policy, and what is still waiting.
//
// Shown in Settings because it is a standing decision about the vessel's
// airtime, not a per-round choice. The pending count is the part that matters
// operationally: "3 photos waiting for Wi-Fi" is the difference between a crew
// that trusts the feature and one that quietly assumes it is broken.
// ===================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import * as photoQueue from '../services/photoQueue';
import { RETENTION_DAYS, photosAwaitingArchive } from '../services/photoArchive';
import { uploadAllowance, FREE_UPLOADS_PER_VESSEL } from '../services/trial';
import { uploadsUsedFor } from '../services/firebaseService';

const POLICIES: photoQueue.UploadPolicy[] = ['wifi', 'always', 'never'];

export function PhotoUploadCard() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { prefs, setPrefs, vessel, inspections: trail, photoArchive } = useData();
  /**
   * Photographs past the 90-day window that the vessel has not archived — the
   * ones whose only copies are the cloud and whichever handset took them. The
   * number is the whole reason the row is here: the retention rule is easy to
   * agree to and easy to forget, and forgetting it costs evidence.
   */
  const awaitingArchive = useMemo(
    () => photosAwaitingArchive(trail, photoArchive),
    [trail, photoArchive]
  );
  const policy = prefs.photoUpload ?? 'wifi';

  const [waiting, setWaiting] = useState(0);
  const [busy, setBusy] = useState(false);
  /**
   * How much of the vessel's free upload allowance is left, or null once
   * licensed. Shown because otherwise a crew member watches photographs sit in
   * the queue and has no way to learn why — the cause is a limit, not a bad
   * connection, and the two need completely different things from them.
   */
  const [left, setLeft] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setWaiting(await photoQueue.pendingCount());
    try {
      const imo = (vessel?.imo ?? '').replace(/\D/g, '');
      const used = imo ? await uploadsUsedFor(imo) : 0;
      const allowance = await uploadAllowance(used);
      setLeft(Number.isFinite(allowance) ? allowance : null);
    } catch {
      setLeft(null);
    }
  }, [vessel?.imo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uploadNow = async () => {
    setBusy(true);
    try {
      // 'always' on purpose: the user has just pressed a button that says do it
      // now, which is a clearer instruction than the standing policy.
      const res = await photoQueue.flush('always');
      await refresh();
      if (res.skipped === 'empty') Alert.alert('Nothing waiting', 'Every photo has been uploaded.');
      else if (res.skipped === 'offline') Alert.alert('No connection', 'Try again once the vessel is online.');
      else {
        Alert.alert(
          'Upload finished',
          `${res.uploaded} sent${res.remaining ? `, ${res.remaining} still waiting` : ''}.`
        );
      }
    } catch (e: any) {
      Alert.alert('Upload failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Label>Inspection photos</Label>
      <Text style={styles.note}>
        Records sync the moment they are signed. Photographs are larger, so they wait for a
        connection worth spending — at sea that bill is the vessel's, not ours.
      </Text>

      <View style={styles.row}>
        {POLICIES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, policy === p && styles.chipOn]}
            onPress={() => void setPrefs({ photoUpload: p })}
          >
            <Text style={[styles.chipText, policy === p && styles.chipTextOn]}>
              {photoQueue.POLICY_LABEL[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>{photoQueue.POLICY_HINT[policy]}</Text>

      <View style={styles.statusRow}>
        <MciIcon
          name={waiting ? 'cloud-upload-outline' : 'cloud-check-outline'}
          size={18}
          color={waiting ? COLORS.warning : COLORS.success}
        />
        <Text style={styles.status}>
          {waiting ? `${waiting} photo${waiting === 1 ? '' : 's'} waiting` : 'Nothing waiting'}
        </Text>
        {waiting && left !== 0 ? (
          <TouchableOpacity onPress={uploadNow} disabled={busy} hitSlop={8}>
            <Text style={[styles.action, busy && { opacity: 0.4 }]}>Upload now</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* The allowance, and only while there is one. A licensed vessel is not
          told about a limit it does not have. */}
      {left !== null ? (
        <Text style={[styles.note, left === 0 && { color: COLORS.warning }]}>
          {left > 0
            ? `${left} of ${FREE_UPLOADS_PER_VESSEL} free uploads left on this vessel. Photographs are ` +
              'kept on the device that took them either way — the licence is what sends them to the crew.'
            : `This vessel has used all ${FREE_UPLOADS_PER_VESSEL} free uploads. Photographs are still ` +
              'taken and kept here, and everything waiting goes up on the first sync after the vessel is licensed.'}
        </Text>
      ) : null}

      {/* The archive, from where the photographs are. A row rather than a
          separate card in Settings: "how photos leave the ship" and "how long
          they stay off it" are one subject, and splitting them is how a vessel
          ends up with a bucket nobody has ever archived. */}
      <TouchableOpacity style={styles.archiveRow} onPress={() => nav.navigate('PhotoArchive')}>
        <MciIcon
          name={awaitingArchive ? 'archive-alert-outline' : 'archive-check-outline'}
          size={18}
          color={awaitingArchive ? COLORS.warning : COLORS.textLight}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.archiveTitle}>Photo archive</Text>
          <Text style={styles.note}>
            {awaitingArchive
              ? `${awaitingArchive} photograph${awaitingArchive === 1 ? '' : 's'} older than ` +
                `${RETENTION_DAYS} days are not archived yet`
              : `Cloud storage keeps photographs for ${RETENTION_DAYS} days; older ones are kept by the vessel`}
          </Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>
    </Card>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    archiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      marginTop: SIZES.md,
      paddingTop: SIZES.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
    },
    archiveTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '600' },
    chev: { fontSize: SIZES.h5, color: COLORS.textLight, fontWeight: '700' },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    row: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
    chip: {
      flex: 1,
      paddingVertical: SIZES.sm,
      borderRadius: SIZES.radiusMd,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSolid,
    },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.text },
    chipTextOn: { color: COLORS.textWhite },
    hint: { color: COLORS.textLight, fontSize: SIZES.tiny, paddingTop: SIZES.sm, lineHeight: 15 },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      paddingTop: SIZES.md,
      marginTop: SIZES.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
    },
    status: { flex: 1, fontSize: SIZES.small, color: COLORS.text },
    action: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
