// ===================================
// GMDSS Log — radio watch journal.
//
// Left panel: journal list (most recent first), with colored status pills for
// daily / weekly / monthly check due state. Right action: add entry modal.
//
// Four entry modes, selected from a bottom sheet:
//   • Daily check   — checkboxes + battery boxes
//   • Weekly check  — checkboxes (DSC test MMSI)
//   • Monthly       — full inspection checklist
//   • Radar on/off  — band selector, auto "Radio watch closed" when in port
//   • Event / note  — free text
//
// Every entry is signed and becomes an immutable text record in the journal.
// ===================================

import React, { useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { roleAtLeast } from '../types/role';
import { GmdssBattery, GmdssCheck, GmdssCheckItem, GmdssEntry, GmdssEntryType, RadarBand } from '../types/gmdss';
import {
  GMDSS_EQUIPMENT, PERIOD_LABEL, blankBatteries, blankCheckItems,
  formatVoltage, gmdssCheckStatus, gmdssEntryText, parseVoltageInput,
} from '../services/gmdssService';
import * as storage from '../services/storage';
import { uid } from '../utils/id';
import { formatDate, formatDateTime } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { todayIso } from '../services/pms';

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function nowHm(): string { return new Date().toTimeString().slice(0, 5); }

// ─── Journal row ─────────────────────────────────────────────────────────────

function EntryRow({ entry, COLORS, styles }: {
  entry: GmdssEntry; COLORS: Palette; styles: ReturnType<typeof makeStyles>;
}) {
  const isCheck = entry.type === 'daily' || entry.type === 'weekly' || entry.type === 'monthly';
  const isRadar = entry.type === 'radar_on' || entry.type === 'radar_off';
  const isAlert = entry.radioWatchClosed;

  const dot =
    isAlert ? COLORS.danger :
    isCheck && entry.type === 'daily' ? '#4CAF50' :
    isCheck && entry.type === 'weekly' ? '#2196F3' :
    isCheck ? '#9C27B0' :
    isRadar ? '#FF9800' :
    COLORS.textLight;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTime}>{`${formatDate(entry.date)} ${entry.time}`}</Text>
        <Text style={styles.rowText}>{entry.text}</Text>
        {entry.radioWatchClosed ? (
          <Text style={[styles.rowAlert, { color: COLORS.danger }]}>Radio watch closed</Text>
        ) : null}
        <Text style={styles.rowBy}>{entry.byRank ? `${entry.by} (${entry.byRank})` : entry.by}</Text>
      </View>
    </View>
  );
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ label, overdue, dueSoon, last, COLORS }: {
  label: string; overdue: boolean; dueSoon: boolean; last: string | null; COLORS: Palette;
}) {
  const bg = overdue ? COLORS.danger : dueSoon ? COLORS.warning : COLORS.success;
  const sub = last ? `Last: ${formatDate(last)}` : 'Not done';
  return (
    <View style={{ alignItems: 'center', marginRight: 8 }}>
      <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 2 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 10, color: COLORS.textLight }}>{sub}</Text>
    </View>
  );
}

// ─── Battery row (daily check) ────────────────────────────────────────────────

function BatteryRow({ bat, onChange, COLORS }: {
  bat: GmdssBattery;
  onChange: (b: GmdssBattery) => void;
  COLORS: Palette;
}) {
  const fmtVolts = (raw: number | undefined) => {
    if (raw === undefined) return '';
    const s = String(raw);
    return s.length === 3 ? s.slice(0, 2) + '.' + s[2] : s;
  };
  const [voltText, setVoltText] = useState(() => fmtVolts(bat.voltageRaw));

  const statuses: { key: GmdssBattery['status']; label: string }[] = [
    { key: 'ok',       label: 'OK' },
    { key: 'charging', label: 'Charging' },
    { key: 'charged',  label: 'Charged' },
  ];

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 4 }}>{bat.label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {statuses.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={{
              borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
              backgroundColor: bat.status === s.key ? COLORS.primary : COLORS.card,
              borderWidth: 1, borderColor: bat.status === s.key ? COLORS.primary : COLORS.border,
            }}
            onPress={() => onChange({ ...bat, status: s.key })}
          >
            <Text style={{ fontSize: 12, color: bat.status === s.key ? '#fff' : COLORS.text }}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          style={{
            borderWidth: 1, borderColor: COLORS.border, borderRadius: 6,
            paddingHorizontal: 8, paddingVertical: 5, fontSize: 14,
            color: COLORS.text, backgroundColor: COLORS.card, width: 90,
          }}
          placeholder="13.0 V"
          placeholderTextColor={COLORS.textLight}
          keyboardType="number-pad"
          value={voltText}
          maxLength={5}
          onChangeText={(v) => {
            const digits = v.replace(/[^0-9]/g, '').slice(0, 3);
            const display = digits.length === 3 ? digits.slice(0, 2) + '.' + digits[2] : digits;
            setVoltText(display);
            const raw = digits.length > 0 ? parseVoltageInput(digits) : undefined;
            onChange({ ...bat, voltageRaw: raw });
          }}
        />
      </View>
    </View>
  );
}

