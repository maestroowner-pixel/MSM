// ===================================
// The Master's verification on a record book's screen (services/verification,
// 25 Oct 2026) — shared by the Oil Record Book, Garbage, Sewage, Ballast, Fuel oil changeover and ODS.
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
// Opening the month is noted here (services/bookAccess, once per 30 minutes), and
// so is a broken seal or chain, once per finding (MEPC.312 §4.1.2).
//
// 20 Nov 2026, for the flag's approval (erb-approval/ in the Oxford folder):
//   - the Master may HOLD BACK entries from a verification, with a reason, signed
//     with the same signature (BookNote, §4.3.10); the reason shows under the entry
//     and prints in the Master's column;
//   - each verification also makes the month's signed copy and keeps it on the
//     device without asking (utils/keptCopies, §4.4.2);
//   - anyone may print one entry, a run of months or the whole book as one true
//     copy (§6.3) — the screen's own PDF button stays the month.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Label } from './ui';
import { MonthPicker } from './MonthPicker';
import type { Signer } from './SignerChoice';
import { SignResult, useSignConfirm, withSeal } from './SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { BookNote, MonthVerification, VerifiableEntry, awaiting, entryStatus, monthIntegrity, monthSigns, noteFor, verificationId, verifiedBy, verifiedIds, withEarlier } from '../services/verification';
import { Integrity, SignKeyRec, coverHashes, sealBad, sealOf } from '../services/seal';
import { AccessWhat, BookAccess, BookKey, OPEN_EVERY_MS, accessFor, integrityDetail, integrityIsNew, openIsNew } from '../services/bookAccess';
import { keysFor } from '../services/signedCopy';
import { TrueCopy, bookTitle, joinCopies, monthsBetween, periodLabel } from '../services/trueCopy';
import * as storage from '../services/storage';
import * as fb from '../services/firebaseService';
import { buildSignedCopy, deliverSignedCopy, pickAndCheckCopy } from '../utils/signedCopyFile';
import { KeptCopy, keepCopy, keptCopies, shareKept } from '../utils/keptCopies';
import { deliverTrueCopy } from '../utils/trueCopyPdf';
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
  /** Id prefix of the book's signatures, and the book in the access log: `orb`, `grb`, `sewage`, `ballast`, `fuelChange`, `ods`. */
  prefix: BookKey;
  /** "Oil Record Book" — for the signature dialog. */
  what: string;
  isMaster: boolean;
  /** The screen's signer and its picker (components/SignerChoice) — one choice for the whole screen. */
  signer: Signer | null;
  picker: React.ReactNode;
  save: (s: MonthVerification) => Promise<unknown>;
  /**
   * A month's true copy (the book's report) — the PDF of the Master's signed copy, and the months of a longer
   * copy. `only`: just these entries; `signs`: the verifications to print (default: the screen's own).
   */
  copy: (month: string, o: { notes: BookNote[]; only?: string[]; signs?: MonthVerification[] }) => { copy: TrueCopy; name: string };
}

