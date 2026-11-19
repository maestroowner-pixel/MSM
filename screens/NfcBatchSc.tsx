// ===================================
// NFC tags in a row (modal) — a tag for each selected piece of equipment, one after another.
//
// Reached from CategoryItems' multi-select, beside the QR labels. Forty extinguishers
// tagged from forty cards is forty trips back to the list; here the next item without a
// tag comes up by itself as soon as the last one is written. Items that already have a
// tag are passed over (a new one is given from the card, after Revoke, as NfcTagRow says).
//
// A chip already on the register is refused BEFORE anything is written to it
// (nfcReader.writeTag's `refuse`): the sticker just put on the last item, held to the
// phone again, would otherwise be rewritten for this one and taken from that.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP, catLabel } from '../constants/categories';
import { EquipmentItem } from '../types/equipment';
import { NfcTag } from '../types/nfc';
import { roleAtLeast, personName } from '../types/role';
import { activeTag, batchQueue, issueTag, payloadFor, tagHolder, uidTail } from '../services/nfcTags';
import { cancelRead, claimNfc, nfcReady, writeTag } from '../services/nfcReader';
import * as storage from '../services/storage';
import { itemLocation, itemNumber, typeWithSize } from '../utils/itemText';
import { goBackOr } from '../utils/nav';
import { t, useT } from '../utils/i18n';

/** The name on the register — the same as the card's NfcTagRow gives (ItemDetailSc). */
const nameOf = (it: EquipmentItem) => {
  const meta = CATEGORY_MAP[it.category];
  return [itemNumber(it), typeWithSize(it) || (meta ? catLabel(meta) : '')].filter(Boolean).join(' · ');
};

