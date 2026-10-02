// ===================================
// Photo archive — the vessel's own copy of evidence older than 90 days.
//
// The shape of this screen follows the one fact that matters: the app cannot see
// where a saved file went. It can build the ZIP and hand it over; whether that
// landed on the ship's server, a memory stick or the Downloads folder of a
// laptop going ashore tomorrow is a human matter. So the flow is deliberately
// two steps — SAVE, then CONFIRM — and the confirmation is worded as what it
// actually authorises: the sweep deleting those photographs from the cloud.
//
// Months are archived in order and one at a time, because `archivedThrough` is a
// single watermark (services/photoArchive.ts `canMarkArchived`). Marking October
// while September is unsaved would hand the sweep permission it must not have.
//
// Master-only for the confirmation, everyone may read and save. Saving a copy of
// the vessel's own evidence is not a privileged act; saying "it is safe to delete
// the originals" is.
// ===================================

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import {
  ArchiveMonth,
  RETENTION_DAYS,
  archivedThroughFor,
  canMarkArchived,
  monthsToArchive,
  photosAwaitingArchive,
  photosInWindow,
} from '../services/photoArchive';
import { exportMonthArchive } from '../services/photoArchiveExport';
import { writePhotoArchive } from '../services/policy';
import { formatDate } from '../utils/dates';
import { onWindows } from '../utils/fileShare';

function mb(bytes: number): string {
  const m = bytes / (1024 * 1024);
  return m >= 1024 ? `≈ ${(m / 1024).toFixed(1)} GB` : `≈ ${Math.round(m)} MB`;
}