export function useVerification<E extends VerifiableEntry, S extends MonthVerification>(a: Args<E, S>) {
  const COLORS = useTheme();
  const confirmSign = useSignConfirm();
  const { appendRow, signKeys, bookAccess, bookNotes, vessel } = useData();
  const notes = useMemo(() => bookNotes.filter((n) => n.book === a.prefix), [bookNotes, a.prefix]);
  const { signer, picker } = a;
  const ids = useMemo(() => verifiedIds(a.all, a.signs), [a.all, a.signs]);
  const waiting = useMemo(() => awaiting(a.book, ids), [a.book, ids]);
  const mine = monthSigns(a.signs, a.month);
  const [showLog, setShowLog] = useState(false);
  const log = useMemo(() => accessFor(bookAccess, a.prefix, a.month), [bookAccess, a.prefix, a.month]);
  // Entries the Master holds back from the next verification, and why (§4.3.10).
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  useEffect(() => {
    setHeld(new Set());
    setReason('');
  }, [a.prefix, a.month]);
  const toVerify = waiting.filter((e) => !held.has(e.id));
  const holding = waiting.filter((e) => held.has(e.id));
  // A run of months for one true copy (§6.3).
  const bookMonths = useMemo(() => [...new Set(a.all.map((e) => e.date.slice(0, 7)))].sort(), [a.all]);
  const [from, setFrom] = useState(a.month);
  const [to, setTo] = useState(a.month);
  useEffect(() => {
    setFrom(a.month);
    setTo(a.month);
  }, [a.month]);
  // The signed copies this device keeps (utils/keptCopies) — the Master's.
  const [kept, setKept] = useState<KeptCopy[]>([]);
  const [showKept, setShowKept] = useState(false);
  const loadKept = () => {
    if (a.isMaster) keptCopies().then(setKept).catch(() => {});
  };
  useEffect(loadKept, [a.isMaster, a.month, a.prefix]);

  // Checking the seals is ~0.1 s each on a phone: after the first paint, not in it.
  const [it, setIt] = useState<Integrity | null>(null);
  useEffect(() => {
    const h = setTimeout(() => setIt(monthIntegrity(a.book, a.all, a.signs, a.month)), 0);
    return () => clearTimeout(h);
  }, [a.book, a.all, a.signs, a.month, signKeys]);

  const note = async (what: AccessWhat, detail?: string) => {
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
    if (what === 'integrity' && (!detail || !integrityIsNew(await storage.loadList<BookAccess>(storage.BOOK_ACCESS_KEY), a.prefix, a.month, detail))) return;
    const row: BookAccess = { id: uid('acc'), book: a.prefix, month: a.month, what, ...(signer ? { by: signer.rank ? `${signer.name} (${signer.rank})` : signer.name, byId: signer.key } : {}), ...(deviceId ? { deviceId } : {}), ...(detail ? { detail } : {}), at: now, updatedAt: now };
    await appendRow(storage.BOOK_ACCESS_KEY, row).catch(() => {});
  };
  // The month opened (and each other month turned to).
  useEffect(() => {
    void note('open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.prefix, a.month]);
  // A seal or the chain found broken goes into the log — the red line on screen is not a record of it.
  useEffect(() => {
    const d = it ? integrityDetail(it) : null;
    if (d) void note('integrity', d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it]);

  const stage = (e: E) => {
    const st = entryStatus(e, a.all, ids);
    const s = st === 'verified' ? verifiedBy(e, a.signs) : undefined;
    const text = st === 'verified' ? t('book.st.verified', { when: s ? uiDateTime(s.at) : '' }) : st === 'reverify' ? t('book.st.reverify') : t('book.st.pending');
    const seal = it?.state.get(e.id);
    const key = sealOf(e as any)?.key ?? '';
    // What the Master verified is not what the entry says now: never green.
    const color = seal && sealBad(seal) ? COLORS.danger : st === 'verified' ? COLORS.success : COLORS.warning;
    const n = st === 'verified' ? undefined : noteFor(e.id, notes);
    const waits = a.isMaster && waiting.some((w) => w.id === e.id);
    const isHeld = held.has(e.id);
    const small = { fontSize: SIZES.tiny, fontWeight: '700' as const, color: COLORS.primary };
    return (
      <>
        <Text style={{ fontSize: SIZES.small, fontWeight: '700', marginTop: 2, color }}>{text}</Text>
        {n ? <Text style={{ fontSize: SIZES.tiny, marginTop: 1, color: COLORS.warning }}>{t('book.note', { by: n.byRank ? `${n.by} (${n.byRank})` : n.by, when: uiDateTime(n.at), reason: n.reason })}</Text> : null}
        {seal && seal !== 'none' ? (
          <Text style={{ fontSize: SIZES.tiny, fontWeight: sealBad(seal) ? '800' : '600', marginTop: 1, color: sealBad(seal) ? COLORS.danger : COLORS.textLight }}>
            {seal === 'valid' ? t('book.seal.valid', { key }) : seal === 'device' ? t('book.seal.device', { key }) : t(`book.seal.${seal}`)}
          </Text>
        ) : null}
        {it?.gaps.includes(e.id) ? <Text style={{ fontSize: SIZES.tiny, fontWeight: '800', marginTop: 1, color: COLORS.danger }}>{t('book.seal.gap')}</Text> : null}
        <View style={{ flexDirection: 'row', gap: SIZES.md, marginTop: 2 }}>
          {waits ? (
            <TouchableOpacity hitSlop={8} onPress={() => setHeld((h) => { const x = new Set(h); if (x.has(e.id)) x.delete(e.id); else x.add(e.id); return x; })}>
              <Text style={{ ...small, color: isHeld ? COLORS.warning : COLORS.primary }}>{isHeld ? t('book.heldBack') : t('book.hold')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity hitSlop={8} onPress={() => void printEntry(e)}>
            <Text style={small}>{t('book.printEntry')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  /** The Master's signed copy of the month, with the verifications given — for the share sheet, or kept here. */
  const makeCopy = async (sig: SignResult, now: number, verifications: MonthVerification[], monthNotes: BookNote[]) => {
    if (!signer || !sig?.key || sig.key.kind !== 'person') throw new Error(t('book.copyNoKey'));
    const entries = withEarlier(a.book, a.all).map((x) => x.r);
    // The keys of every seal in the copy, and the Master's own — just made, it may not be in the register held here yet.
    const keys = keysFor([...entries, ...verifications, ...monthNotes], signKeys);
    if (!keys.some((k) => k.id === sig.key!.id)) {
      const own: SignKeyRec = signKeys.find((k) => k.id === sig.key!.id) ?? { id: sig.key.id, person: signer.key, name: signer.name, kind: 'person', pub: sig.key.pub, at: now, updatedAt: now };
      keys.push(own);
    }
    const c = a.copy(a.month, { notes: monthNotes, signs: verifications });
    const key = sig.key;
    return {
      c,
      records: { entries, verifications, keys, access: log, ...(monthNotes.length ? { notes: monthNotes } : {}) },
      manifest: {
        book: a.prefix,
        title: c.copy.title,
        month: a.month,
        vessel: { ...(vessel?.vessel_name ? { name: vessel.vessel_name } : {}), ...(vessel?.imo ? { imo: vessel.imo } : {}) },
        exportedAt: now,
        master: { name: signer.name, ...(signer.rank ? { rank: signer.rank } : {}), id: signer.key, key: key.id },
      },
      seal: (m: object) => key.seal(m),
    };
  };

  const verify = async () => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    if (!toVerify.length && !holding.length) return;
    if (holding.length && reason.trim().length < 3) return Alert.alert(t('book.master'), t('book.reasonNeeded'));
    const parts = [toVerify.length ? `verify ${toVerify.length} ${toVerify.length === 1 ? 'entry' : 'entries'}` : null, holding.length ? `hold back ${holding.length} with a reason` : null].filter(Boolean).join(', ');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Master's verification — ${a.what}, ${a.month}: ${parts}` });
    if (!sig) return;
    const now = Date.now();
    const by = { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), byId: signer.key };
    let v: MonthVerification | null = null;
    if (toVerify.length) {
      const covers = toVerify.map((e) => e.id);
      // The verification seals the hashes of the very versions it covers (services/seal).
      v = withSeal({ id: verificationId(a.prefix, a.month, a.signs, now), month: a.month, ...by, at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), covers, coverHashes: coverHashes(covers, a.all), updatedAt: now }, sig);
      await a.save(v);
    }
    let bn: BookNote | null = null;
    if (holding.length) {
      bn = withSeal({ id: uid('bnote'), book: a.prefix, month: a.month, entries: holding.map((e) => e.id), reason: reason.trim(), ...by, at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now }, sig);
      await appendRow(storage.BOOK_NOTES_KEY, bn);
    }
    setHeld(new Set());
    setReason('');
    playSuccessSound();
    // Every verification leaves the month's signed copy on this device (§4.4.2) — without asking.
    if (v && sig.key?.kind === 'person') {
      try {
        const m = await makeCopy(sig, now, [...monthSigns(a.signs, a.month), v], [...notes.filter((x) => x.month === a.month), ...(bn ? [bn] : [])]);
        const z = await buildSignedCopy(m.c, m.records, m.manifest, m.seal);
        await keepCopy(z.name, z.base64, now);
        loadKept();
      } catch (e: any) {
        Alert.alert(t('book.copy'), t('book.copyNotKept', { err: String(e?.message ?? e) }));
      }
    }
  };

  // The Master's signed copy of the month (services/signedCopy, MEPC.312 §4.4.3–4.4.4).
  const signedCopy = async () => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Master's signed copy — ${a.what}, ${a.month}` });
    if (!sig) return;
    if (!sig.key || sig.key.kind !== 'person') return Alert.alert(t('book.copy'), t('book.copyNoKey'));
    try {
      const now = Date.now();
      const m = await makeCopy(sig, now, monthSigns(a.signs, a.month), notes.filter((x) => x.month === a.month));
      const w = await deliverSignedCopy(m.c, m.records, m.manifest, m.seal);
      void note('copy');
      playSuccessSound();
      if (typeof w === 'string') Alert.alert(t('book.copy'), w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('book.copy'), String(e?.message ?? e));
    }
  };

  // ---- one true copy of one entry, a run of months, the whole book (§6.3) ----
  const handOver = async (c: TrueCopy, name: string) => {
    try {
      const w = await deliverTrueCopy(c, name.replace(/[\\/:*?"<>|·]+/g, ' ').replace(/\s+/g, ' ').trim());
      void note('pdf');
      if (typeof w === 'string') Alert.alert(t('book.period'), w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('book.period'), String(e?.message ?? e));
    }
  };
  const printEntry = async (e: E) => {
    // Only the verifications that speak of this entry — another entry's would read as this one's.
    const c = a.copy(e.date.slice(0, 7), { notes, only: [e.id], signs: a.signs.filter((x) => !x.covers || x.covers.includes(e.id)) }).copy;
    const day = `${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.${e.date.slice(0, 4)}`;
    await handOver({ ...c, title: `${bookTitle(c.title)} · entry of ${day}` }, `${bookTitle(c.title)} ${e.date} entry.pdf`);
  };
  const printMonths = async (months: string[]) => {
    if (!months.length) return;
    const parts = months.map((m) => ({ month: m, copy: a.copy(m, { notes }).copy }));
    const title = `${bookTitle(parts[0].copy.title)} · ${periodLabel(months)}`;
    await handOver(joinCopies(title, parts), `${bookTitle(parts[0].copy.title)} ${months[0]}${months.length > 1 ? ` to ${months[months.length - 1]}` : ''}.pdf`);
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
          <>
            {holding.length ? (
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.warning, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginTop: SIZES.xs, color: COLORS.textDark, minHeight: 44 }}
                value={reason}
                onChangeText={setReason}
                placeholder={t('book.holdReason')}
                placeholderTextColor={COLORS.textLight}
                maxLength={500}
                multiline
              />
            ) : null}
            <TouchableOpacity style={linkStyle} onPress={() => void verify()}>
              <Text style={{ color: COLORS.primary, fontWeight: '800' }}>
                {toVerify.length && holding.length
                  ? t('book.verifyHold', { x: tn('n.entry', toVerify.length), y: holding.length })
                  : toVerify.length
                    ? t('book.verifyX', { x: tn('n.entry', toVerify.length) })
                    : t('book.recordReason', { x: tn('n.entry', holding.length) })}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={{ fontSize: SIZES.small, color: COLORS.warning, fontWeight: '700' }}>{t('book.awaitingX', { x: tn('n.entry', waiting.length) })}</Text>
        )
      ) : a.book.length ? (
        <Text style={{ fontSize: SIZES.small, color: COLORS.success, fontWeight: '700' }}>{t('book.allVerified')}</Text>
      ) : null}
      {a.isMaster && waiting.length && !signer ? picker : null}

      {/* The seals and the chain (services/seal). */}
      {/* Also when no entry is sealed: a sealed verification can still no longer match its entries. */}
      {it && (it.sealed || problems) ? (
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

      {/* The signed copies kept on this device after each verification (utils/keptCopies, §4.4.2). */}
      {a.isMaster && kept.length ? (
        <>
          <TouchableOpacity onPress={() => setShowKept((v) => !v)} hitSlop={8} style={{ marginTop: SIZES.sm }}>
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small }}>{`${t('book.kept', { n: kept.length })} ${showKept ? '↑' : '↓'}`}</Text>
          </TouchableOpacity>
          {showKept
            ? kept.slice(0, 50).map((c) => (
                <TouchableOpacity key={c.name} hitSlop={4} onPress={() => shareKept(c.name).catch((e) => Alert.alert(t('book.copy'), String(e?.message ?? e)))}>
                  <Text style={{ fontSize: SIZES.tiny, color: COLORS.primary, marginTop: 2 }}>{c.name}</Text>
                </TouchableOpacity>
              ))
            : null}
        </>
      ) : null}

      {/* One true copy of a run of months, or the whole book (§6.3). */}
      {bookMonths.length ? (
        <View style={{ marginTop: SIZES.md }}>
          <Text style={{ fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark }}>{t('book.period')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SIZES.xs, marginTop: SIZES.xs }}>
            <Text style={{ fontSize: SIZES.small, color: COLORS.textLight }}>{t('book.from')}</Text>
            <MonthPicker value={from} onChange={setFrom} months={bookMonths} />
            <Text style={{ fontSize: SIZES.small, color: COLORS.textLight }}>{t('book.to')}</Text>
            <MonthPicker value={to} onChange={setTo} months={bookMonths} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm }}>
            <TouchableOpacity style={linkStyle} onPress={() => void printMonths(monthsBetween(from, to))}>
              <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{t('book.printPeriod')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={linkStyle} onPress={() => void printMonths(monthsBetween(bookMonths[0], bookMonths[bookMonths.length - 1]))}>
              <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{t('book.printAll')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Who opened and exported the month (services/bookAccess). */}
      {a.isMaster && log.length ? (
        <>
          <TouchableOpacity onPress={() => setShowLog((v) => !v)} hitSlop={8} style={{ marginTop: SIZES.sm }}>
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small }}>{`${t('book.access', { n: log.length })} ${showLog ? '↑' : '↓'}`}</Text>
          </TouchableOpacity>
          {showLog
            ? log.slice(0, 50).map((l) => (
                <Text key={l.id} style={{ fontSize: SIZES.tiny, color: l.what === 'integrity' ? COLORS.danger : COLORS.textLight, fontWeight: l.what === 'integrity' ? '700' : '400', marginTop: 1 }}>
                  {`${uiDateTime(l.at)} · ${l.by || t('book.accUnnamed')} · ${t(`book.acc.${l.what}`)}${l.detail ? `: ${l.detail}` : ''}`}
                </Text>
              ))
            : null}
        </>
      ) : null}
    </View>
  );

  return { stage, section, waiting, note, notes };
}
