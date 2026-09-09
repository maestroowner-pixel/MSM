// ===================================
// Inspection (modal) — the round itself.
//
// This is the screen the whole audit trail hangs off: a crew member stands in
// front of the thing, works down the checklist, signs, and the record is closed
// for good (records are append-only — see types/inspection.ts).
//
// Three decisions worth keeping:
//
// 1. **"All pass" first.** A monthly round is 108 detectors, and the honest
//    outcome of nearly every one is "fine". Making the crew tap PASS on six
//    lines each is how a system stops being used — and an unused system records
//    nothing at all. So the round opens with everything unset, one tap fills it
//    with PASS, and the crew member downgrades what is actually wrong. Nothing
//    is pre-filled without that tap: an untouched checklist must never be
//    mistaken for an inspected one.
//
// 2. **The signature is chosen, not typed.** Free-text names produce "J.D.",
//    "jez", "3/O" and three spellings of the same person by month four, which
//    makes the audit trail unsearchable. The crew list is the vocabulary; the
//    name is snapshotted onto the record at save.
//
// 3. **Save is one-way.** There is no edit screen for a saved record anywhere in
//    the app, deliberately. A mistake is corrected by inspecting again.
// ===================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
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
import { SignerPicker } from '../components/SignerPicker';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP } from '../constants/categories';
import { periodsFor, templateFor } from '../constants/checklists';
import { CheckResult, InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import { Attachment } from '../types/equipment';
import { crewLabel } from '../types/crew';
import * as inspections from '../services/inspections';
import * as photoQueue from '../services/photoQueue';
import {
  PickedFile,
  pickDocument,
  pickFromCamera,
  pickFromLibrary,
  resolveUri,
} from '../services/attachments';
import { onWeb } from '../utils/fileShare';
import { uid } from '../utils/id';
import { playErrorSound, playSuccessSound } from '../utils/sound';
import { goBackOr } from '../utils/nav';

const MAX_PHOTOS = 4;

/** Short label for the item, for the header and the confirmation. */
function itemTitle(type?: string, serial?: string, no?: number | string): string {
  return type || (serial ? `S/N ${serial}` : null) || (no != null ? `No. ${no}` : null) || 'Item';
}

export default function InspectionSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const { flat, crew, prefs, vessel, templates, addInspection, setPrefs } = useData();

  const itemId: string = route.params?.itemId;
  const item = useMemo(() => flat.find((i) => i.id === itemId), [flat, itemId]);

  const periods = useMemo<InspectionPeriod[]>(
    () => (item ? periodsFor(item.category, templates) : ['monthly']),
    [item]
  );
  const [period, setPeriod] = useState<InspectionPeriod>(
    route.params?.period && periods.includes(route.params.period) ? route.params.period : periods[0]
  );

  const template = useMemo(
    () => (item ? templateFor(item.category, period, templates) : null),
    [item, period]
  );

  // Results start EMPTY — see decision 1 in the header.
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [comment, setComment] = useState('');
  const [defectNote, setDefectNote] = useState('');
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  /**
   * Two refs, because `saving` is state and state is too slow to guard with.
   *
   * `signed` is the one that matters: this screen is ONE inspection, so once a
   * record exists it must never make a second. A signed record cannot be edited
   * or deleted, so a duplicate is not a cosmetic glitch — it is a second signed
   * statement about the same check, and when the round failed it is a second
   * open defect that somebody has to close by hand.
   *
   * `confirming` stops the confirmation being opened twice. That was the actual
   * route in: tapping Sign three times stacked three dialogs, each with its own
   * Sign button, and the `saving` flag they all tested had not been set by any
   * of them yet — a re-render is not synchronous, so all three closures saw
   * false and all three saved.
   */
  const signed = useRef(false);
  const confirming = useRef(false);

  // Signer: whoever used this device last, if they are still on the crew list.
  const activeCrew = useMemo(() => crew.filter((c) => c.active), [crew]);
  const [signerId, setSignerId] = useState<string | undefined>(() => {
    const last = prefs.lastCrewId && activeCrew.find((c) => c.id === prefs.lastCrewId);
    return last ? last.id : activeCrew.length === 1 ? activeCrew[0].id : undefined;
  });
  const signer = useMemo(() => activeCrew.find((c) => c.id === signerId), [activeCrew, signerId]);
  const [pickingSigner, setPickingSigner] = useState(false);

  // Changing period swaps the template, and the old answers no longer mean
  // anything — a weekly "cradle" is not a monthly "cradle".
  const changePeriod = (p: InspectionPeriod) => {
    if (p === period) return;
    setPeriod(p);
    setResults({});
  };

  const setLine = (id: string, value: CheckResult) =>
    setResults((prev) => ({ ...prev, [id]: prev[id] === value ? (undefined as any) : value }));

  const markAllPass = () => {
    if (!template) return;
    setResults(Object.fromEntries(template.lines.map((l) => [l.id, 'pass' as CheckResult])));
  };

  const answered = template ? template.lines.filter((l) => results[l.id]).length : 0;
  const complete = !!template && answered === template.lines.length;
  const anyFail = Object.values(results).some((r) => r === 'fail');

  const addPhoto = (picker: () => Promise<PickedFile | null>) => async () => {
    const f = await picker();
    if (!f) return;
    setPhotos((prev) =>
      prev.length >= MAX_PHOTOS
        ? prev
        : [...prev, { id: uid('ip'), kind: f.kind, uri: f.uri, name: f.name, addedAt: Date.now() }]
    );
  };

  const choosePhoto = () => {
    if (onWeb) return void addPhoto(pickDocument)();
    Alert.alert('Add evidence', 'Photograph what you found', [
      { text: 'Camera', onPress: addPhoto(pickFromCamera) },
      { text: 'Photo Library', onPress: addPhoto(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = useCallback(async () => {
    if (!item || !template || !signer) return;
    if (signed.current) return; // already signed from this screen — never twice
    signed.current = true;
    setSaving(true);
    try {
      const record = inspections.create({
        item,
        template,
        results,
        by: signer.name,
        byRank: signer.rank,
        byId: signer.id,
        comment,
        photos,
        defectNote,
      });
      await addInspection(record);
      // The record is up in seconds; its photographs wait for a connection worth
      // spending (services/photoQueue.ts). Queued even when uploads are switched
      // off — turning them on later should send what was already taken, not just
      // what happens next.
      if (record.photos?.length && vessel?.imo) {
        await photoQueue.enqueueInspection(vessel.imo, record);
      }
      await setPrefs({ lastCrewId: signer.id });
      playSuccessSound();
      goBackOr(nav);
    } catch (e: any) {
      // Nothing was signed, so let them try again rather than stranding a
      // completed checklist behind a guard that will never lift.
      signed.current = false;
      playErrorSound();
      Alert.alert('Could not sign', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }, [item, template, signer, results, comment, photos, defectNote, addInspection, setPrefs, nav]);

  const confirmSave = () => {
    if (signed.current || confirming.current) return;
    if (!signer) {
      Alert.alert('Who is signing?', 'Pick the crew member carrying out this inspection.');
      setPickingSigner(true);
      return;
    }
    if (!complete) {
      Alert.alert(
        'Checklist not complete',
        `${answered} of ${template?.lines.length} lines answered. Every line needs a result — use N/A for anything that does not apply to this item.`
      );
      return;
    }
    // Spelled out, because it cannot be undone afterwards.
    Alert.alert(
      anyFail ? 'Sign as FAILED' : 'Sign as passed',
      `${PERIOD_LABEL[period]} inspection of ${itemTitle(item?.type, item?.serial, item?.no)}, ` +
        `signed by ${crewLabel(signer)} at ${new Date().toLocaleString()}.\n\n` +
        'A signed record cannot be edited or deleted. To correct a mistake, inspect the item again.',
      [
        { text: 'Back', style: 'cancel', onPress: () => { confirming.current = false; } },
        {
          text: 'Sign',
          style: anyFail ? 'destructive' : 'default',
          onPress: () => {
            confirming.current = false;
            void save();
          },
        },
      ]
    );
    confirming.current = true;
  };

  if (!item || !template) {
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => goBackOr(nav)} hitSlop={12}>
              <Text style={styles.headerBtn}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Inspection</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={{ padding: SIZES.lg }}>
            <Card>
              <Label>Item not found</Label>
              <Text style={styles.note}>
                This item is no longer in the register — it may have been deleted, or this device is
                holding an older copy than the vessel is.
              </Text>
            </Card>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const meta = CATEGORY_MAP[item.category];

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOr(nav)} hitSlop={12}>
            <Text style={styles.headerBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {PERIOD_LABEL[period]} inspection
          </Text>
          <TouchableOpacity onPress={confirmSave} hitSlop={12} disabled={saving}>
            <Text style={[styles.headerBtn, styles.signBtn, saving && { opacity: 0.4 }]}>Sign</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* What is being inspected — never in doubt, because the scan chose it. */}
          <View style={styles.titleRow}>
            <CategoryBadge category={item.category} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {itemTitle(item.type, item.serial, item.no)}
              </Text>
              <Text style={styles.itemMeta}>
                {[meta.label, item.position, item.serial ? `S/N ${item.serial}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>

          {periods.length > 1 ? (
            <View style={styles.periodRow}>
              {periods.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, p === period && styles.periodBtnOn]}
                  onPress={() => changePeriod(p)}
                >
                  <Text style={[styles.periodText, p === period && styles.periodTextOn]}>
                    {PERIOD_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Signature. Sits ABOVE the checklist on purpose: the crew member
              should see whose name is going on this before they answer, not
              discover it at the save dialog. */}
          <TouchableOpacity style={styles.signerRow} onPress={() => setPickingSigner(true)}>
            <MciIcon name="account-check" size={22} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Label>Inspected by</Label>
              <Text style={[styles.signerName, !signer && { color: COLORS.textLight }]}>
                {signer ? crewLabel(signer) : 'Tap to choose…'}
              </Text>
            </View>
            <MciIcon name="chevron-right" size={22} color={COLORS.textLight} />
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.checklistHead}>
              <View style={{ flex: 1 }}>
                <Label>{template.title}</Label>
                <Text style={styles.progress}>
                  {answered} of {template.lines.length} answered
                </Text>
              </View>
              <TouchableOpacity style={styles.allPassBtn} onPress={markAllPass}>
                <MciIcon name="check-all" size={16} color={COLORS.textWhite} />
                <Text style={styles.allPassText}>All pass</Text>
              </TouchableOpacity>
            </View>

            {template.lines.map((line) => {
              const value = results[line.id];
              return (
                <View key={line.id} style={styles.line}>
                  <Text style={styles.lineText}>{line.text}</Text>
                  {line.hint ? <Text style={styles.lineHint}>{line.hint}</Text> : null}
                  <View style={styles.resultRow}>
                    {(['pass', 'fail', 'na'] as CheckResult[]).map((r) => {
                      const on = value === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.resultBtn,
                            on && { backgroundColor: RESULT_COLOR(COLORS)[r], borderColor: RESULT_COLOR(COLORS)[r] },
                          ]}
                          onPress={() => setLine(line.id, r)}
                          accessibilityRole="button"
                          accessibilityLabel={`${line.text}: ${RESULT_LABEL[r]}`}
                        >
                          <Text style={[styles.resultText, on && { color: COLORS.textWhite }]}>
                            {RESULT_LABEL[r]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {/* A failure has to say what is wrong before it can be signed off —
              "FAIL" alone leaves the next person nothing to act on. */}
          {anyFail ? (
            <View style={[styles.card, styles.defectCard]}>
              <Label style={{ color: COLORS.danger }}>Defect raised</Label>
              <Text style={styles.note}>
                This inspection will be filed as FAILED and the defect stays open against this item
                until somebody records the rectification.
              </Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={defectNote}
                onChangeText={setDefectNote}
                placeholder="What is wrong, and what is needed"
                placeholderTextColor={COLORS.textLight}
                multiline
              />
            </View>
          ) : null}

          <View style={styles.card}>
            <Label>Comments</Label>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={comment}
              onChangeText={setComment}
              placeholder="Readings taken, work done, anything worth the next person knowing"
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          </View>

          <View style={styles.card}>
            <Label>Photographs</Label>
            <Text style={styles.note}>
              Evidence for this inspection — kept on the record, not on the item's general photos.
            </Text>
            <View style={styles.photoRow}>
              {photos.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.photo}
                  onLongPress={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                >
                  {p.kind === 'photo' ? (
                    <Image source={{ uri: resolveUri(p.uri) }} style={styles.photoImg} />
                  ) : (
                    <MciIcon name="file-document" size={24} color={COLORS.primaryDark} />
                  )}
                </TouchableOpacity>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <TouchableOpacity style={[styles.photo, styles.photoAdd]} onPress={choosePhoto}>
                  <MciIcon name="camera-plus" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {photos.length ? <Text style={styles.hint}>Long-press a photo to remove it</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, anyFail && { backgroundColor: COLORS.danger }, saving && { opacity: 0.5 }]}
            onPress={confirmSave}
            disabled={saving}
          >
            <MciIcon name="draw-pen" size={20} color={COLORS.textWhite} />
            <Text style={styles.saveBtnText}>
              {anyFail ? 'Sign as FAILED' : 'Sign inspection'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.finalNote}>
            The date, exact time and your name are stamped on the record when you sign. It cannot be
            edited afterwards.
          </Text>
        </ScrollView>

        <SignerPicker
          visible={pickingSigner}
          crew={activeCrew}
          selectedId={signerId}
          onSelect={(id) => {
            setSignerId(id);
            setPickingSigner(false);
          }}
          onClose={() => setPickingSigner(false)}
          onManage={() => {
            setPickingSigner(false);
            nav.navigate('Crew');
          }}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const RESULT_LABEL: Record<CheckResult, string> = { pass: 'PASS', fail: 'FAIL', na: 'N/A' };
const RESULT_COLOR = (c: Palette): Record<CheckResult, string> => ({
  pass: c.success,
  fail: c.danger,
  na: c.textLight,
});

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
    signBtn: { color: COLORS.primary, fontWeight: '700' },
    headerTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark, flex: 1, textAlign: 'center' },

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginBottom: SIZES.md },
    itemName: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    itemMeta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },

    periodRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
    periodBtn: {
      flex: 1,
      paddingVertical: SIZES.md,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      backgroundColor: COLORS.cardSolid,
    },
    periodBtnOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    periodText: { color: COLORS.text, fontWeight: '600' },
    periodTextOn: { color: COLORS.textWhite },

    signerRow: {
      ...COLORS.glassCard,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.md,
      borderRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      marginBottom: SIZES.md,
    },
    signerName: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark, marginTop: 2 },

    card: {
      ...COLORS.glassCard,
      borderRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      marginBottom: SIZES.md,
    },
    defectCard: { borderWidth: 1, borderColor: COLORS.danger },
    checklistHead: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginBottom: SIZES.sm },
    progress: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    allPassBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.xs,
      backgroundColor: COLORS.success,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
    },
    allPassText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.small },

    line: { paddingTop: SIZES.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: SIZES.md },
    lineText: { fontSize: SIZES.body, color: COLORS.text },
    lineHint: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    resultRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
    resultBtn: {
      flex: 1,
      paddingVertical: SIZES.md,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      backgroundColor: COLORS.cardSolid,
    },
    resultText: { fontWeight: '700', fontSize: SIZES.small, color: COLORS.text },

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
    multiline: { minHeight: 80, textAlignVertical: 'top' },

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
    photoAdd: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary },
    photoImg: { width: '100%', height: '100%' },

    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    hint: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm },
    finalNote: {
      color: COLORS.textLight,
      fontSize: SIZES.small,
      textAlign: 'center',
      paddingTop: SIZES.md,
      lineHeight: 16,
    },

    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.lg,
      marginTop: SIZES.sm,
    },
    saveBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },

  });
