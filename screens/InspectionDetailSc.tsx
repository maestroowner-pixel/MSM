// ===================================
// Inspection detail (modal) — one signed record, read-only.
//
// Read-only is the feature. This is what gets shown to a surveyor, and its worth
// rests entirely on the fact that nobody could have gone back and tidied it up.
// So there is no edit control anywhere on this screen, by design; the only thing
// that can still change is a defect going from open to rectified, and that is
// itself a signed, stamped act rather than an edit.
//
// Results are rendered against the template VERSION the record was signed under
// (templateById), so re-wording a checklist line later never changes what an old
// record appears to say. A record from a build this one no longer has falls back
// to showing the raw line ids — ugly, but honest.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, CategoryBadge, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { SignerPicker } from '../components/SignerPicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP } from '../constants/categories';
import { templateById } from '../constants/checklists';
import { CheckResult, PERIOD_LABEL } from '../types/inspection';
import { crewLabel, signatureLine } from '../types/crew';
import { Attachment } from '../types/equipment';
import * as inspections from '../services/inspections';
import { openFile, resolveUri } from '../services/attachments';
import { ensureLocalPhoto } from '../services/photoStorage';
import { formatDateTime } from '../utils/dates';
import { goBackOr } from '../utils/nav';

const RESULT_META: Record<CheckResult, { label: string; icon: string }> = {
  pass: { label: 'PASS', icon: 'check-circle' },
  fail: { label: 'FAIL', icon: 'close-circle' },
  na: { label: 'N/A', icon: 'minus-circle' },
};

