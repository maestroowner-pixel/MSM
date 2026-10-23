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
import { uiDate } from '../utils/dates';
import { onWindows } from '../utils/fileShare';
import { t, tn, useT, dateLocale } from '../utils/i18n';

function mb(bytes: number): string {
  const m = bytes / (1024 * 1024);
  return m >= 1024 ? `≈ ${(m / 1024).toFixed(1)} GB` : `≈ ${Math.round(m)} MB`;
}

export default function PhotoArchiveSc() {
  useT();
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
        t('common.savedLocalOnly'),
        t('pa.notAccepted', { error })
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
        `${month.label} — ${tn('pa.saved', res.photos)}`,
        `${res.fileName}` +
          (res.missing ? `\n\n${t('pa.missing', { n: res.missing })}` : '') +
          (mayMark ? `\n\n${t('pa.keep', { month: month.label })}` : ''),
        mayMark
          ? [
              { text: t('pa.notYet'), style: 'cancel' },
              { text: t('pa.mark'), onPress: () => void markArchived(month) },
            ]
          : [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert(t('pa.couldNot'), String(e?.message ?? e));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const archivedThrough = photoArchive.archivedThrough;

  return (
    <Screen>
      <ScreenTitle
        title={t('pa.title')}
        subtitle={t('pa.sub', { n: RETENTION_DAYS })}
      />

      <Card>
        <Label>{t('pa.how')}</Label>
        <Text style={styles.note}>
          {t('pa.how1', { n: RETENTION_DAYS })}
        </Text>
        <Text style={styles.note}>
          {t('pa.how2')}
        </Text>
      </Card>

      <Card>
        <View style={styles.statRow}>
          <MciIcon name="cloud-check-outline" size={18} color={COLORS.success} />
          <Text style={styles.stat}>
            {tn('pa.inCloud', inCloud, { days: RETENTION_DAYS })}
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
              ? tn('pa.waiting', waiting)
              : t('pa.allArchived')}
          </Text>
        </View>
        {archivedThrough ? (
          <Text style={styles.note}>
            {t('pa.upTo', { date: uiDate(new Date(archivedThrough - 1).toISOString().slice(0, 10)) })}
            {photoArchive.setBy ? ` · ${t('pa.setBy', { who: photoArchive.setBy })}` : ''}.
          </Text>
        ) : (
          <Text style={styles.note}>
            {t('pa.nothingYet')}
          </Text>
        )}
        {photoArchive.lastSweepAt ? (
          <Text style={styles.note}>
            {t('pa.lastSweep', { date: uiDate(new Date(photoArchive.lastSweepAt).toISOString().slice(0, 10)) })} ·{' '}
            {tn('n.file', photoArchive.lastSweepDeleted ?? 0)}.
          </Text>
        ) : null}
      </Card>

      {onWindows ? (
        <Card>
          <Label>{t('pa.notHere')}</Label>
          <Text style={styles.note}>
            {t('pa.useWeb')}
          </Text>
        </Card>
      ) : null}

      {!isMaster ? (
        <Card>
          <Label>{t('pa.youSave')}</Label>
          <Text style={styles.note}>
            {t('pa.youSaveBody')}
          </Text>
        </Card>
      ) : null}

      <Label style={styles.group}>{t('pa.months')}</Label>
      <ScrollView contentContainerStyle={{ paddingBottom: SIZES.xxl }}>
        {!months.length ? (
          <Card>
            <Text style={styles.note}>
              {t('pa.nothing', { n: RETENTION_DAYS })}
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
                  {tn('n.photo', m.photos)} · {tn('n.inspection', m.inspections)} · {mb(m.approxBytes)}
                </Text>
                {/* Said on the row rather than discovered at the confirmation:
                    the order is not a suggestion, it is what keeps the watermark
                    from skipping a month nobody has saved. */}
                {!first ? (
                  <Text style={styles.rowNote}>{t('pa.earlierFirst')}</Text>
                ) : null}
                {working && progress ? (
                  <Text style={styles.rowNote}>
                    {t('pa.collecting', { k: progress.done, n: progress.total })}
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
                    <Text style={styles.saveText}>{t('common.save')}</Text>
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
