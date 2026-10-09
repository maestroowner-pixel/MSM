// ===================================
// SignConfirm — "touch to sign": the one confirmation every signed act goes
// through (inspections, maintenance, stores, and the documents, drills, permits
// and risk assessments to come).
//
//   const confirmSign = useSignConfirm();
//   const res = await confirmSign({ personKey, name, ownDevice, what: 'Sign the inspection' });
//   if (!res) return;                 // cancelled
//   record.signedWith = res.proof;    // undefined when the vessel does not ask
//
// When the vessel does not ask for confirmation (module off, or the Master's
// `confirmSignature` off) it resolves at once with no proof, so callers need no
// branch of their own. When it does:
//   - the signer's own device with a finger or face enrolled → the biometric
//     prompt opens by itself; "Use PIN" is always there;
//   - otherwise → the signer's signing PIN; the first time on this device they
//     choose it (twice), and from then on it is asked for.
// Rules and storage: services/signature.ts.
// ===================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import * as fb from '../services/firebaseService';
import { BiometricKind, biometricKind, confirmBiometric } from '../services/biometric';
import {
  PIN_MAX,
  PIN_MIN,
  SignProof,
  checkPin,
  hasPin,
  isValidSignPin,
  isWeakPin,
  lockedUntil,
  setPin,
} from '../services/signature';

export interface SignRequest {
  /** Stable id of the person: crew id, or `device:<id>` for an account. */
  personKey: string;
  name: string;
  /** True when the signer is this device's own account — biometrics allowed. */
  ownDevice: boolean;
  /** "Sign the inspection", "Record the job as done". */
  what: string;
}

export type SignResult = { proof?: SignProof } | null;

type Step = 'bio' | 'pin' | 'set1' | 'set2';

const Ctx = createContext<((r: SignRequest) => Promise<SignResult>) | null>(null);

export function useSignConfirm(): (r: SignRequest) => Promise<SignResult> {
  const fn = useContext(Ctx);
  // Outside the provider (a test, a screen rendered alone): nothing is asked.
  return fn ?? (async () => ({}));
}

