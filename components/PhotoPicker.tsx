// ===================================
// Evidence photos being added to a record before it is signed — camera or
// library on a phone, a file in a browser; long-press to remove. The same as
// the inspection screen's, for PMS completions and machinery defects.
// ===================================

import React, { useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { Attachment } from '../types/equipment';
import { PickedFile, pickDocument, pickFromCamera, pickFromLibrary, resolveUri } from '../services/attachments';
import { onWeb } from '../utils/fileShare';
import { uid } from '../utils/id';

export const MAX_EVIDENCE = 4;

export function PhotoPicker({ photos, onChange, max = MAX_EVIDENCE, hint }: { photos: Attachment[]; onChange: (p: Attachment[]) => void; max?: number; hint?: string }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const add = (picker: () => Promise<PickedFile | null>) => async () => {
    const f = await picker();
    if (!f) return;
    onChange(photos.length >= max ? photos : [...photos, { id: uid('ph'), kind: f.kind, uri: f.uri, ...(f.name ? { name: f.name } : {}), addedAt: Date.now() }]);
  };
  const choose = () => {
    if (onWeb) return void add(pickDocument)();
    Alert.alert('Add evidence', 'Photograph the work — before and after, clearances, parts replaced', [
      { text: 'Camera', onPress: add(pickFromCamera) },
      { text: 'Photo Library', onPress: add(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  return (
    <View>
      <View style={styles.row}>
        {photos.map((p) => (
          <TouchableOpacity key={p.id} style={styles.photo} onLongPress={() => onChange(photos.filter((x) => x.id !== p.id))}>
            {p.kind === 'photo' ? <Image source={{ uri: resolveUri(p.uri) }} style={styles.img} /> : <MciIcon name="file-document" size={24} color={COLORS.primaryDark} />}
          </TouchableOpacity>
        ))}
        {photos.length < max ? (
          <TouchableOpacity style={[styles.photo, styles.add]} onPress={choose}>
            <MciIcon name="camera-plus" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.hint}>{photos.length ? 'Long-press a photo to remove it' : hint ?? ''}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm, flexWrap: 'wrap' },
    photo: { width: 64, height: 64, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.cardSolid, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    add: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary },
    img: { width: '100%', height: '100%' },
    hint: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4 },
  });
