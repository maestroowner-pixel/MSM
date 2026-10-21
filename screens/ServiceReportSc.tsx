// ===================================
// A service station's report into the register (services/serviceReport.ts).
// Attach the station's PDF; the AI reads it, or the officer types the few
// fields; the app finds the items; the officer ticks what applies; Apply sets
// the dates, adds a remark to each item and files one certificate with the PDF.
// Nobody outside the vessel gets access to anything.
// ===================================

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP, visibleCategories } from '../constants/categories';
import { moduleOn } from '../constants/modules';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { uid } from '../utils/id';
import * as storage from '../services/storage';
import * as snapshot from '../services/snapshot';
import { canAddCertificate } from '../services/trial';
import { aiCall, aiReady } from '../services/ai';
import { PickedFile, pickDocument, pickFromCamera, pickFromLibrary, toDataUri } from '../services/attachments';
import { AI_FIELDS, Match, ReportPick, ServiceReport, applyReport, certificateFor, emptyReport, fromAiRows, matchReport } from '../services/serviceReport';
import { t, tk, tn, useT } from '../utils/i18n';

const MAX_AI_BYTES = 10 * 1024 * 1024;

export default function ServiceReportSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { flat, certificates, categories, saveCertificate, reload, vessel } = useData();
  const sync = useSync();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [rep, setRep] = useState<ServiceReport>(emptyReport);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  // Ticks the officer changed; everything else follows the matching (matched → on, others → off).
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [fieldPick, setFieldPick] = useState<'nextInspection' | 'expiry' | null>(null);
  const set = (p: Partial<ServiceReport>) => setRep((r) => ({ ...r, ...p }));

  const m = useMemo(() => matchReport(rep, flat), [rep, flat]);
  const byId = useMemo(() => new Map(flat.map((i) => [i.id, i])), [flat]);
  const field = fieldPick ?? (rep.category ? CATEGORY_MAP[rep.category]?.dateField : undefined) ?? 'nextInspection';
  const on = (id: string, dflt: boolean) => ticks[id] ?? dflt;
  const picks: ReportPick[] = [
    ...m.matches.filter((x) => on(x.itemId, true)).map((x) => ({ itemId: x.itemId, line: x.line })),
    ...m.others.filter((id) => on(id, false)).map((id) => ({ itemId: id })),
  ];
  const usedCats = useMemo(() => {
    const have = new Set(flat.map((i) => i.category));
    // Built-in and the vessel's own, not hidden; those with items (or the one the AI named).
    return visibleCategories().filter((c) => have.has(c.key) || c.key === rep.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, flat, rep.category]);

  const attach = (picker: () => Promise<PickedFile | null>) => async () => {
    const f = await picker();
    if (f) {
      setFile(f);
      setAiNote(null);
    }
  };

  const readAi = async () => {
    if (!file) return;
    setBusy(t('sr.reading'));
    setAiNote(null);
    try {
      const dataUri = await toDataUri(file.uri, file.name ?? 'report.pdf');
      const mediaType = dataUri.slice(5, dataUri.indexOf(';'));
      const data = dataUri.slice(dataUri.indexOf(',') + 1);
      if (data.length * 0.75 > MAX_AI_BYTES) throw new Error(t('sr.tooBig'));
      const res = await aiCall<{ rows?: Record<string, unknown>[]; unreadable?: string }>('table', { target: 'service certificate', fields: AI_FIELDS, mediaType, data });
      const r = fromAiRows(res.rows ?? []);
      setRep(r);
      setTicks({});
      setFieldPick(null);
      setAiNote(
        `${t('sr.read', { what: r.lines.length ? tn('n.line', r.lines.length) : t('sr.noLines') })}${res.unreadable ? ` · ${t('dpt.couldNot', { what: res.unreadable })}` : ''}. ${t('sr.check')}`
      );
    } catch (e: any) {
      Alert.alert(t('sr.title'), String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const apply = () => {
    if (!picks.length) return Alert.alert(t('sr.title'), t('sr.tick'));
    if (!rep.nextDate && !rep.lines.some((l) => l.next)) return Alert.alert(t('sr.title'), t('sr.needNext'));
    const bad = picks.filter((p) => p.line != null && ['condemned', 'fail'].includes(rep.lines[p.line].result)).length;
    Alert.alert(
      tn('sr.updateQ', picks.length),
      `${t('sr.updateBody', { field: field === 'expiry' ? t('sr.expiry') : t('sr.nextInsp') })}${bad ? `; ${t('sr.keepOld', { n: bad })}` : ''}. ${t('sr.updateKeep')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('sr.update'), onPress: () => void doApply() },
      ]
    );
  };

  const doApply = async () => {
    setBusy(t('sr.updating'));
    try {
      const newId = uid('cert');
      const cert = certificateFor(rep, picks.map((p) => p.itemId), file ? { fileUri: file.uri, fileName: file.name, fileKind: file.kind } : null, certificates, newId);
      if (cert.id === newId && !(await canAddCertificate(certificates.length))) {
        setBusy(null);
        nav.navigate('Paywall');
        return;
      }
      await snapshot.takeSnapshot(vessel).catch(() => null);
      let changed = 0;
      // From storage, category by category: a sync may have landed since the screen rendered.
      const cats = [...new Set(picks.map((p) => byId.get(p.itemId)?.category).filter(Boolean))] as CategoryKey[];
      for (const c of cats) {
        const fresh = await storage.loadCategory(c);
        const r = applyReport(fresh, rep, picks, field);
        if (r.changed) await storage.saveCategory(c, r.items);
        changed += r.changed;
      }
      await saveCertificate(cert);
      await reload();
      setBusy(null);
      Alert.alert(t('common.done'), t('sr.doneBody', { x: tn('n.item', changed), cert: cert.number || cert.name }));
      nav.replace('CertificateDetail', { id: cert.id });
    } catch (e: any) {
      setBusy(null);
      Alert.alert(t('sr.couldNot'), String(e?.message ?? e));
    }
  };

  const itemLine = (it?: EquipmentItem) =>
    it ? [CATEGORY_MAP[it.category]?.short, it.type, it.no != null && it.no !== '' ? t('round.no', { n: it.no }) : null, it.serial ? `S/N ${it.serial}` : null, it.position].filter(Boolean).join(' · ') : t('sr.gone');

  const row = (id: string, checked: boolean, sub: string, tone?: string) => (
    <TouchableOpacity key={id} style={styles.row} onPress={() => setTicks((t) => ({ ...t, [id]: !checked }))} activeOpacity={0.7}>
      <View style={[styles.check, checked && styles.checkOn]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{itemLine(byId.get(id))}</Text>
        <Text style={[styles.sub, tone ? { color: tone, fontWeight: '700' } : null]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );

  // Registered for every vessel; a link to it must not open a module this vessel does not have.
  if (!moduleOn('serviceReport')) return <Screen><Empty text={t('common.notAvailable')} /></Screen>;

  return (
    <Screen scroll>
      <ScreenTitle title={t('sr.title')} subtitle={t('sr.sub')} help="Certificates" />

      <Label>{`1 · ${t('sr.step1')}`}</Label>
      <View style={styles.chips}>
        <TouchableOpacity style={styles.chip} onPress={attach(pickDocument)}>
          <Text style={styles.chipText}>{t('sr.pdfDoc')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={attach(pickFromLibrary)}>
          <Text style={styles.chipText}>{t('sr.photo')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={attach(pickFromCamera)}>
          <Text style={styles.chipText}>{t('pick.camera')}</Text>
        </TouchableOpacity>
      </View>
      {file ? (
        <View style={styles.fileRow}>
          <MciIcon name={file.kind === 'photo' ? 'image-outline' : 'file-pdf-box'} size={20} color={COLORS.primary} />
          <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{file.name ?? t('dl.attached')}</Text>
          {aiReady(sync.enrolled) ? (
            <TouchableOpacity style={styles.btn} onPress={readAi} disabled={!!busy}>
              <Text style={styles.btnText}>{t('sr.readAi')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <Text style={styles.sub}>{t('sr.optional')}</Text>
      )}
      {aiNote ? <Text style={[styles.sub, { color: COLORS.success, marginTop: SIZES.xs }]}>{aiNote}</Text> : null}
      {busy ? (
        <View style={styles.fileRow}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.sub}>{busy}</Text>
        </View>
      ) : null}

      <Label style={{ marginTop: SIZES.md }}>{`2 · ${t('sr.step2')}`}</Label>
      <Field label={t('ho.namePh')} value={rep.name} onChange={(v) => set({ name: v })} placeholder={t('sr.namePh')} styles={styles} COLORS={COLORS} />
      <View style={styles.pair}>
        <Field label={t('sr.certNo')} value={rep.number} onChange={(v) => set({ number: v })} placeholder="4471" styles={styles} COLORS={COLORS} />
        <Field label={t('sr.station')} value={rep.issuer} onChange={(v) => set({ issuer: v })} placeholder="Firemaster Palma" styles={styles} COLORS={COLORS} />
      </View>
      <SimpleDatePicker label={t('sr.serviceDate')} value={rep.serviceDate} onChange={(d) => set({ serviceDate: d || undefined })} />
      <SimpleDatePicker label={t('sr.nextService')} value={rep.nextDate} onChange={(d) => set({ nextDate: d || undefined })} defaultYear={new Date().getFullYear() + 1} />

      <Label>{t('cat.title')}</Label>
      <View style={styles.chips}>
        {usedCats.map((c) => (
          <TouchableOpacity key={c.key} style={[styles.chip, rep.category === c.key && styles.chipOn]} onPress={() => { set({ category: c.key }); setTicks({}); setFieldPick(null); }}>
            <Text style={[styles.chipText, rep.category === c.key && styles.chipTextOn]}>{c.short ?? c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Label style={{ marginTop: SIZES.md }}>{`3 · ${t('sr.step3')}`}</Label>
      {!rep.category && !rep.lines.length ? <Text style={styles.sub}>{t('sr.chooseAbove')}</Text> : null}
      {m.matches.map((x) => {
        const l = x.line != null ? rep.lines[x.line] : undefined;
        const broken = l?.result === 'condemned' || l?.result === 'fail';
        const sub = [tk(`sr.how.${x.how}`), l?.result ? l.result.toUpperCase() : null, l?.next ? t('sr.nextL', { date: l.next.split('-').reverse().join('.') }) : null, l?.remark].filter(Boolean).join(' · ');
        return row(x.itemId, on(x.itemId, true), sub, broken ? COLORS.danger : undefined);
      })}
      {m.unmatched.length ? (
        <View style={styles.warn}>
          <Text style={[styles.title, { color: COLORS.warning }]}>{t('sr.notFound', { n: m.unmatched.length })}</Text>
          {m.unmatched.map((i) => {
            const l = rep.lines[i];
            return (
              <Text key={i} style={styles.sub}>
                {[l.description, l.no ? t('round.no', { n: l.no }) : null, l.serial ? `S/N ${l.serial}` : null, l.result ? l.result.toUpperCase() : null].filter(Boolean).join(' · ')}
              </Text>
            );
          })}
          <Text style={[styles.sub, { marginTop: SIZES.xs }]}>{t('sr.tickBelow')}</Text>
        </View>
      ) : null}
      {m.others.length ? <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('sr.alsoIn', { cat: CATEGORY_MAP[rep.category!]?.short ?? t('sr.theCat') })}</Text> : null}
      {m.others.map((id) => row(id, on(id, false), t('sr.tickIf')))}

      {picks.length ? (
        <>
          <Label style={{ marginTop: SIZES.md }}>{t('sr.goesInto')}</Label>
          <View style={styles.chips}>
            {(['nextInspection', 'expiry'] as const).map((f) => (
              <TouchableOpacity key={f} style={[styles.chip, field === f && styles.chipOn]} onPress={() => setFieldPick(f)}>
                <Text style={[styles.chipText, field === f && styles.chipTextOn]}>{f === 'expiry' ? t('sr.expiry') : t('sr.nextInsp')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      <TouchableOpacity style={[styles.apply, (!picks.length || !!busy) && { opacity: 0.5 }]} onPress={apply} disabled={!picks.length || !!busy}>
        <Text style={styles.btnText}>{picks.length ? t('sr.applyTo', { x: tn('n.item', picks.length) }) : t('sr.apply')}</Text>
      </TouchableOpacity>
      <Text style={[styles.sub, { marginTop: SIZES.sm }]}>
        The station never gets access to the vessel: you bring its paper in. Condemned or failed items keep their old date and get a remark, so they stay on the list until replaced.
      </Text>
    </Screen>
  );
}

function Field({ label, value, onChange, placeholder, styles, COLORS }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; styles: ReturnType<typeof makeStyles>; COLORS: Palette }) {
  return (
    <View style={{ flex: 1, minWidth: 200 }}>
      <Label>{label}</Label>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={COLORS.textLight} />
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.sm },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.sm, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    fileRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.xs },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 8, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800', textAlign: 'center' },
    apply: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 12, marginTop: SIZES.lg },
    row: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs },
    check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    checkOn: { backgroundColor: COLORS.primary },
    checkMark: { color: COLORS.textWhite, fontWeight: '900', fontSize: 13 },
    warn: { borderWidth: 1, borderColor: COLORS.warning, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginVertical: SIZES.sm },
    title: { color: COLORS.text, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
  });
