// ===================================
// Changing or deleting a signed log record — the Master only, with the reason
// and a confirmed signature; the original stays (services/versions.ts).
//
//   useAmend()      → { edit(spec), remove(spec), ui } — render `ui` once.
//   AmendButtons    Edit / Delete, greyed out and inactive for anyone but the Master.
//   AmendNote       "Amended 11 Oct 09:12 by … — reason · 1 earlier version ▾",
//                   the earlier versions on tap.
// ===================================

import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useSigner } from './SignerChoice';
import { useSignConfirm, withSeal } from './SignConfirm';
import { chainHead } from '../services/seal';
import * as storage from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { Versioned, amended, cancelled, previous } from '../services/versions';
import { uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { t, tn, useT } from '../utils/i18n';
import { playSuccessSound } from '../utils/sound';

export interface FieldSpec {
  /** Field of the record; "tanks.abc" reaches one level into an object. */
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'multiline';
}
interface Spec {
  /** Storage key of the log (services/storage). */
  store: string;
  record: Versioned & Record<string, any>;
  /** What it is, for the dialog and the signature: "Fuel sounding 10 Oct". */
  what: string;
  fields?: FieldSpec[];
  /** Run after the new version is stored (e.g. move a plan back when a record is deleted). */
  onDone?: (next: any, mode: 'edit' | 'remove') => Promise<void> | void;
}

const getAt = (r: any, k: string) => (k.includes('.') ? r?.[k.split('.')[0]]?.[k.split('.')[1]] : r?.[k]);

/** The MARPOL record books — their versions are chained and sealed (services/seal). */
const SEALED_BOOKS = [storage.ORB_KEY, storage.SEWAGE_KEY, storage.BALLAST_KEY, storage.GARBAGE_KEY, storage.FUEL_CHANGE_KEY, storage.ODS_KEY];

export function useAmend() {
  const COLORS = useTheme();
  useT();
  const { appendRow, versionsOf } = useData();
  const { signer, picker } = useSigner();
  const confirmSign = useSignConfirm();
  const [spec, setSpec] = useState<(Spec & { mode: 'edit' | 'remove' }) | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  const open = (s: Spec, mode: 'edit' | 'remove') => {
    const v: Record<string, string> = {};
    for (const f of s.fields ?? []) {
      const x = getAt(s.record, f.key);
      v[f.key] = x == null ? '' : String(x);
    }
    setVals(v);
    setReason('');
    setSpec({ ...s, mode });
  };

  const sign = async () => {
    if (!spec) return;
    if (reason.trim().length < 3) return Alert.alert(t('am.reasonT'), spec.mode === 'edit' ? t('am.whyChange') : t('am.whyDelete'));
    if (!signer) return Alert.alert(t('sign.who'), t('am.chooseName'));
    const changes: Record<string, any> = {};
    if (spec.mode === 'edit') {
      for (const f of spec.fields ?? []) {
        const raw = (vals[f.key] ?? '').trim();
        let v: any = raw;
        if (f.kind === 'number') {
          if (raw === '') v = undefined;
          else {
            v = Number(raw.replace(',', '.'));
            if (!Number.isFinite(v)) return Alert.alert(f.label, t('am.enterNumber'));
          }
        }
        if (f.key.includes('.')) {
          const [a, b] = f.key.split('.');
          const obj = { ...(changes[a] ?? spec.record[a] ?? {}) };
          if (v === undefined || v === '') delete obj[b];
          else obj[b] = v;
          changes[a] = obj;
        } else if (v === '' || v === undefined) {
          // An emptied field is left out — the server refuses undefined.
          changes[f.key] = undefined;
        } else changes[f.key] = v;
      }
    }
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${spec.mode === 'edit' ? 'Change' : 'Delete'} — ${spec.what}: ${reason.trim()}` });
    if (!sig) return;
    const by = { name: signer.name, ...(signer.rank ? { rank: signer.rank } : {}), id: signer.key, ...(sig.proof ? { proof: sig.proof } : {}) };
    const id = uid(spec.record.id.split('_')[0] || 'rec');
    let next: any = spec.mode === 'edit' ? amended(spec.record, changes, id, reason.trim(), by) : cancelled(spec.record, id, reason.trim(), by);
    // In a record book the new version joins the book's chain where it stands now, and the amender seals it (services/seal).
    const book = SEALED_BOOKS.includes(spec.store);
    next = Object.fromEntries(Object.entries(book ? { ...next, prev: chainHead(versionsOf(spec.store)) } : next).filter(([, v]) => v !== undefined));
    if (book) next = withSeal(next, sig, 'editedWith');
    await appendRow(spec.store, next);
    await spec.onDone?.(next, spec.mode);
    setSpec(null);
    playSuccessSound();
  };

  const ui = (
    <Modal visible={!!spec} transparent animationType="fade" onRequestClose={() => setSpec(null)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: COLORS.cardSolid }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: COLORS.textDark }]}>{spec?.mode === 'edit' ? t('am.changeT') : t('am.deleteT')}</Text>
            <Text style={[styles.sub, { color: COLORS.textLight }]}>{spec?.what}</Text>
            {spec?.mode === 'remove' ? <Text style={[styles.sub, { color: COLORS.textLight }]}>{t('am.staysHint')}</Text> : null}
            {spec?.mode === 'edit'
              ? (spec.fields ?? []).map((f) => (
                  <View key={f.key} style={{ marginTop: SIZES.sm }}>
                    <Text style={[styles.label, { color: COLORS.textLight }]}>{f.label}</Text>
                    <TextInput
                      style={[styles.input, { color: COLORS.text, borderColor: COLORS.border }, f.kind === 'multiline' && { minHeight: 60, textAlignVertical: 'top' }]}
                      value={vals[f.key] ?? ''}
                      onChangeText={(t) => setVals({ ...vals, [f.key]: t })}
                      keyboardType={f.kind === 'number' ? 'decimal-pad' : 'default'}
                      multiline={f.kind === 'multiline'}
                    />
                  </View>
                ))
              : null}
            <Text style={[styles.label, { color: COLORS.warning, marginTop: SIZES.md }]}>{t('am.reason')}</Text>
            <TextInput style={[styles.input, { color: COLORS.text, borderColor: COLORS.warning }]} value={reason} onChangeText={setReason} placeholder={spec?.mode === 'edit' ? t('am.phChange') : t('am.phDelete')} placeholderTextColor={COLORS.textLight} />
            {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: spec?.mode === 'remove' ? COLORS.danger : COLORS.primary }]} onPress={() => void sign()}>
                <Text style={styles.btnText}>{spec?.mode === 'edit' ? t('am.signChange') : t('am.signDelete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSpec(null)}>
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return { edit: (s: Spec) => open(s, 'edit'), remove: (s: Spec) => open(s, 'remove'), ui };
}

export function AmendButtons({ isMaster, onEdit, onDelete, row }: { isMaster: boolean; onEdit?: () => void; onDelete: () => void; row?: boolean }) {
  const COLORS = useTheme();
  useT();
  // The Master's alone (11 Oct 2026); everyone else sees them greyed out.
  return (
    <View style={{ gap: row ? SIZES.md : 6, flexDirection: row ? 'row' : 'column', opacity: isMaster ? 1 : 0.35 }} accessibilityState={{ disabled: !isMaster }}>
      {onEdit ? (
        <TouchableOpacity disabled={!isMaster} onPress={onEdit} hitSlop={6}>
          <Text style={{ color: isMaster ? COLORS.primary : COLORS.textLight, fontWeight: '700', fontSize: SIZES.small }}>{t('common.edit')}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity disabled={!isMaster} onPress={onDelete} hitSlop={6}>
        <Text style={{ color: isMaster ? COLORS.danger : COLORS.textLight, fontWeight: '700', fontSize: SIZES.small }}>{t('common.delete')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function AmendNote<T extends Versioned>({ rec, all, summary }: { rec: T; all: T[]; summary: (r: T) => string }) {
  const COLORS = useTheme();
  useT();
  const [open, setOpen] = useState(false);
  if (!rec.supersedes) return null;
  const prev = previous(all, rec);
  return (
    <View>
      <TouchableOpacity onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.sub, { color: rec.cancelled ? COLORS.danger : COLORS.warning, fontWeight: '700' }]}>
          {`${rec.cancelled ? t('am.deleted') : t('am.amended')}${rec.editedAt ? ` ${uiDateTime(rec.editedAt)}` : ''}${rec.editedBy ? t('am.by', { who: rec.editedByRank ? `${rec.editedBy} (${rec.editedByRank})` : rec.editedBy }) : ''} — ${rec.editReason ?? ''} · ${tn('n.earlierVersion', prev.length)} ${open ? '▴' : '▾'}`}
        </Text>
      </TouchableOpacity>
      {open ? prev.map((p) => <Text key={p.id} style={[styles.sub, { color: COLORS.textLight, textDecorationLine: 'line-through' }]}>{summary(p)}</Text>) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: SIZES.lg },
  card: { borderRadius: SIZES.radiusLg, padding: SIZES.lg, width: '100%', maxWidth: 460, maxHeight: '90%' },
  title: { fontSize: SIZES.h4, fontWeight: '800' },
  sub: { fontSize: SIZES.small, marginTop: 2 },
  label: { fontSize: SIZES.small, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.lg },
  btn: { borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
  btnText: { color: '#fff', fontWeight: '800' },
});
