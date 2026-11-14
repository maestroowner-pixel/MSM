// ===================================
// The Master's orders (types/orderBook.ts). Three pages:
//   Night orders      the book, newest night first — who of tonight's watch has
//                     signed, which nights the Master has still to close
//   Standing orders   the Master's Standing Orders in force, who has read them,
//                     the revisions before
//   DP Standing Orders the same for DP — opened from the DP menu, gone with DP
// Each night opens on OrderEntrySc; a revision too. The Master writes, every
// officer signs; a crew device holds none of it (the rules say the same).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { moduleOn } from '../constants/modules';
import { roleAtLeast } from '../types/role';
import { NightOrder, OrderAck, StandingKind, orderAckId } from '../types/orderBook';
import * as storage from '../services/storage';
import { currentStanding, hasSigned, nightState, NightState, signStatus, sortNights, standingReaders } from '../services/orderBook';
import { exportNightBook, exportStanding, shareNightBook, shareStanding } from '../services/orderBookReport';
import { todayIso } from '../services/pms';
import { nowLocal } from '../services/permits';
import { uiDate, uiDateTime } from '../utils/dates';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

type View_ = 'night' | StandingKind;
type Period = 'month' | 'year' | 'all';

export const nightColor = (C: { warning: string; primary: string; success: string; textLight: string }, s: NightState) =>
  s === 'toClose' ? C.warning : s === 'tonight' ? C.primary : s === 'closed' ? C.success : C.textLight;

/** The person signing on this device, by the key the signatures carry. */
export function signerPerson(signer: { key: string; name: string } | null) {
  return signer ? { key: signer.key, name: signer.name } : null;
}