export default function InspectionDetailSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const { inspections: trail, flat, crew, vessel, saveInspection } = useData();
  const insp = useMemo(() => trail.find((i) => i.id === route.params?.id), [trail, route.params?.id]);
  const item = useMemo(() => flat.find((i) => i.id === insp?.itemId), [flat, insp]);

  const [closing, setClosing] = useState(false);
  const rectifying = useRef(false);
  const [closeNote, setCloseNote] = useState('');
  const [pickingSigner, setPickingSigner] = useState(false);
  const activeCrew = useMemo(() => crew.filter((c) => c.active), [crew]);

  if (!insp) {
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <Header title="Inspection" onClose={() => goBackOr(nav)} />
          <View style={{ padding: SIZES.lg }}>
            <Card>
              <Label>Record not found</Label>
              <Text style={styles.note}>
                This record is not on this device. If the vessel has several devices, pull the latest
                data in Settings → Cloud sync.
              </Text>
            </Card>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const template = templateById(insp.templateId);
  const breakdown = inspections.resultBreakdown(insp);
  const failed = insp.outcome === 'fail';

  const rectify = (signerId: string) => {
    const signer = activeCrew.find((c) => c.id === signerId);
    if (!signer) return;
    // Same guard as signing: a second dialog opened before the first is answered
    // writes the rectification twice with two different timestamps, and the one
    // that lands last is whichever the network felt like. A ref, because state
    // does not update in time to stop the second tap.
    if (rectifying.current) return;
    rectifying.current = true;
    Alert.alert(
      'Record rectification',
      `Close this defect as rectified, signed by ${crewLabel(signer)} at ${new Date().toLocaleString()}?\n\n` +
        'The original failed inspection stays on file exactly as it is — this adds the rectification to it.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { rectifying.current = false; } },
        {
          text: 'Confirm',
          onPress: () => {
            void saveInspection(
              inspections.closeDefect(insp, signatureLine(signer.name, signer.rank), closeNote)
            );
            setClosing(false);
            setCloseNote('');
            rectifying.current = false;
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <Header title={`${PERIOD_LABEL[insp.period]} inspection`} onClose={() => goBackOr(nav)} />

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          {/* Outcome first — it is the one thing a reader is looking for. */}
          <View style={[styles.outcome, { backgroundColor: failed ? COLORS.danger : COLORS.success }]}>
            <MciIcon
              name={failed ? 'alert-circle' : 'check-decagram'}
              size={28}
              color={COLORS.textWhite}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.outcomeText}>{failed ? 'FAILED' : 'PASSED'}</Text>
              <Text style={styles.outcomeSub}>
                {breakdown.passed} passed · {breakdown.failed} failed · {breakdown.na} n/a
              </Text>
            </View>
          </View>

          <Card>
            <Label>Equipment</Label>
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() =>
                item && nav.replace('ItemDetail', { category: item.category, id: item.id })
              }
              disabled={!item}
            >
              <CategoryBadge category={insp.category} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item?.type || item?.serial || CATEGORY_MAP[insp.category]?.label || 'Item'}
                </Text>
                <Text style={styles.meta}>
                  {item
                    ? [CATEGORY_MAP[insp.category]?.label, item.position, item.serial ? `S/N ${item.serial}` : null]
                        .filter(Boolean)
                        .join(' · ')
                    : 'No longer in the register'}
                </Text>
              </View>
              {item ? <MciIcon name="chevron-right" size={22} color={COLORS.textLight} /> : null}
            </TouchableOpacity>
          </Card>

          {/* The audit trail proper: who, exactly when, under which checklist. */}
          <Card>
            <Label>Signed</Label>
            <Row icon="account-check" text={signatureLine(insp.by, insp.byRank)} />
            <Row icon="clock-outline" text={formatDateTime(insp.at)} />
            <Row
              icon="clipboard-list"
              text={`${template?.title ?? insp.templateId} · v${insp.templateVersion}`}
            />
            {insp.deviceId ? <Row icon="cellphone" text={`Device ${insp.deviceId.slice(0, 8)}`} /> : null}
          </Card>

          <Card>
            <Label>Checklist</Label>
            {Object.entries(insp.results).map(([lineId, result]) => {
              const meta = RESULT_META[result];
              const color =
                result === 'pass' ? COLORS.success : result === 'fail' ? COLORS.danger : COLORS.textLight;
              return (
                <View key={lineId} style={styles.resultRow}>
                  <MciIcon name={meta.icon as any} size={18} color={color} />
                  <Text style={styles.resultText}>
                    {template?.lines.find((l) => l.id === lineId)?.text ?? lineId}
                  </Text>
                  <Text style={[styles.resultLabel, { color }]}>{meta.label}</Text>
                </View>
              );
            })}
          </Card>

          {insp.comment ? (
            <Card>
              <Label>Comments</Label>
              <Text style={styles.body}>{insp.comment}</Text>
            </Card>
          ) : null}

          {insp.photos?.length ? (
            <Card>
              <Label>Photographs</Label>
              <View style={styles.photoRow}>
                {insp.photos.map((p) => (
                  <EvidencePhoto
                    key={p.id}
                    vessel={vessel?.imo ?? ''}
                    inspectionId={insp.id}
                    photo={p}
                  />
                ))}
              </View>
            </Card>
          ) : null}

          {insp.defect ? (
            <View style={[styles.card, { borderWidth: 1, borderColor: insp.defect.open ? COLORS.danger : COLORS.border }]}>
              <Label style={{ color: insp.defect.open ? COLORS.danger : COLORS.textLight }}>
                {insp.defect.open ? 'Defect — outstanding' : 'Defect — rectified'}
              </Label>
              <Text style={styles.body}>{insp.defect.note}</Text>

              {insp.defect.open ? (
                closing ? (
                  <>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={closeNote}
                      onChangeText={setCloseNote}
                      placeholder="What was done to rectify it"
                      placeholderTextColor={COLORS.textLight}
                      multiline
                    />
                    <View style={styles.btnRow}>
                      <TouchableOpacity style={styles.secondaryBtn} onPress={() => setClosing(false)}>
                        <Text style={styles.secondaryBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.primaryBtn} onPress={() => setPickingSigner(true)}>
                        <Text style={styles.primaryBtnText}>Sign off</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setClosing(true)}>
                    <MciIcon name="wrench" size={18} color={COLORS.textWhite} />
                    <Text style={styles.primaryBtnText}>Record rectification</Text>
                  </TouchableOpacity>
                )
              ) : (
                <View style={{ paddingTop: SIZES.sm }}>
                  <Row icon="account-check" text={insp.defect.closedBy ?? '—'} />
                  <Row icon="clock-check-outline" text={formatDateTime(insp.defect.closedAt)} />
                  {insp.defect.closedNote ? <Text style={styles.body}>{insp.defect.closedNote}</Text> : null}
                </View>
              )}
            </View>
          ) : null}

          <Text style={styles.finalNote}>
            Signed records cannot be edited or deleted. A correction is made by inspecting the item
            again, and both records stay on file.
          </Text>
        </ScrollView>

        <SignerPicker
          visible={pickingSigner}
          crew={activeCrew}
          title="Who carried out the rectification?"
          onSelect={(id) => {
            setPickingSigner(false);
            rectify(id);
          }}
          onClose={() => setPickingSigner(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

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
function EvidencePhoto({
  vessel,
  inspectionId,
  photo,
}: {
  vessel: string;
  inspectionId: string;
  photo: Attachment;
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
        <MciIcon name="cloud-upload-outline" size={20} color={COLORS.textLight} />
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

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} hitSlop={12}>
        <Text style={styles.headerBtn}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function Row({ icon, text }: { icon: string; text: string }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.infoRow}>
      <MciIcon name={icon as any} size={18} color={COLORS.textLight} />
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SIZES.lg,
      paddingVertical: SIZES.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    headerBtn: { fontSize: SIZES.h5, color: COLORS.text },
    headerTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark, flex: 1, textAlign: 'center' },

    outcome: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.md,
      borderRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      marginBottom: SIZES.md,
    },
    outcomeText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.h4 },
    outcomeSub: { color: COLORS.textWhite, fontSize: SIZES.small, opacity: 0.9, marginTop: 2 },

    card: {
      ...COLORS.glassCard,
      borderRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      marginBottom: SIZES.md,
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, paddingTop: SIZES.sm },
    itemName: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    meta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },

    infoRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingTop: SIZES.sm },
    body: { fontSize: SIZES.body, color: COLORS.text, flex: 1 },

    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      paddingTop: SIZES.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      marginTop: SIZES.md,
    },
    resultText: { flex: 1, fontSize: SIZES.body, color: COLORS.text },
    resultLabel: { fontWeight: '700', fontSize: SIZES.small },

    photoRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md, flexWrap: 'wrap' },
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

    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      color: COLORS.text,
      backgroundColor: COLORS.card,
      marginTop: SIZES.sm,
    },
    multiline: { minHeight: 70, textAlignVertical: 'top' },
    btnRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
    primaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      marginTop: SIZES.md,
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700' },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
      marginTop: SIZES.md,
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: '700' },

    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    finalNote: {
      color: COLORS.textLight,
      fontSize: SIZES.small,
      textAlign: 'center',
      paddingTop: SIZES.md,
      lineHeight: 16,
    },
  });