export default function NfcBatchSc() {
  useT();
  const COLORS = useTheme();
  const styles = makeStyles(COLORS);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { flat, nfcTags, saveRows } = useData();
  const sync = useSync();
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  /** The item the phone is waiting for; null when stopped. */
  const [current, setCurrent] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The loop outlives renders: it reads the register and the skips from here, not from a stale closure.
  const tagsRef = useRef<NfcTag[]>(nfcTags);
  tagsRef.current = nfcTags;
  const skippedRef = useRef(skipped);
  skippedRef.current = skipped;
  const stopRef = useRef(false);
  const skipRef = useRef(false);

  const ids: string[] = route.params?.ids ?? [];
  const items = useMemo(
    () => ids.map((id) => flat.find((i) => i.id === id)).filter((i): i is EquipmentItem => !!i),
    [ids, flat]
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const itemIds = items.map((i) => i.id);
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const by = sync.me ? personName(sync.me) : 'Officer';

  useEffect(() => {
    void nfcReady().then(setCanWrite);
    // The app-wide listener stands aside while tags are written here.
    const give = claimNfc();
    return () => {
      stopRef.current = true;
      void cancelRead();
      give();
    };
  }, []);

  const run = async () => {
    stopRef.current = false;
    setNote(null);
    let failures = 0;
    while (!stopRef.current) {
      const id = batchQueue(itemIds, tagsRef.current, 'item', skippedRef.current)[0];
      const it = id ? byId.get(id) : undefined;
      if (!it) break;
      const name = nameOf(it);
      setCurrent(id);
      try {
        const uid = await writeTag(payloadFor('item', id), t('nfc.holdToWrite', { name }), (u) => !!tagHolder(tagsRef.current, u));
        const rows = issueTag(tagsRef.current, uid, 'item', id, name, by, Date.now());
        // Ahead of the context's own update, so the next turn of the loop already sees it.
        tagsRef.current = [...rows, ...tagsRef.current.filter((x) => !rows.some((r) => r.id === x.id))];
        await saveRows(storage.NFC_TAGS_KEY, rows);
        setNote(null);
        failures = 0;
      } catch (e: any) {
        const msg = `${e?.constructor?.name ?? ''} ${e?.message ?? e}`;
        if (skipRef.current) {
          skipRef.current = false;
          continue;
        }
        // A chip already on the register: nothing was written, the same item stays up.
        if (e?.message === 'taken') setNote(t('nfc.batchTaken'));
        // Cancelled, timed out (iOS, 60 s) or no reader: the row stops where it was.
        else if (/cancel|timeout/i.test(msg) || e?.message === 'nfc') break;
        else {
          setNote(t('nfc.writeFailed'));
        }
        // A tag that keeps failing is not fought for ever: stop and let the officer choose.
        if (++failures >= 3) break;
      }
    }
    setCurrent(null);
  };

  const skip = () => {
    if (!current) return;
    skipRef.current = true;
    setSkipped((prev) => new Set(prev).add(current));
    skippedRef.current = new Set(skippedRef.current).add(current);
    void cancelRead();
  };

  const stop = () => {
    stopRef.current = true;
    void cancelRead();
  };

  const unskip = (id: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  if (items.length === 0) {
    return (
      <Screen>
        <BackButton onPress={() => goBackOr(nav)} fav={false} />
        <ScreenTitle title={t('lbl.nothing')} subtitle={t('lbl.gone')} />
      </Screen>
    );
  }

  const done = items.filter((i) => activeTag(nfcTags, 'item', i.id)).length;
  const left = batchQueue(itemIds, nfcTags, 'item', skipped).length;
  const cur = current ? byId.get(current) : undefined;

  return (
    <Screen>
      <BackButton onPress={() => goBackOr(nav)} fav={false} />
      <ScreenTitle title={t('nfc.batchTitle')} subtitle={t('nfc.batchSub', { done, n: items.length })} />

      <Card style={styles.now}>
        {canWrite === false || !officer ? (
          <Text style={styles.sub}>{officer ? t('nfc.batchNoReader') : t('nfc.batchOfficers')}</Text>
        ) : cur ? (
          <>
            <View style={styles.head}>
              <MciIcon name="nfc-variant" size={28} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{nameOf(cur)}</Text>
                {itemLocation(cur) ? <Text style={styles.sub}>{itemLocation(cur)}</Text> : null}
              </View>
            </View>
            <Text style={styles.body}>{t('nfc.holdToWrite', { name: nameOf(cur) })}</Text>
            {note ? <Text style={[styles.sub, { color: COLORS.danger }]}>{note}</Text> : null}
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={skip}>
                <Text style={styles.btnText}>{t('nfc.batchSkip')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={stop}>
                <Text style={styles.btnText}>{t('nfc.batchStop')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : left ? (
          <>
            <Text style={styles.body}>{t('nfc.batchHint')}</Text>
            <Text style={styles.sub}>{t('nfc.metalHint')}</Text>
            {note ? <Text style={[styles.sub, { color: COLORS.danger }]}>{note}</Text> : null}
            <TouchableOpacity style={[styles.btn, styles.btnFill]} onPress={() => void run()} disabled={canWrite !== true}>
              <MciIcon name="nfc-variant" size={18} color={COLORS.textWhite} />
              <Text style={[styles.btnText, { color: COLORS.textWhite }]}>{done || skipped.size ? t('nfc.batchGoOn') : t('nfc.batchStart')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.body}>{skipped.size ? t('nfc.batchLeftSkipped') : t('nfc.batchAll')}</Text>
        )}
      </Card>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: SIZES.xxxl }}>
        {items.map((it) => {
          const tag = activeTag(nfcTags, 'item', it.id);
          const isSkipped = !tag && skipped.has(it.id);
          const isCur = it.id === current;
          return (
            <TouchableOpacity
              key={it.id}
              style={[styles.item, isCur && styles.itemCur]}
              disabled={!isSkipped || !!current}
              onPress={() => unskip(it.id)}
            >
              <MciIcon
                name={tag ? 'check-circle' : isSkipped ? 'skip-next-circle-outline' : isCur ? 'nfc-variant' : 'checkbox-blank-circle-outline'}
                size={20}
                color={tag ? COLORS.success : isCur ? COLORS.primary : COLORS.textLight}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{nameOf(it)}</Text>
                <Text style={styles.sub}>
                  {[itemLocation(it), tag ? `…${uidTail(tag.uid)}` : isSkipped ? t('nfc.batchSkipped') : ''].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    now: { gap: SIZES.sm, marginBottom: SIZES.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    row: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap' },
    title: { color: COLORS.textDark, fontWeight: '700', fontSize: SIZES.body },
    body: { color: COLORS.textDark, fontSize: SIZES.body },
    sub: { color: COLORS.textLight, fontSize: SIZES.small },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.xs,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
    },
    btnFill: { backgroundColor: COLORS.primary },
    btnText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body },
    item: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.xs, borderRadius: SIZES.radiusMd },
    itemCur: { backgroundColor: COLORS.primary + '18' },
    itemName: { color: COLORS.textDark, fontSize: SIZES.body, fontWeight: '600' },
  });
