// ===================================
// Live sync — the vessel's register and inspection trail, kept in step across
// every approved device without anybody pressing a button.
//
// Modelled on DEM/NSeaStoreManager's SyncContext (`/Users/DEM`), with its two
// hard-won fixes kept:
//
//   1. **Forced re-push on start and on foreground.** Firestore's offline write
//      queue does NOT survive the process being killed. An officer who signs an
//      inspection at sea, locks the phone and has iOS reap the app has a record
//      that exists locally and nowhere else. Pushing unconditionally when the
//      app comes up closes that hole; it is cheap, because the push is skipped
//      when nothing changed.
//   2. **A size guard on the register blob.** Firestore caps a document at
//      1 MiB and the register only grows.
//
// What is deliberately DIFFERENT from DEM: DEM syncs one person's own devices,
// so whole-document last-write-wins is fine there. A vessel is several people at
// once, so the inspection trail is not in the blob — it is one document per
// signed record (see services/firebaseService.ts), and those cannot collide.
//
// Auto-connect: if the vessel has an IMO and this device has the connection
// password saved, sync signs in by itself at launch. Anything that fails here —
// no config, no password, no signal, device not yet approved — leaves the app
// exactly as it was: local-first, fully usable, no error in the user's face.
// ===================================

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import * as fb from '../services/firebaseService';
import * as storage from '../services/storage';
import { mergeCategories, mergeCrew, mergeInspections, mergeTemplates } from '../services/inspections';
import * as photoQueue from '../services/photoQueue';
import * as enrolment from '../services/enrolment';
import * as trial from '../services/trial';
import { revalidateLicence } from '../services/purchases';
import { Role } from '../types/role';
import { useData } from './DataContext';

export type SyncStatus = 'off' | 'connecting' | 'synced' | 'error' | 'pending';

interface SyncContextType {
  status: SyncStatus;
  /** This device's role once it holds a token — null until then. */
  role: Role | null;
  /** Has this device ever enrolled (i.e. does it hold a device secret)? */
  enrolled: boolean;
  lastSyncAt: number | null;
  /** Size of the register blob, so Settings can show it before it is a problem. */
  registerBytes: number;
  /** Sign in + attach listeners now (Settings calls this after a manual connect). */
  connect: () => Promise<void>;
  /** Detach and stop syncing (used on sign-out / reset). */
  disconnect: () => void;
  /**
   * Why the last attempt failed, in the server's or the SDK's own words.
   *
   * The message existed all along — `refresh` returns it — and was thrown away,
   * so every failure looked identical from the outside: "Could not connect",
   * whatever the cause. A device refused for a real reason (switched off by the
   * Master, a wrong secret) and one that simply has no signal need different
   * things from the user, and only the message can tell them apart.
   */
  lastError: string | null;
  /**
   * Push what this device holds to the vessel NOW, and say whether it landed.
   *
   * For the one case where local must beat the cloud: restoring a `.msm`. The
   * restore replaces the register locally, but the vessel's copy is untouched,
   * and the listener re-applies it on the next launch — the restore then appears
   * to have been ignored, hours later and with nothing to connect it to. The
   * user asked for THIS data, so the vessel adopts it. Returns false when there
   * is no session to push through, so the caller can say the restore is local
   * only rather than implying the ship has it.
   */
  pushLocalNow: () => Promise<boolean>;
  /**
   * Change local data WITHOUT sending it to the vessel.
   *
   * For an officer rolling their own device back: they are repairing the handset
   * in front of them, not rewriting the ship's register. Without this the change
   * would go up by itself — any local edit schedules a push — and a private
   * recovery would silently become everyone's.
   *
   * The suppression covers the write and the render that follows it. It does not
   * and cannot make the change permanent against the vessel: the register is one
   * document and the vessel's copy is the shared truth, so the next sync
   * reconciles. That is the correct outcome, and the caller says so plainly.
   */
  applyLocally: (change: () => Promise<void>) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

/** How long a deliberate local restore outranks the vessel's copy. */
const REMOTE_HOLD_MS = 30_000;

/** Debounce local edits so a burst of typing is one write, not thirty. */
const PUSH_DEBOUNCE_MS = 1500;
/** How much of the trail the live listener holds open. */
const TRAIL_WINDOW_DAYS = 400;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { flat, certificates, vessel, compressor, inspections: trail, crew, prefs, reload } = useData();

  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [registerBytes, setRegisterBytes] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const uidRef = useRef<string | null>(null);
  const unsubs = useRef<Array<() => void>>([]);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What we last sent. Also what stops our own echo coming back as "news".
  const lastPushed = useRef<string | null>(null);
  /**
   * Until this moment, an incoming register is ignored because THIS device has
   * just been given data deliberately (a `.msm` restore). Long enough for the
   * write and its echo to settle, short enough that a device cannot drift.
   */
  const holdRemoteUntil = useRef(0);
  const applyingRemote = useRef(false);
  const warnedSize = useRef(false);

