// ===================================
// The ship's plan (GA) — types/gaPlan.ts. A tab per deck; on the deck's
// picture, the machinery defects and the yard jobs put on it, numbered and
// coloured by how they stand; filters, zoom, the list, and the deck on paper
// for the yard. An officer (or a planner) adds a deck — a picture of it from
// the GA plan — and puts a record on it: the record's screen opens this one
// with `pickKind`/`pickRef`, a tap on the picture places the point.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { moduleOn } from '../constants/modules';
import { SIZES } from '../theme';
import { personName, plansPms, roleAtLeast } from '../types/role';
import { Attachment } from '../types/equipment';
import { GaPin, GaPinKind, GaSheet } from '../types/gaPlan';
import * as storage from '../services/storage';
import * as photoQueue from '../services/photoQueue';
import { ensureLocalPhoto } from '../services/photoStorage';
import { pickDocument, pickFromLibrary, resolveUri } from '../services/attachments';
import { MARK_STATUSES, Mark, MarkFilter, STATUS_HEX, clampPos, liveSheets, nextOrder, pinFor, placePin, sheetMarks, sheetProblem } from '../services/gaPlan';
import { exportGaPlan, shareGaPlan } from '../services/gaPlanReport';
import { todayIso } from '../services/pms';
import { onWeb } from '../utils/fileShare';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const R = 13; // a point's radius on screen
const ZOOMS = [1, 2, 3];

