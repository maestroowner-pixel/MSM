// ===================================
// A wristband held to the phone anywhere in the app (components/NfcListener): whose it
// is, and what to do with them — services/nfcPerson.ts (15 Nov 2026).
//
// The person, on board or ashore; the gangway crossing (security), their card and
// certificates, what waits for their signature (night and standing orders, documents
// to read), and Revoke for an officer. Route `NfcPerson` `band/:ref`, module `nfc`.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { goBackOr } from '../utils/nav';
import { personName, roleAtLeast } from '../types/role';
import { moduleOn } from '../constants/modules';
import { activeTag, revokeTag, uidTail } from '../services/nfcTags';
import { BandPending, bandPending, bandPerson } from '../services/nfcPerson';
import { isDoubleScan, nextMove } from '../services/gangway';
import { myCerts } from '../services/myDocs';
import { nowLocal } from '../services/permits';
import { todayIso } from '../services/pms';
import * as storage from '../services/storage';
import { statusFromDate, uiDate } from '../utils/dates';
import { t, useT } from '../utils/i18n';

export default function NfcPersonSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const ref: string = (useRoute<any>().params ?? {}).ref ?? '';
  const { crew, passengers, crewMoves, nfcTags, certificates, nightOrders, standingOrders, orderAcks, docs, docAcks, appendRow, saveRow } = useData();
  const sync = useSync();
  const [crossed, setCrossed] = useState<string | null>(null);

  const today = todayIso();
  const person = bandPerson(ref, crew, passengers, crewMoves, today);
  const tag = activeTag(nfcTags, 'person', ref);
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const by = sync.me ? personName(sync.me) : 'Officer';

  if (!person) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <ScreenTitle title={t('nfc.band')} />
        <Empty text={t('band.gone')} />
      </Screen>
    );
  }

  const member = person.who === 'crew' ? crew.find((c) => c.id === person.id) : undefined;
  const certs = member && moduleOn('crewCerts') ? myCerts(certificates, member) : [];
  const certsBad = certs.filter((c) => ['expired', 'due'].includes(statusFromDate(c.expiryDate))).length;
  const pending = bandPending(person, {
    nights: nightOrders,
    standing: standingOrders,
    orderAcks,
    docs,
    docAcks,
    crew,
    now: nowLocal(),
    orders: moduleOn('orderBook'),
    dp: moduleOn('dp'),
    docsOn: moduleOn('docs'),
  });
  const gangway = moduleOn('security') && person.onList;

  const cross = () => {
    if (isDoubleScan(person.id, crewMoves)) return setCrossed(t('scn.moment'));
    const m = nextMove(person, crewMoves, sync.me ? personName(sync.me) : 'Gangway', 'nfc');
    void appendRow(storage.CREW_MOVES_KEY, m);
    setCrossed(`${m.dir === 'ashore' ? t('scn.ashore') : t('scn.backAboard')} · ${m.time}`);
  };

  const revoke = () =>
    Alert.alert(t('nfc.band'), t('nfc.revokeAsk', { name: person.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('nfc.revoke'), style: 'destructive', onPress: () => tag && void saveRow(storage.NFC_TAGS_KEY, revokeTag(tag, by, Date.now())) },
    ]);

  const openCard = () => (member ? nav.navigate('CrewMember', { id: member.id }) : nav.navigate('Main', { screen: 'Passengers', params: { open: person.id } }));

  const openPending = (p: BandPending) =>
    p.kind === 'night' ? nav.navigate('OrderEntry', { kind: 'night', id: p.id }) : p.kind === 'standing' ? nav.navigate('OrderBook', { view: p.book }) : nav.navigate('Doc', { id: p.id });

  const pendingTitle = (p: BandPending) =>
    p.kind === 'night' ? t('b.ob.signNight', { date: uiDate(p.date) }) : p.kind === 'standing' ? t(p.book === 'dp' ? 'b.ob.signDp' : 'b.ob.signMaster', { rev: p.rev }) : t('band.readSign', { title: p.title });

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={person.name} subtitle={person.rank ?? (person.who === 'pax' ? t('band.guest') : undefined)} />

      <Card style={{ borderLeftWidth: 6, borderLeftColor: tag ? COLORS.success : COLORS.danger }}>
        <View style={styles.head}>
          <MciIcon name="nfc-variant" size={22} color={tag ? COLORS.success : COLORS.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{tag ? `${t('nfc.band')} …${uidTail(tag.uid)}` : t('band.revoked')}</Text>
            {moduleOn('security') ? (
              <Text style={styles.sub}>
                {!person.onList ? t('band.notOnList') : person.ashore ? t('band.ashore', { time: person.last ? `${person.last.date === today ? '' : `${uiDate(person.last.date)} `}${person.last.time}` : '' }) : t('band.aboard')}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      {gangway ? (
        <Card>
          <Label>{t('band.gangway')}</Label>
          {crossed ? <Text style={[styles.big, { color: COLORS.success }]}>{crossed}</Text> : null}
          <TouchableOpacity style={[styles.btn, crossed && { opacity: 0.5 }]} disabled={!!crossed} onPress={cross}>
            <MciIcon name={person.ashore ? 'login' : 'logout'} size={18} color={COLORS.textWhite} />
            <Text style={styles.btnText}>{person.ashore ? t('band.comeAboard') : t('band.goAshore')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      <Card>
        <Label>{t('band.docs')}</Label>
        <TouchableOpacity style={styles.rowBtn} onPress={openCard}>
          <MciIcon name="card-account-details-outline" size={20} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('band.card')}</Text>
            {certs.length ? <Text style={[styles.sub, certsBad ? { color: COLORS.warning, fontWeight: '700' } : null]}>{certsBad ? t('band.certsBad', { n: certs.length, bad: certsBad }) : t('band.certs', { n: certs.length })}</Text> : null}
          </View>
          <MciIcon name="chevron-right" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
      </Card>

      {person.who === 'crew' ? (
        <Card>
          <Label>{t('band.toSign')}</Label>
          {pending.length ? null : <Text style={styles.sub}>{t('band.nothing')}</Text>}
          {pending.map((p) => (
            <TouchableOpacity key={`${p.kind}:${p.id}`} style={styles.rowBtn} onPress={() => openPending(p)}>
              <MciIcon name="draw" size={20} color={COLORS.warning} />
              <Text style={[styles.title, { flex: 1 }]}>{pendingTitle(p)}</Text>
              <MciIcon name="chevron-right" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}

      {officer && tag ? (
        <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', borderColor: COLORS.danger }]} onPress={revoke}>
          <Text style={[styles.smallText, { color: COLORS.danger }]}>{t('band.revoke')}</Text>
        </TouchableOpacity>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    big: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginBottom: SIZES.sm },
    title: { color: COLORS.textDark, fontWeight: '700', fontSize: SIZES.body },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.xs, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md, marginTop: SIZES.sm },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    rowBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm },
    small: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, marginTop: SIZES.sm },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
