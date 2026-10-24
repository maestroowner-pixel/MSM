// ===================================
// Scan (modal) — point the phone at a sticker, get the item.
//
// A match opens ItemDetail directly and REPLACES this screen in the stack: both
// lookup routes are exact string matches, so there is nothing to confirm, and
// "back" from the item should return to the list the user came from rather than to
// a camera they are finished with.
//
// The two failures are kept apart on purpose (see services/barcode.ts): a code we
// have never seen is simply not ours, whereas one of our own labels pointing at a
// missing item is a register problem worth saying out loud.
//
// Manual entry sits under the camera on every platform. It is not a web fallback
// bolted on — it is what is needed when a code is too scraped to scan and the
// digits are still readable, and it runs the identical lookup.
//
// Quick pass (Sven, 24 Oct 2026): on a vessel where defects are months apart, the
// round is a walk past labels that are all fine, and five taps per item made it
// slower than the Excel sheet it replaced. Switched on, every equipment label
// scanned is signed at once as PASSED on every checklist line — no item screen,
// no checklist, no confirmation — and the scanner re-arms with a sound and a buzz.
// The signature is confirmed ONCE, when the mode is switched on, for the person
// who signs. It refuses what it cannot honestly pass: an item with an open defect,
// one already done this period, a category with no check for the period, and a
// TYPED code where the vessel requires a scan. Each record says it was a quick
// pass, so the report shows how the item was checked. A defect found afterwards
// is a normal inspection of the item — tap it in the list.
//
// Windows: expo-camera has no Windows build and is swapped for mocks/expo-camera.js
// by metro.config.js. The stub reports permission permanently denied, and the guard
// below turns the screen into manual entry — which still works, because the lookup
// is pure JS.
// ===================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SCAN_BARCODE_TYPES, ScanMatch, lookupScan } from '../services/barcode';
import { SIZES, Palette } from '../theme';
import { goBackOr } from '../utils/nav';
import { recordScanProof, signerRule, signingGate } from '../services/signingPolicy';
import { useSignConfirm, SignResult } from '../components/SignConfirm';
import { SignerPicker } from '../components/SignerPicker';
import * as inspections from '../services/inspections';
import { roundFor } from '../services/rounds';
import { useActiveRound } from '../services/activeRound';
import { periodsFor, templateFor } from '../constants/checklists';
import { CATEGORY_MAP, catLabel } from '../constants/categories';
import { CheckResult, InspectionPeriod } from '../types/inspection';
import { itemNumber, typeWithSize } from '../utils/itemText';
import { playErrorSound, playSuccessSound } from '../utils/sound';
import { parseCheckpointQr, parseCrewQr, parseKeyQr, parsePassQr, samePass, parseSopepQr, parseStoreQr } from '../services/crewQr';
import { visit as visitCheckpoint } from '../services/patrolLive';
import { roomByCode, storeRooms } from '../types/stores';
import { lockerCode, sopepLockers } from '../types/sopep';
import { isDoubleScan, nextMove } from '../services/gangway';
import { todayIso } from '../services/pms';
import { passengerAboard } from '../types/passengers';
import { useSync } from '../contexts/SyncContext';
import { moduleOn } from '../constants/modules';
import { isAboard } from '../types/crew';
import { personName } from '../types/role';
import * as storage from '../services/storage';
import { t, tk, useT } from '../utils/i18n';

/** No expo-camera on Windows — see the module header. */
const HAS_CAMERA = Platform.OS !== 'windows';

/**
 * On a PHONE the camera IS this screen — it opens looking, because the officer is
 * standing at the equipment with a sticker in front of them. In a BROWSER it is
 * not: the machine is usually a desk computer, the label is somewhere else on the
 * ship, and reaching for the camera unasked makes the browser sit there waiting
 * for a device that may not exist — which is what a user on Opera saw, and reads
 * as the app hanging. So on web the camera waits to be asked for.
 */
