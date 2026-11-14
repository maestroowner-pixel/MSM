// ===================================
// One night of the Night Order Book, or one revision of standing orders
// (types/orderBook.ts). Route params: `kind` night / master / dp, `id` (or `new`).
//
// A night: the Master writes the orders, where the ship is, when to be called,
// and ticks who keeps a watch tonight; each of them signs "read" on their own
// device. Until someone signs, the Master may put it right; in the morning the
// Master closes it. Written in error: cancelled with a reason, never deleted.
// A revision: the Master issues the new text (starting from the one in force)
// and what changed; it is never edited — the next text is the next revision.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { isAboard, isOfficerRank } from '../types/crew';
import { roleAtLeast } from '../types/role';
import { NightOrder, OrderAck, OrderKind, OrderReaders, OrderStamp, StandingKind, StandingOrder, orderAckId, standingId } from '../types/orderBook';
import * as storage from '../services/storage';
import { isMasterRank } from '../services/appraisals';
import { currentStanding, defaultWatch, hasSigned, isBridgeRank, nextRev, nightEditable, nightProblem, nightState, signStatus, standingProblem, standingReaders } from '../services/orderBook';
import { exportStanding, shareNight, shareStanding } from '../services/orderBookReport';
import { todayIso } from '../services/pms';
import { nowLocal } from '../services/permits';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { nightColor, signerPerson } from './OrderBookSc';
import { t, tk, useT } from '../utils/i18n';

