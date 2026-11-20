// ===================================
// IMO signs (route `ImoSigns` `imo-signs`; types/imoSigns.ts, services/imoSigns.ts).
//
//   List      every place a sign must be — worked out from the LSA/FFE register
//             (an extinguisher wants the extinguisher sign at its position), plus
//             the vessel's own (escape arrows, muster stations), deck by deck,
//             each with how it stood at the last look.
//   Round     Start a round: fine / faded / missing on each place looked at, then
//             one signature — a SignCheck, written once. A round may cover a deck.
//   Replace   faded and missing by sign: spares in the IMO signs store are fitted
//             (issued from stock and the places marked fine, one signature); the
//             rest, and the store back to its minimum, go into a draft order.
//   Own signs officers add the places the register cannot know, and take a
//             worked-out place off the list where no sign is posted.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { SignCheck, SignLook, SignPlace, SignState } from '../types/imoSigns';
import { StoreMove } from '../types/stores';
import { PurchaseOrder } from '../types/orders';
import { IMO_SIGNS, SIGN_GROUPS, SIGN_MAP } from '../services/imoSignCatalogue';
import { SignSpot, fittedLooks, signNeeds, signOrderLines, signSpots, spareTakes, spotPlace, spotStates } from '../services/imoSigns';
import { storeStatus } from '../services/stores';
import { onOrder } from '../services/sparesNeed';
import { nextOrderNo } from '../services/orders';
import { todayIso } from '../services/pms';
import * as storage from '../services/storage';
import { moduleOn } from '../constants/modules';
import { CATEGORY_MAP } from '../constants/categories';
import { goBackOr } from '../utils/nav';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, tn, useT } from '../utils/i18n';

type Show = 'all' | 'replace' | 'unseen';
type Mark = { state: SignState; bad: string };

/** The sign's name in the interface language; the catalogue's English when there is no word for it. */
const signName = (id: string) => {
  const w = tk(`sg.sign.${id}`);
  return w === `sg.sign.${id}` ? SIGN_MAP[id]?.name ?? id : w;
};

