// ===================================
// Group check (modal) — one look, one signature, a record per item
// (services/checkGroups.ts; Jez, 2 Nov 2026).
//
// The Chief Mate walks the crew cabins, sees every EEBD in place with its gauge
// in the green, and the group is signed once. Each ticked item gets its own
// signed inspection — same answers, signer and moment, `verification.method =
// 'group'` — so rounds, the due list and the report read it like any other.
//
// Where the vessel requires a scan, the GROUP's label is scanned — one sticker on
// the locker or in the corridor — read once, when the screen opens, as on an
// item. Without it only the Master signs, with a reason. And the person who
// looked signs: "the Chief Mate tells me they are fine" is the Chief Mate's
// signature, not the one he told.
//
// The answers are PASS or N/A only. A unit that is not right is UNTICKED: it
// stays outstanding and is inspected on its own, where its defect is raised
// against it rather than against twelve EEBDs at once.
// ===================================

import React, { useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, CategoryBadge, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP, catLabel } from '../constants/categories';
import { clHint, clLine, clTitle, periodsFor, templateFor } from '../constants/checklists';
import { moduleOn } from '../constants/modules';
import { CheckResult, Inspection, InspectionPeriod } from '../types/inspection';
import { findGroup, groupProofKey, groupQrPayload } from '../services/checkGroups';
import { scanProofFor, signingGate } from '../services/signingPolicy';
import { canPrintLabels, printLabels } from '../services/qrLabel';
import { EquipmentItem } from '../types/equipment';
import { roundFor, roundProgress, roundTakes } from '../services/rounds';
import { useActiveRound } from '../services/activeRound';
import * as inspections from '../services/inspections';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playErrorSound, playSuccessSound } from '../utils/sound';
import { itemLocation, itemNumber, typeWithSize } from '../utils/itemText';
import { t, tk, useT, dateLocale } from '../utils/i18n';

