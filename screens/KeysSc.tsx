// ===================================
// Security → Key register (types/keys.ts; Jez, 17 Oct 2026).
//
//   Keys     every key: its ID and what it opens, where it is now — on the board
//            or with whom since when. A key's tag scanned (msm://key/<id>) opens
//            it here. Sign it out to someone (signed by PIN or by hand), or back.
//   Out now  the keys out, longest first.
//   Report   out now, the register, the movements of a period — PDF.
// The officers keep the list of keys and print the tags.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import { PrinterModal } from '../components/PrinterModal';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { crewLabel, isAboard } from '../types/crew';
import { personName, roleAtLeast } from '../types/role';
import { STORE_CODE_RE } from '../types/stores';
import { KeyItem, KeyMove } from '../types/keys';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { keyStatus, keysOut, nextCode } from '../services/patrols';
import { exportKeyReport } from '../services/patrolReport';
import { exportKeyTags } from '../services/crewCards';
import { exportEngravingSvg, exportKeyTagCards } from '../services/idCards';
import { GANGWAY_STOCKS, GANGWAY_STOCK_MM, codeLabelSpecs } from '../services/gangwayLabels';
import { TsplLabelSpec, labelsToTspl } from '../services/tspl';
import { getSavedPrinter, printTspl, SavedPrinter } from '../services/blePrinter';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tn, useT } from '../utils/i18n';

const when = (t: number) => `${new Date(t).toISOString().slice(0, 10)} ${new Date(t).toTimeString().slice(0, 5)}`;