const CAMERA_ON_OPEN = Platform.OS !== 'web';

const QUICK_PERIODS: InspectionPeriod[] = ['weekly', 'monthly', 'quarterly', 'annual'];
/** On the record, in English like the rest of it — what the report prints as the remark. */
const QUICK_NOTE = {
  camera: 'Quick pass: label scanned, all lines passed, no checklist opened.',
  typed: 'Quick pass: code typed, all lines passed, no checklist opened.',
};
/** The camera keeps reading a sticker it is still pointed at; the same code is ignored this long. */
const SAME_CODE_MS = 4000;

interface QuickRow {
  key: string;
  itemId?: string;
  title: string;
  text: string;
  ok: boolean;
}

const quickTitle = (it: { no?: string; type?: string; size?: string; serial?: string } & any) =>
  [itemNumber(it) && `#${itemNumber(it)}`, typeWithSize(it) || (it.serial ? `S/N ${it.serial}` : '')].filter(Boolean).join(' ') || t('ins.item');

export default function ScanSc() {
  useT();
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { flat, recordScan, crew, crewMoves, appendRow, visitors, saveRow, passengers, storeRoomList, sopepLockers: sopepLockerList, checkpoints, keyList, inspections: trail, templates, rounds, signingPolicy, prefs, setPrefs, addInspection } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();
  const activeRoundId = useActiveRound();
  /** Opened from the gangway page: a crew or passenger card records the crossing. */
  const atGangway = ['1', 'true', true, 1].includes(route.params?.gangway);
  /** Opened from a security round: each checkpoint scanned is recorded and the scanner stays open for the next. */
  const onRound = ['1', 'true', true, 1].includes(route.params?.patrol);
  /** The last crew card read at the gangway — shown big, then the scanner is ready for the next. */
  const [crewHit, setCrewHit] = useState<{ name: string; text: string; ok: boolean } | null>(null);
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [permission, requestPermission] = useCameraPermissions();
  const [wantCamera, setWantCamera] = useState(CAMERA_ON_OPEN);
  /** Why the camera cannot be used, when we know before the browser hangs on it. */
  const [camError, setCamError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanMatch | null>(null);
  const [manual, setManual] = useState('');

  // The scanner fires on every frame that holds a code — several times before any
  // state update lands. A ref is the only guard fast enough to keep one sticker
  // from opening one screen twice.
  const locked = useRef(false);

  // ---- Quick pass (see the header) ----
  const quickAllowed = !atGangway && !onRound;
  const [quick, setQuick] = useState(false);
  const [quickPeriod, setQuickPeriod] = useState<InspectionPeriod>(
    () => rounds.find((r) => r.id === activeRoundId && !r.closedAt)?.period as InspectionPeriod ?? 'monthly'
  );
  const [quickRows, setQuickRows] = useState<QuickRow[]>([]);
  const [quickCount, setQuickCount] = useState(0);
  const [pickingSigner, setPickingSigner] = useState(false);
  /** The signature confirmed when the mode was switched on — carried by every record it signs. */
  const quickSig = useRef<{ signer: { id: string; name: string; rank?: string }; result: NonNullable<SignResult> } | null>(null);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  /** Records are written one after another: two appends racing would read the same list and drop one. */
  const writes = useRef<Promise<void>>(Promise.resolve());
  /** Items passed in this session — the trail in context lags the write by a render. */
  const passedNow = useRef(new Set<string>());

  const rule = signerRule(signingPolicy, sync.enrolled, sync.me);
  const activeCrew = useMemo(() => crew.filter((c) => c.active), [crew]);

  const startQuick = async (pickedId?: string) => {
    let signer: { id: string; name: string; rank?: string } | undefined;
    if (rule.kind === 'device') signer = rule.signer;
    else if (rule.kind === 'pick') {
      const id = pickedId ?? prefs.lastCrewId;
      signer = activeCrew.find((c) => c.id === id) ?? (activeCrew.length === 1 ? activeCrew[0] : undefined);
      if (!signer) return setPickingSigner(true);
    } else return setQuickRows([{ key: 'wait', title: t('qp.title'), text: t('ins.waitAccountBody'), ok: false }]);
    const sig = await confirmSign({ personKey: signer.id, name: signer.name, ownDevice: rule.kind === 'device', what: t('qp.signWhat') });
    if (!sig) return;
    if (rule.kind === 'pick') void setPrefs({ lastCrewId: signer.id });
    quickSig.current = { signer, result: sig };
    passedNow.current = new Set();
    setQuickRows([]);
    setQuickCount(0);
    setQuick(true);
  };

  const stopQuick = () => {
    quickSig.current = null;
    setQuick(false);
  };

  const quickPass = (code: string, via: 'camera' | 'typed') => {
    const now = Date.now();
    if (via === 'camera' && lastCode.current?.code === code && now - lastCode.current.at < SAME_CODE_MS) {
      locked.current = false;
      return;
    }
    lastCode.current = { code, at: now };
    const done = (row: Omit<QuickRow, 'key'>) => {
      setQuickRows((prev) => [{ ...row, key: `${now}` }, ...prev].slice(0, 12));
      if (row.ok) {
        playSuccessSound();
        Vibration.vibrate(60);
      } else {
        playErrorSound();
        Vibration.vibrate([0, 90, 80, 90]);
      }
      setManual('');
      setTimeout(() => {
        locked.current = false;
      }, row.ok ? 700 : 1500);
    };
    const s = quickSig.current;
    if (!s) return done({ title: t('qp.title'), text: t('qp.notStarted'), ok: false });

    const match = lookupScan(code, flat);
    if (match.kind !== 'item') return done({ title: code, text: match.kind === 'stale' ? t('scn.staleTitle') : t('qp.notItem'), ok: false });
    const item = match.item;
    const title = quickTitle(item);
    if (!periodsFor(item.category, templates).includes(quickPeriod)) {
      return done({ itemId: item.id, title, text: t('qp.noCheck', { per: tk(`period.${quickPeriod}`).toLowerCase(), cat: catLabel(CATEGORY_MAP[item.category]) }), ok: false });
    }
    const template = templateFor(item.category, quickPeriod, templates);
    if (!template) return done({ itemId: item.id, title, text: t('qp.noCheck', { per: tk(`period.${quickPeriod}`).toLowerCase(), cat: catLabel(CATEGORY_MAP[item.category]) }), ok: false });
    if (inspections.openDefectsForItem(trail, item.id).length) return done({ itemId: item.id, title, text: t('qp.openDefect'), ok: false });
    if (passedNow.current.has(item.id) || inspections.roundStatus(trail, item.id, quickPeriod) === 'done') {
      return done({ itemId: item.id, title, text: t('qp.already', { per: tk(`period.${quickPeriod}`).toLowerCase() }), ok: false });
    }
    // A typed code is not proof the label was in front of the phone — where the vessel
    // requires a scan, only the camera may pass an item with no checklist opened.
    if (via === 'camera') recordScanProof(item.id, 'qr-camera', now);
    const proof = via === 'camera' ? { itemId: item.id, at: now, method: 'qr-camera' as const } : null;
    const gate = signingGate(signingPolicy, sync.role, sync.enrolled, proof, item.category);
    if (gate.kind === 'blocked' || gate.kind === 'override') return done({ itemId: item.id, title, text: t('qp.scanNeeded'), ok: false });

    const round = moduleOn('rounds') ? roundFor(rounds, item, quickPeriod, activeRoundId) : null;
    const record = {
      ...inspections.create({
        item,
        template,
        results: Object.fromEntries(template.lines.map((l) => [l.id, 'pass' as CheckResult])),
        by: s.signer.name,
        byRank: s.signer.rank,
        byId: s.signer.id,
        comment: QUICK_NOTE[via],
        ...(round ? { roundId: round.id } : {}),
        verification: proof ? { method: proof.method, scannedAt: proof.at } : undefined,
        at: now,
      }),
      ...(s.result.proof ? { signedWith: s.result.proof } : {}),
    };
    passedNow.current.add(item.id);
    writes.current = writes.current
      .then(() => addInspection(record))
      .catch(() => {
        passedNow.current.delete(item.id);
        setQuickRows((prev) => [{ key: `${now}e`, itemId: item.id, title, text: t('ins.couldNotSign'), ok: false }, ...prev]);
        playErrorSound();
      });
    void recordScan(item.id);
    setQuickCount((n) => n + 1);
    done({ itemId: item.id, title, text: t('qp.passed', { per: tk(`period.${quickPeriod}`).toLowerCase(), time: new Date(now).toTimeString().slice(0, 5) }), ok: true });
  };

  const handle = useCallback(
    (code: string, via: 'camera' | 'typed') => {
      if (locked.current) return;
      locked.current = true;
      if (quick) return quickPass(code, via);

      const hold = (hit: { name: string; text: string; ok: boolean }, ms = 2200) => {
        setCrewHit(hit);
        setTimeout(() => {
          locked.current = false;
        }, ms);
      };

      // A security round checkpoint (msm://checkpoint/<id>), or its ID typed (CP-03):
      // recorded in the round under way on this device (Jez, 17 Oct 2026).
      const cp = moduleOn('patrols')
        ? checkpoints.find((c) => c.id === parseCheckpointQr(code)) ?? (via === 'typed' ? checkpoints.find((c) => c.code.toUpperCase() === code.trim().toUpperCase()) : undefined)
        : undefined;
      if (cp || parseCheckpointQr(code)) {
        if (!cp) return hold({ name: t('pat.cp'), text: moduleOn('patrols') ? t('scn.notCp') : t('scn.patrolsOff'), ok: false });
        void visitCheckpoint(cp, via === 'camera' ? 'scan' : 'typed').then((r) => {
          if (!r) return hold({ name: `${cp.code} · ${cp.name}`, text: t('scn.noRound'), ok: false }, 3000);
          const at = new Date(r.live.visits.find((v) => v.checkpointId === cp.id)!.at).toTimeString().slice(0, 5);
          if (!onRound) return nav.replace('Main', { screen: 'Security', params: { view: 'patrols' } });
          hold({ name: `${cp.code} · ${cp.name}`, text: r.already ? t('scn.already', { at }) : t('scn.recorded', { at, n: r.live.visits.length }), ok: true });
        });
        return;
      }

      // A key tag (msm://key/<id>), or a key's ID typed (K-04): that key, to sign it out or back.
      const key = moduleOn('keys')
        ? keyList.find((k) => k.id === parseKeyQr(code)) ?? (via === 'typed' ? keyList.find((k) => k.code.toUpperCase() === code.trim().toUpperCase()) : undefined)
        : undefined;
      if (key) return nav.replace('Main', { screen: 'Security', params: { view: 'keys', key: key.id } });
      if (parseKeyQr(code)) return hold({ name: t('scn.keyTag'), text: moduleOn('keys') ? t('scn.notKey') : t('scn.keysOff'), ok: false });

      // A SOPEP locker's label (msm://sopep/<id>): what is in that locker (14 Oct 2026, as
      // InventoryLens opens a locker). The id only — a renamed or moved locker keeps its label.
      // …or its ID typed (SP-01), 15 Oct 2026.
      const lockerId = parseSopepQr(code) ?? (via === 'typed' && moduleOn('sopep') ? sopepLockers(sopepLockerList).find((l) => lockerCode(l).toUpperCase() === code.trim().toUpperCase())?.id : undefined);
      if (lockerId) {
        if (moduleOn('sopep')) return nav.replace('Main', { screen: 'Sopep', params: { locker: lockerId } });
        setCrewHit({ name: t('scn.sopepLocker'), text: t('scn.sopepOff'), ok: false });
        setTimeout(() => {
          locked.current = false;
        }, 2500);
        return;
      }

      // A store's label (msm://store/<id>), or a store's ID typed (PPE, ST-03): that
      // store's list (15 Oct 2026, components/StoreRooms). Typed, an ID is tried
      // only after the labels — a register search still finds an item whose serial
      // happens to read the same.
      const storeId = parseStoreQr(code) ?? (via === 'typed' && moduleOn('stores') ? roomByCode(storeRooms(storeRoomList), code)?.id : undefined);
      if (storeId) {
        if (moduleOn('stores')) return nav.replace('Main', { screen: 'Stores', params: { view: storeId } });
        setCrewHit({ name: t('scn.store'), text: t('scn.storesOff'), ok: false });
        setTimeout(() => {
          locked.current = false;
        }, 2500);
        return;
      }

      // A crew card (msm://crew/<id>): going ashore or coming back aboard — only when the
      // scanner was opened from the gangway page (14 Oct 2026: "crossing the gangway only
      // from the gangway page"). Anywhere else the card opens the person: the crew member's
      // card, or the passenger on the passenger list.
      const crewId = parseCrewQr(code);
      if (crewId && !atGangway) {
        const member = crew.find((x) => x.id === crewId && !x.deleted);
        if (member) return nav.replace('CrewMember', { id: member.id });
        const guest = moduleOn('passengers') ? passengers.find((x) => x.id === crewId && !x.deleted) : undefined;
        if (guest) return nav.replace('Main', { screen: 'Passengers', params: { open: guest.id } });
        setCrewHit({ name: t('scn.unknownCard'), text: t('scn.notOnList'), ok: false });
        setTimeout(() => {
          locked.current = false;
        }, 2500);
        return;
      }
      if (crewId && moduleOn('security')) {
        // A passenger card carries the same scheme, with the passenger's id (types/passengers.ts).
        const pax = moduleOn('passengers') ? passengers.find((x) => x.id === crewId && passengerAboard(x, todayIso())) : undefined;
        const c = crew.find((x) => x.id === crewId && isAboard(x)) ?? (pax ? { id: pax.id, name: pax.name, rank: pax.cabin ? `Guest · cabin ${pax.cabin}` : 'Guest' } : undefined);
        const show = (hit: { name: string; text: string; ok: boolean }) => {
          setCrewHit(hit);
          setTimeout(() => {
            locked.current = false;
          }, 2500);
        };
        if (!c) return show({ name: t('scn.unknownCard'), text: t('scn.notOnList2'), ok: false });
        if (isDoubleScan(c.id, crewMoves)) return show({ name: c.name, text: t('scn.moment'), ok: true });
        const by = sync.me ? personName(sync.me) : 'Gangway';
        const m = nextMove(c, crewMoves, by, via === 'camera' ? 'qr' : 'manual');
        void appendRow(storage.CREW_MOVES_KEY, m);
        show({ name: c.rank ? `${c.name} · ${c.rank}` : c.name, text: `${m.dir === 'ashore' ? t('scn.ashore') : t('scn.backAboard')} · ${m.time}`, ok: true });
        return;
      }

      // A crew card or visitor pass on a vessel without gangway control: say what it
      // is. It used to fall through to the register search — "Not on file", with the
      // advice to file the code as an item's serial, which would have made the
      // officer's card open a fire extinguisher (11 Oct 2026).
      if ((crewId || parsePassQr(code)) && !moduleOn('security')) {
        setCrewHit({
          name: crewId ? t('scn.crewCard') : t('scn.visitorPass'),
          text: t('scn.gangwayOff'),
          ok: false,
        });
        setTimeout(() => {
          locked.current = false;
        }, 2500);
        return;
      }

      // A visitor pass (msm://pass/07): a pass in use → who holds it, with the
      // photograph — anyone can check who it is; the watch signs them off from
      // there (Jez, 13 Oct 2026: identify and sign off are both a scan of the
      // pass, and an identity check must not sign anybody off). A free pass →
      // the sign-on form with this pass number.
      const passNo = parsePassQr(code);
      if (passNo && moduleOn('security')) {
        const holder = visitors.find((v) => !v.timeOut && samePass(v.passNo, passNo));
        if (!holder) {
          nav.replace('Main', { screen: 'Security', params: { view: 'gangway', pass: passNo } });
          return;
        }
        nav.replace('Main', { screen: 'Security', params: { view: 'gangway', visitor: holder.id } });
        return;
      }

      const match = lookupScan(code, flat);
      if (match.kind === 'item') {
        // Proof that the label was in front of the camera — what lets a crew
        // member sign on a vessel that requires a scan (services/signingPolicy).
        // A TYPED code is deliberately not proof: the manual field exists for a
        // damaged label, the one case the rule must not wave through.
        if (via === 'camera') recordScanProof(match.item.id, 'qr-camera');
        // Remember that this label was just scanned on this device — the Dashboard's
        // "Recently scanned" strip reads this trail. Fire-and-forget, and kept off
        // the item itself so it neither bumps updatedAt (which would reorder the
        // other lists) nor gets wiped by the very screen opened on the next line.
        void recordScan(match.item.id);
        // ItemDetail is keyed by {category, id}; the category came back from the
        // register, not from the sticker.
        nav.replace('ItemDetail', { category: match.category, id: match.item.id });
        return;
      }
      setResult(match);
    },
    [flat, nav, recordScan, crew, crewMoves, appendRow, visitors, saveRow, sync.me, passengers, storeRoomList, sopepLockerList, quick, quickPass]
  );

  const again = () => {
    locked.current = false;
    setResult(null);
    setManual('');
  };

  const submitManual = () => {
    const code = manual.trim();
    if (code) handle(code, 'typed');
  };

  const cameraReady = HAS_CAMERA && wantCamera && permission?.granted && !result;

  /**
   * Web only: the user has asked for the camera, so now we may go and get it —
   * but ASK THE MACHINE FIRST whether it has one.
   *
   * A browser handed a camera request it cannot satisfy does not fail: it sits in
   * a "connecting a device" state indefinitely, and on Opera that is worded as
   * waiting for a scanner to be plugged in. The page looks stuck and nothing ever
   * says why. `enumerateDevices` answers without any prompt, so a machine with no
   * camera is told so in one line instead of being left waiting.
   */
  const useCamera = async () => {
    setCamError(null);
    if (Platform.OS === 'web') {
      const md: any = (globalThis as any).navigator?.mediaDevices;
      if (!md?.getUserMedia) {
        setCamError(t('scn.noBrowserCam'));
        return;
      }
      try {
        const devices = await md.enumerateDevices?.();
        // An empty list means the browser is withholding it until permission is
        // granted, which is not the same as "no camera" — only a populated list
        // with no video input is proof there is nothing to open.
        if (Array.isArray(devices) && devices.length && !devices.some((d: any) => d.kind === 'videoinput')) {
          setCamError(t('scn.noCamConnected'));
          return;
        }
      } catch {
        /* enumerateDevices is not essential — fall through and just ask */
      }
    }
    setWantCamera(true);
    try {
      const res = await requestPermission();
      if (res && !res.granted) {
        setCamError(
          res.canAskAgain === false
            ? t('scn.camBlocked')
            : t('scn.camRefused')
        );
        setWantCamera(false);
      }
    } catch {
      setCamError(t('scn.camFailed'));
      setWantCamera(false);
    }
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <ScreenTitle title={atGangway ? t('scn.gangwayTitle') : t('scn.title')} subtitle={atGangway ? t('scn.gangwaySub') : t('scn.sub')} />
        </View>
      </View>

      {!HAS_CAMERA ? (
        <Card>
          <Label>{t('scn.noCamHere')}</Label>
          <Text style={styles.note}>
            {t('scn.noCamBody')}
          </Text>
        </Card>
      ) : !wantCamera ? (
        <Card>
          <Label>{t('pick.camera')}</Label>
          <Text style={styles.note}>
            {camError ??
              t('scn.deskCam')}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void useCamera()}>
            <Text style={styles.primaryBtnText}>{camError ? t('scn.tryAgain') : t('scn.useCam')}</Text>
          </TouchableOpacity>
        </Card>
      ) : !permission ? null : !permission.granted ? (
        <Card>
          <Label>{t('scn.camAccess')}</Label>
          {/* THE ANSWER HAS ALREADY BEEN GIVEN — say so and move on.
              `canAskAgain === false` means the person said no and the system will
              not ask again. Repeating the offer here is the 5.1.1(iv) refusal in
              its other form: on the web it was at least actionable (a browser's
              site permissions live in the address bar), but on a phone the only
              place to change it is the Settings app, and sending anyone there is
              what got build 20304 rejected. So on native this card stops being a
              request and becomes a signpost to the box below, which needs no
              camera and runs the identical lookup. */}
          <Text style={styles.note}>
            {permission.canAskAgain === false
              ? Platform.OS === 'web'
                ? t('scn.browserBlocked')
                : t('scn.camOff')
              : t('scn.needCam')}
          </Text>
          {/* "Continue", NOT "Allow camera". App Review reads a custom screen whose
              button uses the system dialog's own verb as pressuring the user
              towards one answer, and rejected build 20302 under 5.1.1(iv) for it.
              The card may explain WHY the camera is wanted; the choice itself
              belongs to the system prompt, so this button only gets us there —
              and only while the system will still show it. */}
          {permission.canAskAgain === false ? null : (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void requestPermission()}>
              <Text style={styles.primaryBtnText}>{t('cs.continue')}</Text>
            </TouchableOpacity>
          )}
        </Card>
      ) : null}

      {quickAllowed && HAS_CAMERA ? (
        <Card style={quick ? { borderLeftWidth: 6, borderLeftColor: COLORS.success } : undefined}>
          <View style={styles.quickHead}>
            <View style={{ flex: 1 }}>
              <Label>{t('qp.title')}</Label>
              <Text style={styles.note}>{quick ? t('qp.onBody', { who: quickSig.current?.signer.name ?? '' }) : t('qp.offBody')}</Text>
            </View>
            <Switch value={quick} onValueChange={(v) => (v ? void startQuick() : stopQuick())} />
          </View>
          <View style={styles.periodRow}>
            {QUICK_PERIODS.map((p) => (
              <TouchableOpacity key={p} style={[styles.periodBtn, p === quickPeriod && styles.periodBtnOn]} onPress={() => setQuickPeriod(p)}>
                <Text style={[styles.periodText, p === quickPeriod && { color: COLORS.textWhite }]}>{tk(`period.${p}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {quick ? <Text style={styles.quickCount}>{t('qp.count', { n: quickCount })}</Text> : null}
        </Card>
      ) : null}

      {cameraReady ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: SCAN_BARCODE_TYPES }}
            onBarcodeScanned={({ data }) => handle(data, 'camera')}
          />
          <View style={styles.reticle} pointerEvents="none" />
        </View>
      ) : null}

      {quick && quickRows.length ? (
        <Card>
          {quickRows.map((r) => (
            <TouchableOpacity
              key={r.key}
              disabled={!r.itemId}
              style={styles.quickRow}
              onPress={() => r.itemId && nav.navigate('Inspection', { itemId: r.itemId, period: quickPeriod })}
            >
              <MciIcon name={r.ok ? 'check-circle' : 'alert-circle'} size={20} color={r.ok ? COLORS.success : COLORS.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.quickTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={[styles.note, { paddingTop: 0 }]}>{r.text}</Text>
              </View>
              {r.itemId ? (
                r.ok ? <Text style={styles.quickDefect}>{t('qp.defect')}</Text> : <MciIcon name="chevron-right" size={20} color={COLORS.textLight} />
              ) : null}
            </TouchableOpacity>
          ))}
          <Text style={styles.note}>{t('qp.defectHint')}</Text>
        </Card>
      ) : null}

      {crewHit ? (
        <Card style={{ borderLeftWidth: 6, borderLeftColor: crewHit.ok ? COLORS.success : COLORS.danger }}>
          <Label>{t('pax.gangway')}</Label>
          <Text style={{ fontSize: SIZES.h3, fontWeight: '900', color: COLORS.textDark }}>{crewHit.name}</Text>
          <Text style={{ fontSize: SIZES.h4, fontWeight: '800', color: crewHit.ok ? COLORS.success : COLORS.danger, marginTop: 4 }}>{crewHit.text}</Text>
          <Text style={styles.note}>{t('scn.ready')}</Text>
        </Card>
      ) : null}

      {result?.kind === 'stale' ? (
        <Card>
          <Label>{t('scn.staleTitle')}</Label>
          <Text style={styles.note}>
            {t('scn.staleBody')}
          </Text>
          <Text style={styles.code}>{result.itemId}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={again}>
            <Text style={styles.secondaryBtnText}>{t('scn.again')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {result?.kind === 'unknown' ? (
        <Card>
          <Label>{t('scn.unknownTitle')}</Label>
          <Text style={styles.note}>
            {t('scn.unknownBody')}
          </Text>
          <Text style={styles.code}>{result.code}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={again}>
            <Text style={styles.secondaryBtnText}>{t('scn.again')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {!result ? (
        <Card>
          <Label>{t('scn.orType')}</Label>
          <Text style={styles.note}>
            {t('scn.orTypeBody')}
          </Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.input}
              value={manual}
              onChangeText={setManual}
              placeholder={t('scn.serialPh')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={submitManual}
            />
            <TouchableOpacity
              style={[styles.goBtn, !manual.trim() && { opacity: 0.4 }]}
              disabled={!manual.trim()}
              onPress={submitManual}
            >
              <MciIcon name="magnify" size={20} color={COLORS.textWhite} />
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}
      <SignerPicker
        visible={pickingSigner}
        crew={activeCrew}
        title={t('sign.who')}
        onSelect={(id) => {
          setPickingSigner(false);
          void startQuick(id);
        }}
        onClose={() => setPickingSigner(false)}
      />
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'flex-start' },
    quickHead: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    quickCount: { color: COLORS.success, fontWeight: '800', fontSize: SIZES.h5, paddingTop: SIZES.sm },
    quickRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.xs },
    quickTitle: { color: COLORS.textDark, fontWeight: '700', fontSize: SIZES.body },
    quickDefect: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small },
    periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, paddingTop: SIZES.sm },
    periodBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    periodBtnOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    periodText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.small },
    cameraBox: {
      height: 320,
      borderRadius: SIZES.radiusLg,
      overflow: 'hidden',
      backgroundColor: '#000',
      marginBottom: SIZES.md,
    },
    reticle: {
      position: 'absolute',
      top: '18%',
      left: '18%',
      right: '18%',
      bottom: '18%',
      borderWidth: 2,
      borderColor: COLORS.textWhite,
      borderRadius: SIZES.radiusMd,
      opacity: 0.9,
    },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    code: {
      color: COLORS.text,
      fontSize: SIZES.body,
      fontWeight: '700',
      paddingTop: SIZES.sm,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    manualRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingTop: SIZES.md },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      color: COLORS.text,
      backgroundColor: COLORS.card,
    },
    goBtn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, padding: SIZES.md },
    primaryBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.lg,
      alignItems: 'center',
      marginTop: SIZES.md,
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
      marginTop: SIZES.sm,
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: '700' },
  });