  // Held in a ref so the AppState listener and the pending poll always reach the
  // current `connect` without tearing themselves down on every render.
  const connectRef = useRef<(() => Promise<void>) | null>(null);

  const detach = useCallback(() => {
    unsubs.current.forEach((u) => {
      try { u(); } catch { /* already gone */ }
    });
    unsubs.current = [];
  }, []);

  const pushNow = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || applyingRemote.current) return;
    try {
      const n = await fb.pushAll(uid);
      setLastSyncAt(Date.now());
      setStatus('synced');
      return n;
    } catch (e: any) {
      // This was the silent one. `refresh` records why it failed and so does the
      // catch around connect, but a failing WRITE only set the status — so the
      // card said "Could not connect" while the session was fine and it was the
      // register push being refused. Every path to 'error' now carries its
      // reason, or the card is a light with no label on it.
      let msg = e?.message ?? String(e);
      // The refusal we actually expect: the token was issued for one vessel and
      // the app is writing to another, because the IMO was changed after this
      // device enrolled. "Missing or insufficient permissions" tells nobody
      // that; the two numbers side by side tell them exactly what to do.
      if (/permission/i.test(msg)) {
        const claimed = await fb.claimedVessel();
        if (claimed && uid && claimed !== uid) {
          msg =
            `This device is enrolled on vessel ${claimed}, but the app is set to ${uid}. ` +
            `Set the IMO back to ${claimed}, or join ${uid} again from Settings → Vessel → This device.`;
        }
      }
      console.warn('[sync] push failed:', msg);
      setLastError(msg);
      setStatus('error');
    }
  }, []);

  /** See `pushLocalNow` in SyncContextType — local deliberately beats the cloud. */
  const pushLocalNow = useCallback(async (): Promise<boolean> => {
    if (!uidRef.current) return false;
    // Shut the incoming door FIRST. Restoring a backup and syncing are a genuine
    // race: the restore rewrites the register locally while the listener is live,
    // so a snapshot arriving in that second — including the echo of our own push
    // — would pull the vessel's old register straight back over it. Whoever won
    // was down to timing, which is no way to decide whose data survives. For this
    // window local is simply authoritative.
    holdRemoteUntil.current = Date.now() + REMOTE_HOLD_MS;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    lastPushed.current = null;
    // A pull may be halfway through. Let it finish rather than pushing underneath
    // it, or we would write a register we are about to overwrite ourselves.
    for (let i = 0; applyingRemote.current && i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const n = await pushNow();
    if (n === undefined) {
      holdRemoteUntil.current = 0; // push failed — do not keep the vessel out
      return false;
    }
    return true;
  }, [pushNow]);

  /** See `applyLocally` in SyncContextType. */
  const applyLocally = useCallback(async (change: () => Promise<void>) => {
    applyingRemote.current = true;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    try {
      await change();
    } finally {
      // Held past the render the change triggers: the push effect runs after
      // state settles, and releasing on the same tick would let it through —
      // which is the whole thing this exists to prevent.
      setTimeout(() => {
        applyingRemote.current = false;
      }, 2500);
    }
  }, []);

  const schedulePush = useCallback((immediate = false) => {
    if (!uidRef.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void pushNow(), immediate ? 0 : PUSH_DEBOUNCE_MS);
  }, [pushNow]);

  /** Attach the three listeners. Remote changes land in storage, then reload(). */
  const attach = useCallback(
    (uid: string) => {
      detach();
      const since = Date.now() - TRAIL_WINDOW_DAYS * 86_400_000;

      unsubs.current.push(
        fb.subscribeRegister(uid, async (snap) => {
          if (!snap.json || snap.json === lastPushed.current) return;
          if (Date.now() < holdRemoteUntil.current) {
            // A restore is landing. Keeping what the user just chose is the whole
            // point; the push that follows makes the vessel agree.
            console.warn('[sync] ignoring an incoming register — a local restore holds priority');
            return;
          }
          setRegisterBytes(snap.json.length);
          if (snap.json.length > 700 * 1024 && !warnedSize.current) {
            warnedSize.current = true;
            console.warn('[sync] register blob is approaching Firestore\'s 1 MiB document cap.');
          }
          // Our own write, echoed back — nothing to apply.
          if (snap.deviceId && snap.deviceId === (await fb.getLocalDeviceId())) return;
          applyingRemote.current = true;
          try {
            await fb.pullAll(uid);
            lastPushed.current = snap.json;
            await reload();
            setLastSyncAt(Date.now());
            setStatus('synced');
          } catch (e: any) {
            const msg = e?.message ?? String(e);
            console.warn('[sync] applying remote register failed:', msg);
            setLastError(msg);
          } finally {
            applyingRemote.current = false;
          }
        })
      );

      unsubs.current.push(
        fb.subscribeInspections(uid, since, async (rows) => {
          if (!rows.length) return;
          const merged = mergeInspections(await storage.loadInspections(), rows);
          await storage.saveInspections(merged);
          applyingRemote.current = true;
          try { await reload(); } finally { applyingRemote.current = false; }
        })
      );

      unsubs.current.push(
        fb.subscribeCrew(uid, async (rows) => {
          if (!rows.length) return;
          await storage.saveCrew(mergeCrew(await storage.loadCrew(), rows));
          applyingRemote.current = true;
          try { await reload(); } finally { applyingRemote.current = false; }
        })
      );

      // Categories BEFORE anything that reads the register: a heading that has not
      // arrived yet means a bucket nothing enumerates, and items that exist in
      // storage but appear nowhere on screen.
      unsubs.current.push(
        fb.subscribeCategories(uid, async (rows) => {
          if (!rows.length) return;
          await storage.saveVesselCategories(
            mergeCategories(await storage.loadVesselCategories(), rows)
          );
          applyingRemote.current = true;
          try { await reload(); } finally { applyingRemote.current = false; }
        })
      );

      unsubs.current.push(
        fb.subscribeTemplates(uid, async (rows) => {
          if (!rows.length) return;
          await storage.saveTemplates(mergeTemplates(await storage.loadTemplates(), rows));
          applyingRemote.current = true;
          try { await reload(); } finally { applyingRemote.current = false; }
        })
      );
    },
    [detach, reload]
  );

  const connect = useCallback(async () => {
    if (!fb.syncSupported() || !fb.isConfigured()) {
      setStatus('off');
      return;
    }
    const imo = vessel?.imo?.trim();
    if (!imo) {
      setStatus('off');
      return;
    }

    setStatus('connecting');
    try {
      // ---- enrolled devices: ask the server for a token -------------------
      //
      // This runs on EVERY launch, not only the first, and that is the point.
      // Claims are baked into a token when it is minted, so a device that was
      // left pending cannot notice it has been approved, and a promotion cannot
      // reach a device, except by minting a new one. `refresh` is that call, and
      // it needs no PIN — only the secret issued at enrolment.
      const secret = await fb.getDeviceSecret();
      setEnrolled(!!secret);
      // Show the rank we last knew while the network is being asked. Without
      // this a launch with no signal renders the whole app as "rank unknown"
      // until (or unless) the call comes back.
      if (secret) {
        const known = await fb.getKnownRole();
        if (known) setRole(known as Role);
      }
      if (secret) {
        const res = await enrolment.refresh(imo);
        if (res.status === 'pending') {
          uidRef.current = null;
          setRole(res.role);
          void fb.saveKnownRole(res.role);
          setStatus('pending');
          return;
        }
        if (res.status === 'ok') {
          setRole(res.role);
          setLastError(null);
          void fb.saveKnownRole(res.role);
          // The register is keyed by the vessel's IMO under the new model, not
          // by a Firebase uid — the token says which vessel this device may
          // touch, and firestore.rules checks that claim.
          uidRef.current = imo.replace(/\D/g, '');
          attach(uidRef.current);
          // Mirror the trial start to the vessel. On Android the local stamp is
          // wiped by an uninstall, so this account copy is the only thing that
          // stops a reinstall handing out a fresh 60 days — and the trial belongs
          // to the ship now, not to the handset. Best-effort: a failure here must
          // never stop the device syncing.
          void trial.syncTrialWithAccount(uidRef.current).catch(() => {});
          await pushNow();
          return;
        }
        // 'reenrol' — the vessel does not know this device any more (a Master
        // removed it, or the register was reset). The stale secret has to go, or
        // `enrolled` stays true, the join screen keeps showing an identity that
        // no longer exists, and the connection card offers "Try again" for a
        // thing that will never succeed. Clearing it puts "Join this vessel"
        // back in front of the user, which is the only move left.
        if (res.status === 'reenrol') {
          await fb.signOutDevice().catch(() => {});
          setEnrolled(false);
          setRole(null);
          setLastError('This device is no longer on the vessel. Join it again to sync.');
        }

        if (res.status === 'refused') {
          console.warn('[sync] refused:', res.message);
          setLastError(res.message);
        }
        setStatus(res.status === 'reenrol' ? 'off' : 'error');
        return;
      }

      // No device secret — this device has never joined the vessel. There is
      // nothing to fall back on: the shared-connection-password path was removed
      // in Sep 2026. It keyed the register by the Firebase uid, and since
      // enrolment that uid is per-device (`<imo>__<deviceId>`), so a device that
      // fell through wrote the vessel's register to
      // `safety_vessels/9876543__dev_x` beside the real `safety_vessels/9876543`
      // — one vessel, two registers, neither complete. Settings → Join this
      // vessel is the only way in.
      setStatus('off');
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn('[sync] connect failed:', msg);
      setLastError(msg);
      setStatus('error');
    }
  }, [vessel?.imo, attach, pushNow]);

  /**
   * Leave the vessel. Called by Sign off, and by nothing else.
   *
   * `enrolled` has to go with it. It mirrors "this device holds a secret", which
   * sign-off has just destroyed — and it is what the screens read to decide
   * whether they are looking at a device aboard a ship. Left standing, the join
   * screen went on showing the identity of a device that had just left, and
   * Settings went on hiding the controls a standalone device is entitled to,
   * until the app was restarted and the secret re-read from disk. State that
   * mirrors storage must be corrected by whoever changes the storage.
   */
  const disconnect = useCallback(() => {
    detach();
    uidRef.current = null;
    lastPushed.current = null;
    setRole(null);
    setEnrolled(false);
    setLastError(null);
    setLastSyncAt(null);
    setStatus('off');
  }, [detach]);

  connectRef.current = connect;

  // Connect once the vessel's IMO is known (it arrives with the first data load).
  useEffect(() => {
    if (vessel?.imo) void connect();
    return detach;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vessel?.imo]);

  // Local edits → debounced push. Skipped while we are applying a remote change,
  // or every incoming update would bounce straight back out again.
  //
  // THE TRAIL BELONGS IN HERE. It was watching the register, the certificates,
  // the vessel and the compressor — everything except the one thing the app
  // exists to record. Signing an inspection changes `inspections` and nothing
  // else, so the push was never scheduled: the record sat on the phone until the
  // next launch or until somebody happened to edit an item. On a round worked by
  // two officers on two phones that is the difference between "reaches the crew
  // in seconds" and "reaches them tomorrow".
  useEffect(() => {
    if (!uidRef.current || applyingRemote.current) return;
    schedulePush();
  }, [flat, certificates, vessel, compressor, trail, crew, schedulePush]);

  // Fix 1, second half: re-push when the app comes back to the foreground.
  //
  // The photo queue is drained on the same signal, and that is the right hook:
  // coming to the foreground is when the phone has just been picked up, which is
  // when it is most likely to have found the Wi-Fi in port. The queue decides for
  // itself whether the connection is worth spending — see services/photoQueue.ts
  // — so calling it here costs nothing at sea.
  useEffect(() => {
    const drainPhotos = () => {
      void photoQueue.flush(prefs.photoUpload ?? 'wifi').catch(() => {});
    };
    // Confirm the yearly subscription is still live. Rate-limited to once a day
    // inside, and it refuses to revoke anything when LemonSqueezy is unreachable
    // — a ship at sea must not lose Pro for being at sea.
    const checkLicence = () => {
      void revalidateLicence().catch(() => {});
    };

    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (uidRef.current) {
        schedulePush(true);
      } else {
        // Not connected? Ask again. A device left waiting for approval has no
        // other way to find out it was let in: its claims are baked into a token
        // it does not have, so nothing arrives to tell it. Before this, the
        // officer whose Master had just approved them saw no change at all until
        // a full cold restart — and "reopen the app" is a poor thing to have to know.
        void connectRef.current?.();
      }
      checkLicence();
      drainPhotos();
    };

    checkLicence();
    drainPhotos(); // and once on mount, for the launch after a round at sea
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [schedulePush, prefs.photoUpload]);

  // While waiting, keep asking. One callable every 20s costs nothing and only
  // runs while the device is actually pending — approval usually happens with
  // both people standing together, and neither should have to restart anything.
  useEffect(() => {
    if (status !== 'pending') return;
    const t = setInterval(() => void connectRef.current?.(), 20_000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
  }, []);

  return (
    <SyncContext.Provider
      value={{ status, role, enrolled, lastSyncAt, registerBytes, connect, disconnect, pushLocalNow, applyLocally, lastError }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextType {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
