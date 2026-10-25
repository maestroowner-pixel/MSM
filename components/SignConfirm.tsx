// ===================================
// SignConfirm — "touch to sign": the one confirmation every signed act goes
// through (inspections, maintenance, stores, and the documents, drills, permits
// and risk assessments to come).
//
//   const confirmSign = useSignConfirm();
//   const res = await confirmSign({ personKey, name, ownDevice, what: 'Sign the inspection' });
//   if (!res) return;                 // cancelled
//   record.signedWith = res.proof;    // undefined when the vessel does not ask
//   record = withSeal(record, res);   // the record books: seal the words (services/seal)
//
// When the vessel does not ask for confirmation (module off, or the Master's
// `confirmSignature` off) it resolves at once with no proof, so callers need no
// branch of their own. When it does:
//   - the signer's own device with a finger or face enrolled → the biometric
//     prompt opens by itself; "Use PIN" is always there;
//   - otherwise → the signer's signing PIN; the first time on this device they
//     choose it (twice), and from then on it is asked for.
// Rules and storage: services/signature.ts.
//
// Each way also opens the signer's KEY (services/signKeys, 25 Oct 2026): the PIN
// decrypts theirs, the fingerprint opens their own phone's, a hand-drawn
// signature gets the device's. `withSeal` signs a record's hash with it; a key
// made just now is added to the vessel's key register here.
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
import { t, tn, useT } from '../utils/i18n';
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
import { OpenKey, openBioKey, openDeviceKey, openPinKey } from '../services/signKeys';
import type { SignKeyRec } from '../services/seal';
import * as storage from '../services/storage';

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

export type SignResult = { proof?: SignProof; key?: OpenKey } | null;

/**
 * `rec` with its seal in `field` (the proof already there, or the result's): the
 * signer's key signs the hash of everything else the record says. No key (an old
 * build, no generator) — the record as it was.
 */