export function SignConfirmProvider({ children }: { children: React.ReactNode }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { signingPolicy } = useData();
  const required = moduleOn('signConfirm') && !!signingPolicy?.confirmSignature;

  const [req, setReq] = useState<SignRequest | null>(null);
  const [step, setStep] = useState<Step>('pin');
  const [bio, setBio] = useState<BiometricKind | null>(null);
  const [pin, setPinText] = useState('');
  const [first, setFirst] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const resolver = useRef<((r: SignResult) => void) | null>(null);

  const finish = useCallback((r: SignResult) => {
    resolver.current?.(r);
    resolver.current = null;
    setReq(null);
  }, []);

  // Firestore refuses `undefined` outright, so the device id is left out rather
  // than sent empty when it cannot be read.
  const proof = async (method: SignProof['method']): Promise<SignResult> => {
    const deviceId = await fb.getLocalDeviceId().catch(() => undefined);
    return { proof: { method, ...(deviceId ? { deviceId } : {}), at: Date.now() } };
  };

  const tryBio = useCallback(async (r: SignRequest) => {
    setMsg(null);
    if (await confirmBiometric(`${r.what} as ${r.name}`)) finish(await proof('biometric'));
    else setStep((await hasPin(r.personKey)) ? 'pin' : 'set1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  const confirm = useCallback(
    async (r: SignRequest): Promise<SignResult> => {
      if (!required) return {};
      return new Promise<SignResult>((resolve) => {
        resolver.current = resolve;
        setPinText('');
        setFirst('');
        setMsg(null);
        setReq(r);
        void (async () => {
          const kind = r.ownDevice ? await biometricKind() : null;
          setBio(kind);
          if (kind) {
            setStep('bio');
            void tryBio(r);
          } else {
            setStep((await hasPin(r.personKey)) ? 'pin' : 'set1');
          }
        })();
      });
    },
    [required, tryBio]
  );

  // Show the lockout as it stands when the PIN step opens.
  useEffect(() => {
    if (!req || step !== 'pin') return;
    void lockedUntil(req.personKey).then((u) => u && setMsg(lockText(u)));
  }, [req, step]);

  const submit = async () => {
    if (!req) return;
    const v = pin.trim();
    if (step === 'pin') {
      const r = await checkPin(req.personKey, v);
      setPinText('');
      if (r.ok) return finish(await proof('pin'));
      setMsg(r.lockedUntil ? lockText(r.lockedUntil) : `Wrong PIN — ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`);
      return;
    }
    if (step === 'set1') {
      if (!isValidSignPin(v)) return setMsg(`Choose ${PIN_MIN} to ${PIN_MAX} digits.`);
      if (isWeakPin(v)) return setMsg('Too easy to guess — avoid repeats and runs like 1234.');
      setFirst(v);
      setPinText('');
      setMsg(null);
      return setStep('set2');
    }
    if (step === 'set2') {
      if (v !== first) {
        setPinText('');
        setFirst('');
        setMsg('The two PINs differ — choose it again.');
        return setStep('set1');
      }
      await setPin(req.personKey, req.name, v);
      finish(await proof('pin'));
    }
  };

  const title =
    step === 'bio' ? 'Confirm with biometrics' : step === 'pin' ? 'Enter your signing PIN' : step === 'set1' ? 'Choose a signing PIN' : 'Repeat the PIN';
  const hint =
    step === 'set1'
      ? `First signature on this device. Choose ${PIN_MIN}–${PIN_MAX} digits that only you know — not your account PIN. Nobody can read it back, the Master included.`
      : step === 'set2'
      ? 'Type the same PIN again.'
      : step === 'pin'
      ? 'Forgotten it? The Master resets it in Settings → Signing PINs, and you choose a new one.'
      : null;

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => finish(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <MciIcon name={step === 'bio' ? (bio === 'face' ? 'face-recognition' : 'fingerprint') : 'dialpad'} size={40} color={COLORS.primary} />
            <Text style={styles.what}>{req?.what}</Text>
            <Text style={styles.name}>{req?.name}</Text>
            <Text style={styles.title}>{title}</Text>
            {step === 'bio' ? (
              <TouchableOpacity style={styles.primary} onPress={() => req && void tryBio(req)}>
                <Text style={styles.primaryText}>{bio === 'face' ? 'Use Face ID' : 'Touch to sign'}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  key={step}
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
                  <Text style={styles.primaryText}>{step === 'set1' ? 'Next' : 'Sign'}</Text>
                </TouchableOpacity>
              </>
            )}
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            <View style={styles.row}>
              {step === 'bio' ? (
                <TouchableOpacity onPress={async () => req && setStep((await hasPin(req.personKey)) ? 'pin' : 'set1')} hitSlop={8}>
                  <Text style={styles.link}>Use PIN</Text>
                </TouchableOpacity>
              ) : bio && step === 'pin' ? (
                <TouchableOpacity onPress={() => { setStep('bio'); req && void tryBio(req); }} hitSlop={8}>
                  <Text style={styles.link}>Use biometrics</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity onPress={() => finish(null)} hitSlop={8}>
                <Text style={[styles.link, { color: COLORS.textLight }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

function lockText(until: number): string {
  const min = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  return `Too many wrong PINs — try again in ${min} min.`;
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: SIZES.lg },
    card: { ...COLORS.glassCard, backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusLg, padding: SIZES.lg, width: '100%', maxWidth: 380, alignItems: 'center' },
    what: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.sm, textAlign: 'center' },
    name: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark, marginTop: 2, textAlign: 'center' },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.text, marginTop: SIZES.md },
    pin: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, marginTop: SIZES.md, width: 200, textAlign: 'center', fontSize: 26, letterSpacing: 10, color: COLORS.textDark },
    primary: { marginTop: SIZES.md, paddingVertical: SIZES.md, paddingHorizontal: SIZES.xl, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.primary, alignSelf: 'stretch', alignItems: 'center' },
    primaryText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    msg: { color: COLORS.danger, fontSize: SIZES.small, marginTop: SIZES.sm, textAlign: 'center' },
    hint: { color: COLORS.textLight, fontSize: SIZES.tiny, marginTop: SIZES.sm, textAlign: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: SIZES.lg },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
