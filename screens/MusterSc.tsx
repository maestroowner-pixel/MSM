// ===================================
// Muster (route `Muster` `muster`) — the stations, and the count at an alarm (types/muster.ts).
//
// No muster under way: the officers keep the stations (ID, name, where, who is assigned by
// the muster list, the station's NFC tag) and start one — a drill, or a real alarm. Under
// way: every phone shows the same count as the marks sync. A station leader says where
// they are (a chip, or by tapping the station's tag) and marks each person arriving — a
// wristband tapped, a crew card scanned, or the name pressed in the missing list. The
// bridge reads accounted / missing per station. An officer closes it with what happened
// to anyone missing; the record goes to paper (PDF, English).
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { NfcTagRow } from '../components/NfcTagRow';
import { useNfcTaps } from '../components/useNfcTaps';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { goBackOr } from '../utils/nav';
import { personName, roleAtLeast } from '../types/role';
import { Muster, MusterKind, MusterStation } from '../types/muster';
import { closeMuster, countMuster, durationText, liveStations, markPerson, musterSheet, nextStationCode, pobList, runningMuster, startMuster } from '../services/muster';
import { TapResult } from '../services/nfcTags';
import { parseCrewQr, parseMusterQr } from '../services/crewQr';
import { exportPmsHistory, sharePmsHistory } from '../services/pmsHistoryReport';
import { todayIso } from '../services/pms';
import * as storage from '../services/storage';
import { playErrorSound, playSuccessSound } from '../utils/sound';
import { shipHm, shipToday } from '../utils/shipTime';
import { uid } from '../utils/id';
import { t, useT } from '../utils/i18n';