export default function KeysSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const { keyList, keyMoves, crew, vessel, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const people = useMemo(() => crew.filter(isAboard), [crew]);
  const keys = useMemo(() => [...keyList].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })), [keyList]);
  const status = useMemo(() => keyStatus(keys, keyMoves), [keys, keyMoves]);
  const out = useMemo(() => keysOut(keys, keyMoves, Date.now()), [keys, keyMoves]);

  const [open, setOpen] = useState<string | null>(route.params?.key ?? null);
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [dueBack, setDueBack] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<KeyItem | null>(null);
  const [filter, setFilter] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [from, setFrom] = useState(todayIso().slice(0, 8) + '01');
  const [until, setUntil] = useState(todayIso());
  const [printerOpen, setPrinterOpen] = useState(false);
  const [pending, setPending] = useState<TsplLabelSpec[] | null>(null);
  useEffect(() => {
    if (route.params?.key) setOpen(route.params.key);
  }, [route.params?.key]);

  const done = (w: string | null | void) => {
    if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  };
  const fail = (e: any) => Alert.alert('PDF', String(e?.message ?? e));
  const recorder = sync.me ? personName(sync.me) : 'Key cabinet';

  const issue = async (k: KeyItem) => {
    const p = people.find((x) => x.id === to);
    const name = p?.name ?? toName.trim();
    if (!name) return Alert.alert(k.code, t('keys.whoTakes'));
    const sig = await confirmSign({ personKey: p ? p.id : `name:${name}`, name, ownDevice: false, what: `Key ${k.code} — ${k.name} — taken`, always: true, handOnly: !p });
    if (!sig) return;
    const now = Date.now();
    const mv: KeyMove = { id: uid('km'), keyId: k.id, code: k.code, name: k.name, dir: 'out', person: name, ...(p?.rank ? { personRank: p.rank } : {}), ...(p ? { personKey: p.id } : {}), ...(sig.proof ? { personWith: sig.proof } : {}), by: recorder, at: now, ...(note.trim() ? { note: note.trim() } : {}), ...(dueBack ? { dueBack } : {}), updatedAt: now };
    await saveRow(storage.KEY_MOVES_KEY, mv);
    playSuccessSound();
    setSaved(`${k.code} ${k.name} — out to ${name}`);
    setOpen(null);
    setTo('');
    setToName('');
    setNote('');
    setDueBack(undefined);
  };
  const back = async (k: KeyItem, m: KeyMove) => {
    const now = Date.now();
    await saveRow(storage.KEY_MOVES_KEY, { id: uid('km'), keyId: k.id, code: k.code, name: k.name, dir: 'in', person: m.person, ...(m.personRank ? { personRank: m.personRank } : {}), ...(m.personKey ? { personKey: m.personKey } : {}), by: recorder, at: now, ...(note.trim() ? { note: note.trim() } : {}), updatedAt: now } as KeyMove);
    playSuccessSound();
    setSaved(`${k.code} ${k.name} — back on the board`);
    setOpen(null);
    setNote('');
  };

  const saveKey = async () => {
    if (!edit) return;
    const code = edit.code.trim().toUpperCase();
    if (!edit.name.trim()) return Alert.alert(t('keys.key'), t('keys.whatOpens'));
    if (!STORE_CODE_RE.test(code)) return Alert.alert(t('keys.id'), t('keys.idRule'));
    if (keys.some((k) => k.id !== edit.id && k.code.toUpperCase() === code)) return Alert.alert('ID', `${code} is another key’s ID.`);
    await saveRow(storage.KEYS_KEY, { ...edit, code, name: edit.name.trim(), location: edit.location?.trim() || undefined, updatedAt: Date.now() });
    setEdit(null);
    playSuccessSound();
  };
  const send = async (printer: SavedPrinter, specs: TsplLabelSpec[]) => {
    try {
      await printTspl(printer.id, labelsToTspl(specs));
      Alert.alert(t('print.sent'), t('keys.tagsSent', { x: tn('n.tag', specs.length), printer: printer.name }));
    } catch (e: any) {
      Alert.alert(t('print.xprinterFail'), String(e?.message ?? e));
    } finally {
      setPending(null);
    }
  };
  const toXprinter = (list: KeyItem[]) =>
    Alert.alert(t('print.labelSize'), t('print.roll'), [
      ...GANGWAY_STOCKS.map((sz) => ({
        text: `${GANGWAY_STOCK_MM[sz].widthMm} × ${GANGWAY_STOCK_MM[sz].heightMm} mm`,
        onPress: async () => {
          const specs = codeLabelSpecs('key', list, vessel, sz);
          const printer = await getSavedPrinter();
          if (printer) return void send(printer, specs);
          setPending(specs);
          setPrinterOpen(true);
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);

  const shown = keys.filter((k) => !filter.trim() || `${k.code} ${k.name} ${k.location ?? ''} ${status.get(k.id)?.dir === 'out' ? status.get(k.id)!.person : ''}`.toLowerCase().includes(filter.trim().toLowerCase()));

  const keyForm = edit ? (
    <Card>
      <Label>{keys.some((k) => k.id === edit.id) ? t('keys.keyCode', { code: edit.code }) : t('keys.newKey')}</Label>
      <Text style={styles.sub}>{t('keys.opens')}</Text>
      <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} accessibilityLabel={t('keys.opens')} />
      <Text style={styles.sub}>{t('keys.kept')}</Text>
      <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} accessibilityLabel={t('keys.kept')} />
      <Text style={styles.sub}>{t('keys.idTag')}</Text>
      <TextInput style={[styles.input, { width: 160 }]} value={edit.code} onChangeText={(v) => setEdit({ ...edit, code: v })} autoCapitalize="characters" autoCorrect={false} accessibilityLabel={t('keys.keyId')} />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void saveKey()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
      </View>
    </Card>
  ) : null;

  return (
    <Screen scroll>
      <PrinterModal visible={printerOpen} onClose={() => { setPrinterOpen(false); setPending(null); }} onPicked={(p) => { setPrinterOpen(false); if (pending) void send(p, pending); }} />
      <ScreenTitle title={t('keys.title')} subtitle={`${tn('n.key', keys.length)} · ${t('keys.outNowN', { n: out.length })}`} help="Security (ISPS)" />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}

      {out.length ? (
        <>
          <Label>{t('keys.outNow')}</Label>
          {out.map((o) => (
            <TouchableOpacity key={o.key.id} style={[styles.item, { borderLeftColor: o.move.dueBack && o.move.dueBack < todayIso() ? COLORS.danger : COLORS.warning }]} onPress={() => setOpen(o.key.id)}>
              <Text style={styles.name}>{`${o.key.code} · ${o.key.name}`}</Text>
              <Text style={styles.sub}>{`${o.move.person}${o.move.personRank ? ` (${o.move.personRank})` : ''} · ${t('keys.since', { when: when(o.move.at) })}${o.days ? ` · ${tn('n.day', o.days)}` : ''}${o.move.dueBack ? ` · ${t('keys.dueBack', { date: o.move.dueBack })}` : ''}`}</Text>
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <Label style={{ marginTop: SIZES.md }}>{t('keys.keys')}</Label>
      <View style={[styles.row, { marginTop: 0, gap: SIZES.xs, alignItems: 'center' }]}>
        <TextInput style={[styles.input, { flex: 1, minWidth: 180, marginTop: 0 }]} value={filter} onChangeText={setFilter} accessibilityLabel={t('keys.find')} />
        {officer ? <TouchableOpacity style={styles.btn} onPress={() => setEdit({ id: uid('key'), code: nextCode('K-', keys), name: '', updatedAt: Date.now() })}><Text style={styles.btnText}>{`+ ${t('keys.newKey')}`}</Text></TouchableOpacity> : null}
        {officer && keys.length ? (
          <>
            <TouchableOpacity style={styles.small} onPress={() => void exportKeyTags(keys, vessel).then(done, fail)}><Text style={styles.smallText}>{t('keys.tagsAll')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => toXprinter(keys)}><Text style={styles.smallText}>{t('keys.xprinterAll')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => void exportKeyTagCards(keys, vessel).then(done, fail)}><Text style={styles.smallText}>{t('keys.card')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => void exportEngravingSvg(keys, vessel).then(done, fail)}><Text style={styles.smallText}>{t('keys.laser')}</Text></TouchableOpacity>
          </>
        ) : null}
      </View>
      {edit && !keys.some((k) => k.id === edit.id) ? keyForm : null}
      {!keys.length ? <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>{officer ? t('keys.empty') : t('keys.emptyCrew')}</Text> : null}

      {shown.map((k) => {
        if (edit?.id === k.id) return <React.Fragment key={k.id}>{keyForm}</React.Fragment>;
        const m = status.get(k.id);
        const isOut = m?.dir === 'out';
        const expanded = open === k.id;
        return (
          <View key={k.id} style={[styles.item, { borderLeftColor: isOut ? COLORS.warning : COLORS.success }]}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }} onPress={() => setOpen(expanded ? null : k.id)}>
              <MciIcon name={isOut ? 'key-arrow-right' : 'key-variant'} size={20} color={isOut ? COLORS.warning : COLORS.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{`${k.code} · ${k.name}`}</Text>
                <Text style={styles.sub}>{isOut ? t('keys.outRow', { who: m!.person, when: when(m!.at) }) : `${t('keys.onBoard')}${k.location ? ` · ${k.location}` : ''}`}</Text>
              </View>
            </TouchableOpacity>
            {expanded ? (
              <View style={{ marginTop: SIZES.sm }}>
                {isOut ? (
                  <>
                    <Text style={styles.sub}>{t('keys.note')}</Text>
                    <TextInput style={styles.input} value={note} onChangeText={setNote} accessibilityLabel={t('keys.note')} />
                    <TouchableOpacity style={styles.btn} onPress={() => void back(k, m!)}><Text style={styles.btnText}>{t('keys.back', { who: m!.person })}</Text></TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Dropdown caption={t('keys.takenByCap')} value={to} onChange={(v: string) => setTo(v)} options={[{ value: '', label: t('common.choose') }, ...people.map((p) => ({ value: p.id, label: crewLabel(p) }))]} style={{ maxWidth: 420 }} />
                    {!to ? (
                      <>
                        <Text style={[styles.sub, { marginTop: SIZES.xs }]}>{t('keys.orSomeone')}</Text>
                        <TextInput style={styles.input} value={toName} onChangeText={setToName} accessibilityLabel={t('keys.takenByName')} />
                      </>
                    ) : null}
                    <SimpleDatePicker label={t('keys.dueBackOpt')} value={dueBack} onChange={(d) => setDueBack(d || undefined)} onClear={() => setDueBack(undefined)} />
                    <Text style={styles.sub}>{t('keys.note')}</Text>
                    <TextInput style={styles.input} value={note} onChangeText={setNote} accessibilityLabel={t('keys.note')} />
                    <TouchableOpacity style={styles.btn} onPress={() => void issue(k)}><Text style={styles.btnText}>{t('keys.signOut')}</Text></TouchableOpacity>
                  </>
                )}
                {officer ? (
                  <View style={[styles.row, { gap: SIZES.xs }]}>
                    <TouchableOpacity style={styles.small} onPress={() => setEdit(k)}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.small} onPress={() => void exportKeyTags([k], vessel).then(done, fail)}><Text style={styles.smallText}>{t('keys.tagPdf')}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.small} onPress={() => toXprinter([k])}><Text style={styles.smallText}>Xprinter</Text></TouchableOpacity>
                    {!isOut ? (
                      <TouchableOpacity onPress={() => Alert.alert(t('keys.removeQ'), t('keys.removeBody', { key: `${k.code} ${k.name}` }), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.remove'), style: 'destructive', onPress: () => void saveRow(storage.KEYS_KEY, { ...k, deleted: true, updatedAt: Date.now() }) }])} hitSlop={8} accessibilityLabel={`${t('common.remove')} ${k.code}`}>
                        <MciIcon name="trash-can-outline" size={20} color={COLORS.danger} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      <Label style={{ marginTop: SIZES.md }}>{t('keys.report')}</Label>
      <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.sm }]}>
        <View style={{ minWidth: 160 }}><SimpleDatePicker label={t('common.from')} value={from} onChange={(d) => setFrom(d || from)} /></View>
        <View style={{ minWidth: 160 }}><SimpleDatePicker label={t('common.to')} value={until} onChange={(d) => setUntil(d || until)} /></View>
        <TouchableOpacity style={styles.btn} onPress={() => void exportKeyReport(from, until, keyList, keyMoves, vessel).then(done, fail)}><Text style={styles.btnText}>PDF</Text></TouchableOpacity>
      </View>
      <Text style={styles.sub}>{t('keys.reportNote')}</Text>
    </Screen>
  );
}
