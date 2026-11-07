// ===================================
// "Check the photo (AI)" under an inspection's photographs (plan item 66,
// services/photoCheckAi.ts): is it this item, the same unit as last time, does
// its label agree with the register, what corrosion or damage shows. The
// inspector may put it into the remark or the defect; otherwise nothing of it
// is kept. Not queued: the inspection is open now, and the photo stays.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useSync } from '../contexts/SyncContext';
import { useTheme } from '../contexts/ThemeContext';
import { aiCall, aiReady } from '../services/ai';
import { isNetworkError } from '../services/aiQueue';
import { resolveUri } from '../services/attachments';
import { imageToDataUri } from '../services/medFiles';
import { checkDefect, checkRemark, needsLook, PhotoCheck, PhotoCheckReply, PhotoRef, readPhotoCheck } from '../services/photoCheckAi';
import { ensureLocalPhoto } from '../services/photoStorage';
import { CATEGORY_MAP } from '../constants/categories';
import { Attachment, EquipmentItem } from '../types/equipment';
import { Palette, SIZES } from '../theme';
import { dateLocale, t, tk, useT } from '../utils/i18n';
import { itemLocation, itemNumber, typeWithSize } from '../utils/itemText';

const b64 = (uri: string) => uri.slice(uri.indexOf(',') + 1);

/** The reference photo as data, or null when it is not on this device and cannot be fetched. */
async function refData(ref: PhotoRef, imo?: string): Promise<string | null> {
  try {
    const local = ref.inspectionId && imo ? await ensureLocalPhoto(imo, ref.inspectionId, ref.photo) : resolveUri(ref.photo.uri) ?? ref.photo.uri;
    return local ? b64(await imageToDataUri(local)) : null;
  } catch {
    return null;
  }
}

export interface CheckState {
  photoId: string;
  check: PhotoCheck;
}

export function PhotoCheckPanel({ item, photos, refPhoto, imo, value, onValue, onRemark, onDefect, canDefect }: {
  item: EquipmentItem;
  photos: Attachment[];
  refPhoto: PhotoRef | null;
  imo?: string;
  value: CheckState | null;
  onValue: (v: CheckState | null) => void;
  onRemark: (text: string) => void;
  onDefect: (text: string) => void;
  /** A line is failed, so the defect box is open: a defect is raised only from a failed line. */
  canDefect: boolean;
}) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const sync = useSync();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [used, setUsed] = useState<string | null>(null);
  const shot = [...photos].reverse().find((p) => p.kind === 'photo');

  if (!aiReady(sync.enrolled) || !shot) return null;
  const check = value?.photoId === shot.id ? value.check : null;

  const go = async () => {
    setBusy(true);
    setNote(null);
    setUsed(null);
    try {
      const image = b64(await imageToDataUri(resolveUri(shot.uri) ?? shot.uri));
      const ref = refPhoto ? await refData(refPhoto, imo) : null;
      const reply = await aiCall<PhotoCheckReply>('photo', {
        item: {
          name: typeWithSize(item) || CATEGORY_MAP[item.category]?.label,
          category: CATEGORY_MAP[item.category]?.label,
          number: itemNumber(item),
          make: item.make,
          serial: item.serial,
          location: itemLocation(item),
          expiry: item.expiry,
          nextInspection: item.nextInspection,
        },
        image: { mediaType: 'image/jpeg', data: image },
        ...(ref && refPhoto ? { ref: { mediaType: 'image/jpeg', data: ref }, refWhen: refPhoto.at ? `on ${new Date(refPhoto.at).toISOString().slice(0, 10)}` : 'before' } : {}),
      });
      const c = readPhotoCheck(reply, item, !!ref);
      if (!c) setNote(t('pc.nothing'));
      else onValue({ photoId: shot.id, check: c });
      if (refPhoto && !ref) setNote(t('pc.noRefHere'));
    } catch (e: any) {
      setNote(isNetworkError(e) ? t('pc.offline') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const tone = !check ? COLORS.primary : check.match === 'no' || check.same === 'other' || check.same === 'samePhoto' || check.differs.length || check.findings.some((f) => f.major) ? COLORS.danger : needsLook(check) ? COLORS.warning : COLORS.success;
  const defect = check ? checkDefect(check) : '';

  return (
    <View style={{ marginTop: SIZES.sm }}>
      {check ? (
        <View style={[styles.box, { borderLeftColor: tone }]}>
          <Text style={[styles.head, { color: check.match === 'yes' ? COLORS.success : check.match === 'no' ? COLORS.danger : COLORS.warning }]}>{tk(`pc.match.${check.match}`)}</Text>
          {check.why ? <Text style={styles.text}>{check.why}</Text> : null}
          {check.same ? <Text style={[styles.text, check.same !== 'same' && check.same !== 'unsure' && { color: COLORS.danger }]}>{tk(`pc.same.${check.same}`, { when: refPhoto?.at ? new Date(refPhoto.at).toLocaleDateString(dateLocale()) : '' })}</Text> : refPhoto ? null : <Text style={styles.sub}>{t('pc.noRef')}</Text>}
          {check.differs.map((d) => (
            <Text key={d} style={[styles.text, { color: COLORS.danger }]}>{t('pc.differs', { what: d })}</Text>
          ))}
          {check.findings.length ? (
            check.findings.map((f, i) => (
              <View key={i} style={styles.finding}>
                <MciIcon name={f.major ? 'alert-circle' : 'alert-circle-outline'} size={16} color={f.major ? COLORS.danger : COLORS.warning} />
                <Text style={styles.text}>
                  <Text style={{ fontWeight: '700' }}>{tk(`pc.kind.${f.kind}`)}{f.major ? ` · ${t('pc.major')}` : ''}: </Text>
                  {f.where}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.text, { color: COLORS.success }]}>{t('pc.clean')}</Text>
          )}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => { onRemark(checkRemark(check)); setUsed(t('pc.usedRemark')); }}>
              <Text style={styles.btnText}>{t('pc.toRemark')}</Text>
            </TouchableOpacity>
            {defect && canDefect ? (
              <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => { onDefect(defect); setUsed(t('pc.usedDefect')); }}>
                <Text style={styles.btnText}>{t('pc.toDefect')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => void go()} disabled={busy} hitSlop={8}>
              <Text style={[styles.link, busy && { opacity: 0.5 }]}>{busy ? t('pc.working') : t('pc.again')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sub}>{used ?? (defect && !canDefect ? t('pc.failFirst') : t('pc.hint'))}</Text>
        </View>
      ) : (
        <TouchableOpacity onPress={() => void go()} disabled={busy} hitSlop={8} style={styles.go}>
          <MciIcon name="image-search-outline" size={16} color={COLORS.primary} />
          <Text style={[styles.link, busy && { opacity: 0.5 }]}>{busy ? t('pc.working') : t('pc.go')}</Text>
        </TouchableOpacity>
      )}
      {note ? <Text style={styles.sub}>{note}</Text> : null}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { fontSize: SIZES.body, fontWeight: '700' },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    text: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 2, flexShrink: 1 },
    box: { borderLeftWidth: 3, paddingLeft: SIZES.sm },
    finding: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.sm },
    btn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    btnText: { color: COLORS.textWhite, fontWeight: '700' },
    go: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
