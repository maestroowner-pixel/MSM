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
import { Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import * as fb from '../services/firebaseService';
import { BiometricKind, biometricKind, confirmBiometric } from '../services/biometric';
import { SignaturePad } from './SignaturePad';
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
  ADMIN_KEY,
  hasAdminPin,
} from '../services/signature';

export interface SignRequest {
  /** Stable id of the person: crew id, or `device:<id>` for an account. */
  personKey: string;
  name: string;
  /** True when the signer is this device's own account — biometrics allowed. */
  ownDevice: boolean;
  /** "Sign the inspection", "Record the job as done". */
  what: string;
  /**
   * Ask even where confirmed signatures are not switched on for the app — a
   * signature that is nothing but a tap means nothing on a drill's attendance
   * list (13 Oct 2026: "attendance list signed digitally — PIN and bio").
   */
  always?: boolean;
  /**
   * Someone with no PIN on this device and none to get — the person ashore who
   * receives a landing: the hand-drawn signature only.
   */
  handOnly?: boolean;
}

export type SignResult = { proof?: SignProof } | null;

type Step = 'choose' | 'bio' | 'pin' | 'admin' | 'set1' | 'set2' | 'draw';

/** A phone, a tablet, or a browser on a touch screen — where a hand or a stylus can sign. */
/** Signing by hand is offered everywhere — a stylus or finger on a tablet, a pen tablet or mouse on a computer. */
const canDraw = true;

const Ctx = createContext<((r: SignRequest) => Promise<SignResult>) | null>(null);

export function useSignConfirm(): (r: SignRequest) => Promise<SignResult> {
  const fn = useContext(Ctx);
  // Outside the provider (a test, a screen rendered alone): nothing is asked.
  return fn ?? (async () => ({}));
}

/** Where the PIN path starts: the PIN, or — with none yet — the Master's unlock (if there is a Master PIN). */
async function pinStep(personKey: string): Promise<Step> {
  if (await hasPin(personKey)) return 'pin';
  return (await hasAdminPin()) ? 'admin' : 'set1';
}