/** The deck's picture on this device: undefined while it is looked for, null when it is not here yet. */
function usePlanImage(imo: string, sheet?: GaSheet): string | null | undefined {
  const [uri, setUri] = useState<string | null | undefined>(undefined);
  const photo = sheet?.photos[0];
  useEffect(() => {
    let alive = true;
    setUri(undefined);
    if (!sheet || !photo) {
      setUri(null);
      return;
    }
    ensureLocalPhoto(imo, sheet.id, photo)
      .catch(() => null)
      .then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [imo, sheet?.id, photo?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return uri;
}

interface SheetDraft {
  id?: string;
  name: string;
  photo?: Attachment;
  w: number;
  h: number;
}

export default function GaPlanSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { gaSheets, gaPins, pmsDefects, yardJobs, pmsProjects, saveRow, saveRows, vessel } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin') || plansPms(sync.enrolled, sync.role);
  const me = sync.me ? personName(sync.me) : t('ga.officer');
  const imo = vessel?.imo ?? '';
  const today = todayIso();
  const sheets = liveSheets(gaSheets);

  const pickKind: GaPinKind | undefined = route.params?.pickKind;
  const pickRef: string | undefined = route.params?.pickRef;
  const picking = canEdit && pickKind && pickRef ? { kind: pickKind, ref: pickRef } : null;
  const pickDefect = picking?.kind === 'defect' ? pmsDefects.find((d) => d.id === picking.ref) : undefined;
  const pickJob = picking?.kind === 'yard' ? yardJobs.find((j) => j.id === picking.ref) : undefined;
  const pickTitle = pickDefect ? `${t('ga.kind.defect')}: ${pickDefect.description}` : pickJob ? `${t('ga.kind.yard')} ${String(pickJob.no).padStart(3, '0')}: ${pickJob.title}` : '';
  const ownPin = picking ? pinFor(gaPins, picking.kind, picking.ref) : undefined;

  const kindsOn: GaPinKind[] = [...(moduleOn('pms') ? (['defect'] as const) : []), ...(moduleOn('yard') ? (['yard'] as const) : [])];
  const [sheetId, setSheetId] = useState<string | undefined>(route.params?.sheet);
  const sheet = sheets.find((s) => s.id === sheetId) ?? sheets[0];
  const [kinds, setKinds] = useState<GaPinKind[]>(kindsOn);
  const [closed, setClosed] = useState<boolean>(!!route.params?.focus);
  const [projectId, setProjectId] = useState<string>(route.params?.project ?? '');
  const [zoom, setZoom] = useState(1);
  const [boxW, setBoxW] = useState(0);
  const [focus, setFocus] = useState<string | undefined>(route.params?.focus);
  const [draft, setDraft] = useState<{ sheetId: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<SheetDraft | null>(null);
  const [removing, setRemoving] = useState(false);
  const uri = usePlanImage(imo, sheet);
  const planRef = useRef<any>(null);

  // Where the record stands now, as the starting point of a move.
  const pickKey = picking ? `${picking.kind}_${picking.ref}` : '';
  useEffect(() => {
    setDraft(ownPin ? { sheetId: ownPin.sheetId, x: ownPin.x, y: ownPin.y } : null);
    if (ownPin) setSheetId(ownPin.sheetId);
  }, [pickKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const projects = useMemo(() => [...pmsProjects].filter((p) => yardJobs.some((j) => j.projectId === p.id)).sort((a, b) => b.dueDate.localeCompare(a.dueDate)), [pmsProjects, yardJobs]);
  const projectDate = (id: string) => pmsProjects.find((p) => p.id === id)?.dueDate ?? '';
  const filter: MarkFilter = { kinds: kinds.filter((k) => kindsOn.includes(k)), closed, projectId: kinds.includes('yard') && projectId ? projectId : undefined };
  const allMarks = sheet ? sheetMarks(sheet.id, gaPins, pmsDefects, yardJobs, filter, projectDate) : [];
  // While a record is being placed its own old point is the draft, not a mark.
  const marks = picking ? allMarks.filter((m) => m.pin.id !== ownPin?.id) : allMarks;
  const focused = marks.find((m) => m.pin.id === focus);

  const planW = Math.max(1, boxW * zoom);
  const planH = sheet ? (planW * sheet.h) / sheet.w : 0;

  const chip = (on: boolean, label: string, onPress: () => void, key?: string, dot?: string) => (
    <TouchableOpacity key={key ?? label} style={[styles.chip, on && styles.chipOn, dot ? { flexDirection: 'row', alignItems: 'center', gap: 6 } : null]} onPress={onPress}>
      {dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const fail = (e: any) => Alert.alert(t('ga.title'), String(e?.message ?? e));
  const backToRecord = () => (picking ? goBackOr(nav, picking.kind === 'defect' ? 'PmsDefect' : 'YardJob', { id: picking.ref }) : goBackOr(nav));

  // ---- a point ----
  // Where the tap fell on the picture. A phone gives it as locationX/Y; a browser's click
  // (react-native-web) carries none, so it is the pointer against the picture's own box
  // (the ref is the DOM node there).
  const tap = (e: any) => {
    if (!picking || !sheet) return;
    const n = e.nativeEvent ?? {};
    const box = planRef.current?.getBoundingClientRect?.();
    const cx = typeof n.clientX === 'number' ? n.clientX : typeof n.pageX === 'number' && typeof window !== 'undefined' ? n.pageX - (window.scrollX ?? 0) : undefined;
    const cy = typeof n.clientY === 'number' ? n.clientY : typeof n.pageY === 'number' && typeof window !== 'undefined' ? n.pageY - (window.scrollY ?? 0) : undefined;
    const [px, py] = box && cx != null && cy != null ? [cx - box.left, cy - box.top] : [n.locationX, n.locationY];
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    setDraft({ sheetId: sheet.id, x: clampPos(px / planW), y: clampPos(py / planH) });
  };
  const savePin = async () => {
    if (!picking || !draft) return;
    await saveRow(storage.GA_PINS_KEY, placePin(ownPin, picking.kind, picking.ref, draft.sheetId, draft.x, draft.y, me, Date.now()));
    playSuccessSound();
    backToRecord();
  };
  const takeOff = async () => {
    if (!ownPin) return;
    const off: GaPin = { ...ownPin, removed: { by: me, at: Date.now() } };
    await saveRow(storage.GA_PINS_KEY, off);
    backToRecord();
  };

  // ---- a deck ----
  const pickPicture = async () => {
    const f = onWeb ? await pickDocument() : await pickFromLibrary();
    if (!f) return;
    if (f.kind !== 'photo') return Alert.alert(t('ga.title'), t('ga.noPdf'));
    const shown = resolveUri(f.uri) ?? f.uri;
    Image.getSize(
      shown,
      (w, h) => setEditing((d) => (d ? { ...d, photo: { id: uid('ph'), kind: 'photo', uri: f.uri, ...(f.name ? { name: f.name } : {}), addedAt: Date.now() }, w, h } : d)),
      () => Alert.alert(t('ga.title'), t('ga.badPicture'))
    );
  };
  const saveSheet = async () => {
    if (!editing) return;
    const prev = editing.id ? gaSheets.find((s) => s.id === editing.id) : undefined;
    const now = Date.now();
    const next: GaSheet = {
      ...(prev ?? { id: uid('ga'), order: nextOrder(gaSheets), by: me, at: now }),
      name: editing.name.trim(),
      photos: editing.photo ? [editing.photo] : prev?.photos ?? [],
      w: editing.photo ? editing.w : prev?.w ?? 0,
      h: editing.photo ? editing.h : prev?.h ?? 0,
      updatedAt: now,
    } as GaSheet;
    const why = sheetProblem(next);
    if (why) return Alert.alert(t('ga.title'), tk(`ga.need.${why}`));
    await saveRow(storage.GA_SHEETS_KEY, next);
    if (editing.photo && imo) await photoQueue.enqueueInspection(imo, { id: next.id, photos: [editing.photo] });
    playSuccessSound();
    setSheetId(next.id);
    setEditing(null);
  };
  const removeSheet = async () => {
    if (!sheet) return;
    await saveRow(storage.GA_SHEETS_KEY, { ...sheet, removed: { by: me, at: Date.now() } });
    setRemoving(false);
    setEditing(null);
    setSheetId(undefined);
  };
  const moveEarlier = async () => {
    if (!sheet) return;
    const i = sheets.findIndex((s) => s.id === sheet.id);
    if (i <= 0) return;
    const before = sheets[i - 1];
    const now = Date.now();
    await saveRows(storage.GA_SHEETS_KEY, [{ ...sheet, order: before.order, updatedAt: now }, { ...before, order: sheet.order === before.order ? before.order + 1 : sheet.order, updatedAt: now }]);
  };

  const paper = (all: boolean, share: boolean) => {
    const list = (all ? sheets : sheet ? [sheet] : []).map((s) => ({ sheet: s, marks: sheetMarks(s.id, gaPins, pmsDefects, yardJobs, filter, projectDate) }));
    if (!list.length) return;
    const pName = filter.projectId ? pmsProjects.find((p) => p.id === filter.projectId)?.name : undefined;
    void (share ? shareGaPlan : exportGaPlan)(vessel, list, filter, pName, today).catch(fail);
  };

  const kindLabel = (m: Mark) => (m.pin.kind === 'defect' ? t('ga.kind.defect') : `${t('ga.kind.yard')} ${m.no}`);
  const open = (pin: GaPin) => nav.navigate(pin.kind === 'defect' ? 'PmsDefect' : 'YardJob', { id: pin.ref });

  return (
    <Screen scroll>
      <BackButton onPress={() => (picking ? backToRecord() : goBackOr(nav))} />
      <ScreenTitle title={t('ga.title')} subtitle={t('ga.subtitle')} help="Ship's plan (GA)" />

      {picking ? (
        <Card>
          <Label>{ownPin ? t('ga.moveTitle') : t('ga.placeTitle')}</Label>
          <Text style={styles.body} numberOfLines={3}>{pickTitle}</Text>
          <Text style={styles.sub}>{sheets.length ? t('ga.tapHint') : t('ga.noDecksYet')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, !draft && { opacity: 0.5 }]} disabled={!draft} onPress={() => void savePin()}><Text style={styles.btnText}>{t('ga.saveHere')}</Text></TouchableOpacity>
            {ownPin ? <TouchableOpacity onPress={() => void takeOff()}><Text style={[styles.link, { color: COLORS.danger }]}>{t('ga.takeOff')}</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={backToRecord}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {/* The decks */}
      <View style={styles.chips}>
        {sheets.map((s) => chip(s.id === sheet?.id, s.name, () => { setSheetId(s.id); setFocus(undefined); setEditing(null); setRemoving(false); }, s.id))}
        {canEdit && !picking && !editing ? (
          <TouchableOpacity style={styles.chip} onPress={() => setEditing({ name: '', w: 0, h: 0 })}><Text style={styles.chipText}>{`+ ${t('ga.addDeck')}`}</Text></TouchableOpacity>
        ) : null}
      </View>

      {editing ? (
        <Card>
          <Label>{editing.id ? t('ga.editDeck') : t('ga.addDeck')}</Label>
          <Text style={styles.sub}>{t('ga.deckName')}</Text>
          <TextInput style={styles.input} value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} placeholder={t('ga.deckNameEg')} placeholderTextColor={COLORS.textLight} accessibilityLabel={t('ga.deckName')} />
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('ga.pictureHint')}</Text>
          {editing.photo ? <Image source={{ uri: resolveUri(editing.photo.uri) ?? editing.photo.uri }} style={{ width: 240, height: (240 * editing.h) / Math.max(1, editing.w), maxHeight: 240, marginTop: SIZES.xs, borderRadius: SIZES.radiusMd }} resizeMode="contain" /> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => void pickPicture()}><Text style={styles.smallText}>{editing.photo || editing.id ? t('ga.newPicture') : t('ga.choosePicture')}</Text></TouchableOpacity>
            {editing.photo ? <Text style={styles.sub}>{`${editing.w} × ${editing.h}`}</Text> : null}
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void saveSheet()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditing(null); setRemoving(false); }}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
            {editing.id && !removing ? <TouchableOpacity onPress={() => setRemoving(true)}><Text style={[styles.link, { color: COLORS.danger }]}>{t('ga.removeDeck')}</Text></TouchableOpacity> : null}
          </View>
          {removing ? (
            <View>
              <Text style={styles.sub}>{t('ga.removeHint')}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => void removeSheet()}><Text style={styles.btnText}>{t('ga.removeDeck')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setRemoving(false)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {!sheets.length && !editing ? (
        <Card><Text style={styles.sub}>{canEdit ? t('ga.emptyEdit') : t('ga.empty')}</Text></Card>
      ) : null}

      {sheet && !editing ? (
        <>
          {/* Filters */}
          {!picking ? (
            <View style={styles.chips}>
              {kindsOn.length > 1 ? kindsOn.map((k) => chip(kinds.includes(k), tk(`ga.kinds.${k}`), () => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]), k)) : null}
              {chip(closed, t('ga.closedToo'), () => setClosed(!closed), 'closed')}
              {ZOOMS.map((z) => chip(zoom === z, `${z}×`, () => setZoom(z), `z${z}`))}
            </View>
          ) : (
            <View style={styles.chips}>{ZOOMS.map((z) => chip(zoom === z, `${z}×`, () => setZoom(z), `z${z}`))}</View>
          )}
          {!picking && kinds.includes('yard') && projects.length ? (
            <Dropdown caption={t('ga.project')} value={projectId} onChange={setProjectId} options={[{ value: '', label: t('ga.allProjects') }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} style={{ maxWidth: 420, marginBottom: SIZES.sm }} />
          ) : null}

          {/* The deck */}
          <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={zoom > 1}>
              <Pressable ref={planRef} onPress={tap} disabled={!picking} style={{ width: planW, height: planH, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' }} accessibilityLabel={sheet.name}>
                {uri ? (
                  <Image source={{ uri }} style={{ width: planW, height: planH }} resizeMode="stretch" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={styles.sub}>{uri === null ? t('ga.notHereYet') : t('ga.loading')}</Text>
                  </View>
                )}
                {boxW > 0
                  ? marks.map((m) => (
                      <TouchableOpacity
                        key={m.pin.id}
                        disabled={!!picking}
                        onPress={() => setFocus(m.pin.id === focus ? undefined : m.pin.id)}
                        accessibilityLabel={`${m.n} ${m.label} ${m.title}`}
                        style={{
                          position: 'absolute', left: m.pin.x * planW - R, top: m.pin.y * planH - R, width: R * 2, height: R * 2, borderRadius: R,
                          backgroundColor: STATUS_HEX[m.status], borderWidth: m.pin.id === focus ? 3 : 2, borderColor: m.pin.id === focus ? COLORS.text : '#fff',
                          alignItems: 'center', justifyContent: 'center', opacity: picking ? 0.55 : 1, pointerEvents: picking ? 'none' : 'auto',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{m.n}</Text>
                      </TouchableOpacity>
                    ))
                  : null}
                {picking && draft && draft.sheetId === sheet.id && boxW > 0 ? (
                  <View pointerEvents="none" style={{ position: 'absolute', left: draft.x * planW - R - 3, top: draft.y * planH - R - 3, width: R * 2 + 6, height: R * 2 + 6, borderRadius: R + 3, borderWidth: 4, borderColor: COLORS.primary, backgroundColor: 'rgba(255,255,255,0.6)' }} />
                ) : null}
              </Pressable>
            </ScrollView>
          </View>

          {/* Colours */}
          <View style={[styles.chips, { marginTop: SIZES.sm }]}>
            {MARK_STATUSES.map((s) => (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: SIZES.sm }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_HEX[s] }} />
                <Text style={styles.sub}>{tk(`ga.st.${s}`)}</Text>
              </View>
            ))}
          </View>

          {focused && !picking ? (
            <Card>
              <Text style={[styles.name, { color: STATUS_HEX[focused.status] }]}>{`${focused.n} · ${kindLabel(focused)} · ${tk(`ga.st.${focused.status}`)}`}</Text>
              <Text style={styles.body}>{focused.title}</Text>
              {focused.sub ? <Text style={styles.sub}>{focused.sub}</Text> : null}
              <View style={styles.row}>
                <TouchableOpacity style={styles.small} onPress={() => open(focused.pin)}><Text style={styles.smallText}>{`${t('ga.openRecord')} ›`}</Text></TouchableOpacity>
                {canEdit ? <TouchableOpacity onPress={() => nav.setParams({ pickKind: focused.pin.kind, pickRef: focused.pin.ref })}><Text style={styles.link}>{t('ga.move')}</Text></TouchableOpacity> : null}
              </View>
            </Card>
          ) : null}

          {!picking ? (
            <>
              <Label style={{ marginTop: SIZES.md }}>{t('ga.points', { n: marks.length })}</Label>
              {marks.length ? marks.map((m) => (
                <TouchableOpacity key={m.pin.id} style={styles.item} onPress={() => open(m.pin)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: STATUS_HEX[m.status], alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{m.n}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={2}>{m.title}</Text>
                      <Text style={styles.sub}>{[kindLabel(m), m.sub, tk(`ga.st.${m.status}`)].filter(Boolean).join(' · ')}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )) : <Text style={styles.sub}>{t('ga.noPoints')}</Text>}

              <View style={[styles.row, { marginTop: SIZES.md }]}>
                <TouchableOpacity style={styles.small} onPress={() => paper(false, false)}><Text style={styles.smallText}>{t('ga.pdfDeck')}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.small} onPress={() => paper(false, true)}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
                {sheets.length > 1 ? <TouchableOpacity style={styles.small} onPress={() => paper(true, false)}><Text style={styles.smallText}>{t('ga.pdfAll')}</Text></TouchableOpacity> : null}
              </View>
              {canEdit ? (
                <View style={styles.row}>
                  <TouchableOpacity onPress={() => setEditing({ id: sheet.id, name: sheet.name, w: sheet.w, h: sheet.h })}><Text style={styles.link}>{t('ga.editDeck')}</Text></TouchableOpacity>
                  {sheets[0]?.id !== sheet.id ? <TouchableOpacity onPress={() => void moveEarlier()}><Text style={styles.link}>{`◀ ${t('ga.earlier')}`}</Text></TouchableOpacity> : null}
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
