// ===================================
// One evidence photo, wherever it lives — moved out of InspectionDetailSc so
// PMS completions and machinery defects show theirs the same way.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { Attachment } from '../types/equipment';
import { openFile } from '../services/attachments';
import { ensureLocalPhoto } from '../services/photoStorage';

/**
 * One evidence photo, wherever it happens to live.
 *
 * On the phone that took it the local file is there and this is a plain
 * <Image>. On every OTHER device the record arrived through Firestore while the
 * image itself is in Cloud Storage — or still queued on the first phone, waiting
 * for Wi-Fi. `ensureLocalPhoto` covers all three: local file, cached download,
 * fetch once and cache. A photo that is genuinely not up yet shows as pending
 * rather than as a broken frame, because "not uploaded yet" is a normal state on
 * a vessel and must not read as a missing record.
 */
export function EvidencePhoto({
  vessel,
  inspectionId,
  photo,
  archived,
}: {
  vessel: string;
  inspectionId: string;
  photo: Attachment;
  /** The cloud copy has been swept — so "not here" means archived, not pending. */
  archived?: boolean;
}) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [uri, setUri] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Catch, always. Anything thrown in here leaves BOTH states unset, and the
      // component's only remaining branch is the spinner — a failure that shows
      // as "still loading" for ever instead of as "not here yet".
      let local: string | null = null;
      try {
        local = await ensureLocalPhoto(vessel, inspectionId, photo);
      } catch {
        local = null;
      }
      if (!alive) return;
      if (local) setUri(local);
      else setMissing(true);
    })();
    return () => {
      alive = false;
    };
  }, [vessel, inspectionId, photo]);

  if (photo.kind !== 'photo') {
    return (
      <TouchableOpacity style={styles.photo} onPress={() => openFile(photo.uri)}>
        <MciIcon name="file-document" size={24} color={COLORS.primaryDark} />
      </TouchableOpacity>
    );
  }

  if (missing) {
    return (
      <View style={[styles.photo, { borderWidth: 1, borderColor: COLORS.border }]}>
        <MciIcon
          name={archived ? 'archive-outline' : 'cloud-upload-outline'}
          size={20}
          color={COLORS.textLight}
        />
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.photo}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.photo} onPress={() => openFile(uri)}>
      <Image source={{ uri }} style={styles.photoImg} />
    </TouchableOpacity>
  );
}


const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    photo: {
      width: 64,
      height: 64,
      borderRadius: SIZES.radiusMd,
      backgroundColor: COLORS.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photoImg: { width: '100%', height: '100%' },
  });