export function withSeal<T extends object>(rec: T, sig: SignResult, field: 'signedWith' | 'editedWith' = 'signedWith'): T {
  if (!sig?.key) return rec;
  const proof = (rec as any)[field] ?? sig.proof;
  if (!proof) return rec;
  return { ...rec, [field]: { ...proof, seal: sig.key.seal(rec) } };
}

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
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { signingPolicy, appendRow, signKeys } = useData();
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
  // tryBio is memoised: the request and the register are read through refs, not its first render.
  const reqRef = useRef<SignRequest | null>(null);
  const keysRef = useRef(signKeys);
  keysRef.current = signKeys;

  const finish = useCallback((r: SignResult) => {
    resolver.current?.(r);
    resolver.current = null;
    setReq(null);
  }, []);

  // Firestore refuses `undefined` outright, so the device id is left out rather
  // than sent empty when it cannot be read.
  // The key is opened with what was just proved: the PIN typed, the finger, or —
  // by hand — the device's own. A key failing to open never stops the signature.
  const proof = async (method: SignProof['method'], drawn?: string, pinTyped?: string): Promise<SignResult> => {
    const deviceId = await fb.getLocalDeviceId().catch(() => undefined);
    let key: OpenKey | null = null;
    const req = reqRef.current;
    if (req) {
      try {
        key = method === 'pin' && pinTyped ? await openPinKey(req.personKey, pinTyped) : method === 'biometric' ? await openBioKey(req.personKey) : method === 'drawn' ? await openDeviceKey(deviceId ?? '') : null;
      } catch (e: any) {
        console.warn('[seal] key not opened:', e?.message ?? e);
      }
      if (key && (key.fresh || !keysRef.current.some((k) => k.id === key!.id))) {
        const now = Date.now();
        const rec: SignKeyRec = {
          id: key.id,
          person: key.kind === 'device' ? `dev:${deviceId ?? ''}` : req.personKey,
          name: key.kind === 'device' ? 'This device' : req.name,
          kind: key.kind,
          pub: key.pub,
          ...(key.opens ? { opens: key.opens } : {}),
          ...(deviceId ? { deviceId } : {}),
          at: now,
          updatedAt: now,
        };
        await appendRow(storage.SIGN_KEYS_KEY, rec).catch(() => {});
      }
    }
    return { proof: { method, ...(drawn ? { drawing: drawn } : {}), ...(deviceId ? { deviceId } : {}), at: Date.now() }, ...(key ? { key } : {}) };
  };
  const toPin = async () => {
    if (!req) return;
    setMsg(null);
    setStep(await pinStep(req.personKey));
  };

  const tryBio = useCallback(async (r: SignRequest) => {
    setMsg(null);
    if (await confirmBiometric(t('sc.bioAs', { what: r.what, name: r.name }))) finish(await proof('biometric'));
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
        reqRef.current = r;
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
      if (!r.ok) return setMsg(r.lockedUntil ? lockText(r.lockedUntil) : t('sc.wrongMaster', { left: tn('n.tryLeft', r.left) }));
      setMsg(null);
      return setStep('set1');
    }
    if (step === 'pin') {
      const r = await checkPin(req.personKey, v);
      setPinText('');
      if (r.ok) return finish(await proof('pin', undefined, v));
      setMsg(r.lockedUntil ? lockText(r.lockedUntil) : t('sc.wrongPin', { left: tn('n.tryLeft', r.left) }));
      return;
    }
    if (step === 'set1') {
      if (!isValidSignPin(v)) return setMsg(t('sc.digits', { min: PIN_MIN, max: PIN_MAX }));
      if (isWeakPin(v)) return setMsg(t('sc.weak'));
      setFirst(v);
      setPinText('');
      setMsg(null);
      return setStep('set2');
    }
    if (step === 'set2') {
      if (v !== first) {
        setPinText('');
        setFirst('');
        setMsg(t('sc.differ'));
        return setStep('set1');
      }
      await setPin(req.personKey, req.name, v);
      finish(await proof('pin', undefined, v));
    }
  };

  const title =
    step === 'choose' ? t('sc.how') : step === 'bio' ? t('sc.bioTitle') : step === 'draw' ? t('sc.byHand') : step === 'admin' ? t('sc.adminTitle') : step === 'pin' ? t('sc.enterPin') : step === 'set1' ? t('sc.choosePin') : t('sc.repeat');
  const hint =
    step === 'set1'
      ? t('sc.firstHint', { min: PIN_MIN, max: PIN_MAX })
      : step === 'set2'
      ? t('sc.again')
      : step === 'admin'
      ? t('sc.adminHint') + (canDraw && bio ? t('sc.orHandBio') : canDraw ? t('sc.orHand') : bio ? t('sc.orBio') : '')
      : step === 'draw'
      ? t('sc.drawHint')
      : step === 'pin'
      ? t('sc.forgot')
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
                    <Text style={styles.choiceText}>{t('sc.byHand')}</Text>
                  </TouchableOpacity>
                ) : null}
                {bio ? (
                  <TouchableOpacity style={styles.choice} onPress={() => { setStep('bio'); req && void tryBio(req); }}>
                    <MciIcon name="fingerprint" size={30} color={COLORS.primary} />
                    <Text style={styles.choiceText}>{t('sc.fingerprint')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : step === 'bio' ? (
              <TouchableOpacity style={styles.primary} onPress={() => req && void tryBio(req)}>
                <Text style={styles.primaryText}>{t('sc.touch')}</Text>
              </TouchableOpacity>
            ) : step === 'draw' ? (
              <View style={{ alignSelf: 'stretch' }}>
                {/* A big pad for a stylus or a finger, and two big buttons. */}
                <SignaturePad value={drawing} onChange={setDrawing} big />
                <View style={styles.drawButtons}>
                  <TouchableOpacity style={[styles.bigBtn, styles.bigOutline]} onPress={() => setDrawing('')}>
                    <MciIcon name="eraser" size={22} color={COLORS.danger} />
                    <Text style={[styles.bigBtnText, { color: COLORS.danger }]}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bigBtn, { backgroundColor: COLORS.primary }, !drawing && { opacity: 0.5 }]} disabled={!drawing} onPress={async () => finish(await proof('drawn', drawing))}>
                    <MciIcon name="check" size={22} color={COLORS.textWhite} />
                    <Text style={[styles.bigBtnText, { color: COLORS.textWhite }]}>{t('common.sign')}</Text>
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
                  <Text style={styles.primaryText}>{step === 'set1' ? t('sc.next') : step === 'admin' ? t('sc.unlock') : t('common.sign')}</Text>
                </TouchableOpacity>
              </>
            )}
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            <View style={styles.row}>
              {/* Back to the choice: PIN, by hand, fingerprint. */}
              {step !== 'choose' && !req?.handOnly ? (
                <TouchableOpacity onPress={() => { setMsg(null); setPinText(''); setStep('choose'); }} hitSlop={8}>
                  <Text style={styles.link}>{t('sc.another')}</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity onPress={() => finish(null)} hitSlop={8}>
                <Text style={[styles.link, { color: COLORS.textLight }]}>{t('common.cancel')}</Text>
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
  return t('sc.locked', { min });
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