export default function GroupCheckSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { flat, inspections: trail, templates, rounds, signingPolicy, addInspections, setPrefs } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner(t('gc.signedBy'));
  const activeRoundId = useActiveRound();
  // Read once: the scan of the group's label that brought the inspector here.
  const [proof] = useState(() => (route.params?.groupId ? scanProofFor(groupProofKey(String(route.params.groupId))) : null));
  const [overrideReason, setOverrideReason] = useState('');

  const group = useMemo(() => findGroup(flat, String(route.params?.groupId ?? '')), [flat, route.params?.groupId]);
  const category = group?.category;
  const periods = useMemo<InspectionPeriod[]>(() => (category ? periodsFor(category, templates) : ['monthly']), [category, templates]);
  const [chosen, setChosen] = useState<InspectionPeriod | null>(route.params?.period ?? null);
  const period: InspectionPeriod = chosen && periods.includes(chosen) ? chosen : periods[0] ?? 'monthly';
  const template = useMemo(() => (category ? templateFor(category, period, templates) : null), [category, period, templates]);

  const round = useMemo(() => {
    if (!group || !moduleOn('rounds')) return null;
    const from = rounds.find((x) => x.id === route.params?.roundId);
    return roundTakes(from, group.items[0], period) ? from! : roundFor(rounds, group.items[0], period, activeRoundId);
  }, [group, rounds, route.params?.roundId, period, activeRoundId]);

  // Already done — in the round when there is one, else in this period's window.
  // Those start unticked: signing them again would be a second statement for nothing.
  const done = useMemo(() => {
    const out = new Set<string>();
    if (!group) return out;
    if (round) {
      for (const id of roundProgress(round, flat, trail, [group.category]).done.keys()) out.add(id);
    } else {
      for (const it of group.items) if (inspections.roundStatus(trail, it.id, period) === 'done') out.add(it.id);
    }
    return out;
  }, [group, round, flat, trail, period]);

  // Overrides of the default (ticked unless done).
  const [on, setOn] = useState<Set<string>>(new Set());
  const [off, setOff] = useState<Set<string>>(new Set());
  const ticked = (id: string) => on.has(id) || (!off.has(id) && !done.has(id));
  const toggle = (id: string) => {
    const now = ticked(id);
    setOn((s) => { const n = new Set(s); now ? n.delete(id) : n.add(id); return n; });
    setOff((s) => { const n = new Set(s); now ? n.add(id) : n.delete(id); return n; });
  };

  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const signed = useRef(false);

  if (!group || !template) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Card>
          <Label>{t('gc.notFound')}</Label>
          <Text style={styles.note}>{t('gc.notFoundBody')}</Text>
        </Card>
      </Screen>
    );
  }

  const gate = signingGate(signingPolicy, sync.role, sync.enrolled, proof, group.category);
  const places = [...new Set(group.items.map((it) => itemLocation(it)).filter(Boolean))];

  // One sticker for the group, where it is kept. A stand-in item carries the text;
  // the QR is the group's own (LabelText.qr), never an item's.
  const printLabel = async () => {
    const stand = { id: 'group', category: group.category, type: group.name, no: `${group.items.length} items`, position: places.length === 1 ? places[0] : undefined, updatedAt: 0 } as EquipmentItem;
    try {
      await printLabels([stand], '100x50', 'roll', undefined, { group: { name: group.name, note: t('gc.labelNote'), qr: groupQrPayload(group.id) } });
    } catch (e: any) {
      Alert.alert(t('gc.label'), String(e?.message ?? e));
    }
  };
  const picked = group.items.filter((it) => ticked(it.id));
  const left = group.items.filter((it) => !ticked(it.id) && !done.has(it.id));
  const answered = template.lines.filter((l) => results[l.id]).length;
  const complete = answered === template.lines.length;
  const setLine = (id: string, r: CheckResult) => setResults((p) => ({ ...p, [id]: p[id] === r ? (undefined as any) : r }));
  const allPass = () => setResults(Object.fromEntries(template.lines.map((l) => [l.id, 'pass' as CheckResult])));

  const save = async () => {
    if (!signer || signed.current) return;
    signed.current = true;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Group check — ${group.name}` });
    if (!sig) {
      signed.current = false;
      return;
    }
    setSaving(true);
    try {
      const at = Date.now();
      const groupId = uid('gc');
      const records: Inspection[] = picked.map((item) => {
        const r = inspections.create({
          item,
          template,
          results,
          by: signer.name,
          byRank: signer.rank,
          byId: signer.key.replace(/^device:/, ''),
          comment,
          at,
          ...(round ? { roundId: round.id } : {}),
          verification: {
            method: 'group', group: group.name, groupId, groupSize: picked.length,
            ...(proof ? { scannedAt: proof.at } : gate.kind === 'override' ? { reason: overrideReason } : {}),
          },
        });
        return sig.proof ? { ...r, signedWith: sig.proof } : r;
      });
      await addInspections(records);
      if (!signer.own) await setPrefs({ lastCrewId: signer.key });
      playSuccessSound();
      goBackOr(nav);
    } catch (e: any) {
      signed.current = false;
      playErrorSound();
      Alert.alert(t('ins.couldNotSign'), e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirm = () => {
    if (gate.kind === 'blocked' || saving) return;
    if (gate.kind === 'override' && !overrideReason.trim()) return Alert.alert(t('ins.whyNoScan'), t('gc.whyNoScanBody'));
    if (!signer) return Alert.alert(t('sign.who'), t('ins.pickCrew'));
    if (!picked.length) return Alert.alert(t('gc.title'), t('gc.noneTicked'));
    if (!complete) return Alert.alert(t('ins.notComplete'), t('ins.notCompleteBody', { k: answered, n: template.lines.length }));
    Alert.alert(
      t('gc.signQ', { n: picked.length }),
      t('gc.signBody', { group: group.name, n: picked.length, who: signer.rank ? `${signer.name} (${signer.rank})` : signer.name, when: new Date().toLocaleString(dateLocale()) }) +
        (proof ? `\n${t('gc.scannedAt', { time: new Date(proof.at).toLocaleTimeString(dateLocale()) })}` : gate.kind === 'override' ? `\n${t('ins.noScanSigned', { reason: overrideReason.trim() })}` : '') +
        (left.length ? `\n\n${t('gc.leftBody', { n: left.length })}` : '') +
        `\n\n${t('ins.cannotEdit')}`,
      [
        { text: t('common.back'), style: 'cancel' },
        { text: t('common.sign'), onPress: () => void save() },
      ]
    );
  };

  const meta = CATEGORY_MAP[group.category];

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={t('gc.title')} subtitle={`${group.name} · ${catLabel(meta)} · ${tk(`period.${period}`)}`} />

      {round ? (
        <View style={styles.banner}>
          <MciIcon name="clipboard-check-outline" size={18} color={COLORS.success} />
          <Text style={[styles.note, { flex: 1, color: COLORS.success, fontWeight: '700', paddingTop: 0 }]}>{t('ins.countsRound', { per: tk(`period.${round.period}`).toLowerCase(), label: round.label })}</Text>
        </View>
      ) : null}

      {periods.length > 1 ? (
        <View style={styles.chips}>
          {periods.map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, p === period && styles.chipOn]} onPress={() => { setChosen(p); setResults({}); }}>
              <Text style={[styles.chipText, p === period && styles.chipTextOn]}>{tk(`period.${p}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {canPrintLabels ? (
        <TouchableOpacity style={styles.labelBtn} onPress={() => void printLabel()}>
          <MciIcon name="qrcode" size={18} color={COLORS.primary} />
          <Text style={styles.labelBtnText}>{t('gc.printLabel')}</Text>
        </TouchableOpacity>
      ) : null}

      {gate.kind === 'blocked' ? (
        <Card>
          <View style={styles.head}>
            <MciIcon name="qrcode-scan" size={24} color={COLORS.primary} />
            <Label style={{ flex: 1 }}>{t('gc.scanToSign')}</Label>
          </View>
          <Text style={styles.note}>{t('gc.scanToSignBody', { places: places.join(', ') || catLabel(meta) })}</Text>
          <TouchableOpacity style={[styles.saveBtn, { marginBottom: 0 }]} onPress={() => nav.replace('Scan')}>
            <MciIcon name="qrcode-scan" size={20} color={COLORS.textWhite} />
            <Text style={styles.saveText}>{t('gc.scanLabel')}</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <>
          {proof ? (
            <View style={styles.banner}>
              <MciIcon name="qrcode-scan" size={18} color={COLORS.success} />
              <Text style={[styles.note, { flex: 1, color: COLORS.success, fontWeight: '700', paddingTop: 0 }]}>{t('gc.scannedRow', { time: new Date(proof.at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) })}</Text>
            </View>
          ) : gate.kind === 'override' ? (
            <Card>
              <Label style={{ color: COLORS.warning }}>{t('gc.notScanned')}</Label>
              <Text style={styles.note}>{t('gc.notScannedBody')}</Text>
              <TextInput style={styles.input} value={overrideReason} onChangeText={setOverrideReason} placeholder={t('ins.noScanPh')} placeholderTextColor={COLORS.textLight} />
            </Card>
          ) : null}
          <Card>
            <View style={styles.head}>
              <CategoryBadge category={group.category} size={22} />
              <Label style={{ flex: 1 }}>{t('gc.items', { k: picked.length, n: group.items.length })}</Label>
            </View>
            <Text style={styles.note}>{t('gc.untickHint')}</Text>
            {group.items.map((it) => {
              const yes = ticked(it.id);
              return (
                <TouchableOpacity key={it.id} style={styles.itemRow} onPress={() => toggle(it.id)} activeOpacity={0.7}>
                  <MciIcon name={yes ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={yes ? COLORS.primary : COLORS.textLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, !yes && { color: COLORS.textLight }]} numberOfLines={1}>
                      {[itemNumber(it) && t('round.no', { n: itemNumber(it) }), typeWithSize(it)].filter(Boolean).join(' — ') || catLabel(meta)}
                    </Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {[itemLocation(it), it.serial ? `S/N ${it.serial}` : '', done.has(it.id) ? t('gc.doneAlready') : !yes ? t('gc.leftOut') : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>

          <Card>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Label numberOfLines={1}>{clTitle(template)}</Label>
                <Text style={styles.note}>{t('ins.answered', { k: answered, n: template.lines.length })}</Text>
              </View>
              <TouchableOpacity style={styles.allPass} onPress={allPass}>
                <MciIcon name="check-all" size={16} color={COLORS.textWhite} />
                <Text style={styles.allPassText}>{t('ins.allPass')}</Text>
              </TouchableOpacity>
            </View>
            {template.lines.map((line) => (
              <View key={line.id} style={styles.line}>
                <Text style={styles.lineText}>{clLine(template, line)}</Text>
                {line.hint ? <Text style={styles.note}>{clHint(template, line)}</Text> : null}
                <View style={styles.resultRow}>
                  {(['pass', 'na'] as CheckResult[]).map((r) => {
                    const sel = results[line.id] === r;
                    const color = r === 'pass' ? COLORS.success : COLORS.textLight;
                    return (
                      <TouchableOpacity key={r} style={[styles.resultBtn, sel && { backgroundColor: color, borderColor: color }]} onPress={() => setLine(line.id, r)}>
                        <Text style={[styles.resultText, sel && { color: COLORS.textWhite }]}>{tk(r === 'pass' ? 'ins.res.pass' : 'ins.res.na')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <Text style={styles.note}>{t('gc.noFail')}</Text>
          </Card>

          <Card>
            <Label>{t('id.comments')}</Label>
            <TextInput style={styles.input} value={comment} onChangeText={setComment} multiline placeholder={t('gc.commentPh')} placeholderTextColor={COLORS.textLight} />
            {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : signer ? <Text style={styles.note}>{t('gc.signingAs', { who: signer.rank ? `${signer.name} (${signer.rank})` : signer.name })}</Text> : null}
            <Text style={styles.note}>{t('gc.whoLooked')}</Text>
          </Card>

          <TouchableOpacity style={[styles.saveBtn, (saving || !picked.length) && { opacity: 0.5 }]} onPress={confirm} disabled={saving}>
            <MciIcon name="draw-pen" size={20} color={COLORS.textWhite} />
            <Text style={styles.saveText}>{t('gc.sign', { n: picked.length })}</Text>
          </TouchableOpacity>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    banner: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.md },
    chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusRound, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, backgroundColor: COLORS.cardSolid },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, paddingVertical: SIZES.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: SIZES.xs },
    itemTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    itemSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    allPass: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: COLORS.success, borderRadius: SIZES.radiusRound, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm },
    allPassText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.small },
    line: { paddingTop: SIZES.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: SIZES.md },
    lineText: { fontSize: SIZES.body, color: COLORS.text },
    resultRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
    resultBtn: { flex: 1, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.cardSolid },
    resultText: { fontWeight: '700', fontSize: SIZES.small, color: COLORS.text },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.md, color: COLORS.text, backgroundColor: COLORS.card, marginTop: SIZES.sm, minHeight: 60, textAlignVertical: 'top' },
    labelBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusRound, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, marginBottom: SIZES.md },
    labelBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, padding: SIZES.lg, marginTop: SIZES.sm, marginBottom: SIZES.xxxl },
    saveText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  });
