// ===================================
// My documents (services/myDocs.ts, plan item 47) — one person's certificates,
// trip and contract, drills and hours of rest, and what changed since they last
// looked. Read only: officers keep these records. Entry: the menu, the Board.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { personName } from '../types/role';
import { findMe, MyChange, myCerts, myChanges, myDrills, myRest } from '../services/myDocs';
import { MySdm, sdmDiffs, toMySdm } from '../services/mySdm';
import { parseSdm } from '../services/sdmImport';
import { pickSdmFile } from '../services/crewListReport';
import { useSdmPassword } from '../components/useSdmPassword';
import { MY_SDM_KEY } from '../services/storage';
import { shipToday } from '../utils/shipTime';
import { statusFromDate, uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { moduleOn } from '../constants/modules';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

// Not offered yet (flag mySdm). Not in a browser: a shared computer on board is no place for someone's passport (plan item 59).
const SDM_HERE = moduleOn('mySdm') && Platform.OS !== 'web';

export default function MyDocsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const data = useData();
  const sync = useSync();
  const today = shipToday();
  const who = useMemo(() => {
    if (sync.me) return { key: `device:${sync.me.id}`, name: personName(sync.me) };
    const c = data.crew.find((x) => x.id === data.prefs?.lastCrewId && !x.deleted);
    return c ? { key: c.id, name: c.name } : null;
  }, [sync.me, data.crew, data.prefs?.lastCrewId]);
  const m = findMe(data.crew, who);
  const certs = useMemo(() => (m ? myCerts(data.certificates, m) : []), [data.certificates, m]);
  const drills = useMemo(() => (m ? myDrills(data.drills, m, today) : []), [data.drills, m, today]);
  const rest = useMemo(() => (m ? myRest(data.rest, m, today, data.vessel) : null), [data.rest, m, today, data.vessel]);
  // Worked out once, when the data is there; looking at them is what clears them, for next time.
  const [changes, setChanges] = useState<MyChange[]>([]);
  useEffect(() => {
    if (!m) return;
    setChanges(myChanges(certs, m, data.prefs?.myDocsSeen));
    void data.setPrefs({ myDocsSeen: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);

  // Their own SDM file, on this device only.
  const [sdm, setSdm] = useState<MySdm | null>(null);
  const password = useSdmPassword();
  useEffect(() => {
    if (!SDM_HERE) return;
    void AsyncStorage.getItem(MY_SDM_KEY).then((raw) => setSdm(raw ? JSON.parse(raw) : null)).catch(() => setSdm(null));
  }, []);
  const loadSdm = async () => {
    try {
      const f = await pickSdmFile();
      if (!f) return;
      const inside = await password.open(f);
      if (inside == null) return;
      const next = toMySdm(parseSdm(inside), f.name, Date.now());
      await AsyncStorage.setItem(MY_SDM_KEY, JSON.stringify(next));
      setSdm(next);
    } catch (e: any) {
      Alert.alert(t('my.sdm'), String(e?.message ?? e));
    }
  };
  const removeSdm = () => Alert.alert(t('my.sdmRemoveQ'), t('my.sdmRemoveBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: () => void AsyncStorage.removeItem(MY_SDM_KEY).then(() => setSdm(null)) },
  ]);
  const diffs = useMemo(() => (sdm ? sdmDiffs(sdm.documents, certs) : []), [sdm, certs]);

  if (!m) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Dashboard')} />
        <ScreenTitle title={t('my.title')} subtitle={t('my.sub')} help="My documents" />
        <Empty text={who ? t('my.notOnList', { name: who.name }) : t('my.noPerson')} />
      </Screen>
    );
  }

  const stColor = (s: string) => (s === 'expired' ? COLORS.danger : s === 'due' ? COLORS.warning : s === 'ok' ? COLORS.success : COLORS.textLight);
  const fact = (k: string, v?: string) => (v ? <Text style={styles.sub}>{`${k}: ${v}`}</Text> : null);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Dashboard')} />
      <ScreenTitle title={t('my.title')} subtitle={m.rank ? `${m.name} · ${m.rank}` : m.name} help="My documents" />

      {changes.length ? (
        <Card>
          <Text style={[styles.name, { color: COLORS.primary }]}>{t('my.changed')}</Text>
          {changes.map((c) => <Text key={`${c.kind}${c.id}`} style={styles.sub}>{`${c.kind === 'cert' ? c.title : t('my.details')} · ${uiDate(new Date(c.at).toISOString().slice(0, 10))}`}</Text>)}
        </Card>
      ) : null}

      <Label>{t('my.trip')}</Label>
      <Card>
        <Text style={styles.name}>{m.onBoard === false ? t('my.ashore') : t('my.aboard')}</Text>
        {fact(t('my.signOn'), m.signOn ? uiDate(m.signOn) : undefined)}
        {fact(t('my.signOnPort'), m.signOnPort)}
        {fact(t('my.signOff'), m.onBoard === false && m.signOff ? uiDate(m.signOff) : undefined)}
        {fact(t('my.contractEnd'), m.contractEnd ? uiDate(m.contractEnd) : undefined)}
        {fact(t('my.cabin'), m.cabin)}
      </Card>

      <Label>{t('my.certs')}</Label>
      {!certs.length ? <Empty text={t('my.noCerts')} /> : null}
      {certs.map((c) => {
        const s = statusFromDate(c.expiryDate);
        return (
          <TouchableOpacity key={c.id} style={[styles.item, { borderLeftColor: stColor(s) }]} onPress={() => nav.navigate('CertificateDetail', { id: c.id })} activeOpacity={0.7}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={[styles.sub, { color: stColor(s), fontWeight: '700' }]}>{c.expiryDate ? `${tk(`my.st.${s}`)} · ${uiDate(c.expiryDate)}` : t('my.noExpiry')}</Text>
            {c.number ? <Text style={styles.sub}>{c.number}</Text> : null}
          </TouchableOpacity>
        );
      })}

      {rest ? (
        <>
          <Label>{t('my.rest')}</Label>
          <TouchableOpacity style={[styles.item, { borderLeftColor: rest.violations ? COLORS.danger : COLORS.primary }]} onPress={() => nav.navigate('HoursOfRest')} activeOpacity={0.7}>
            <Text style={styles.name}>{t('my.restHours', { h: rest.restHours, days: rest.recorded })}</Text>
            <Text style={[styles.sub, rest.violations ? { color: COLORS.danger, fontWeight: '700' } : null]}>{rest.violations ? t('my.restBad', { n: rest.violations }) : t('my.restOk')}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      <Label>{t('my.drills')}</Label>
      {!drills.length ? <Empty text={t('my.noDrills')} /> : null}
      <View>
        {drills.map((d) => <Text key={d.id} style={styles.sub}>{`${uiDate(d.date)} · ${d.title ?? d.topic}`}</Text>)}
      </View>
      {SDM_HERE ? (
        <>
          <Label>{t('my.sdm')}</Label>
          {sdm ? (
            <>
              <Card>
                <Text style={styles.name}>{sdm.name || sdm.fileName}</Text>
                <Text style={styles.sub}>{t('my.sdmLoaded', { date: uiDate(new Date(sdm.loadedAt).toISOString().slice(0, 10)), file: sdm.fileName })}</Text>
                {fact(t('my.sdmBorn'), [sdm.birthDate ? uiDate(sdm.birthDate) : '', sdm.birthPlace ?? ''].filter(Boolean).join(', ') || undefined)}
                {fact(t('my.sdmNationality'), sdm.nationality)}
                {fact(t('my.sdmPhone'), sdm.phone)}
                {fact(t('my.sdmEmail'), sdm.email)}
                {sdm.visas.map((v) => <React.Fragment key={v.label}>{fact(`${t('my.sdmVisa')} ${v.label}`, v.value)}</React.Fragment>)}
                {sdm.kin ? fact(t('my.sdmKin'), [sdm.kin.name, sdm.kin.relationship, sdm.kin.phone, sdm.kin.email].filter(Boolean).join(' · ')) : null}
              </Card>
              {diffs.length ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700', marginTop: 8 }]}>{t('my.sdmDiffs')}</Text> : null}
              {diffs.map((x) => (
                <Text key={`${x.kind}${x.doc.id}`} style={[styles.sub, { color: COLORS.warning }]}>
                  {`• ${x.doc.name}: ${x.kind === 'missing' ? t('my.sdmMissing') : t('my.sdmDate', { mine: uiDate(x.doc.expiryDate!), vessel: uiDate(x.vesselExpiry!) })}`}
                </Text>
              ))}
              <Label>{t('my.sdmDocs')}</Label>
              {sdm.documents.map((d) => {
                const st = d.noExpiry ? 'none' : statusFromDate(d.expiryDate);
                return (
                  <View key={d.id} style={[styles.item, { borderLeftColor: stColor(st) }]}>
                    <Text style={styles.name}>{d.name}</Text>
                    <Text style={[styles.sub, { color: stColor(st), fontWeight: '700' }]}>{d.expiryDate ? `${tk(`my.st.${st}`)} · ${uiDate(d.expiryDate)}` : t('my.noExpiry')}</Text>
                    <Text style={styles.sub}>{[d.category, d.number, d.issuePlace].filter(Boolean).join(' · ')}</Text>
                  </View>
                );
              })}
              {sdm.service.length ? <Label>{t('my.sdmService')}</Label> : null}
              {sdm.service.map((v, i) => (
                <Text key={`${v.vessel}${i}`} style={styles.sub}>{[[v.signOn ? uiDate(v.signOn) : '', v.signOff ? uiDate(v.signOff) : ''].filter(Boolean).join(' – '), v.vessel, v.position, v.company].filter(Boolean).join(' · ')}</Text>
              ))}
            </>
          ) : <Text style={styles.sub}>{t('my.sdmHint')}</Text>}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void loadSdm()}><Text style={styles.btnText}>{sdm ? t('my.sdmReload') : t('my.sdmLoad')}</Text></TouchableOpacity>
            {sdm ? <TouchableOpacity onPress={removeSdm}><Text style={styles.link}>{t('my.sdmRemove')}</Text></TouchableOpacity> : null}
          </View>
        </>
      ) : null}
      <Text style={[styles.sub, { marginTop: 12 }]}>{t('my.note')}</Text>
      {password.ui}
    </Screen>
  );
}
