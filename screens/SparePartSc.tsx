// ===================================
// One spare part — what it is, where it is kept, how many are on hand, and every
// movement in and out.
//
// The three things done to stock each get one button, because each is a
// different act with a different number in it:
//   Received   a delivery: "+6".
//   Used       taken out for a job outside the maintenance plan: "−1". Jobs in
//              the plan take their parts by themselves when recorded as done.
//   Stocktake  what is physically on the shelf: "4". Recorded as the DIFFERENCE
//              from the book, so a count taken offline cannot wipe out a delivery
//              another device booked meanwhile (types/spares.ts).
// Each is signed and kept, like a completed job. A wrong movement is corrected by
// a stocktake, not by editing history.
//
// A new part is given its opening stock as a stocktake when first saved.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { MoveKind, SparePart } from '../types/spares';
import { crewLabel } from '../types/crew';
import { personName } from '../types/role';
import { MOVE_LABEL, makeMove, moveText, qtyText, stockByPart, stockStatus, unitOf } from '../services/spares';
import { todayIso } from '../services/pms';
import { moduleOn } from '../constants/modules';
import { useSignConfirm } from '../components/SignConfirm';
import { formatDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';

const UNITS = ['pcs', 'set', 'l', 'm', 'kg'];

export default function SparePartSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { spares, spareMoves, machines, crew, saveSpare, addSpareMoves } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();

  const id: string = route.params?.id;
  const existing = spares.find((p) => p.id === id);
  const isNew = !existing;

  const [draft, setDraft] = useState<SparePart>(existing ?? { id, name: '', updatedAt: Date.now() });
  const touched = useRef(false);
  useEffect(() => {
    if (existing && !touched.current) setDraft(existing);
  }, [existing]);
  const set = (p: Partial<SparePart>) => {
    touched.current = true;
    setDraft((d) => ({ ...d, ...p }));
  };

  const onHand = useMemo(() => stockByPart(spareMoves.filter((m) => m.partId === id)).get(id) ?? 0, [spareMoves, id]);
  const status = stockStatus(existing ?? draft, onHand);
  const history = useMemo(
    () => spareMoves.filter((m) => m.partId === id).sort((a, b) => b.at - a.at).slice(0, 30),
    [spareMoves, id]
  );

  // Who signs a movement: this device's account when it has joined a vessel,
  // otherwise a name from the crew list — or, on a vessel with no list yet, typed.
  const people = useMemo(() => crew.filter((c) => c.active && !c.deleted), [crew]);
  const me = sync.me ? personName(sync.me) : '';
  const [signerId, setSignerId] = useState<string | undefined>();
  const [typedName, setTypedName] = useState('');
  const picked = people.find((p) => p.id === signerId);
  const signer = me
    ? { by: me, byRank: sync.me?.position || undefined }
    : picked
    ? { by: picked.name, byRank: picked.rank }
    : typedName.trim()
    ? { by: typedName.trim() }
    : null;

  const [moving, setMoving] = useState<MoveKind | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [opening, setOpening] = useState('');

  const num = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return v.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const onSave = async () => {
    if (!draft.name.trim()) return Alert.alert('Name required', 'Say what the part is — "Raw-water pump impeller".');
    const part = { ...draft, name: draft.name.trim(), updatedAt: Date.now() };
    await saveSpare(part);
    const start = num(opening);
    if (isNew && start != null && start > 0) {
      await addSpareMoves([makeMove(part, 'count', start, 0, signer ?? { by: 'Opening stock' }, todayIso(), { note: 'Opening stock' })]);
    }
    playSuccessSound();
    goBackOr(nav);
  };

  const onMove = async () => {
    if (!existing || !moving) return;
    const n = num(amount);
    if (n == null || (moving !== 'count' && n === 0)) return Alert.alert('Quantity', 'Enter how many.');
    if (!signer) return Alert.alert('Who is this?', 'Choose your name.');
    const sig = await confirmSign({
      personKey: me && sync.me ? `device:${sync.me.id}` : picked ? picked.id : `name:${signer.by}`,
      name: signer.by,
      ownDevice: !!me,
      what: `${MOVE_LABEL[moving]}: ${existing.name}`,
    });
    if (!sig) return;
    if (moving === 'used' && n > onHand) {
      // Allowed — the part is in the engineer's hand whatever the book says — but
      // said, so the next stocktake is not a surprise.
      Alert.alert('More than the book shows', `The book shows ${qtyText(onHand, existing)}. Recorded anyway; a stocktake will put the count right.`);
    }
    const move = makeMove(existing, moving, n, onHand, signer, todayIso(), { note: note.trim() || undefined });
    await addSpareMoves([sig.proof ? { ...move, signedWith: sig.proof } : move]);
    playSuccessSound();
    setMoving(null);
    setAmount('');
    setNote('');
  };

  const onDelete = () => {
    if (isNew) return goBackOr(nav);
    Alert.alert('Remove part', 'Remove this line from the stores? Its movements are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await saveSpare({ ...existing!, deleted: true, updatedAt: Date.now() });
          goBackOr(nav);
        },
      },
    ]);
  };

  const qtyColor = status === 'out' ? COLORS.danger : status === 'low' ? COLORS.warning : COLORS.success;
  const fits = new Set(draft.machineIds ?? []);
  const toggleFit = (mid: string) =>
    set({ machineIds: fits.has(mid) ? [...fits].filter((x) => x !== mid) : [...fits, mid] });

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => (moving ? setMoving(null) : goBackOr(nav))} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {moving ? MOVE_LABEL[moving] : isNew ? 'New part' : 'Spare part'}
          </Text>
          <TouchableOpacity onPress={moving ? onMove : onSave} hitSlop={12}>
            <Text style={styles.save}>{moving ? 'Record' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          {!isNew ? (
            <View style={styles.stockCard}>
              <Text style={styles.stockLabel}>On hand</Text>
              <Text style={[styles.stock, { color: qtyColor }]}>{qtyText(onHand, existing!)}</Text>
              <Text style={styles.sub}>
                {status === 'out' ? 'Out of stock' : status === 'low' ? `At or below the re-order level (${existing!.minQty})` : existing!.minQty != null ? `Re-order at ${existing!.minQty}` : 'No re-order level set'}
              </Text>
              {!moving ? (
                <View style={styles.moveBtns}>
                  {(['received', 'used', 'count'] as MoveKind[]).map((k) => (
                    <TouchableOpacity key={k} style={styles.moveBtn} onPress={() => { setMoving(k); setAmount(k === 'count' ? String(onHand) : ''); }}>
                      <Text style={styles.moveBtnText}>{k === 'received' ? '+ Received' : k === 'used' ? '− Used' : 'Stocktake'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {moving ? (
            <>
              <Text style={styles.partTitle}>{existing?.name}</Text>
              <Label>{moving === 'count' ? `Counted on the shelf (${unitOf(draft)})` : `How many (${unitOf(draft)})`}</Label>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus placeholder="0" placeholderTextColor={COLORS.textLight} />
              {moving === 'count' && num(amount) != null ? (
                <Text style={styles.sub}>{`The book shows ${qtyText(onHand, draft)}; this records ${num(amount)! - onHand >= 0 ? '+' : '−'}${qtyText(Math.abs(num(amount)! - onHand), draft)}.`}</Text>
              ) : null}
              <View style={{ height: SIZES.md }} />
              <Label>{moving === 'received' ? 'Note (supplier, order no.)' : moving === 'used' ? 'Note (what for)' : 'Note'}</Label>
              <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="—" placeholderTextColor={COLORS.textLight} />
              <View style={{ height: SIZES.md }} />
              <Label>Recorded by</Label>
              {me ? (
                <Text style={styles.signer}>{sync.me?.position ? `${me} (${sync.me.position})` : me}</Text>
              ) : people.length ? (
                <View style={styles.chips}>
                  {people.map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.chip, signerId === p.id && styles.chipOn]} onPress={() => setSignerId(p.id)}>
                      <Text style={[styles.chipText, signerId === p.id && styles.chipTextOn]}>{crewLabel(p)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput style={styles.input} value={typedName} onChangeText={setTypedName} placeholder="Your name" placeholderTextColor={COLORS.textLight} />
              )}
              <Text style={[styles.sub, { marginTop: SIZES.md }]}>Movements are kept and cannot be edited. A wrong one is put right by a stocktake.</Text>
            </>
          ) : (
            <>
              <Label>Part ★</Label>
              <TextInput style={styles.input} value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Raw-water pump impeller" placeholderTextColor={COLORS.textLight} />
              <View style={styles.pair}>
                <View style={{ flex: 1 }}>
                  <Label>Part number</Label>
                  <TextInput style={styles.input} value={draft.partNo ?? ''} onChangeText={(v) => set({ partNo: v })} placeholder="—" placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>Maker</Label>
                  <TextInput style={styles.input} value={draft.maker ?? ''} onChangeText={(v) => set({ maker: v })} placeholder="—" placeholderTextColor={COLORS.textLight} />
                </View>
              </View>
              <View style={{ height: SIZES.md }} />
              <Label>Location (store, shelf, box)</Label>
              <TextInput style={styles.input} value={draft.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder="ER store · B3" placeholderTextColor={COLORS.textLight} />
              <View style={styles.pair}>
                <View style={{ flex: 1 }}>
                  <Label>Re-order at</Label>
                  <TextInput
                    style={styles.input}
                    value={draft.minQty != null ? String(draft.minQty) : ''}
                    onChangeText={(v) => set({ minQty: num(v) })}
                    keyboardType="decimal-pad"
                    placeholder="2"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                {isNew ? (
                  <View style={{ flex: 1 }}>
                    <Label>On hand now</Label>
                    <TextInput style={styles.input} value={opening} onChangeText={setOpening} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textLight} />
                  </View>
                ) : null}
              </View>
              <View style={{ height: SIZES.sm }} />
              <Label>Unit</Label>
              <View style={styles.chips}>
                {UNITS.map((u) => (
                  <TouchableOpacity key={u} style={[styles.chip, styles.chipSmall, unitOf(draft) === u && styles.chipOn]} onPress={() => set({ unit: u })}>
                    <Text style={[styles.chipSmallText, unitOf(draft) === u && styles.chipTextOn]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {moduleOn('pms') && machines.length ? (
                <>
                  <View style={{ height: SIZES.md }} />
                  <Label>Fits</Label>
                  <View style={styles.chips}>
                    {machines.map((m) => (
                      <TouchableOpacity key={m.id} style={[styles.chip, styles.chipSmall, fits.has(m.id) && styles.chipOn]} onPress={() => toggleFit(m.id)}>
                        <Text style={[styles.chipSmallText, fits.has(m.id) && styles.chipTextOn]}>{m.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              <View style={{ height: SIZES.md }} />
              <Label>Notes</Label>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v })} multiline placeholder="Supplier, alternative part numbers…" placeholderTextColor={COLORS.textLight} />

              {history.length ? (
                <>
                  <View style={{ height: SIZES.lg }} />
                  <Label>Movements</Label>
                  {history.map((m) => (
                    <View key={m.id} style={styles.moveRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.moveText}>{moveText(m, draft)}</Text>
                        <Text style={styles.sub} numberOfLines={2}>
                          {[formatDate(m.date), m.by, m.jobTitle ? `${m.machineName ? `${m.machineName}: ` : ''}${m.jobTitle}` : null, m.note].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}

              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                <Text style={styles.deleteText}>{isNew ? 'Discard' : 'Remove part'}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    stockCard: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.lg, alignItems: 'center' },
    stockLabel: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
    stock: { fontSize: 34, fontWeight: '900', marginVertical: 2 },
    moveBtns: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
    moveBtn: { paddingVertical: 9, paddingHorizontal: SIZES.md, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.primary },
    moveBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.small },
    partTitle: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark, marginBottom: SIZES.md },
    pair: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4, textAlign: 'left' },
    signer: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark, marginTop: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    chipSmall: { paddingVertical: 4, paddingHorizontal: SIZES.sm, borderColor: COLORS.border },
    chipSmallText: { color: COLORS.text, fontSize: SIZES.tiny },
    moveRow: { flexDirection: 'row', paddingVertical: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    moveText: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    deleteBtn: { marginTop: SIZES.xl, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center' },
    deleteText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.body },
  });