export default function ImoSignsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const sync = useSync();
  const { byCategory, signPlaces, signChecks, storeItems, storeMoves, purchaseOrders, saveRow, appendRow } = useData();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner(t('sg.signingAs'));
  const today = todayIso();

  const spots = useMemo(() => signSpots(byCategory, signPlaces), [byCategory, signPlaces]);
  const states = useMemo(() => spotStates(spots, signChecks), [spots, signChecks]);
  const signsStock = moduleOn('stores') ? storeItems.filter((i) => i.store === 'signs' && !i.deleted) : [];
  const usable = useMemo(() => new Map(storeStatus(signsStock, storeMoves, today).map((r) => [r.item.id, r.usable])), [signsStock, storeMoves, today]);
  const coming = useMemo(() => onOrder(purchaseOrders, 'storeItemId'), [purchaseOrders]);
  const needs = useMemo(() => signNeeds(spots, states, signsStock, usable, coming), [spots, states, signsStock, usable, coming]);
  const itemName = useMemo(() => {
    const m = new Map<string, string>();
    for (const [cat, items] of Object.entries(byCategory)) for (const it of items ?? []) m.set(it.id, [CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]?.short, it.no != null ? `No. ${it.no}` : '', it.type].filter(Boolean).join(' · '));
    return m;
  }, [byCategory]);

  const [show, setShow] = useState<Show>('all');
  const [deck, setDeck] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [round, setRound] = useState<Record<string, Mark> | null>(null);
  const [adding, setAdding] = useState<{ sign: string; deck: string; position: string; qty: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const decks = [...new Set(spots.map((s) => s.deck ?? ''))].sort((a, b) => (!a ? 1 : 0) - (!b ? 1 : 0) || a.localeCompare(b, undefined, { numeric: true }));
  const count = (k: SignState | 'unseen') => spots.filter((s) => states.get(s.key)?.state === k).length;
  const shown = spots
    .filter((s) => !deck || (s.deck ?? '') === deck)
    .filter((s) => show === 'all' || (show === 'replace' ? (states.get(s.key)?.bad ?? 0) > 0 : states.get(s.key)?.state === 'unseen'));
  const place = (s: Pick<SignSpot, 'deck' | 'position' | 'itemNo'>) => spotPlace(s, t('sg.noPosition'));
  const stateColor = (k: SignState | 'unseen') => (k === 'missing' ? COLORS.danger : k === 'poor' ? COLORS.warning : k === 'ok' ? COLORS.success : COLORS.textLight);

  // ---- the round ----
  const markAll = (state: SignState) => setRound(Object.fromEntries(shown.map((s) => [s.key, { state, bad: '' }])));
  const signRound = async () => {
    if (!round) return;
    const marked = spots.filter((s) => round[s.key]);
    if (!marked.length) return Alert.alert(t('sg.round'), t('sg.markOne'));
    if (!signer) return Alert.alert(t('sign.who'), t('round.chooseName'));
    const looks: SignLook[] = [];
    for (const s of marked) {
      const m = round[s.key];
      const bad = m.state === 'ok' ? 0 : m.bad.trim() ? Number(m.bad) : s.qty;
      if (m.state !== 'ok' && (!Number.isInteger(bad) || bad < 1 || bad > s.qty)) return Alert.alert(signName(s.sign), t('sg.badQty', { n: s.qty }));
      looks.push({ key: s.key, sign: s.sign, qty: s.qty, ...(s.deck ? { deck: s.deck } : {}), ...(s.position ? { position: s.position } : s.itemNo ? { position: `No. ${s.itemNo}` } : {}), state: m.state, ...(m.state !== 'ok' && bad < s.qty ? { bad } : {}) });
    }
    const bad = looks.filter((l) => l.state !== 'ok').length;
    const what = `IMO signs round — ${looks.length} place${looks.length === 1 ? '' : 's'} looked at, ${bad} to replace`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    const now = Date.now();
    const rec: SignCheck = { id: uid('sgc'), date: today, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), looks, at: now, updatedAt: now };
    await appendRow(storage.SIGN_CHECKS_KEY, rec);
    setRound(null);
    playSuccessSound();
    setSaved(t('sg.roundSaved', { n: looks.length, bad }));
  };

  // ---- fitted from stock ----
  const fitAll = async () => {
    const fit = needs.filter((n) => n.fit > 0);
    if (!fit.length) return;
    if (!signer) return Alert.alert(t('sign.who'), t('round.chooseName'));
    const total = fit.reduce((n, x) => n + x.fit, 0);
    const what = `IMO signs fitted from stock — ${total} sign${total === 1 ? '' : 's'}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    const now = Date.now();
    const who = { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}) };
    const batches = new Map(storeStatus(fit.flatMap((n) => n.stocks), storeMoves, today).map((r) => [r.item.id, r.batches]));
    const moves: StoreMove[] = [];
    for (const n of fit) {
      const where = n.spots.map(place).join('; ');
      // From each store that holds the sign in turn, until the places are covered.
      let left = n.fit;
      for (const item of n.stocks) {
        for (const p of spareTakes(batches.get(item.id) ?? [], left)) {
          left -= p.qty;
          moves.push({ id: uid('stm'), itemId: item.id, kind: 'issued', qty: p.qty, ...(p.batchNo ? { batchNo: p.batchNo } : {}), ...(p.expiry ? { expiry: p.expiry } : {}), ...(p.wear ? { wear: p.wear } : {}), date: today, note: `Posted: ${where}`.slice(0, 300), ...who, at: now, updatedAt: now });
        }
        if (left <= 0) break;
      }
    }
    const looks = fittedLooks(fit, states);
    for (const m of moves) await appendRow(storage.STORE_MOVES_KEY, m);
    await appendRow(storage.SIGN_CHECKS_KEY, { id: uid('sgc'), date: today, ...who, looks, fitted: true, at: now, updatedAt: now } as SignCheck);
    playSuccessSound();
    setSaved(t('sg.fitted', { n: total }));
  };

  // ---- the order ----
  const lines = signOrderLines(needs);
  const draftOrder = async () => {
    if (!lines.length) return Alert.alert(t('sg.order'), t('sp.nothingToOrder'));
    const now = Date.now();
    // The date of the last round, not of a fitting from stock.
    const last = signChecks.filter((c) => !c.fitted).sort((a, b) => b.at - a.at)[0];
    const order: PurchaseOrder = {
      id: uid('po'), no: nextOrderNo(purchaseOrders, 'deck'), dept: 'deck', status: 'draft', date: today, by: '', at: now, updatedAt: now,
      notes: `IMO signs — faded or missing at the round${last ? ` of ${uiDate(last.date)}` : ''}. Photoluminescent, IMO A.1116(30) / ISO 17631 / ISO 7010.`,
      lines: lines.map((l) => ({ id: uid('ol'), ...l })),
    };
    await saveRow(storage.PURCHASE_ORDERS_KEY, order);
    nav.navigate('Order', { id: order.id });
  };

  // ---- the vessel's own places ----
  const saveOwn = async () => {
    if (!adding) return;
    if (!adding.sign) return Alert.alert(t('sg.addOwn'), t('sg.pickSign'));
    if (!adding.position.trim()) return Alert.alert(t('sg.addOwn'), t('sg.needPosition'));
    const qty = adding.qty.trim() ? Number(adding.qty) : 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return Alert.alert(t('sg.addOwn'), t('sg.badQty', { n: 99 }));
    const row: SignPlace = { id: uid('sgp'), sign: adding.sign, ...(adding.deck.trim() ? { deck: adding.deck.trim() } : {}), position: adding.position.trim(), qty, updatedAt: Date.now() };
    await saveRow(storage.SIGN_PLACES_KEY, row);
    setAdding(null);
  };
  const takeOff = (s: SignSpot) => {
    const go = async () => {
      if (s.placeId) {
        const p = signPlaces.find((x) => x.id === s.placeId);
        if (p) await saveRow(storage.SIGN_PLACES_KEY, { ...p, removed: true, updatedAt: Date.now() });
      } else await saveRow(storage.SIGN_PLACES_KEY, { id: uid('sgp'), hides: s.key, updatedAt: Date.now() } as SignPlace);
      setOpen(null);
    };
    Alert.alert(signName(s.sign), s.placeId ? t('sg.removeAsk') : t('sg.hideAsk'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sg.takeOff'), style: 'destructive', onPress: () => void go() },
    ]);
  };
  const hiddenN = signPlaces.filter((p) => p.hides && !p.removed).length;
  const putBack = () => Alert.alert(t('sg.putBack'), t('sg.putBackAsk', { n: hiddenN }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('sg.putBack'), onPress: () => void (async () => { for (const p of signPlaces.filter((x) => x.hides && !x.removed)) await saveRow(storage.SIGN_PLACES_KEY, { ...p, removed: true, updatedAt: Date.now() }); })() },
  ]);

  const chip = (on: boolean, text: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? text} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{text}</Text>
    </TouchableOpacity>
  );
  const fitN = needs.reduce((n, x) => n + x.fit, 0);
  const noStore = moduleOn('stores') && !signsStock.length;

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={t('sg.title')} subtitle={t('sg.sub')} help="IMO signs" />

      {saved ? <Card><Text style={[styles.body, { color: COLORS.success }]}>{saved}</Text></Card> : null}

      {!spots.length ? (
        <Empty text={t('sg.empty')} />
      ) : (
        <>
          <View style={styles.chips}>
            {chip(show === 'all', t('sg.showAll', { n: spots.length }), () => setShow('all'))}
            {chip(show === 'replace', t('sg.showReplace', { n: count('poor') + count('missing') }), () => setShow('replace'))}
            {chip(show === 'unseen', t('sg.showUnseen', { n: count('unseen') }), () => setShow('unseen'))}
          </View>
          {decks.length > 1 ? (
            <Dropdown caption={t('sg.deck')} value={deck} onChange={setDeck} options={[{ value: '', label: t('sg.allDecks') }, ...decks.map((d) => ({ value: d, label: d || t('sg.noDeck') }))]} />
          ) : null}

          {/* ---- the round ---- */}
          {round ? (
            <Card>
              <Text style={styles.name}>{t('sg.roundOn')}</Text>
              <Text style={styles.sub}>{t('sg.roundHint')}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.small} onPress={() => markAll('ok')}><Text style={styles.smallText}>{t('sg.allFine')}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.small} onPress={() => setRound({})}><Text style={styles.smallText}>{t('sg.clear')}</Text></TouchableOpacity>
              </View>
              {picker}
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void signRound()}><Text style={styles.btnText}>{t('sg.signRound', { n: Object.keys(round).length })}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.small} onPress={() => setRound(null)}><Text style={styles.smallText}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </Card>
          ) : (
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.sm }]} onPress={() => { setRound({}); setSaved(null); }}>
              <Text style={styles.btnText}>{t('sg.startRound')}</Text>
            </TouchableOpacity>
          )}

          {/* ---- to replace ---- */}
          {needs.length && !round ? (
            <Card>
              <Text style={styles.name}>{t('sg.toReplace', { n: needs.reduce((n, x) => n + x.replace, 0) })}</Text>
              {needs.map((n) => (
                <View key={n.sign} style={{ marginTop: SIZES.sm }}>
                  <Text style={styles.body}>{signName(n.sign)} — {n.replace}</Text>
                  <Text style={styles.sub}>
                    {[n.stocks.length ? t('sg.spare', { n: n.spare }) : moduleOn('stores') ? t('sg.noSpare') : '', n.onOrder ? t('sg.onOrder', { n: n.onOrder }) : '', n.fit ? t('sg.fitN', { n: n.fit }) : '', n.order ? t('sg.orderN', { n: n.order }) : ''].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.sub} numberOfLines={2}>{n.spots.map(place).join('; ')}</Text>
                </View>
              ))}
              {fitN && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
              <View style={styles.row}>
                {fitN ? <TouchableOpacity style={styles.btn} onPress={() => void fitAll()}><Text style={styles.btnText}>{t('sg.fit', { n: fitN })}</Text></TouchableOpacity> : null}
                {lines.length && moduleOn('orders') && officer ? <TouchableOpacity style={styles.btn} onPress={() => void draftOrder()}><Text style={styles.btnText}>{t('sg.draftOrder', { x: tn('n.line', lines.length) })}</Text></TouchableOpacity> : null}
              </View>
              {noStore ? <Text style={styles.sub}>{t('sg.noStore')}</Text> : null}
            </Card>
          ) : null}

          {/* ---- the places ---- */}
          {!shown.length ? <Empty text={t('sg.noneShown')} /> : null}
          {shown.map((s, i) => {
            const st = states.get(s.key)!;
            const m = round?.[s.key];
            const head = i === 0 || (shown[i - 1].deck ?? '') !== (s.deck ?? '');
            const isOpen = open === s.key && !round;
            return (
              <View key={s.key}>
                {head ? <Label>{s.deck || t('sg.noDeck')}</Label> : null}
                <TouchableOpacity style={[styles.item, { borderLeftColor: stateColor(m?.state ?? st.state) }]} onPress={() => setOpen(isOpen ? null : s.key)} disabled={!!round}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                    <MciIcon name="sign-direction" size={18} color={stateColor(m?.state ?? st.state)} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{signName(s.sign)}{s.qty > 1 ? ` × ${s.qty}` : ''}</Text>
                      <Text style={styles.sub}>{s.position || (s.itemNo ? `No. ${s.itemNo} — ${t('sg.noPosition')}` : t('sg.noPosition'))}{s.placeId ? ` · ${t('sg.own')}` : ''}</Text>
                    </View>
                    {!round ? (
                      <Text style={[styles.badge, { color: stateColor(st.state), borderColor: stateColor(st.state) }]}>
                        {st.state === 'unseen' ? t('sg.state.unseen') : `${tk(`sg.state.${st.state}`)}${st.bad && st.bad < s.qty ? ` ${st.bad}` : ''}`}
                      </Text>
                    ) : null}
                  </View>
                  {round ? (
                    <View style={styles.row}>
                      {(['ok', 'poor', 'missing'] as SignState[]).map((k) => (
                        <TouchableOpacity key={k} style={[styles.small, m?.state === k && { backgroundColor: stateColor(k), borderColor: stateColor(k) }]} onPress={() => setRound({ ...round, [s.key]: { state: k, bad: m?.bad ?? '' } })}>
                          <Text style={[styles.smallText, m?.state === k && { color: COLORS.textWhite }]}>{tk(`sg.state.${k}`)}</Text>
                        </TouchableOpacity>
                      ))}
                      {m && m.state !== 'ok' && s.qty > 1 ? (
                        <TextInput style={[styles.input, { width: 90, marginTop: 0 }]} value={m.bad} onChangeText={(v) => setRound({ ...round, [s.key]: { ...m, bad: v.replace(/\D/g, '') } })} placeholder={t('sg.howMany', { n: s.qty })} placeholderTextColor={COLORS.textLight} keyboardType="number-pad" />
                      ) : null}
                    </View>
                  ) : null}
                  {isOpen ? (
                    <View style={{ marginTop: SIZES.sm }}>
                      <Text style={styles.sub}>{SIGN_MAP[s.sign]?.ref}</Text>
                      {s.itemIds.length ? <Text style={styles.sub}>{t('sg.marks')}: {s.itemIds.map((id) => itemName.get(id) ?? id).join('; ')}</Text> : null}
                      {st.check ? <Text style={styles.sub}>{t('sg.lastLook', { date: uiDate(st.check.date), by: st.check.by })}{st.look?.note ? ` — ${st.look.note}` : ''}</Text> : null}
                      {officer ? <TouchableOpacity onPress={() => takeOff(s)}><Text style={[styles.link, { color: COLORS.danger }]}>{s.placeId ? t('sg.remove') : t('sg.hide')}</Text></TouchableOpacity> : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      {/* ---- the vessel's own signs ---- */}
      {officer && !round ? (
        adding ? (
          <Card>
            <Text style={styles.name}>{t('sg.addOwn')}</Text>
            <Dropdown
              caption={t('sg.sign')}
              value={adding.sign}
              onChange={(v) => setAdding({ ...adding, sign: v })}
              options={[{ value: '', label: t('common.choose') }, ...SIGN_GROUPS.flatMap((g) => IMO_SIGNS.filter((x) => x.group === g).map((x) => ({ value: x.id, label: `${tk(`sg.group.${g}`)} — ${signName(x.id)}` })))]}
            />
            <TextInput style={styles.input} value={adding.deck} onChangeText={(v) => setAdding({ ...adding, deck: v })} placeholder={t('sg.deckPh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={adding.position} onChangeText={(v) => setAdding({ ...adding, position: v })} placeholder={t('sg.positionPh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { width: 120 }]} value={adding.qty} onChangeText={(v) => setAdding({ ...adding, qty: v.replace(/\D/g, '') })} placeholder={t('sg.qtyPh')} placeholderTextColor={COLORS.textLight} keyboardType="number-pad" />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => void saveOwn()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => setAdding(null)}><Text style={styles.smallText}>{t('common.cancel')}</Text></TouchableOpacity>
            </View>
          </Card>
        ) : (
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => setAdding({ sign: '', deck: deck, position: '', qty: '' })}><Text style={styles.smallText}>{t('sg.addOwn')}</Text></TouchableOpacity>
            {hiddenN ? <TouchableOpacity style={styles.small} onPress={putBack}><Text style={styles.smallText}>{t('sg.putBackN', { n: hiddenN })}</Text></TouchableOpacity> : null}
          </View>
        )
      ) : null}
      <Text style={styles.sub}>{t('sg.foot')}</Text>
    </Screen>
  );
}
