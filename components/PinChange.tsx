// ===================================
// Setting / changing a signing PIN — under a lock (Crew matrix → 🔒).
//
//   No PIN yet      the Master's PIN opens it (0000 until the Master changes it).
//   PIN set         the owner's own PIN, or the Master's PIN.
//   The Master PIN  0000 by default; changed with the current one.
// Wrong PINs count against the same lockout as signing (services/signature).
// Like every signing PIN it lives on this device only.
// ===================================

import { t, tn, useT } from '../utils/i18n';
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
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [who, setWho] = useState<PinPerson | null>(null);
  const [step, setStep] = useState<Step>('unlock');
  /** Whose PIN unlocks: the owner's or the Master's. */
  const [by, setBy] = useState<'own' | 'master'>('master');
  const [ownSet, setOwnSet] = useState(false);
  const [masterSet, setMasterSet] = useState(false);
  const [masterDefault, setMasterDefault] = useState(false);
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
      // The Master PIN always exists — 0000 until it is changed.
      const master = true;
      setMasterDefault(!(await hasPin(ADMIN_KEY)));
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
      if (!r.ok) return setMsg(r.lockedUntil ? t('sc.locked', { min: Math.max(1, Math.ceil((r.lockedUntil - Date.now()) / 60000)) }) : t('sc.wrongPin', { left: tn('n.tryLeft', r.left) }));
      setMsg(null);
      return setStep('new1');
    }
    if (step === 'new1') {
      if (!isValidSignPin(v)) return setMsg(t('sc.digits', { min: PIN_MIN, max: PIN_MAX }));
      if (isWeakPin(v)) return setMsg(t('sc.weak'));
      setFirst(v);
      setMsg(null);
      return setStep('new2');
    }
    if (step === 'new2') {
      if (v !== first) {
        setFirst('');
        setMsg(t('sc.differ'));
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
      ? t('pc.enterCurMaster')
      : by === 'own'
      ? t('pc.enterOwn', { name: who.name })
      : t('pc.enterMaster')
    : step === 'new1'
    ? isMasterPin
      ? masterSet ? t('pc.newMaster') : t('pc.setMaster')
      : ownSet ? t('pc.newPin') : t('pc.setPin')
    : step === 'new2'
    ? t('sc.repeat')
    : t('pc.saved');

  return (
    <Ctx.Provider value={open}>
      {children}
      <Modal visible={!!who} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <MciIcon name={step === 'done' ? 'lock-check' : step === 'unlock' ? 'lock' : 'lock-open-variant-outline'} size={40} color={step === 'done' ? COLORS.success : COLORS.primary} />
            <Text style={styles.name}>{isMasterPin ? t('pc.masterPin') : who?.name}</Text>
            <Text style={styles.title}>{title}</Text>
            {step === 'unlock' && !isMasterPin && ownSet && masterSet ? (
              <View style={styles.seg}>
                {(['own', 'master'] as const).map((k) => (
                  <TouchableOpacity key={k} onPress={() => { setBy(k); setMsg(null); }} style={[styles.segBtn, by === k && { backgroundColor: COLORS.primary }]}>
                    <Text style={[styles.segText, by === k && { color: COLORS.textWhite }]}>{k === 'own' ? t('pc.ownPin') : t('pc.masterPin')}</Text>
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
                  <Text style={styles.primaryText}>{step === 'unlock' ? t('sc.unlock') : step === 'new1' ? t('sc.next') : t('common.save')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primary} onPress={close}>
                <Text style={styles.primaryText}>{t('common.done')}</Text>
              </TouchableOpacity>
            )}
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            {step === 'unlock' && (isMasterPin || by === 'master') && masterDefault ? (
              <Text style={styles.hint}>{t('pc.defaultHint')}</Text>
            ) : null}
            {step === 'new1' ? (
              <Text style={styles.hint}>{t('pc.newHint', { min: PIN_MIN, max: PIN_MAX })}</Text>
            ) : null}
            {step !== 'done' ? (
              <TouchableOpacity onPress={close} hitSlop={8} style={{ marginTop: SIZES.md }}>
                <Text style={[styles.link, { color: COLORS.textLight }]}>{t('common.cancel')}</Text>
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