export function SignConfirmProvider({ children }: { children: React.ReactNode }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { signingPolicy } = useData();
  // Every signature is confirmed — PIN, fingerprint or by hand (10 Oct 2026: "a
  // signature with nothing asked is not acceptable"). The old per-vessel switch
  // (signingPolicy.confirmSignature) no longer turns it off.
  const required = moduleOn('signConfirm');

  const [req, setReq] = useState<SignRequest | null>(null);
  const [step, setStep] = useState<Step>('pin');
  const [bio, setBio] = useState<BiometricKind | null>(null);
  const [pin, setPinText] = useState('');
  const [drawing, setDrawing] = useState('');
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
  const proof = async (method: SignProof['method'], drawn?: string): Promise<SignResult> => {
    const deviceId = await fb.getLocalDeviceId().catch(() => undefined);
    return { proof: { method, ...(drawn ? { drawing: drawn } : {}), ...(deviceId ? { deviceId } : {}), at: Date.now() } };
  };
  const toPin = async () => {
    if (!req) return;
    setMsg(null);
    setStep(await pinStep(req.personKey));
  };

  const tryBio = useCallback(async (r: SignRequest) => {
    setMsg(null);
    if (await confirmBiometric(`${r.what} as ${r.name}`)) finish(await proof('biometric'));
    else setStep(await pinStep(r.personKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  const confirm = useCallback(
    async (r: SignRequest): Promise<SignResult> => {
      if (!required && !r.always) return {};
      return new Promise<SignResult>((resolve) => {
        resolver.current = resolve;
        setPinText('');
        setDrawing('');
        setFirst('');
        setMsg(null);
        setReq(r);
        void (async () => {
          // The signer chooses: PIN, by hand, or the fingerprint on their own device (11 Oct 2026).
          setBio(r.ownDevice ? await biometricKind() : null);
          setStep(r.handOnly ? 'draw' : 'choose');
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
    if (step === 'admin') {
      // A first PIN is set only with the Master's PIN (components/PinChange).
      const r = await checkPin(ADMIN_KEY, v);
      setPinText('');
      if (!r.ok) return setMsg(r.lockedUntil ? lockText(r.lockedUntil) : `Wrong Master PIN — ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`);
      setMsg(null);
      return setStep('set1');
    }
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
    step === 'choose' ? 'How do you sign?' : step === 'bio' ? 'Confirm with your fingerprint' : step === 'draw' ? 'Sign by hand' : step === 'admin' ? 'No signing PIN yet — the Master PIN, please' : step === 'pin' ? 'Enter your signing PIN' : step === 'set1' ? 'Choose a signing PIN' : 'Repeat the PIN';
  const hint =
    step === 'set1'
      ? `First signature on this device. Choose ${PIN_MIN}–${PIN_MAX} digits that only you know — not your account PIN. Nobody can read it back, the Master included.`
      : step === 'set2'
      ? 'Type the same PIN again.'
      : step === 'admin'
      ? `Setting a first signing PIN needs the Master.${canDraw || bio ? ` Or sign ${[canDraw ? 'by hand' : null, bio ? 'with your fingerprint' : null].filter(Boolean).join(' or ')} for now.` : ''}`
      : step === 'draw'
      ? 'With a finger or a stylus, as on paper. It goes into the record with your name.'
      : step === 'pin'
      ? 'Forgotten it? The Master resets it in Settings → Signing PINs, and you choose a new one.'
      : null;

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => finish(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, step === 'draw' && styles.cardWide]}>
            {step !== 'draw' ? <MciIcon name={step === 'choose' ? 'draw' : step === 'bio' ? 'fingerprint' : 'dialpad'} size={40} color={COLORS.primary} /> : null}
            <Text style={styles.what}>{req?.what}</Text>
            <Text style={styles.name}>{req?.name}</Text>
            <Text style={styles.title}>{title}</Text>
            {step === 'choose' ? (
              <View style={styles.choices}>
                <TouchableOpacity style={styles.choice} onPress={() => void toPin()}>
                  <MciIcon name="dialpad" size={30} color={COLORS.primary} />
                  <Text style={styles.choiceText}>PIN</Text>
                </TouchableOpacity>
                {canDraw ? (
                  <TouchableOpacity style={styles.choice} onPress={() => { setMsg(null); setDrawing(''); setStep('draw'); }}>
                    <MciIcon name="draw-pen" size={30} color={COLORS.primary} />
                    <Text style={styles.choiceText}>Sign by hand</Text>
                  </TouchableOpacity>
                ) : null}
                {bio ? (
                  <TouchableOpacity style={styles.choice} onPress={() => { setStep('bio'); req && void tryBio(req); }}>
                    <MciIcon name="fingerprint" size={30} color={COLORS.primary} />
                    <Text style={styles.choiceText}>Fingerprint</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : step === 'bio' ? (
              <TouchableOpacity style={styles.primary} onPress={() => req && void tryBio(req)}>
                <Text style={styles.primaryText}>Touch to sign</Text>
              </TouchableOpacity>
            ) : step === 'draw' ? (
              <View style={{ alignSelf: 'stretch' }}>
                {/* A big pad for a stylus or a finger, and two big buttons. */}
                <SignaturePad value={drawing} onChange={setDrawing} big />
                <View style={styles.drawButtons}>
                  <TouchableOpacity style={[styles.bigBtn, styles.bigOutline]} onPress={() => setDrawing('')}>
                    <MciIcon name="eraser" size={22} color={COLORS.danger} />
                    <Text style={[styles.bigBtnText, { color: COLORS.danger }]}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bigBtn, { backgroundColor: COLORS.primary }, !drawing && { opacity: 0.5 }]} disabled={!drawing} onPress={async () => finish(await proof('drawn', drawing))}>
                    <MciIcon name="check" size={22} color={COLORS.textWhite} />
                    <Text style={[styles.bigBtnText, { color: COLORS.textWhite }]}>Sign</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
                  <Text style={styles.primaryText}>{step === 'set1' ? 'Next' : step === 'admin' ? 'Unlock' : 'Sign'}</Text>
                </TouchableOpacity>
              </>
            )}
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            <View style={styles.row}>
              {/* Back to the choice: PIN, by hand, fingerprint. */}
              {step !== 'choose' && !req?.handOnly ? (
                <TouchableOpacity onPress={() => { setMsg(null); setPinText(''); setStep('choose'); }} hitSlop={8}>
                  <Text style={styles.link}>Another way</Text>
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
    cardWide: { maxWidth: 1000, padding: SIZES.xl },
    choices: { alignSelf: 'stretch', gap: SIZES.sm, marginTop: SIZES.md },
    choice: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingHorizontal: SIZES.lg },
    choiceText: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.primary },
    drawButtons: { flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.lg, justifyContent: 'center' },
    bigBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, minWidth: 180, paddingVertical: 16, paddingHorizontal: SIZES.xl, borderRadius: SIZES.radiusMd },
    bigOutline: { borderWidth: 2, borderColor: COLORS.danger },
    bigBtnText: { fontSize: SIZES.h5, fontWeight: '900' },
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
