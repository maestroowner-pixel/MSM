// ===================================
// Security → Security rounds (types/patrols.ts; Jez, 17 Oct 2026).
//
//   Today       the rounds due today — done (by whom, when) or still to do; start one.
//   A round     its duties first ("read and confirm"), then its checkpoints: scan
//               each one's QR where it is (the scanner stays open), or type its
//               ID when the label cannot be read; finish and sign. Filed once.
//   Checkpoints the places with a label — officers: add, rename, print the labels.
//   Rounds      when each round is due, which checkpoints, its duties — officers.
//   Reports     a day's or a month's rounds as a PDF: done, missed, who, when.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { PrinterModal } from '../components/PrinterModal';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { STORE_CODE_RE } from '../types/stores';
import { Checkpoint, KIND_LABEL, Patrol, PatrolKind, PatrolPlan } from '../types/patrols';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { STARTER_CHECKPOINTS, STARTER_PLANS, dayRounds, livePlans, missedPoints, nextCode, slotFor } from '../services/patrols';
import { LivePatrol, loadLive, onLive, saveLive } from '../services/patrolLive';
import { exportPatrolDay, exportPatrolMonth } from '../services/patrolReport';
import { exportCheckpointLabels } from '../services/crewCards';
import { GANGWAY_STOCKS, GANGWAY_STOCK_MM, codeLabelSpecs } from '../services/gangwayLabels';
import { TsplLabelSpec, labelsToTspl } from '../services/tspl';
import { getSavedPrinter, printTspl, SavedPrinter } from '../services/blePrinter';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type Page = 'today' | 'points' | 'plans' | 'reports';
const hm = (t = Date.now()) => new Date(t).toTimeString().slice(0, 5);
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function PatrolsSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { checkpoints, patrolPlans, patrols, vessel, saveRow, saveRows } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('ROUND BY');
  const today = todayIso();
  const [page, setPage] = useState<Page>('today');
  const [live, setLive] = useState<LivePatrol | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // The vessel's rounds: its own records over the starter ones (same ids).
  const plans = useMemo(() => {
    const own = new Map(patrolPlans.map((p) => [p.id, p]));
    return [...STARTER_PLANS.map((p) => own.get(p.id) ?? p), ...patrolPlans.filter((p) => !STARTER_PLANS.some((s) => s.id === p.id))];
  }, [patrolPlans]);
  const points = checkpoints;

  useEffect(() => {
    void loadLive().then(setLive);
    return onLive(setLive);
  }, []);

  const done = (w: string | null | void) => {
    if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
  };
  const fail = (e: any) => Alert.alert('PDF', String(e?.message ?? e));

  const due = dayRounds(today, plans, patrols.filter((p) => p.date === today));
  const plan = live ? plans.find((p) => p.id === live.planId) : undefined;

  // ---- a round ----------------------------------------------------------------
  const start = (p: PatrolPlan) => {
    if (!p.checkpointIds.length) return Alert.alert(p.name, officer ? 'Choose its checkpoints first (Rounds).' : 'This round has no checkpoints yet — an officer sets them in Rounds.');
    const slot = slotFor(p, hm(), due.filter((d) => d.plan.id === p.id && d.done).map((d) => d.slot)) ?? undefined;
    void saveLive({ planId: p.id, slot, date: today, startedAt: Date.now(), dutiesDone: false, visits: [], remarks: '' });
  };
  const finish = async () => {
    if (!live || !plan) return;
    if (!signer) return Alert.alert('Security round', 'Choose who did the round.');
    const missed = missedPoints(plan, points, live.visits.map((v) => v.checkpointId));
    const go = async () => {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${plan.name}${live.slot ? ` — ${live.slot}` : ''}` });
      if (!sig) return;
      const now = Date.now();
      const rec: Patrol = {
        id: uid('pt'),
        planId: plan.id,
        planName: plan.name,
        kind: plan.kind,
        ...(live.slot ? { slot: live.slot } : {}),
        date: live.date,
        startedAt: live.startedAt,
        finishedAt: now,
        duties: plan.duties,
        dutiesDone: live.dutiesDone,
        visits: live.visits,
        missed: missed.map((c) => ({ checkpointId: c.id, code: c.code, name: c.name })),
        ...(live.remarks.trim() ? { remarks: live.remarks.trim() } : {}),
        by: signer.name,
        ...(signer.rank ? { byRank: signer.rank } : {}),
        byKey: signer.key,
        updatedAt: now,
      };
      await saveRow(storage.PATROLS_KEY, rec);
      await saveLive(null);
      playSuccessSound();
      setSaved(`${plan.name} filed — ${rec.visits.length} of ${rec.visits.length + rec.missed.length} checkpoints`);
    };
    if (missed.length || !live.dutiesDone) {
      Alert.alert('Finish the round?', [missed.length ? `Not visited: ${missed.map((c) => c.code).join(', ')}.` : '', live.dutiesDone ? '' : 'The duties are not confirmed.', 'It is filed as it is and printed so.'].filter(Boolean).join(' '), [
        { text: 'Go on with it', style: 'cancel' },
        { text: 'Finish', onPress: () => void go() },
      ]);
    } else void go();
  };
  const abandon = () =>
    Alert.alert('Drop this round?', 'Nothing of it is kept. The time it was due shows as missed unless another round is done for it.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Drop', style: 'destructive', onPress: () => void saveLive(null) },
    ]);
  const typeId = (code: string) => {
    const c = points.find((x) => x.code.toUpperCase() === code.trim().toUpperCase() && plan?.checkpointIds.includes(x.id));
    if (!c) return Alert.alert('Checkpoint', `${code.trim().toUpperCase()} is not on this round.`);
    if (!live || live.visits.some((v) => v.checkpointId === c.id)) return;
    void saveLive({ ...live, visits: [...live.visits, { checkpointId: c.id, code: c.code, name: c.name, at: Date.now(), how: 'typed' }] });
  };

  if (live && plan) {
    const onRound = plan.checkpointIds.map((id) => points.find((c) => c.id === id)).filter((c): c is Checkpoint => !!c);
    return (
      <Screen scroll>
        <ScreenTitle title={plan.name} subtitle={`${live.slot ? `Due ${live.slot} · ` : ''}started ${hm(live.startedAt)} · ${live.visits.length} of ${onRound.length} checkpoints`} help="Security (ISPS)" />
        <Card>
          <Label>Duties of this round</Label>
          {plan.duties.map((d, i) => (
            <Text key={i} style={[styles.body, { marginBottom: 4 }]}>{`${i + 1}. ${d}`}</Text>
          ))}
          <TouchableOpacity style={[styles.chip, live.dutiesDone && styles.chipOn, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={() => void saveLive({ ...live, dutiesDone: !live.dutiesDone })}>
            <Text style={[styles.chipText, live.dutiesDone && styles.chipTextOn]}>{live.dutiesDone ? '✓ Read and done' : 'Read and done'}</Text>
          </TouchableOpacity>
        </Card>
        <TouchableOpacity style={[styles.btn, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginVertical: SIZES.sm }]} onPress={() => nav.navigate('Scan', { patrol: 1 })}>
          <MciIcon name="qrcode-scan" size={20} color={COLORS.textWhite} />
          <Text style={styles.btnText}>Scan a checkpoint</Text>
        </TouchableOpacity>
        <Label>Checkpoints</Label>
        {onRound.map((c) => {
          const v = live.visits.find((x) => x.checkpointId === c.id);
          return (
            <View key={c.id} style={[styles.item, { borderLeftColor: v ? COLORS.success : COLORS.border, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }]}>
              <MciIcon name={v ? 'check-circle' : 'map-marker-outline'} size={20} color={v ? COLORS.success : COLORS.textLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{`${c.code} · ${c.name}`}</Text>
                <Text style={styles.sub}>{v ? `${v.how === 'scan' ? 'Scanned' : 'ID typed'} ${hm(v.at)}` : c.location || 'not yet'}</Text>
              </View>
              {!v ? (
                <TouchableOpacity style={styles.small} onPress={() => Alert.alert(c.code, 'The label could not be scanned — record it by its ID? The report says so.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Record', onPress: () => typeId(c.code) }])}>
                  <Text style={styles.smallText}>Label unreadable</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
        <Label>Remarks</Label>
        <TextInput style={[styles.input, { minHeight: 60 }]} value={live.remarks} onChangeText={(t) => setLive({ ...live, remarks: t })} onEndEditing={() => void saveLive(live)} onBlur={() => void saveLive(live)} multiline accessibilityLabel="Remarks" />
        {picker}
        <TouchableOpacity style={[styles.btn, { marginTop: SIZES.sm }]} onPress={() => void finish()}>
          <Text style={styles.btnText}>{signer ? `Finish and sign — ${signer.name}` : 'Finish and sign'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={abandon} style={{ marginTop: SIZES.md }}>
          <Text style={[styles.link, { color: COLORS.danger }]}>Drop this round</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const PAGES: [Page, string][] = [['today', 'Today'], ...(officer ? ([['points', 'Checkpoints'], ['plans', 'Rounds']] as [Page, string][]) : []), ['reports', 'Reports']];

  return (
    <Screen scroll>
      <ScreenTitle title="Security rounds" subtitle="Opening, daytime and closing rounds — each checkpoint scanned where it is" help="Security (ISPS)" />
      <View style={styles.chips}>
        {PAGES.map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.chip, page === k && styles.chipOn]} onPress={() => setPage(k)}>
            <Text style={[styles.chipText, page === k && styles.chipTextOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginVertical: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}

      {page === 'today' ? (
        <>
          {!points.length ? <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>{officer ? 'No checkpoints yet — add the places in Checkpoints, print their labels, then choose them for each round.' : 'No checkpoints yet — an officer sets them up.'}</Text> : null}
          {due.map((d) => (
            <View key={`${d.plan.id}${d.slot}`} style={[styles.item, { borderLeftColor: d.done ? COLORS.success : d.slot <= hm() ? COLORS.danger : COLORS.border, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }]}>
              <Text style={[styles.name, { width: 52 }]}>{d.slot}</Text>
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={styles.name}>{d.plan.name}</Text>
                <Text style={styles.sub}>{d.done ? `Done ${hm(d.done.startedAt)}–${hm(d.done.finishedAt)} · ${d.done.by} · ${d.done.visits.length}/${d.done.visits.length + d.done.missed.length}${d.done.missed.length ? ` · missed ${d.done.missed.map((m) => m.code).join(', ')}` : ''}` : d.slot <= hm() ? 'Not done yet' : 'Later today'}</Text>
              </View>
              {!d.done ? (
                <TouchableOpacity style={styles.btn} onPress={() => start(d.plan)}>
                  <Text style={styles.btnText}>Start</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {page === 'points' && officer ? <Points done={done} fail={fail} /> : null}
      {page === 'plans' && officer ? <Plans plans={plans} /> : null}

      {page === 'reports' ? <Reports plans={plans} done={done} fail={fail} /> : null}
    </Screen>
  );
}

// ---- checkpoints -----------------------------------------------------------------

function Points({ done, fail }: { done: (w: string | null | void) => void; fail: (e: any) => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { checkpoints: points, vessel, saveRow, saveRows } = useData();
  const [edit, setEdit] = useState<Checkpoint | null>(null);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [pending, setPending] = useState<TsplLabelSpec[] | null>(null);
  const isNew = !!edit && !points.some((c) => c.id === edit.id);
  const code = (edit?.code ?? '').trim().toUpperCase();
  const taken = !!edit && points.some((c) => c.id !== edit.id && c.code.toUpperCase() === code);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return Alert.alert('Checkpoint', 'Name the place — Gangway, Tender garage.');
    if (!STORE_CODE_RE.test(code)) return Alert.alert('ID', 'Letters, digits, - and _ only — CP-04.');
    if (taken) return Alert.alert('ID', `${code} is another checkpoint’s ID.`);
    await saveRow(storage.CHECKPOINTS_KEY, { ...edit, name: edit.name.trim(), code, location: edit.location?.trim() || undefined, updatedAt: Date.now() });
    setEdit(null);
    playSuccessSound();
  };
  const starter = async () => {
    const now = Date.now();
    await saveRows(storage.CHECKPOINTS_KEY, STARTER_CHECKPOINTS.map((c, i) => ({ id: uid('cp'), code: `CP-${String(i + 1).padStart(2, '0')}`, name: c.name, location: c.location, order: i, updatedAt: now })));
  };
  const send = async (printer: SavedPrinter, specs: TsplLabelSpec[]) => {
    try {
      await printTspl(printer.id, labelsToTspl(specs));
      Alert.alert('Sent to printer', `${specs.length} label${specs.length === 1 ? '' : 's'} sent to ${printer.name}.`);
    } catch (e: any) {
      Alert.alert('Could not print to the Xprinter', String(e?.message ?? e));
    } finally {
      setPending(null);
    }
  };
  const toXprinter = (list: Checkpoint[]) =>
    Alert.alert('Label size', 'The roll loaded in the printer.', [
      ...GANGWAY_STOCKS.map((sz) => ({
        text: `${GANGWAY_STOCK_MM[sz].widthMm} × ${GANGWAY_STOCK_MM[sz].heightMm} mm`,
        onPress: async () => {
          const specs = codeLabelSpecs('checkpoint', list, vessel, sz);
          const printer = await getSavedPrinter();
          if (printer) return void send(printer, specs);
          setPending(specs);
          setPrinterOpen(true);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const form = edit ? (
    <Card>
      <Label>{isNew ? 'New checkpoint' : `Checkpoint — ${edit.code}`}</Label>
      <Text style={styles.sub}>Name</Text>
      <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} autoFocus={isNew} accessibilityLabel="Checkpoint name" />
      <Text style={styles.sub}>Where it is</Text>
      <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} accessibilityLabel="Where it is" />
      <Text style={styles.sub}>ID — on the label</Text>
      <TextInput style={[styles.input, { width: 160 }]} value={edit.code} onChangeText={(v) => setEdit({ ...edit, code: v })} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Checkpoint ID" />
      {taken ? <Text style={[styles.sub, { color: COLORS.danger }]}>Another checkpoint has this ID.</Text> : null}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
      </View>
    </Card>
  ) : null;

  return (
    <>
      <PrinterModal visible={printerOpen} onClose={() => { setPrinterOpen(false); setPending(null); }} onPicked={(p) => { setPrinterOpen(false); if (pending) void send(p, pending); }} />
      <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>Each place gets a QR label fixed where the watch must go. The label carries the checkpoint itself — renaming it or changing its ID does not need a new label.</Text>
      <View style={[styles.row, { marginTop: 0, gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.btn} onPress={() => setEdit({ id: uid('cp'), code: nextCode('CP-', points), name: '', order: points.length, updatedAt: Date.now() })}><Text style={styles.btnText}>+ New checkpoint</Text></TouchableOpacity>
        {points.length ? (
          <>
            <TouchableOpacity style={styles.small} onPress={() => void exportCheckpointLabels(points, vessel).then(done, fail)}><Text style={styles.smallText}>{`QR labels — all (PDF) · ${points.length}`}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => toXprinter(points)}><Text style={styles.smallText}>Xprinter — all</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.small} onPress={() => void starter()}><Text style={styles.smallText}>Start from a typical yacht (8 places)</Text></TouchableOpacity>
        )}
      </View>
      {isNew ? form : null}
      {points.map((c) =>
        edit?.id === c.id ? (
          <React.Fragment key={c.id}>{form}</React.Fragment>
        ) : (
          <View key={c.id} style={[styles.item, { borderLeftColor: COLORS.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }}>
              <Text style={[styles.name, { color: COLORS.primary }]}>{c.code}</Text>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.sub}>{c.location || 'place not set'}</Text>
              </View>
              <TouchableOpacity style={styles.small} onPress={() => setEdit(c)}><Text style={styles.smallText}>Edit</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => void exportCheckpointLabels([c], vessel).then(done, fail)}><Text style={styles.smallText}>QR label (PDF)</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => toXprinter([c])}><Text style={styles.smallText}>Xprinter</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Remove checkpoint', `Remove ${c.code} ${c.name}? Its label stops counting; rounds done keep it.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void saveRow(storage.CHECKPOINTS_KEY, { ...c, deleted: true, updatedAt: Date.now() }) }])} hitSlop={8} accessibilityLabel={`Remove ${c.code}`}>
                <MciIcon name="trash-can-outline" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )
      )}
    </>
  );
}