export default function PhotoArchiveSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { inspections: trail, flat, vessel, photoArchive, setPhotoArchive } = useData();
  const sync = useSync();

  const solo = !sync.enrolled;
  const isMaster = solo || sync.role === 'superadmin';

  const months = useMemo(() => monthsToArchive(trail, photoArchive), [trail, photoArchive]);
  const inCloud = useMemo(() => photosInWindow(trail), [trail]);
  const waiting = useMemo(() => photosAwaitingArchive(trail, photoArchive), [trail, photoArchive]);

  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const markArchived = async (month: ArchiveMonth) => {
    const { error } = await writePhotoArchive(
      photoArchive,
      { archivedThrough: archivedThroughFor(month, photoArchive) },
      setPhotoArchive,
      { synced: sync.status === 'synced', isMaster: sync.role === 'superadmin' }
    );
    if (error) {
      Alert.alert(
        'Saved on this device only',
        `The vessel did not accept it: ${error}. It will be sent again when this device reconnects, ` +
          'and nothing is deleted until it arrives.'
      );
    }
  };

  const save = async (month: ArchiveMonth) => {
    setBusy(month.key);
    setProgress({ done: 0, total: month.photos });
    try {
      const res = await exportMonthArchive(month, trail, flat, vessel, setProgress);
      const mayMark = isMaster && canMarkArchived(months, month);
      Alert.alert(
        `${month.label} — ${res.photos} photograph${res.photos === 1 ? '' : 's'} saved`,
        `${res.fileName}` +
          (res.missing
            ? `\n\n${res.missing} could not be found on any device or in the cloud. They are listed in index.csv as NOT FOUND — there is nothing left to save for them.`
            : '') +
          (mayMark
            ? '\n\nKeep this file where the ship keeps its records. Once you confirm, the photographs from ' +
              `${month.label} may be deleted from cloud storage — this archive and whatever is on the crew's own devices become the only copies.`
            : ''),
        mayMark
          ? [
              { text: 'Not yet', style: 'cancel' },
              { text: 'Saved — mark archived', onPress: () => void markArchived(month) },
            ]
          : [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Could not build the archive', String(e?.message ?? e));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const archivedThrough = photoArchive.archivedThrough;

  return (
    <Screen>
      <ScreenTitle
        title="Photo archive"
        subtitle={`Cloud storage keeps inspection photographs for ${RETENTION_DAYS} days`}
      />

      <Card>
        <Label>How this works</Label>
        <Text style={styles.note}>
          A photograph stays in the vessel's cloud storage for {RETENTION_DAYS} days, so any device
          aboard can see it. After that it is the vessel's to keep: save the month's archive here,
          confirm it, and those photographs are cleared from the cloud overnight. Nothing is ever
          deleted from a period you have not confirmed — and nothing is deleted from the phones and
          tablets themselves.
        </Text>
        <Text style={styles.note}>
          The signed records — who inspected what, when, and the result — are never touched by any
          of this. They stay in the app, in the reports and in the .msm backup. This is the
          photographs only.
        </Text>
      </Card>

      <Card>
        <View style={styles.statRow}>
          <MciIcon name="cloud-check-outline" size={18} color={COLORS.success} />
          <Text style={styles.stat}>
            {inCloud} photograph{inCloud === 1 ? '' : 's'} inside the {RETENTION_DAYS}-day window
          </Text>
        </View>
        <View style={styles.statRow}>
          <MciIcon
            name={waiting ? 'archive-alert-outline' : 'archive-check-outline'}
            size={18}
            color={waiting ? COLORS.warning : COLORS.success}
          />
          <Text style={styles.stat}>
            {waiting
              ? `${waiting} older photograph${waiting === 1 ? '' : 's'} not yet archived`
              : 'Everything older than the window is archived'}
          </Text>
        </View>
        {archivedThrough ? (
          <Text style={styles.note}>
            Archived up to {formatDate(new Date(archivedThrough - 1).toISOString().slice(0, 10))}
            {photoArchive.setBy ? ` · set by the ${photoArchive.setBy}` : ''}.
          </Text>
        ) : (
          <Text style={styles.note}>
            Nothing has been archived yet, so nothing is being deleted. Cloud storage is holding
            every photograph the vessel has uploaded.
          </Text>
        )}
        {photoArchive.lastSweepAt ? (
          <Text style={styles.note}>
            Last cleared from the cloud: {new Date(photoArchive.lastSweepAt).toLocaleDateString()} ·{' '}
            {photoArchive.lastSweepDeleted ?? 0} file
            {photoArchive.lastSweepDeleted === 1 ? '' : 's'}.
          </Text>
        ) : null}
      </Card>

      {onWindows ? (
        <Card>
          <Label>Not available here</Label>
          <Text style={styles.note}>
            Build the archive from the web app — this build cannot write a ZIP.
          </Text>
        </Card>
      ) : null}

      {!isMaster ? (
        <Card>
          <Label>You can save, the Master confirms</Label>
          <Text style={styles.note}>
            Anyone may save a copy of the vessel's photographs. Confirming that a month is archived
            is what allows the originals to be deleted, so that stays with the Master.
          </Text>
        </Card>
      ) : null}

      <Label style={styles.group}>Months to archive</Label>
      <ScrollView contentContainerStyle={{ paddingBottom: SIZES.xxl }}>
        {!months.length ? (
          <Card>
            <Text style={styles.note}>
              Nothing to archive. A month appears here once it is completely older than{' '}
              {RETENTION_DAYS} days and has photographs that are not archived yet.
            </Text>
          </Card>
        ) : null}

        {months.map((m, i) => {
          const working = busy === m.key;
          const first = i === 0;
          return (
            <View key={m.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{m.label}</Text>
                <Text style={styles.rowSub}>
                  {m.photos} photograph{m.photos === 1 ? '' : 's'} · {m.inspections} inspection
                  {m.inspections === 1 ? '' : 's'} · {mb(m.approxBytes)}
                </Text>
                {/* Said on the row rather than discovered at the confirmation:
                    the order is not a suggestion, it is what keeps the watermark
                    from skipping a month nobody has saved. */}
                {!first ? (
                  <Text style={styles.rowNote}>Archive the earlier months first</Text>
                ) : null}
                {working && progress ? (
                  <Text style={styles.rowNote}>
                    Collecting {progress.done} of {progress.total}…
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, (working || !!busy || onWindows) && { opacity: 0.4 }]}
                disabled={working || !!busy || onWindows}
                onPress={() => void save(m)}
              >
                {working ? (
                  <ActivityIndicator color={COLORS.textWhite} />
                ) : (
                  <>
                    <MciIcon name="folder-zip-outline" size={16} color={COLORS.textWhite} />
                    <Text style={styles.saveText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    note: { color: COLORS.textLight, fontSize: SIZES.small, lineHeight: 17, paddingTop: SIZES.xs },
    group: { marginTop: SIZES.lg, marginBottom: SIZES.xs },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingTop: SIZES.xs },
    stat: { flex: 1, color: COLORS.text, fontSize: SIZES.small, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.md,
      paddingVertical: SIZES.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    rowTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.text },
    rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    rowNote: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 2, fontStyle: 'italic' },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.xs,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.lg,
      paddingVertical: SIZES.sm,
      minWidth: 96,
      justifyContent: 'center',
    },
    saveText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.small },
  });