export default function OrderBookSc() {
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
  const pick = (v: unknown): View_ => (v === 'master' ? 'master' : v === 'dp' && moduleOn('dp') ? 'dp' : 'night');
  const [view, setView] = useState<View_>(pick(route.params?.view));
  // The menu's entries switch the page of a screen already open.
  useEffect(() => {
    if (route.params?.view) setView(pick(route.params.view));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.view]);
  const [period, setPeriod] = useState<Period>('month');

  if (!officer) {
    return (
      <Screen scroll>
        <ScreenTitle title={t('ob.title')} help="The Master's orders" />
        <Text style={styles.sub}>{t('ob.officersOnly')}</Text>
      </Screen>
    );
  }

  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const fail = (e: any) => Alert.alert(t('ob.title'), String(e?.message ?? e));
  const whoOf = (x: { by: string; byRank?: string }) => (x.byRank ? `${x.by} (${x.byRank})` : x.by || '—');

  const header = (
    <>
      <ScreenTitle title={t('ob.title')} subtitle={t(`ob.sub.${view}`)} help="The Master's orders" />
      <View style={styles.chips}>
        {chip(view === 'night', t('ob.view.night'), () => setView('night'), 'night')}
        {chip(view === 'master', t('ob.view.master'), () => setView('master'), 'master')}
        {moduleOn('dp') ? chip(view === 'dp', t('ob.view.dp'), () => setView('dp'), 'dp') : null}
      </View>
    </>
  );

  // ---- the night order book ----
  if (view === 'night') {
    const nights = sortNights(nightOrders);
    const y = Number(today.slice(0, 4));
    const range: Record<Period, [string, string]> = { month: [`${today.slice(0, 8)}01`, today], year: [`${y}-01-01`, `${y}-12-31`], all: ['', ''] };
    const row = (o: NightOrder) => {
      const s = nightState(o, now);
      const st = signStatus(o.id, o.watch, orderAcks);
      const c = nightColor(COLORS, s);
      return (
        <TouchableOpacity key={o.id} style={[styles.item, { borderLeftColor: c }, o.cancelled ? { opacity: 0.6 } : null]} onPress={() => nav.navigate('OrderEntry', { kind: 'night', id: o.id })} activeOpacity={0.7}>
          <Text style={styles.name}>{[t('ob.nightOf', { date: uiDate(o.date) }), o.where].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.sub} numberOfLines={2}>{o.text}</Text>
          <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>
            {[tk(`ob.st.${s}`), o.watch.length ? t('ob.signedOf', { n: st.signed.length, of: o.watch.length }) : null].filter(Boolean).join(' · ')}
          </Text>
        </TouchableOpacity>
      );
    };
    return (
      <Screen scroll>
        {header}
        {isMaster ? (
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('OrderEntry', { kind: 'night', id: 'new' })}><Text style={styles.btnText}>{t('ob.addNight')}</Text></TouchableOpacity>
          </View>
        ) : null}
        {nights.slice(0, 60).map(row)}
        {!nights.length ? <Empty text={t('ob.nightEmpty')} /> : null}
        {nights.length ? (
          <>
            <Text style={[styles.sub, { marginTop: 16, fontWeight: '700' }]}>{t('ob.book')}</Text>
            <View style={styles.chips}>
              {chip(period === 'month', t('ob.thisMonth'), () => setPeriod('month'), 'month')}
              {chip(period === 'year', String(y), () => setPeriod('year'), 'year')}
              {chip(period === 'all', t('lt.allDates'), () => setPeriod('all'), 'all')}
            </View>
            <View style={styles.row}>
              <TouchableOpacity style={styles.small} onPress={() => void exportNightBook(nightOrders, orderAcks, vessel, range[period][0], range[period][1], now).catch(fail)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => void shareNightBook(nightOrders, orderAcks, vessel, range[period][0], range[period][1], now).catch(fail)}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
            </View>
          </>
        ) : null}
      </Screen>
    );
  }

  // ---- standing orders (the Master's, or DP) ----
  const kind: StandingKind = view;
  const cur = currentStanding(standingOrders, kind);
  const older = standingOrders.filter((s) => s.kind === kind && s.id !== cur?.id).sort((a, b) => b.rev - a.rev);
  const st = cur ? signStatus(cur.id, standingReaders(crew, cur.readers), orderAcks) : null;
  const me = signerPerson(signer);
  const mine = cur && me ? hasSigned(cur.id, orderAcks, me) : undefined;
  const sign = async () => {
    if (!cur) return;
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const ack: OrderAck = { id: orderAckId(cur.id, signer.key), orderId: cur.id, kind, rev: cur.rev, personKey: signer.key, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), updatedAt: Date.now() };
    await saveRow(storage.ORDER_ACKS_KEY, ack);
    playSuccessSound();
  };

  return (
    <Screen scroll>
      {header}
      {isMaster ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('OrderEntry', { kind, id: 'new' })}><Text style={styles.btnText}>{cur ? t('ob.newRev') : t('ob.firstRev')}</Text></TouchableOpacity>
        </View>
      ) : null}
      {!cur ? <Empty text={t(kind === 'dp' ? 'ob.dpEmpty' : 'ob.masterEmpty')} /> : (
        <>
          <Card>
            <Text style={styles.name}>{t('ob.revInForce', { rev: cur.rev, date: uiDate(cur.issued) })}</Text>
            <Text style={styles.sub}>{[t('ob.issuedBy', { by: whoOf(cur) }), t(`ob.readers.${cur.readers}`)].join(' · ')}</Text>
            {cur.changeNote ? (
              <>
                <Label>{t('ob.changeNote')}</Label>
                <Text style={styles.body}>{cur.changeNote}</Text>
              </>
            ) : null}
            <Label>{t('ob.orders')}</Label>
            <Text style={styles.body}>{cur.text}</Text>
          </Card>
          <Card>
            <Label>{t('ob.readSigned')}</Label>
            {mine ? (
              <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{t('ob.youSigned', { at: uiDateTime(mine.at) })}</Text>
            ) : (
              <>
                {picker ? <View style={{ marginBottom: 6 }}>{picker}</View> : null}
                <TouchableOpacity style={styles.btn} onPress={() => void sign()}><Text style={styles.btnText}>{t('ob.signRead')}</Text></TouchableOpacity>
              </>
            )}
            {st!.signed.map((x) => <Text key={x.ack.id} style={styles.sub}>{`✓ ${x.reader.name}${x.reader.rank ? ` · ${x.reader.rank}` : ''} · ${uiDateTime(x.ack.at)}`}</Text>)}
            {st!.others.map((a) => <Text key={a.id} style={styles.sub}>{`✓ ${whoOf(a)} · ${uiDateTime(a.at)}`}</Text>)}
            {st!.unsigned.length ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700', marginTop: 6 }]}>{t('ob.notYet', { names: st!.unsigned.map((r) => r.name).join(', ') })}</Text> : null}
          </Card>
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => void exportStanding(cur, standingOrders, orderAcks, crew, vessel, today, true).catch(fail)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => void shareStanding(cur, standingOrders, orderAcks, crew, vessel, today, true).catch(fail)}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
          </View>
        </>
      )}
      {older.length ? (
        <>
          <Text style={[styles.sub, { marginTop: 16, fontWeight: '700' }]}>{t('ob.older')}</Text>
          {older.map((s) => (
            <TouchableOpacity key={s.id} style={[styles.item, { borderLeftColor: COLORS.textLight }]} onPress={() => nav.navigate('OrderEntry', { kind, id: s.id })}>
              <Text style={styles.name}>{t('ob.revFrom', { rev: s.rev, date: uiDate(s.issued) })}</Text>
              {s.changeNote ? <Text style={styles.sub} numberOfLines={1}>{s.changeNote}</Text> : null}
            </TouchableOpacity>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