// ─── Check form ───────────────────────────────────────────────────────────────

function CheckForm({ period, items, batteries, note, onItems, onBatteries, onNote, COLORS }: {
  period: 'daily' | 'weekly' | 'monthly';
  items: GmdssCheckItem[];
  batteries: GmdssBattery[];
  note: string;
  onItems: (i: GmdssCheckItem[]) => void;
  onBatteries: (b: GmdssBattery[]) => void;
  onNote: (n: string) => void;
  COLORS: Palette;
}) {
  const defs = GMDSS_EQUIPMENT.filter((e) => e.periods.includes(period));

  return (
    <View>
      {defs.map((def) => {
        const item = items.find((i) => i.id === def.id) ?? { id: def.id, checked: false };
        const toggle = (checked: boolean) =>
          onItems(items.map((i) => i.id === def.id ? { ...i, checked } : i));
        const setVal = (value: string) =>
          onItems(items.map((i) => i.id === def.id ? { ...i, value } : i));
        const setVal2 = (value2: string) =>
          onItems(items.map((i) => i.id === def.id ? { ...i, value2 } : i));

        return (
          <View key={def.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity onPress={() => toggle(!item.checked)}>
                <View style={{
                  width: 22, height: 22, borderRadius: 4, borderWidth: 2,
                  borderColor: item.checked ? COLORS.primary : COLORS.border,
                  backgroundColor: item.checked ? COLORS.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.checked ? <MciIcon name="check" size={14} color="#fff" /> : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggle(!item.checked)}>
                <Text style={{ fontSize: 14, color: COLORS.text }}>{def.label}</Text>
              </TouchableOpacity>
              {def.hasValue ? (
                <TextInput
                  style={{
                    width: def.valueWidth ?? 120,
                    borderWidth: 1, borderColor: COLORS.border, borderRadius: 6,
                    paddingHorizontal: 8, paddingVertical: 5, fontSize: 13,
                    color: COLORS.text, backgroundColor: COLORS.card,
                    textAlign: 'center',
                  }}
                  placeholder={def.valuePlaceholder ?? ''}
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="number-pad"
                  maxLength={def.valueMaxLength}
                  value={item.value ?? ''}
                  onChangeText={setVal}
                />
              ) : null}
              {def.hasValue2 ? (
                <TextInput
                  style={{
                    width: def.value2Width ?? 140,
                    borderWidth: 1, borderColor: COLORS.border, borderRadius: 6,
                    paddingHorizontal: 8, paddingVertical: 5, fontSize: 13,
                    color: COLORS.text, backgroundColor: COLORS.card,
                  }}
                  placeholder={def.value2Placeholder ?? ''}
                  placeholderTextColor={COLORS.textLight}
                  maxLength={def.value2MaxLength}
                  value={item.value2 ?? ''}
                  onChangeText={setVal2}
                />
              ) : null}
            </View>
          </View>
        );
      })}

      {period === 'daily' && batteries.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Label>BATTERIES</Label>
          {batteries.map((bat, idx) => (
            <BatteryRow
              key={bat.id}
              bat={bat}
              COLORS={COLORS}
              onChange={(b) => onBatteries(batteries.map((x, i) => i === idx ? b : x))}
            />
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 8 }}>
        <Label>NOTE</Label>
        <TextInput
          style={{
            borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 7, fontSize: 14,
            color: COLORS.text, backgroundColor: COLORS.card,
            minHeight: 56, textAlignVertical: 'top',
          }}
          multiline
          placeholder="Optional remarks"
          placeholderTextColor={COLORS.textLight}
          value={note}
          onChangeText={onNote}
        />
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function GmdssSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { gmdssLog, vessel, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('RECORDED BY', { forceDropdown: true });

  // Modal state
  const [modal, setModal] = useState<GmdssEntryType | null>(null);

  // Check form state
  const [checkPeriod, setCheckPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [checkItems, setCheckItems] = useState<GmdssCheckItem[]>([]);
  const [batteries, setBatteries] = useState<GmdssBattery[]>([]);
  const [note, setNote] = useState('');

  // Radar state
  const [radarBand, setRadarBand] = useState<RadarBand>('xband');
  const [radarType, setRadarType] = useState<'radar_on' | 'radar_off'>('radar_on');
  const [radarNote, setRadarNote] = useState('');
  const [radioWatchClosed, setRadioWatchClosed] = useState(false);

  // Event note state
  const [eventNote, setEventNote] = useState('');

  const dailyStatus  = useMemo(() => gmdssCheckStatus(gmdssLog, 'daily'),   [gmdssLog]);
  const weeklyStatus = useMemo(() => gmdssCheckStatus(gmdssLog, 'weekly'),  [gmdssLog]);
  const monthlyStatus= useMemo(() => gmdssCheckStatus(gmdssLog, 'monthly'), [gmdssLog]);

  const sorted = useMemo(() =>
    [...gmdssLog].sort((a, b) => b.at - a.at),
    [gmdssLog]
  );

  // Open a modal and initialise its state
  const openModal = (type: GmdssEntryType) => {
    if (type === 'daily' || type === 'weekly' || type === 'monthly') {
      setCheckPeriod(type);
      setCheckItems(blankCheckItems(type));
      setBatteries(type === 'daily' ? blankBatteries() : []);
      setNote('');
    } else if (type === 'radar_on' || type === 'radar_off') {
      setRadarBand('xband');
      setRadarType(type);
      setRadarNote('');
      setRadioWatchClosed(false);
    } else {
      setEventNote('');
    }
    setModal(type);
  };

  const save = async () => {
    if (!signer) {
      Alert.alert('Who is recording?', 'Choose your name first.');
      return;
    }
    if (!modal) return;

    let type = modal;
    let text = '';
    let check: GmdssCheck | undefined;
    let band: RadarBand | undefined;
    let rwc: boolean | undefined;

    if (type === 'daily' || type === 'weekly' || type === 'monthly') {
      check = { period: type, items: checkItems, batteries: type === 'daily' ? batteries : undefined, note: note.trim() || undefined };
      text = gmdssEntryText({ type, check });
    } else if (type === 'radar_on' || type === 'radar_off') {
      band = radarBand;
      rwc = type === 'radar_off' ? radioWatchClosed : undefined;
      text = gmdssEntryText({ type, band, radioWatchClosed: rwc, note: radarNote.trim() || undefined });
    } else {
      if (!eventNote.trim()) {
        Alert.alert('Empty note', 'Please write something before saving.');
        return;
      }
      text = gmdssEntryText({ type: 'event', note: eventNote.trim() });
    }

    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: text });
    if (!sig) return;

    const now = Date.now();
    const entry: GmdssEntry = {
      id: uid('gmd'),
      type,
      date: todayIso(),
      time: nowHm(),
      at: now,
      updatedAt: now,
      text,
      ...(check ? { check } : {}),
      ...(band ? { band } : {}),
      ...(rwc ? { radioWatchClosed: true } : {}),
      by: signer.name,
      ...(signer.rank ? { byRank: signer.rank } : {}),
      ...(sig.proof ? { signedWith: sig.proof } : {}),
    };
    await saveRow(storage.GMDSS_KEY, entry);
    setModal(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Screen scroll={false}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => goBackOr(nav)} />
        <ScreenTitle title="GMDSS Log" subtitle="Radio watch & equipment checks" />
      </View>

      {/* Status pills */}
      <View style={styles.pills}>
        <StatusPill label="Daily"   {...dailyStatus}   last={dailyStatus.lastDate}   COLORS={COLORS} />
        <StatusPill label="Weekly"  {...weeklyStatus}  last={weeklyStatus.lastDate}  COLORS={COLORS} />
        <StatusPill label="Monthly" {...monthlyStatus} last={monthlyStatus.lastDate} COLORS={COLORS} />
      </View>

      {/* Action buttons */}
      {canEdit ? (
        <View style={styles.actions}>
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <TouchableOpacity key={p} style={styles.actionBtn} onPress={() => openModal(p)}>
              <MciIcon name="check-circle-outline" size={16} color="#fff" />
              <Text style={styles.actionText}>{PERIOD_LABEL[p]}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.warning }]} onPress={() => openModal('radar_on')}>
            <MciIcon name="radar" size={16} color="#fff" />
            <Text style={styles.actionText}>Radar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.textLight }]} onPress={() => openModal('event')}>
            <MciIcon name="note-outline" size={16} color="#fff" />
            <Text style={styles.actionText}>Event / note</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Journal */}
      <FlatList
        data={sorted}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: SIZES.md, paddingBottom: 60 }}
        ListEmptyComponent={
          <Text style={{ color: COLORS.textLight, textAlign: 'center', marginTop: 40 }}>
            No entries yet. Start with a daily check.
          </Text>
        }
        renderItem={({ item }) => (
          <EntryRow entry={item} COLORS={COLORS} styles={styles} />
        )}
      />

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      <Modal visible={modal !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(null)}>
        <View style={[styles.modal, { backgroundColor: COLORS.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(null)}>
              <MciIcon name="close" size={24} color={COLORS.textLight} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>
              {modal === 'daily'     ? 'Daily check' :
               modal === 'weekly'   ? 'Weekly check' :
               modal === 'monthly'  ? 'Monthly inspection' :
               modal === 'radar_on' || modal === 'radar_off' ? 'Radar event' :
               'Event / note'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SIZES.md }}>

            {/* ── Check form ── */}
            {(modal === 'daily' || modal === 'weekly' || modal === 'monthly') ? (
              <CheckForm
                period={checkPeriod}
                items={checkItems}
                batteries={batteries}
                note={note}
                onItems={setCheckItems}
                onBatteries={setBatteries}
                onNote={setNote}
                COLORS={COLORS}
              />
            ) : null}

            {/* ── Radar form ── */}
            {(modal === 'radar_on' || modal === 'radar_off') ? (
              <View>
                <Label>TYPE</Label>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {(['radar_on', 'radar_off'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, radarType === t && styles.chipOn]}
                      onPress={() => { setRadarType(t); setModal(t); }}
                    >
                      <Text style={[styles.chipText, radarType === t && styles.chipTextOn]}>
                        {t === 'radar_on' ? 'Radar ON' : 'Radar OFF'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Label>BAND</Label>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {(['xband', 'sband'] as const).map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chip, radarBand === b && styles.chipOn]}
                      onPress={() => setRadarBand(b)}
                    >
                      <Text style={[styles.chipText, radarBand === b && styles.chipTextOn]}>
                        {b === 'xband' ? 'X-band' : 'S-band'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {radarType === 'radar_off' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>Radio watch closed</Text>
                      <Text style={{ fontSize: 12, color: COLORS.textLight }}>Mark when closing the radio watch in port</Text>
                    </View>
                    <Switch
                      value={radioWatchClosed}
                      onValueChange={setRadioWatchClosed}
                      trackColor={{ true: COLORS.danger }}
                    />
                  </View>
                ) : null}

                <Label>NOTE (optional)</Label>
                <TextInput
                  style={[styles.noteInput, { color: COLORS.text, backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                  multiline
                  placeholder="e.g. fault reported, course change…"
                  placeholderTextColor={COLORS.textLight}
                  value={radarNote}
                  onChangeText={setRadarNote}
                />
              </View>
            ) : null}

            {/* ── Event / note form ── */}
            {modal === 'event' ? (
              <View>
                <Label>NOTE</Label>
                <TextInput
                  style={[styles.noteInput, { color: COLORS.text, backgroundColor: COLORS.card, borderColor: COLORS.border, minHeight: 80 }]}
                  multiline
                  placeholder="e.g. MAYDAY received from MV XXXX, MMSI 123456789 at 14:32 UTC on Ch 16. Relayed to MRCC Oslo."
                  placeholderTextColor={COLORS.textLight}
                  value={eventNote}
                  onChangeText={setEventNote}
                  autoFocus
                />
              </View>
            ) : null}

            {/* Signer */}
            <View style={{ marginTop: 16 }}>
              <Label>RECORDED BY</Label>
              {picker}
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.primary }]} onPress={save}>
              <Text style={styles.saveBtnText}>Sign and save</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  return StyleSheet.create({
    header: { paddingHorizontal: SIZES.md, paddingTop: SIZES.sm },
    pills: {
      flexDirection: 'row', paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm, flexWrap: 'wrap', gap: 4,
    },
    actions: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      paddingHorizontal: SIZES.md, paddingBottom: SIZES.sm,
    },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.primary, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 7,
    },
    actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Journal rows
    row: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    rowTime: { fontSize: 11, color: C.textLight, marginBottom: 2 },
    rowText: { fontSize: 13, color: C.text, lineHeight: 18 },
    rowAlert: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    rowBy: { fontSize: 11, color: C.textLight, marginTop: 3 },

    // Chips
    chip: {
      borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    chipOn: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: 13, color: C.text },
    chipTextOn: { color: '#fff', fontWeight: '600' },

    // Modal
    modal: { flex: 1 },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    modalTitle: { fontSize: 16, fontWeight: '700' },
    noteInput: {
      borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
      fontSize: 14, textAlignVertical: 'top', minHeight: 56,
    },
    saveBtn: {
      marginTop: 20, borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}