export default function OrderEntrySc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { nightOrders, standingOrders, orderAcks, crew, vessel, saveRow } = useData();
  const sync = useSync();
  const { signer, picker } = useSigner();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const today = todayIso();
  const now = nowLocal();
  const kind: OrderKind = route.params?.kind === 'master' || route.params?.kind === 'dp' ? route.params.kind : 'night';
  const isNew = route.params?.id === 'new';
  const back = () => goBackOr(nav, 'OrderBook', { view: kind });

  const storedNight = kind === 'night' ? nightOrders.find((o) => o.id === route.params?.id) : undefined;
  const storedRev = kind !== 'night' ? standingOrders.find((s) => s.id === route.params?.id) : undefined;
  const [night, setNight] = useState<NightOrder | null>(() =>
    isNew && kind === 'night' ? { id: uid('nob'), date: today, text: '', watch: defaultWatch(crew), by: '', createdAt: Date.now(), updatedAt: 0 } : null,
  );
  const [rev, setRev] = useState<{ issued: string; text: string; changeNote: string; readers: OrderReaders } | null>(() => {
    if (!isNew || kind === 'night') return null;
    const cur = currentStanding(standingOrders, kind);
    return { issued: today, text: cur?.text ?? '', changeNote: '', readers: cur?.readers ?? 'bridge' };
  });
  const [ending, setEnding] = useState<{ what: 'close' | 'cancel'; note: string } | null>(null);

  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const fail = (e: any) => Alert.alert(t('ob.title'), String(e?.message ?? e));
  const whoOf = (x: { by: string; byRank?: string }) => (x.byRank ? `${x.by} (${x.byRank})` : x.by || '—');
  // A name when there is one to give: a device on its own with no crew list still keeps its book.
  const who = (): { by: string; byRank?: string } | null => {
    if (signer) return { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}) };
    if (crew.length) {
      Alert.alert(t('sign.who'), t('pd.chooseName'));
      return null;
    }
    return { by: '' };
  };
  // The orders are the Master's: on a device without the Master's own account, the name picked must be the Master's.
  const masterWho = (): { by: string; byRank?: string } | null => {
    const w = who();
    if (!w) return null;
    if (!sync.me && crew.some((c) => isAboard(c) && isMasterRank(c.rank)) && !isMasterRank(w.byRank)) {
      Alert.alert(t('ob.title'), t('ob.masterSigns'));
      return null;
    }
    return w;
  };
  const signRead = async (orderId: string, rev?: number) => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const ack: OrderAck = { id: orderAckId(orderId, signer.key), orderId, kind, ...(rev ? { rev } : {}), personKey: signer.key, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), updatedAt: Date.now() };
    await saveRow(storage.ORDER_ACKS_KEY, ack);
    playSuccessSound();
  };
  const signedLines = (st: ReturnType<typeof signStatus>) => (
    <>
      {st.signed.map((x) => <Text key={x.ack.id} style={styles.sub}>{`✓ ${x.reader.name}${x.reader.rank ? ` · ${x.reader.rank}` : ''} · ${uiDateTime(x.ack.at)}`}</Text>)}
      {st.others.map((a) => <Text key={a.id} style={styles.sub}>{`✓ ${whoOf(a)} · ${uiDateTime(a.at)}`}</Text>)}
      {st.unsigned.length ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700', marginTop: 6 }]}>{t('ob.notYet', { names: st.unsigned.map((r) => r.name).join(', ') })}</Text> : null}
    </>
  );

  if (!officer) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('ob.officersOnly')}</Text>
      </Screen>
    );
  }

  // ---- a new revision of standing orders ----
  if (rev && kind !== 'night') {
    const k: StandingKind = kind;
    const n = nextRev(standingOrders, k);
    const issue = async () => {
      const bad = standingProblem(rev);
      if (bad) return Alert.alert(t('ob.title'), tk(`ob.bad.${bad}`));
      const w = masterWho();
      if (!w) return;
      const s: StandingOrder = JSON.parse(JSON.stringify({
        id: standingId(k, n), kind: k, rev: n, issued: rev.issued, text: rev.text.trim(), changeNote: rev.changeNote.trim() || undefined,
        readers: rev.readers, ...w, createdAt: Date.now(), updatedAt: Date.now(),
      }));
      await saveRow(storage.STANDING_ORDERS_KEY, s);
      playSuccessSound();
      back();
    };
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <ScreenTitle title={t(`ob.view.${k}`)} subtitle={t('ob.newRevN', { rev: n })} help="The Master's orders" />
        <Card>
          <SimpleDatePicker label={t('ob.inForceFrom')} value={rev.issued} onChange={(v) => setRev({ ...rev, issued: v || today })} />
          <Label>{t('ob.orders')}</Label>
          <TextInput style={[styles.input, { minHeight: 220, textAlignVertical: 'top' }]} value={rev.text} onChangeText={(v) => setRev({ ...rev, text: v })} multiline placeholder={t(k === 'dp' ? 'ob.dpPh' : 'ob.masterPh')} placeholderTextColor={COLORS.textLight} />
          {n > 1 ? (
            <>
              <Label>{t('ob.changeNote')}</Label>
              <TextInput style={styles.input} value={rev.changeNote} onChangeText={(v) => setRev({ ...rev, changeNote: v })} multiline placeholder={t('ob.changePh')} placeholderTextColor={COLORS.textLight} />
            </>
          ) : null}
          <Label>{t('ob.whoReads')}</Label>
          <View style={styles.chips}>
            {chip(rev.readers === 'bridge', t('ob.readers.bridge'), () => setRev({ ...rev, readers: 'bridge' }), 'bridge')}
            {chip(rev.readers === 'officers', t('ob.readers.officers'), () => setRev({ ...rev, readers: 'officers' }), 'officers')}
          </View>
          <Text style={styles.sub}>{t('ob.revHint')}</Text>
          {picker ? <View style={{ marginTop: 6 }}>{picker}</View> : null}
        </Card>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} disabled={!isMaster} onPress={() => void issue()}><Text style={styles.btnText}>{t('ob.issue')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={back}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // ---- a revision as issued ----
  if (kind !== 'night') {
    if (!storedRev) {
      return (
        <Screen scroll>
          <BackButton onPress={back} />
          <Text style={styles.sub}>{t('ob.notHere')}</Text>
        </Screen>
      );
    }
    const s = storedRev;
    const current = currentStanding(standingOrders, s.kind)?.id === s.id;
    const st = signStatus(s.id, current ? standingReaders(crew, s.readers) : [], orderAcks);
    const me = signerPerson(signer);
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <ScreenTitle title={t(`ob.view.${s.kind}`)} subtitle={`${t('ob.revFrom', { rev: s.rev, date: uiDate(s.issued) })} · ${current ? t('ob.current') : t('ob.superseded')}`} help="The Master's orders" />
        <Card>
          <Text style={styles.sub}>{[t('ob.issuedBy', { by: whoOf(s) }), t(`ob.readers.${s.readers}`)].join(' · ')}</Text>
          {s.changeNote ? <><Label>{t('ob.changeNote')}</Label><Text style={styles.body}>{s.changeNote}</Text></> : null}
          <Label>{t('ob.orders')}</Label>
          <Text style={styles.body}>{s.text}</Text>
        </Card>
        <Card>
          <Label>{t('ob.readSigned')}</Label>
          {current && me && !hasSigned(s.id, orderAcks, me) ? (
            <TouchableOpacity style={styles.btn} onPress={() => void signRead(s.id, s.rev)}><Text style={styles.btnText}>{t('ob.signRead')}</Text></TouchableOpacity>
          ) : null}
          {current && !me && picker ? picker : null}
          {signedLines(st)}
        </Card>
        <View style={styles.row}>
          <TouchableOpacity style={styles.small} onPress={() => void exportStanding(s, standingOrders, orderAcks, crew, vessel, today, current).catch(fail)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} onPress={() => void shareStanding(s, standingOrders, orderAcks, crew, vessel, today, current).catch(fail)}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // ---- writing a night (new, or put right before anyone signed) ----
  if (night) {
    const officers = crew.filter((c) => isAboard(c) && (isOfficerRank(c.rank) || isBridgeRank(c.rank)));
    const on = (id: string) => night.watch.some((r) => r.key === id);
    const toggle = (id: string) => {
      const c = officers.find((x) => x.id === id)!;
      setNight({ ...night, watch: on(id) ? night.watch.filter((r) => r.key !== id) : [...night.watch, { key: c.id, name: c.name, ...(c.rank ? { rank: c.rank } : {}) }] });
    };
    const save = async () => {
      const bad = nightProblem(night);
      if (bad) return Alert.alert(t('ob.title'), tk(`ob.bad.${bad}`));
      let w: { by: string; byRank?: string } | null = { by: night.by, ...(night.byRank ? { byRank: night.byRank } : {}) };
      if (!night.by) w = masterWho();
      if (!w) return;
      const out: NightOrder = JSON.parse(JSON.stringify({
        ...night, text: night.text.trim(), callMe: night.callMe?.trim() || undefined, where: night.where?.trim() || undefined, ...w, updatedAt: Date.now(),
      }));
      await saveRow(storage.NIGHT_ORDERS_KEY, out);
      playSuccessSound();
      setNight(null);
      if (isNew) nav.replace('OrderEntry', { kind: 'night', id: out.id });
    };
    return (
      <Screen scroll>
        <BackButton onPress={() => (isNew ? back() : setNight(null))} />
        <ScreenTitle title={t('ob.nightTitle')} subtitle={t('ob.nightOf', { date: uiDate(night.date) })} help="The Master's orders" />
        <Card>
          <SimpleDatePicker label={t('ob.night')} value={night.date} onChange={(v) => setNight({ ...night, date: v || today })} />
          <Label>{t('ob.where')}</Label>
          <TextInput style={styles.input} value={night.where ?? ''} onChangeText={(v) => setNight({ ...night, where: v })} placeholder={t('ob.wherePh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('ob.orders')}</Label>
          <TextInput style={[styles.input, { minHeight: 160, textAlignVertical: 'top' }]} value={night.text} onChangeText={(v) => setNight({ ...night, text: v })} multiline placeholder={t('ob.nightPh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('ob.callMe')}</Label>
          <TextInput style={styles.input} value={night.callMe ?? ''} onChangeText={(v) => setNight({ ...night, callMe: v })} multiline placeholder={t('ob.callMePh')} placeholderTextColor={COLORS.textLight} />
        </Card>
        <Card>
          <Label>{t('ob.watch')}</Label>
          {officers.length ? <View style={styles.chips}>{officers.map((c) => chip(on(c.id), c.rank ? `${c.name} · ${c.rank}` : c.name, () => toggle(c.id), c.id))}</View> : <Text style={styles.sub}>{t('ob.noOfficers')}</Text>}
          <Text style={styles.sub}>{t('ob.watchHint')}</Text>
          {!night.by && picker ? <View style={{ marginTop: 6 }}>{picker}</View> : null}
        </Card>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} disabled={!isMaster} onPress={() => void save()}><Text style={styles.btnText}>{t('ob.issue')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => (isNew ? back() : setNight(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // ---- a night as written ----
  if (!storedNight) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('ob.notHere')}</Text>
      </Screen>
    );
  }
  const o = storedNight;
  const s = nightState(o, now);
  const c = nightColor(COLORS, s);
  const st = signStatus(o.id, o.watch, orderAcks);
  const me = signerPerson(signer);
  const mine = me ? hasSigned(o.id, orderAcks, me) : undefined;
  const finish = async () => {
    if (!ending) return;
    if (ending.what === 'cancel' && ending.note.trim().length < 3) return Alert.alert(t('ob.title'), t('ob.cancelNote'));
    const w = masterWho();
    if (!w) return;
    const stamp: OrderStamp = { ...w, at: Date.now(), ...(ending.note.trim() ? { note: ending.note.trim() } : {}) };
    await saveRow(storage.NIGHT_ORDERS_KEY, { ...o, ...(ending.what === 'close' ? { closed: stamp } : { cancelled: stamp }), updatedAt: Date.now() });
    playSuccessSound();
    setEnding(null);
  };

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={t('ob.nightOf', { date: uiDate(o.date) })} subtitle={[o.where, t('ob.writtenBy', { by: whoOf(o) })].filter(Boolean).join(' · ')} help="The Master's orders" />
      <View style={[styles.item, { borderLeftColor: c }]}>
        <Text style={[styles.body, { color: c, fontWeight: '800' }]}>{tk(`ob.st.${s}`)}</Text>
        {o.closed ? <Text style={styles.sub}>{`${t('ob.closedBy', { by: whoOf(o.closed), at: uiDateTime(o.closed.at) })}${o.closed.note ? ` — ${o.closed.note}` : ''}`}</Text> : null}
        {o.cancelled ? <Text style={styles.sub}>{`${t('ob.cancelledBy', { by: whoOf(o.cancelled), at: uiDateTime(o.cancelled.at) })} — ${o.cancelled.note ?? ''}`}</Text> : null}
      </View>
      <Card>
        <Label>{t('ob.orders')}</Label>
        <Text style={styles.body}>{o.text}</Text>
        {o.callMe ? <><Label>{t('ob.callMe')}</Label><Text style={styles.body}>{o.callMe}</Text></> : null}
      </Card>
      <Card>
        <Label>{t('ob.readSigned')}</Label>
        {!o.cancelled && !mine ? (
          <>
            {picker ? <View style={{ marginBottom: 6 }}>{picker}</View> : null}
            <TouchableOpacity style={styles.btn} onPress={() => void signRead(o.id)}><Text style={styles.btnText}>{t('ob.signRead')}</Text></TouchableOpacity>
          </>
        ) : null}
        {mine ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{t('ob.youSigned', { at: uiDateTime(mine.at) })}</Text> : null}
        {signedLines(st)}
      </Card>

      {ending ? (
        <Card>
          <Label>{ending.what === 'close' ? t('ob.closeNote') : t('ob.cancelWhy')}</Label>
          <TextInput style={styles.input} value={ending.note} onChangeText={(v) => setEnding({ ...ending, note: v })} multiline autoFocus placeholder={ending.what === 'close' ? t('ob.closePh') : t('lt.cancelPh')} placeholderTextColor={COLORS.textLight} />
          {picker ? <View style={{ marginTop: 6 }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, ending.what === 'cancel' ? { backgroundColor: COLORS.danger } : null]} onPress={() => void finish()}>
              <Text style={styles.btnText}>{ending.what === 'close' ? t('ob.close') : t('ob.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEnding(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <>
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => void shareNight(o, orderAcks, vessel, now).catch(fail)}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
          </View>
          {isMaster && !o.closed && !o.cancelled ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => setEnding({ what: 'close', note: '' })}><Text style={styles.btnText}>{t('ob.close')}</Text></TouchableOpacity>
              {nightEditable(o, orderAcks) ? <TouchableOpacity style={styles.small} onPress={() => setNight({ ...o })}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity> : null}
              <TouchableOpacity onPress={() => setEnding({ what: 'cancel', note: '' })}><Text style={[styles.link, { color: COLORS.danger }]}>{t('ob.cancel')}</Text></TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
