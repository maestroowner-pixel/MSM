// ===================================
// A person's wristband, or a place's tag — on the crew member's card, the guest's card,
// a checkpoint, a muster station and a piece of equipment (types/nfc.ts).
//
// Shows the tag in force (the end of its UID, when and by whom it was given). An officer
// writes one on a phone that reads NFC — the words go on the chip, its UID onto the
// register — or revokes it from any device (a new one is given only after that),
// a browser included. A chip that takes no words — a smartwatch's or a door card's
// access-card NFC, with a fixed UID — is registered as is: its UID alone proves it
// (services/nfcTags.resolveTap checks the words only when a tag has some). Nothing at
// all with the module off.
// ===================================

import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { roleAtLeast, personName } from '../types/role';
import { NfcTagKind } from '../types/nfc';
import { activeTag, issueTag, payloadFor, revokeTag, uidTail } from '../services/nfcTags';
import { cancelRead, nfcReady, readTag, writeTag } from '../services/nfcReader';
import * as storage from '../services/storage';
import { uiDate } from '../utils/dates';
import { t, useT } from '../utils/i18n';

export function NfcTagRow({ kind, refId, name }: { kind: NfcTagKind; refId: string; name: string }) {
  useT();
  const COLORS = useTheme();
  const styles = makeStyles(COLORS);
  const { nfcTags, saveRows, saveRow } = useData();
  const sync = useSync();
  const [canWrite, setCanWrite] = useState(false);
  /** What the phone is waiting for: the prompt shown, with Cancel (Android has no sheet of its own). */
  const [busy, setBusy] = useState<string | null>(null);
  const on = moduleOn('nfc');
  useEffect(() => {
    if (on) void nfcReady().then(setCanWrite);
  }, [on]);
  if (!on) return null;

  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const tag = activeTag(nfcTags, kind, refId);
  const by = sync.me ? personName(sync.me) : 'Officer';
  const what = kind === 'person' ? t('nfc.band') : t('nfc.tag');

  const enter = (uid: string) => {
    // The same chip again for the same person: nothing changes on the register.
    if (tag && tag.uid === uid.replace(/[^0-9a-f]/gi, '').toUpperCase()) return;
    return saveRows(storage.NFC_TAGS_KEY, issueTag(nfcTags, uid, kind, refId, name, by, Date.now()));
  };

  const write = async () => {
    const prompt = t('nfc.holdToWrite', { name });
    setBusy(prompt);
    try {
      await enter(await writeTag(payloadFor(kind, refId), prompt));
    } catch (e: any) {
      if (!/cancel/i.test(`${e?.constructor?.name ?? ''} ${e?.message ?? e}`)) Alert.alert(what, kind === 'person' ? `${t('nfc.writeFailed')}\n\n${t('nfc.writeFailedWatch')}` : t('nfc.writeFailed'));
    } finally {
      setBusy(null);
    }
  };

  /** Only the UID onto the register, nothing written: a watch or a door card. */
  const register = async () => {
    const prompt = t('nfc.holdToRegister', { name });
    setBusy(prompt);
    try {
      const read = await readTag(prompt);
      if (read) await enter(read.uid);
    } finally {
      setBusy(null);
    }
  };

  const stop = () => {
    void cancelRead();
    setBusy(null);
  };

  const revoke = () =>
    Alert.alert(what, t('nfc.revokeAsk', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('nfc.revoke'),
        style: 'destructive',
        onPress: () => tag && void saveRow(storage.NFC_TAGS_KEY, revokeTag(tag, by, Date.now())),
      },
    ]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <MciIcon name="nfc-variant" size={22} color={tag ? COLORS.success : COLORS.textLight} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{what}</Text>
          <Text style={styles.sub}>
            {tag
              ? t('nfc.issued', {
                  uid: uidTail(tag.uid),
                  date: uiDate(new Date(tag.issuedAt).toISOString().slice(0, 10)),
                  by: tag.issuedBy,
                })
              : t('nfc.none')}
          </Text>
          {/* Equipment is mostly steel, where an ordinary NTAG sticker is not read at all. */}
          {kind === 'item' && !tag ? <Text style={styles.sub}>{t('nfc.metalHint')}</Text> : null}
        </View>
      </View>
      <View style={styles.row}>
        {/* One tag in force at a time: another is given after Revoke, so a stray tap cannot re-bind it. */}
        {officer && canWrite && !busy && !tag ? (
          <>
            <TouchableOpacity style={styles.btn} onPress={() => void write()}>
              <Text style={styles.btnText}>{t('nfc.write')}</Text>
            </TouchableOpacity>
            {kind === 'person' ? (
              <TouchableOpacity style={styles.btn} onPress={() => void register()}>
                <Text style={styles.btnText}>{t('nfc.register')}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
        {busy ? (
          <>
            <Text style={[styles.sub, { flexBasis: '100%' }]}>{busy}</Text>
            <TouchableOpacity style={styles.btn} onPress={stop}>
              <Text style={styles.btnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {officer && tag && !busy ? (
          <TouchableOpacity style={[styles.btn, { borderColor: COLORS.danger }]} onPress={revoke}>
            <Text style={[styles.btnText, { color: COLORS.danger }]}>{t('nfc.revoke')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    wrap: { paddingVertical: SIZES.sm, gap: SIZES.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    // The buttons under the name, left-aligned with its text: beside it they squeezed "NFC wristband" a word a line on a phone.
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap', paddingLeft: 22 + SIZES.sm },
    title: { color: COLORS.textDark, fontWeight: '700', fontSize: SIZES.body },
    sub: { color: COLORS.textLight, fontSize: SIZES.small },
    btn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    btnText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