export default function MusterSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const sync = useSync();
  const { crew, crewMoves, visitors, passengers, vessel, musters, musterMarks, musterStations, saveRow, appendRow } = useData();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const me = sync.me ? personName(sync.me) : officer ? 'Officer' : 'Crew';

  const stations = liveStations(musterStations);
  const running = runningMuster(musters);
  const [stationId, setStationId] = useState<string | undefined>(route.params?.station);
  const station = stations.find((s) => s.id === stationId);
  const [hit, setHit] = useState<{ name: string; text: string; ok: boolean } | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [edit, setEdit] = useState<MusterStation | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  /** Full names from this device's lists — a guest is masked on the cloud. */
  const nameOf = (id: string, fallback: string) => crew.find((c) => c.id === id)?.name ?? passengers.find((p) => p.id === id)?.name ?? visitors.find((v) => v.id === id)?.name ?? fallback;

  const mark = (m: Muster, personId: string, via: 'nfc' | 'qr' | 'manual') => {
    if (!stationId) {
      playErrorSound();
      return setHit({ name: t('mu.title'), text: t('mu.pickStation'), ok: false });
    }
    const r = markPerson(m, musterMarks, personId, stationId, via, me, Date.now());
    const who = m.pob.find((p) => p.id === personId);
    const name = nameOf(personId, who?.name ?? t('scn.unknownCard'));
    if (r.ok) {
      void appendRow(storage.MUSTER_MARKS_KEY, r.mark);
      playSuccessSound();
      Vibration.vibrate(60);
      return setHit({ name, text: t('mu.marked', { time: shipHm(r.mark.at) }), ok: true });
    }
    playErrorSound();
    if (r.why === 'already') {
      const st = musterStations.find((x) => x.id === r.mark!.stationId);
      return setHit({ name, text: t('mu.already', { station: st?.code ?? '—', time: shipHm(r.mark!.at) }), ok: true });
    }
    setHit({ name, text: r.why === 'closed' ? t('mu.closed') : t('mu.notOnBoard'), ok: false });
  };

  // A wristband marks its wearer here; a station's tag says where this phone is.
  const onTap = (r: TapResult) => {
    if (!r.ok) {
      playErrorSound();
      return setHit({ name: r.tag?.name ?? t('nfc.tag'), text: t(`nfc.why.${r.why}`), ok: false });
    }
    const ms = parseMusterQr(r.code);
    if (ms) {
      const st = stations.find((s) => s.id === ms);
      if (!st) return setHit({ name: t('mu.station'), text: t('mu.stationGone'), ok: false });
      setStationId(st.id);
      return setHit({ name: `${st.code} · ${st.name}`, text: t('mu.atStation'), ok: true });
    }
    const pid = parseCrewQr(r.code);
    if (pid && running) return mark(running, pid, 'nfc');
    setHit({ name: r.tag.name, text: t('mu.notCard'), ok: false });
  };
  const taps = useNfcTaps(onTap, t('nfc.holdBand'), !!running);

  const start = (kind: MusterKind) => {
    const pob = pobList(crew, crewMoves, visitors, passengers, todayIso());
    const go = () => {
      void saveRow(storage.MUSTERS_KEY, startMuster(kind, pob, me, Date.now(), note));
      setNote('');
      setHit(null);
    };
    if (kind === 'drill') return go();
    Alert.alert(t('mu.real'), t('mu.realAsk', { n: pob.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mu.start'), style: 'destructive', onPress: go },
    ]);
  };

  const pdf = (m: Muster, share: boolean) => {
    const sheet = musterSheet(m, musterMarks, musterStations, nameOf);
    const stem = `Muster ${m.kind} ${shipToday(m.startedAt)}`;
    const p = share ? sharePmsHistory(sheet.title, stem, vessel, [sheet]) : exportPmsHistory(sheet.title, stem, vessel, [sheet]);
    void p.catch((e: any) => Alert.alert(t('mu.title'), String(e?.message ?? e)));
  };

  const saveStation = async () => {
    if (!edit || !edit.name.trim()) return;
    await saveRow(storage.MUSTER_STATIONS_KEY, { ...edit, name: edit.name.trim(), code: edit.code.trim() || nextStationCode(musterStations), location: edit.location?.trim() || undefined, updatedAt: Date.now() });
    setEdit(null);
  };

  const count = running ? countMuster(running, musterMarks, musterStations) : null;
  const assignedCrew = (s: MusterStation) => (s.crewIds ?? []).map((id) => crew.find((c) => c.id === id)?.name).filter(Boolean).join(', ');
  const aboardCrew = crew.filter((c) => c.active && !c.deleted && c.onBoard !== false);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={t('mu.title')} subtitle={running ? (running.kind === 'real' ? t('mu.realRunning') : t('mu.drillRunning')) : t('mu.sub')} help="Muster and boat landing" />

      {running && count ? (
        <>
          <Card style={{ borderLeftWidth: 6, borderLeftColor: count.missing.length ? COLORS.danger : COLORS.success }}>
            <Text style={styles.big}>{t('mu.accounted', { n: count.accounted, of: count.total })}</Text>
            <Text style={[styles.sub, { color: count.missing.length ? COLORS.danger : COLORS.success, fontWeight: '800' }]}>
              {count.missing.length ? t('mu.missingN', { n: count.missing.length }) : count.allInSec != null ? t('mu.allIn', { time: durationText(count.allInSec) }) : t('mu.allInShort')}
            </Text>
            <Text style={styles.sub}>{t('mu.startedAt', { time: shipHm(running.startedAt), by: running.startedBy })}</Text>
          </Card>

          <Card>
            <Label>{t('mu.myStation')}</Label>
            {stations.length ? (
              <View style={styles.chips}>
                {stations.map((s) => (
                  <TouchableOpacity key={s.id} style={[styles.chip, s.id === stationId && styles.chipOn]} onPress={() => setStationId(s.id)}>
                    <Text style={[styles.chipText, s.id === stationId && { color: COLORS.textWhite }]}>{`${s.code} ${s.name}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.sub}>{t('mu.noStations')}</Text>
            )}
            <View style={styles.row}>
              {taps.available && taps.needsStart && !taps.listening ? (
                <TouchableOpacity style={styles.btn} onPress={() => void taps.start()}>
                  <MciIcon name="nfc-variant" size={18} color={COLORS.textWhite} />
                  <Text style={styles.btnText}>{t('nfc.tapBand')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.btn, !stationId && { opacity: 0.5 }]} disabled={!stationId} onPress={() => nav.navigate('Scan', { muster: running.id, station: stationId })}>
                <MciIcon name="qrcode-scan" size={18} color={COLORS.textWhite} />
                <Text style={styles.btnText}>{t('mu.scanCard')}</Text>
              </TouchableOpacity>
            </View>
            {taps.listening ? <Text style={[styles.sub, { color: COLORS.success }]}>{t('nfc.listening')}</Text> : null}
          </Card>

          {hit ? (
            <Card style={{ borderLeftWidth: 6, borderLeftColor: hit.ok ? COLORS.success : COLORS.danger }}>
              <Text style={styles.big}>{hit.name}</Text>
              <Text style={{ fontSize: SIZES.h5, fontWeight: '800', color: hit.ok ? COLORS.success : COLORS.danger }}>{hit.text}</Text>
            </Card>
          ) : null}

          {count.missing.length ? (
            <Card>
              <Label>{t('mu.missing')}</Label>
              <Text style={styles.sub}>{station ? t('mu.tapToMark', { station: station.code }) : t('mu.pickStation')}</Text>
              {count.missing.map((p) => (
                <TouchableOpacity key={p.id} style={styles.person} disabled={!station} onPress={() => mark(running, p.id, 'manual')}>
                  <MciIcon name="account-alert-outline" size={20} color={COLORS.danger} />
                  <Text style={styles.personName}>{nameOf(p.id, p.name)}</Text>
                  <Text style={styles.sub}>{p.rank ?? t(`mu.who.${p.who}`)}</Text>
                </TouchableOpacity>
              ))}
            </Card>
          ) : null}

          {count.stations.map((s) => (
            <Card key={s.station?.id ?? 'none'}>
              <Label>{s.station ? `${s.station.code} · ${s.station.name}` : t('mu.noStation')}</Label>
              <Text style={styles.sub}>
                {t('mu.stationCount', { here: s.here.length, missing: s.missing.length })}
                {s.elsewhere ? ` · ${t('mu.elsewhere', { n: s.elsewhere })}` : ''}
              </Text>
              {s.here.map((h) => (
                <Text key={h.person.id} style={styles.line}>{`✓ ${shipHm(h.mark.at)}  ${nameOf(h.person.id, h.person.name)}${h.mark.via === 'nfc' ? ' · NFC' : h.mark.via === 'qr' ? ' · QR' : ''}`}</Text>
              ))}
              {s.missing.map((p) => (
                <Text key={p.id} style={[styles.line, { color: COLORS.danger }]}>{`✗ ${nameOf(p.id, p.name)}`}</Text>
              ))}
            </Card>
          ))}

          {officer ? (
            <Card>
              {closing == null ? (
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => setClosing('')}>
                    <Text style={styles.btnText}>{t('mu.close')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.small} onPress={() => pdf(running, false)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
                </View>
              ) : (
                <>
                  <Label>{t('mu.close')}</Label>
                  <Text style={styles.sub}>{count.missing.length ? t('mu.closeMissing', { n: count.missing.length }) : t('mu.closeAll')}</Text>
                  <TextInput style={styles.input} value={closing} onChangeText={setClosing} placeholder={t('mu.closePh')} placeholderTextColor={COLORS.textLight} multiline />
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[styles.btn, count.missing.length && !closing.trim() ? { opacity: 0.5 } : null]}
                      disabled={!!count.missing.length && !closing.trim()}
                      onPress={() => {
                        void saveRow(storage.MUSTERS_KEY, closeMuster(running, me, Date.now(), closing));
                        setClosing(null);
                        setOpenId(running.id);
                      }}
                    >
                      <Text style={styles.btnText}>{t('mu.closeNow')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setClosing(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                  </View>
                </>
              )}
            </Card>
          ) : null}
        </>
      ) : (
        <>
          {officer ? (
            <Card>
              <Label>{t('mu.startTitle')}</Label>
              <Text style={styles.sub}>{t('mu.startHint', { n: pobList(crew, crewMoves, visitors, passengers, todayIso()).length })}</Text>
              <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder={t('mu.notePh')} placeholderTextColor={COLORS.textLight} />
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => start('drill')}>
                  <Text style={styles.btnText}>{t('mu.startDrill')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => start('real')}>
                  <Text style={styles.btnText}>{t('mu.startReal')}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : null}

          <Label>{t('mu.stations')}</Label>
          {officer && !edit ? (
            <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginBottom: SIZES.sm }]} onPress={() => setEdit({ id: uid('ms'), code: nextStationCode(musterStations), name: '', order: stations.length, crewIds: [], updatedAt: Date.now() })}>
              <Text style={styles.smallText}>{`+ ${t('mu.station')}`}</Text>
            </TouchableOpacity>
          ) : null}
          {edit ? (
            <Card>
              <Label>{`${t('mu.station')} — ${edit.code}`}</Label>
              <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} placeholder={t('mu.namePh')} placeholderTextColor={COLORS.textLight} autoFocus />
              <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} placeholder={t('mu.wherePh')} placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { width: 140 }]} value={edit.code} onChangeText={(v) => setEdit({ ...edit, code: v })} autoCapitalize="characters" autoCorrect={false} />
              <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('mu.assigned')}</Text>
              <View style={styles.chips}>
                {aboardCrew.map((c) => {
                  const on = (edit.crewIds ?? []).includes(c.id);
                  const other = !on && stations.find((s) => s.id !== edit.id && (s.crewIds ?? []).includes(c.id));
                  return (
                    <TouchableOpacity key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setEdit({ ...edit, crewIds: on ? (edit.crewIds ?? []).filter((x) => x !== c.id) : [...(edit.crewIds ?? []), c.id] })}>
                      <Text style={[styles.chipText, on && { color: COLORS.textWhite }]}>{other ? `${c.name} (${other.code})` : c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {musterStations.some((s) => s.id === edit.id) ? <NfcTagRow kind="muster" refId={edit.id} name={`${edit.code} · ${edit.name}`} /> : null}
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, !edit.name.trim() && { opacity: 0.5 }]} disabled={!edit.name.trim()} onPress={() => void saveStation()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                {musterStations.some((s) => s.id === edit.id) ? (
                  <TouchableOpacity onPress={() => { void saveRow(storage.MUSTER_STATIONS_KEY, { ...edit, removed: true, updatedAt: Date.now() }); setEdit(null); }}>
                    <Text style={[styles.link, { color: COLORS.danger }]}>{t('common.remove')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          ) : null}
          {!stations.length && !edit ? <Empty text={t('mu.noStations')} /> : null}
          {stations.filter((s) => s.id !== edit?.id).map((s) => (
            <TouchableOpacity key={s.id} activeOpacity={officer ? 0.7 : 1} onPress={() => officer && setEdit(s)}>
              <Card>
                <Text style={styles.personName}>{`${s.code} · ${s.name}`}</Text>
                {s.location ? <Text style={styles.sub}>{s.location}</Text> : null}
                <Text style={styles.sub}>{assignedCrew(s) || t('mu.noneAssigned')}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      <Label>{t('mu.past')}</Label>
      {musters.filter((m) => m.closedAt).length ? null : <Empty text={t('mu.nonePast')} />}
      {musters
        .filter((m) => m.closedAt)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 30)
        .map((m) => {
          const c = countMuster(m, musterMarks, musterStations);
          return (
            <TouchableOpacity key={m.id} onPress={() => setOpenId(openId === m.id ? null : m.id)}>
              <Card style={{ borderLeftWidth: 6, borderLeftColor: m.kind === 'real' ? COLORS.danger : COLORS.primary }}>
                <Text style={styles.personName}>{`${m.kind === 'real' ? t('mu.real') : t('mu.drill')} · ${shipToday(m.startedAt)} ${shipHm(m.startedAt)}`}</Text>
                <Text style={styles.sub}>
                  {t('mu.accounted', { n: c.accounted, of: c.total })}
                  {c.allInSec != null ? ` · ${durationText(c.allInSec)}` : ''}
                </Text>
                {openId === m.id ? (
                  <>
                    {m.closeNote ? <Text style={styles.line}>{m.closeNote}</Text> : null}
                    {c.missing.map((p) => <Text key={p.id} style={[styles.line, { color: COLORS.danger }]}>{`✗ ${nameOf(p.id, p.name)}`}</Text>)}
                    <View style={styles.row}>
                      <TouchableOpacity style={styles.small} onPress={() => pdf(m, false)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.small} onPress={() => pdf(m, true)}><Text style={styles.smallText}>{t('mu.share')}</Text></TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </Card>
            </TouchableOpacity>
          );
        })}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    big: { fontSize: SIZES.h3, fontWeight: '900', color: COLORS.textDark },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    line: { color: COLORS.text, fontSize: SIZES.small, marginTop: 4 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.sm },
    chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.small },
    btn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    small: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    link: { color: COLORS.primary, fontWeight: '700' },
    person: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
    personName: { color: COLORS.textDark, fontWeight: '700', fontSize: SIZES.body, flexShrink: 1 },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, marginTop: SIZES.sm, color: COLORS.textDark },
  });
