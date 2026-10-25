// ===================================
// The Master's verification on a record book's screen (services/verification,
// 25 Oct 2026) — shared by the Oil Record Book, Garbage, Sewage and Ballast.
//
//   useVerification(...) → { stage(entry), section, note(what) }
//     stage     the entry's lines under it: "Awaiting verification" (amber),
//               "Amended — verify again" (amber), "Verified 25 Oct 14:05" (green);
//               and its seal (services/seal) — "Sealed · key 3F2A-…", or in red
//               when the entry no longer says what was signed
//     section   the Master's block at the foot: every signature of the month,
//               "Verify N entries" while any wait — the Master signs THOSE
//               versions, so an amendment made later waits for its own; the
//               seals and the chain checked; the Master's signed copy and
//               "Check a copy"; who opened and exported the month
//     note      a screen's PDF / Excel export, for the access log
// Opening the month is noted here (services/bookAccess, once per 30 minutes).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { Label } from './ui';
import type { Signer } from './SignerChoice';
import { useSignConfirm, withSeal } from './SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { MonthVerification, VerifiableEntry, awaiting, entryStatus, monthIntegrity, monthSigns, verificationId, verifiedBy, verifiedIds, withEarlier } from '../services/verification';
import { Integrity, SignKeyRec, coverHashes, sealBad, sealOf } from '../services/seal';
import { AccessWhat, BookAccess, BookKey, OPEN_EVERY_MS, accessFor, openIsNew } from '../services/bookAccess';
import { keysFor } from '../services/signedCopy';
import type { TrueCopy } from '../services/trueCopy';
import * as storage from '../services/storage';
import * as fb from '../services/firebaseService';
import { deliverSignedCopy, pickAndCheckCopy } from '../utils/signedCopyFile';
import { uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { t, tn } from '../utils/i18n';
import { playSuccessSound } from '../utils/sound';

/** When this device last noted a month opened — kept while the app is open. */
const lastOpen = new Map<string, number>();

interface Args<E extends VerifiableEntry, S extends MonthVerification> {
  /** Every version of every entry of the book. */
  all: E[];
  /** The page: current versions of the month. */
  book: E[];
  signs: S[];
  month: string;
  /** Id prefix of the book's signatures, and the book in the access log: `orb`, `grb`, `sewage`, `ballast`. */
  prefix: BookKey;
  /** "Oil Record Book" — for the signature dialog. */
  what: string;
  isMaster: boolean;
  /** The screen's signer and its picker (components/SignerChoice) — one choice for the whole screen. */
  signer: Signer | null;
  picker: React.ReactNode;
  save: (s: MonthVerification) => Promise<unknown>;
  /** The month's true copy (the book's report) — the PDF of the Master's signed copy. */
  copy: () => { copy: TrueCopy; name: string };
}

export function useVerification<E extends VerifiableEntry, S extends MonthVerification>(a: Args<E, S>) {
  const COLORS = useTheme();
  const confirmSign = useSignConfirm();
  const { appendRow, signKeys, bookAccess, vessel } = useData();
  const { signer, picker } = a;
  const ids = useMemo(() => verifiedIds(a.all, a.signs), [a.all, a.signs]);
  const waiting = useMemo(() => awaiting(a.book, ids), [a.book, ids]);
  const mine = monthSigns(a.signs, a.month);
  const [showLog, setShowLog] = useState(false);
  const log = useMemo(() => accessFor(bookAccess, a.prefix, a.month), [bookAccess, a.prefix, a.month]);

  // Checking the seals is ~0.1 s each on a phone: after the first paint, not in it.
  const [it, setIt] = useState<Integrity | null>(null);
  useEffect(() => {
    const h = setTimeout(() => setIt(monthIntegrity(a.book, a.all, a.signs, a.month)), 0);
    return () => clearTimeout(h);
  }, [a.book, a.all, a.signs, a.month, signKeys]);

  const note = async (what: AccessWhat) => {
    const deviceId = await fb.getLocalDeviceId().catch(() => undefined);
    const now = Date.now();
    if (what === 'open') {
      // The list in hand may not hold the line written a moment ago (a remount, React's double effect in development).
      const k = `${a.prefix}:${a.month}`;
      if (now - (lastOpen.get(k) ?? 0) < OPEN_EVERY_MS) return;
      lastOpen.set(k, now);
      // Read from storage, not the context: on a fresh load the screen opens before the lists are in.
      if (!openIsNew(await storage.loadList<BookAccess>(storage.BOOK_ACCESS_KEY), a.prefix, a.month, deviceId, now)) return;
    }
    const row: BookAccess = { id: uid('acc'), book: a.prefix, month: a.month, what, ...(signer ? { by: signer.rank ? `${signer.name} (${signer.rank})` : signer.name, byId: signer.key } : {}), ...(deviceId ? { deviceId } : {}), at: now, updatedAt: now };
    await appendRow(storage.BOOK_ACCESS_KEY, row).catch(() => {});
  };
  // The month opened (and each other month turned to).
  useEffect(() => {
    void note('open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.prefix, a.month]);

  const stage = (e: E) => {
    const st = entryStatus(e, a.all, ids);
    const s = st === 'verified' ? verifiedBy(e, a.signs) : undefined;
    const text = st === 'verified' ? t('book.st.verified', { when: s ? uiDateTime(s.at) : '' }) : st === 'reverify' ? t('book.st.reverify') : t('book.st.pending');
    const seal = it?.state.get(e.id);
    const key = sealOf(e as any)?.key ?? '';
    // What the Master verified is not what the entry says now: never green.
    const color = seal && sealBad(seal) ? COLORS.danger : st === 'verified' ? COLORS.success : COLORS.warning;
    return (
      <>
        <Text style={{ fontSize: SIZES.small, fontWeight: '700', marginTop: 2, color }}>{text}</Text>
        {seal && seal !== 'none' ? (
          <Text style={{ fontSize: SIZES.tiny, fontWeight: sealBad(seal) ? '800' : '600', marginTop: 1, color: sealBad(seal) ? COLORS.danger : COLORS.textLight }}>
            {seal === 'valid' ? t('book.seal.valid', { key }) : seal === 'device' ? t('book.seal.device', { key }) : t(`book.seal.${seal}`)}
          </Text>
        ) : null}
        {it?.gaps.includes(e.id) ? <Text style={{ fontSize: SIZES.tiny, fontWeight: '800', marginTop: 1, color: COLORS.danger }}>{t('book.seal.gap')}</Text> : null}
      </>
    );
  };

  const verify = async () => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    if (!waiting.length) return;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Master's verification — ${a.what}, ${a.month}: ${waiting.length} ${waiting.length === 1 ? 'entry' : 'entries'}` });
    if (!sig) return;
    const now = Date.now();
    const covers = waiting.map((e) => e.id);
    // The verification seals the hashes of the very versions it covers (services/seal).
    await a.save(
      withSeal(
        {
          id: verificationId(a.prefix, a.month, a.signs, now),
          month: a.month,
          by: signer.name,
          ...(signer.rank ? { byRank: signer.rank } : {}),
          byId: signer.key,
          at: now,
          ...(sig.proof ? { signedWith: sig.proof } : {}),
          covers,
          coverHashes: coverHashes(covers, a.all),
          updatedAt: now,
        },
        sig,
      ),
    );
    playSuccessSound();
  };

  // The Master's signed copy of the month (services/signedCopy, MEPC.312 §4.4.3–4.4.4).
  const signedCopy = async () => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Master's signed copy — ${a.what}, ${a.month}` });
    if (!sig) return;
    if (!sig.key || sig.key.kind !== 'person') return Alert.alert(t('book.copy'), t('book.copyNoKey'));
    try {
      const now = Date.now();
      const entries = withEarlier(a.book, a.all).map((x) => x.r);
      const verifications = monthSigns(a.signs, a.month);
      // The keys of every seal in the copy, and the Master's own — just made, it may not be in the register held here yet.
      const keys = keysFor([...entries, ...verifications], signKeys);
      if (!keys.some((k) => k.id === sig.key!.id)) {
        const own: SignKeyRec = signKeys.find((k) => k.id === sig.key!.id) ?? { id: sig.key.id, person: signer.key, name: signer.name, kind: 'person', pub: sig.key.pub, at: now, updatedAt: now };
        keys.push(own);
      }
      const c = a.copy();
      const w = await deliverSignedCopy(
        c,
        { entries, verifications, keys, access: log },
        {
          book: a.prefix,
          title: c.copy.title,
          month: a.month,
          vessel: { ...(vessel?.vessel_name ? { name: vessel.vessel_name } : {}), ...(vessel?.imo ? { imo: vessel.imo } : {}) },
          exportedAt: now,
          master: { name: signer.name, ...(signer.rank ? { rank: signer.rank } : {}), id: signer.key, key: sig.key.id },
        },
        (m) => sig.key!.seal(m),
      );
      void note('copy');
      playSuccessSound();
      if (typeof w === 'string') Alert.alert(t('book.copy'), w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('book.copy'), String(e?.message ?? e));
    }
  };

  const checkACopy = async () => {
    try {
      const r = await pickAndCheckCopy();
      if (!r) return;
      const m = r.manifest;
      Alert.alert(
        t('book.checkCopy'),
        r.ok && m
          ? t('book.copyOk', { title: m.title, by: m.master.rank ? `${m.master.name} (${m.master.rank})` : m.master.name, when: uiDateTime(m.exportedAt), key: m.master.key, x: tn('n.entry', r.integrity ? r.integrity.sealed + r.integrity.unsealed : 0) })
          : `${t('book.copyBad')}\n\n${r.problems.join('\n')}`,
      );
    } catch (e: any) {
      Alert.alert(t('book.checkCopy'), String(e?.message ?? e));
    }
  };

  const linkStyle = { alignSelf: 'flex-start' as const, borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md, marginTop: SIZES.xs };
  const total = it ? it.sealed + it.unsealed : 0;
  const problems = it ? it.bad.length + it.gaps.length + it.badVerifications.length : 0;

  const section = (
    <View>
      <Label>{t('book.master')}</Label>
      {mine.map((s) => (
        <Text key={s.id} style={{ fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600', marginBottom: 2 }}>
          {`${t('book.verifiedBy', { by: s.byRank ? `${s.by} (${s.byRank})` : s.by, x: s.covers ? tn('n.entry', s.covers.length) : t('book.allBefore') })} · ${uiDateTime(s.at)}`}
        </Text>
      ))}
      {waiting.length ? (
        a.isMaster ? (
          <TouchableOpacity style={linkStyle} onPress={() => void verify()}>
            <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{t('book.verifyX', { x: tn('n.entry', waiting.length) })}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ fontSize: SIZES.small, color: COLORS.warning, fontWeight: '700' }}>{t('book.awaitingX', { x: tn('n.entry', waiting.length) })}</Text>
        )
      ) : a.book.length ? (
        <Text style={{ fontSize: SIZES.small, color: COLORS.success, fontWeight: '700' }}>{t('book.allVerified')}</Text>
      ) : null}
      {a.isMaster && waiting.length && !signer ? picker : null}

      {/* The seals and the chain (services/seal). */}
      {it && it.sealed ? (
        <Text style={{ fontSize: SIZES.small, marginTop: SIZES.sm, fontWeight: '700', color: problems ? COLORS.danger : COLORS.success }}>
          {problems
            ? [it.bad.length ? t('book.int.bad', { x: tn('n.entry', it.bad.length) }) : null, it.gaps.length ? t('book.int.gap') : null, it.badVerifications.length ? t('book.int.badVer') : null].filter(Boolean).join(' · ')
            : t('book.int.ok', { n: it.sealed, total })}
        </Text>
      ) : null}

      {a.isMaster ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.xs }}>
          {a.book.length ? (
            <TouchableOpacity style={linkStyle} onPress={() => void signedCopy()}>
              <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{t('book.copy')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={linkStyle} onPress={() => void checkACopy()}>
            <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{t('book.checkCopy')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {a.isMaster && !signer && !waiting.length && a.book.length ? picker : null}

      {/* Who opened and exported the month (services/bookAccess). */}
      {a.isMaster && log.length ? (
        <>
          <TouchableOpacity onPress={() => setShowLog((v) => !v)} hitSlop={8} style={{ marginTop: SIZES.sm }}>
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small }}>{`${t('book.access', { n: log.length })} ${showLog ? '↑' : '↓'}`}</Text>
          </TouchableOpacity>
          {showLog
            ? log.slice(0, 50).map((l) => (
                <Text key={l.id} style={{ fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 }}>
                  {`${uiDateTime(l.at)} · ${l.by || t('book.accUnnamed')} · ${t(`book.acc.${l.what}`)}`}
                </Text>
              ))
            : null}
        </>
      ) : null}
    </View>
  );

  return { stage, section, waiting, note };
}
