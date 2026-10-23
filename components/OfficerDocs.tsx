// ===================================
// A shelf of documents for the Master and the officers (types/officerDocs.ts):
// SOPEP docs on the SOPEP menu, the Ship Security Plan on Security (15 Oct 2026).
//
// Each document: title (the usual ones offered), number, revision, issued, next
// review, a note, and its file — a PDF or a photograph, kept in the officers-only
// folder. The crew see that the shelf exists and who keeps it, not what is on it.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { t, useT } from '../utils/i18n';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import * as storage from '../services/storage';
import { DocShelf, OfficerDoc, SHELF_STARTER } from '../types/officerDocs';
import { personName, roleAtLeast } from '../types/role';
import { keepRestrictedFile, openMedFile, pickMedFile, sizeText } from '../services/medFiles';
import { todayIso } from '../services/pms';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from '../screens/SafetySc';

const KEY: Record<DocShelf, string> = { sopep: storage.SOPEP_DOCS_KEY, ssp: storage.SSP_DOCS_KEY };

export function OfficerDocs({ shelf, intro }: { shelf: DocShelf; intro: string }) {
  const COLORS = useTheme();
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { sopepDocs, sspDocs, vessel, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const docs = (shelf === 'sopep' ? sopepDocs : sspDocs).slice().sort((a, b) => a.title.localeCompare(b.title));
  const today = todayIso();
  const [edit, setEdit] = useState<OfficerDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!officer) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
          <MciIcon name="lock-outline" size={22} color={COLORS.textLight} />
          <Text style={[styles.sub, { flex: 1 }]}>{t('odc.only')}</Text>
        </View>
      </Card>
    );
  }

  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) return Alert.alert(t('pax.document'), t('odc.needTitle'));
    const clean = Object.fromEntries(Object.entries({ ...edit, title: edit.title.trim() }).filter(([, v]) => v !== '' && v !== undefined)) as unknown as OfficerDoc;
    await saveRow(KEY[shelf], clean);
    setEdit(null);
    playSuccessSound();
  };

  const attach = async (d: OfficerDoc) => {
    try {
      const f = await pickMedFile();
      if (!f) return;
      setBusy(d.id);
      const url = await keepRestrictedFile(vessel?.imo, sync.enrolled, d.id, uid('f'), f);
      await saveRow(KEY[shelf], { ...d, fileUri: url, fileName: f.name, by: sync.me ? personName(sync.me) : d.by });
      playSuccessSound();
    } catch (e: any) {
      Alert.alert(t('tr.file'), String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const review = (d: OfficerDoc) => (d.reviewDue && d.reviewDue < today ? { text: t('odc.reviewOverdue', { date: uiDate(d.reviewDue) }), color: COLORS.danger } : d.reviewDue ? { text: t('odc.review', { date: uiDate(d.reviewDue) }), color: COLORS.textLight } : null);
  const missing = SHELF_STARTER[shelf].filter((t) => !docs.some((d) => d.title.toLowerCase() === t.toLowerCase()));

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm }}>
        <MciIcon name="shield-lock-outline" size={18} color={COLORS.primary} />
        <Text style={[styles.sub, { flex: 1, marginTop: 0 }]}>{intro}</Text>
      </View>
      <View style={[styles.row, { marginTop: 0 }]}>
        <TouchableOpacity style={styles.btn} onPress={() => setEdit({ id: uid('odoc'), title: '', updatedAt: Date.now() })}><Text style={styles.btnText}>{t('odc.add')}</Text></TouchableOpacity>
      </View>
      {edit ? (
        <Card>
          <Label>{docs.some((d) => d.id === edit.id) ? t('pax.document') : t('fv.newDoc')}</Label>
          {!edit.title && missing.length ? (
            <View style={styles.chips}>
              {missing.map((t) => (
                <TouchableOpacity key={t} style={styles.chip} onPress={() => setEdit({ ...edit, title: t })}><Text style={styles.chipText}>{t}</Text></TouchableOpacity>
              ))}
            </View>
          ) : null}
          <TextInput style={styles.input} value={edit.title} onChangeText={(v) => setEdit({ ...edit, title: v })} placeholder={t('fv.titleReq')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, minWidth: 160, marginTop: 0 }]} value={edit.docNo ?? ''} onChangeText={(v) => setEdit({ ...edit, docNo: v })} placeholder={t('odc.numberPh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { width: 110, marginTop: 0 }]} value={edit.revision ?? ''} onChangeText={(v) => setEdit({ ...edit, revision: v })} placeholder={t('doc.revision')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { width: 150, marginTop: 0 }]} value={edit.issued ?? ''} onChangeText={(v) => setEdit({ ...edit, issued: v })} placeholder={t('odc.issuedPh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { width: 170, marginTop: 0 }]} value={edit.reviewDue ?? ''} onChangeText={(v) => setEdit({ ...edit, reviewDue: v })} placeholder={t('odc.reviewPh')} placeholderTextColor={COLORS.textLight} />
          </View>
          <TextInput style={styles.input} value={edit.notes ?? ''} onChangeText={(v) => setEdit({ ...edit, notes: v })} placeholder={t('odc.notePh')} placeholderTextColor={COLORS.textLight} multiline />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
            {docs.some((d) => d.id === edit.id) ? (
              <TouchableOpacity onPress={() => Alert.alert(t('common.remove'), t('odc.removeQ', { name: edit.title }), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.remove'), style: 'destructive', onPress: () => void saveRow(KEY[shelf], { ...edit, deleted: true }).then(() => setEdit(null)) }])}>
                <Text style={[styles.link, { color: COLORS.danger }]}>{t('common.remove')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>
      ) : null}

      {!docs.length && !edit ? <Text style={styles.sub}>{t('odc.empty', { list: SHELF_STARTER[shelf].slice(0, 4).join(', ') })}</Text> : null}
      {docs.map((d) => {
        const r = review(d);
        return (
          <View key={d.id} style={[styles.item, { borderLeftColor: !d.fileUri ? COLORS.warning : r?.color === COLORS.danger ? COLORS.danger : COLORS.success }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }}>
              <MciIcon name={d.fileUri ? 'file-pdf-box' : 'file-outline'} size={22} color={d.fileUri ? COLORS.primary : COLORS.textLight} />
              <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 }}>
                <Text style={styles.name}>{d.title}</Text>
                <Text style={styles.sub}>{[d.docNo, d.revision ? t('odc.rev', { n: d.revision }) : null, d.issued ? t('odc.issued', { date: uiDate(d.issued) }) : null].filter(Boolean).join(' · ') || '—'}</Text>
                {r ? <Text style={[styles.sub, { color: r.color, fontWeight: r.color === COLORS.danger ? '700' : '400' }]}>{r.text}</Text> : null}
                {d.notes ? <Text style={styles.sub}>{d.notes}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: SIZES.xs, marginLeft: 'auto' }}>
                {d.fileUri ? (
                  <TouchableOpacity style={styles.small} onPress={() => void openMedFile(d.fileUri!, d.fileName ?? d.title).catch((e) => Alert.alert(t('tr.file'), String(e?.message ?? e)))}>
                    <Text style={styles.smallText}>{t('odc.open')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.small, busy === d.id && { opacity: 0.4 }]} disabled={busy === d.id} onPress={() => void attach(d)}>
                  <Text style={styles.smallText}>{busy === d.id ? t('odc.uploading') : d.fileUri ? t('it.replaceFile') : t('odc.attach')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.small} onPress={() => setEdit(d)}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
      <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('odc.filesNote', { size: sizeText(8 * 1024 * 1024) })}</Text>
    </>
  );
}
