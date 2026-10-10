// ===================================
// Setting / changing a signing PIN — under a lock (Crew matrix → 🔒).
//
//   No PIN yet      the Master's PIN opens it.
//   PIN set         the owner's own PIN, or the Master's PIN.
//   The Master PIN  first time: the Master sets it; after that only the old
//                   Master PIN opens it.
// Wrong PINs count against the same lockout as signing (services/signature).
// Like every signing PIN it lives on this device only.
// ===================================

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { ADMIN_KEY, PIN_MAX, PIN_MIN, checkPin, hasPin, isValidSignPin, isWeakPin, setPin } from '../services/signature';

export interface PinPerson {
  key: string;
  name: string;
}
type Step = 'unlock' | 'new1' | 'new2' | 'done';
type Opener = (p: PinPerson, opts?: { master?: boolean; onDone?: () => void }) => void;

const Ctx = createContext<Opener | null>(null);
export const usePinChange = (): Opener => useContext(Ctx) ?? (() => {});

export function PinChangeProvider({ children }: { children: React.ReactNode }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [who, setWho] = useState<PinPerson | null>(null);
  const [step, setStep] = useState<Step>('unlock');
  /** Whose PIN unlocks: the owner's or the Master's. */
  const [by, setBy] = useState<'own' | 'master'>('master');
  const [ownSet, setOwnSet] = useState(false);
  const [masterSet, setMasterSet] = useState(false);
  const [pin, setPinText] = useState('');
  const [first, setFirst] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [onDone, setOnDone] = useState<(() => void) | undefined>();

  const isMasterPin = who?.key === ADMIN_KEY;

  const open: Opener = useCallback((p, opts) => {
    setPinText('');
    setFirst('');
    setMsg(null);
    setOnDone(() => opts?.onDone);
    void (async () => {
      const own = await hasPin(p.key);
      const master = await hasPin(ADMIN_KEY);
      setOwnSet(own);
      setMasterSet(master);
      setBy(own ? 'own' : 'master');
      // The Master PIN, set for the first time: nothing to unlock with.
      setStep(p.key === ADMIN_KEY && !master ? 'new1' : !master && !own ? 'new1' : 'unlock');
      setWho(p);
    })();
  }, []);

  const close = () => setWho(null);

  const submit = async () => {
    if (!who) return;
    const v = pin.trim();
    setPinText('');
    if (step === 'unlock') {
      const key = by === 'own' || isMasterPin ? who.key : ADMIN_KEY;
      const r = await checkPin(key, v);
      if (!r.ok) return setMsg(r.lockedUntil ? `Too many wrong PINs — try again in ${Math.max(1, Math.ceil((r.lockedUntil - Date.now()) / 60000))} min.` : `Wrong PIN — ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`);
      setMsg(null);
      return setStep('new1');
    }
    if (step === 'new1') {
      if (!isValidSignPin(v)) return setMsg(`Choose ${PIN_MIN} to ${PIN_MAX} digits.`);
      if (isWeakPin(v)) return setMsg('Too easy to guess — avoid repeats and runs like 1234.');
      setFirst(v);
      setMsg(null);
      return setStep('new2');
    }
    if (step === 'new2') {
      if (v !== first) {
        setFirst('');
        setMsg('The two PINs differ — choose it again.');
        return setStep('new1');
      }
      await setPin(who.key, who.name, v);
      setMsg(null);
      setStep('done');
      onDone?.();
    }
  };

  const title = !who
    ? ''
    : step === 'unlock'
    ? isMasterPin
      ? 'Enter the current Master PIN'
      : by === 'own'
      ? `${who.name}: enter your current PIN`
      : 'Enter the Master PIN'
    : step === 'new1'
    ? isMasterPin
      ? masterSet ? 'Choose the new Master PIN' : 'Set the Master PIN'
      : ownSet ? 'Choose the new PIN' : 'Set the signing PIN'
    : step === 'new2'
    ? 'Repeat the PIN'
    : 'PIN saved';

  return (
    <Ctx.Provider value={open}>
      {children}
      <Modal visible={!!who} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <MciIcon name={step === 'done' ? 'lock-check' : step === 'unlock' ? 'lock' : 'lock-open-variant-outline'} size={40} color={step === 'done' ? COLORS.success : COLORS.primary} />
            <Text style={styles.name}>{isMasterPin ? 'Master PIN' : who?.name}</Text>
            <Text style={styles.title}>{title}</Text>
            {step === 'unlock' && !isMasterPin && ownSet && masterSet ? (
              <View style={styles.seg}>
                {(['own', 'master'] as const).map((k) => (
                  <TouchableOpacity key={k} onPress={() => { setBy(k); setMsg(null); }} style={[styles.segBtn, by === k && { backgroundColor: COLORS.primary }]}>
                    <Text style={[styles.segText, by === k && { color: COLORS.textWhite }]}>{k === 'own' ? 'Own PIN' : 'Master PIN'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {step !== 'done' ? (
              <>
                <TextInput
                  key={`${step}${by}`}
                  style={styles.pin}
                  value={pin}
                  onChangeText={(t) => setPinText(t.replace(/\D/g, '').slice(0, PIN_MAX))}
                  onSubmitEditing={() => void submit()}
                  keyboardType="number-pad"
                  secureTextEntry
                  autoFocus
                  maxLength={PIN_MAX}
                  placeholder="• • • •"
                  placeholderTextColor={COLORS.textLight}
                />
                <TouchableOpacity style={[styles.primary, pin.length < PIN_MIN && { opacity: 0.5 }]} disabled={pin.length < PIN_MIN} onPress={() => void submit()}>
                  <Text style={styles.primaryText}>{step === 'unlock' ? 'Unlock' : step === 'new1' ? 'Next' : 'Save'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primary} onPress={close}>
                <Text style={styles.primaryText}>Done</Text>
              </TouchableOpacity>
            )}
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            {step === 'new1' && !isMasterPin && !masterSet && !ownSet ? (
              <Text style={styles.hint}>No Master PIN on this device yet — set one in the Crew matrix (🔒 Master PIN) so that setting a PIN needs the Master.</Text>
            ) : step === 'new1' ? (
              <Text style={styles.hint}>{`${PIN_MIN}–${PIN_MAX} digits. Kept on this device only, as a hash — nobody can read it back.`}</Text>
            ) : null}
            {step !== 'done' ? (
              <TouchableOpacity onPress={close} hitSlop={8} style={{ marginTop: SIZES.md }}>
                <Text style={[styles.link, { color: COLORS.textLight }]}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: SIZES.lg },
    card: { ...COLORS.glassCard, backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusLg, padding: SIZES.lg, width: '100%', maxWidth: 380, alignItems: 'center' },
    name: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.sm, textAlign: 'center' },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.text, marginTop: SIZES.sm, textAlign: 'center' },
    seg: { flexDirection: 'row', gap: SIZES.xs, marginTop: SIZES.md },
    segBtn: { paddingVertical: 6, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    segText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    pin: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, marginTop: SIZES.md, width: 200, textAlign: 'center', fontSize: 26, letterSpacing: 10, color: COLORS.textDark },
    primary: { marginTop: SIZES.md, paddingVertical: SIZES.md, paddingHorizontal: SIZES.xl, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.primary, alignSelf: 'stretch', alignItems: 'center' },
    primaryText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    msg: { color: COLORS.danger, fontWeight: '700', marginTop: SIZES.sm, textAlign: 'center' },
    hint: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: SIZES.sm, textAlign: 'center' },
    link: { color: COLORS.primary, fontWeight: '700' },
  });