// ---- rounds (plans) ------------------------------------------------------------------

function Plans({ plans }: { plans: PatrolPlan[] }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { checkpoints: points, saveRow } = useData();
  const [edit, setEdit] = useState<{ p: PatrolPlan; times: string; duties: string } | null>(null);

  const open = (p: PatrolPlan) => setEdit({ p, times: p.times.join(', '), duties: p.duties.join('\n') });
  const save = async () => {
    if (!edit) return;
    const times = edit.times.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.length === 4 && !t.includes(':') ? `${t.slice(0, 2)}:${t.slice(2)}` : t));
    const bad = times.filter((t) => !TIME_RE.test(t));
    if (!edit.p.name.trim()) return Alert.alert('Round', 'Name it.');
    if (!times.length || bad.length) return Alert.alert('When it is due', bad.length ? `Not a time: ${bad.join(', ')}. Write 07:00, 13:30.` : 'At least one time — 07:00.');
    const norm = times.map((t) => t.padStart(5, '0'));
    await saveRow(storage.PATROL_PLANS_KEY, { ...edit.p, name: edit.p.name.trim(), times: [...new Set(norm)].sort(), duties: edit.duties.split('\n').map((d) => d.trim()).filter(Boolean), updatedAt: Date.now() });
    setEdit(null);
    playSuccessSound();
  };

  if (edit) {
    const p = edit.p;
    const set = (patch: Partial<PatrolPlan>) => setEdit({ ...edit, p: { ...p, ...patch } });
    return (
      <Card>
        <Label>Round</Label>
        <Text style={styles.sub}>Name</Text>
        <TextInput style={styles.input} value={p.name} onChangeText={(v) => set({ name: v })} accessibilityLabel="Round name" />
        <Text style={styles.sub}>Kind</Text>
        <View style={styles.chips}>
          {(Object.keys(KIND_LABEL) as PatrolKind[]).map((k) => (
            <TouchableOpacity key={k} style={[styles.chip, p.kind === k && styles.chipOn]} onPress={() => set({ kind: k })}>
              <Text style={[styles.chipText, p.kind === k && styles.chipTextOn]}>{KIND_LABEL[k]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sub}>Due at (ship’s time, comma between)</Text>
        <TextInput style={[styles.input, { maxWidth: 360 }]} value={edit.times} onChangeText={(v) => setEdit({ ...edit, times: v })} accessibilityLabel="Due at" />
        <Text style={styles.sub}>{`Checkpoints on this round (${p.checkpointIds.length})`}</Text>
        <View style={styles.chips}>
          {points.map((c) => {
            const on = p.checkpointIds.includes(c.id);
            return (
              <TouchableOpacity key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => set({ checkpointIds: on ? p.checkpointIds.filter((x) => x !== c.id) : [...p.checkpointIds, c.id] })}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{`${c.code} ${c.name}`}</Text>
              </TouchableOpacity>
            );
          })}
          {!points.length ? <Text style={styles.sub}>Add the checkpoints first.</Text> : null}
        </View>
        <Text style={[styles.sub, { marginTop: SIZES.sm }]}>Duties and reminders — one a line, shown at the top of the round and printed</Text>
        <TextInput style={[styles.input, { minHeight: 140 }]} value={edit.duties} onChangeText={(v) => setEdit({ ...edit, duties: v })} multiline accessibilityLabel="Duties" />
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
        </View>
      </Card>
    );
  }

  return (
    <>
      <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>When each round is due, which checkpoints the watch scans, and the duties shown at its top.</Text>
      {plans.map((p) => (
        <View key={p.id} style={[styles.item, { borderLeftColor: p.off ? COLORS.border : COLORS.primary, opacity: p.off ? 0.55 : 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.sub}>{`${p.times.join(', ') || 'no time'} · ${p.checkpointIds.length} checkpoints · ${p.duties.length} duties${p.off ? ' · off' : ''}`}</Text>
            </View>
            <TouchableOpacity style={styles.small} onPress={() => open(p)}><Text style={styles.smallText}>Edit</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => void saveRow(storage.PATROL_PLANS_KEY, { ...p, off: !p.off, updatedAt: Date.now() })}><Text style={styles.smallText}>{p.off ? 'Switch on' : 'Switch off'}</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={[styles.btn, { marginTop: SIZES.sm, alignSelf: 'flex-start' }]} onPress={() => open({ id: uid('pp'), name: '', kind: 'daytime', times: [], checkpointIds: [], duties: [], updatedAt: 0 })}>
        <Text style={styles.btnText}>+ New round</Text>
      </TouchableOpacity>
    </>
  );
}

// ---- reports ------------------------------------------------------------------------

function Reports({ plans, done, fail }: { plans: PatrolPlan[]; done: (w: string | null | void) => void; fail: (e: any) => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { patrols, vessel } = useData();
  const today = todayIso();
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const shift = (m: string, by: number) => {
    const d = new Date(`${m}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + by);
    return d.toISOString().slice(0, 7);
  };
  const dayShift = (d: string, by: number) => new Date(Date.parse(`${d}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
  const r = dayRounds(day, plans, patrols.filter((p) => p.date === day));
  return (
    <>
      <Label>A day</Label>
      <View style={[styles.row, { alignItems: 'center' }]}>
        <TouchableOpacity onPress={() => setDay(dayShift(day, -1))} hitSlop={8}><Text style={styles.link}>‹</Text></TouchableOpacity>
        <Text style={styles.name}>{day}</Text>
        <TouchableOpacity onPress={() => day < today && setDay(dayShift(day, 1))} hitSlop={8}><Text style={[styles.link, day >= today && { opacity: 0.3 }]}>›</Text></TouchableOpacity>
        <Text style={styles.sub}>{`${r.filter((x) => x.done).length} of ${r.length} done`}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => void exportPatrolDay(day, plans, patrols, vessel).then(done, fail)}><Text style={styles.btnText}>PDF</Text></TouchableOpacity>
      </View>
      <Label style={{ marginTop: SIZES.md }}>A month</Label>
      <View style={[styles.row, { alignItems: 'center' }]}>
        <TouchableOpacity onPress={() => setMonth(shift(month, -1))} hitSlop={8}><Text style={styles.link}>‹</Text></TouchableOpacity>
        <Text style={styles.name}>{month}</Text>
        <TouchableOpacity onPress={() => month < today.slice(0, 7) && setMonth(shift(month, 1))} hitSlop={8}><Text style={[styles.link, month >= today.slice(0, 7) && { opacity: 0.3 }]}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void exportPatrolMonth(month, today, plans, patrols, vessel).then(done, fail)}><Text style={styles.btnText}>PDF</Text></TouchableOpacity>
      </View>
      <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{`Rounds due, done and missed; who did each and when; checkpoints missed; each round’s duties. ${livePlans(plans).length} rounds in use.`}</Text>
    </>
  );
}
