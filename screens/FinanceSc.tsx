// ===================================
// Finance — the APA and the budget (types/finance.ts, services/finance.ts).
//
//   APA     pick the fund (owner's account, a charter's APA), see its balance,
//           record money in and payments with the receipt photographed; a
//           mistake is reversed, never edited. Statement for a period — PDF
//           for the owner, Excel for the accountant.
//   Budget  the year by cost centre: budget, spent (APA + orders received),
//           committed (orders sent), left. The budget is typed in here.
// The officers and the Master only — the rules say the same.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import { PhotoPicker } from '../components/PhotoPicker';
import { EvidencePhoto } from '../components/EvidencePhoto';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { personName, roleAtLeast } from '../types/role';
import { Attachment } from '../types/equipment';
import { ApaEntry, ApaFund, COST_CENTRES, CURRENCIES, CostCentre, PAY_METHODS, PayMethod } from '../types/finance';
import * as storage from '../services/storage';
import * as photoQueue from '../services/photoQueue';
import { todayIso } from '../services/pms';
import { budgetCurrency, budgetYear, cancelledIds, entryProblem, fundSummary, inFund, money } from '../services/finance';
import { apaStatementSheet, budgetSheet, exportApaStatement, exportBudget } from '../services/financeReport';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const num = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};

interface Draft {
  kind: 'in' | 'out';
  date: string;
  amount: string;
  currency: string;
  rate: string;
  centre?: CostCentre;
  description: string;
  supplier: string;
  method?: PayMethod;
  receiptNo: string;
  poId: string;
  photos: Attachment[];
}

export default function FinanceSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { apaFunds, apaEntries, budgetLines, purchaseOrders, vessel, saveRow, appendRow, saveRows } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const me = sync.me ? personName(sync.me) : 'Officer';

  const [tab, setTab] = useState<'apa' | 'budget'>('apa');
  const funds = useMemo(() => [...apaFunds].sort((a, b) => Number(!!a.closed) - Number(!!b.closed) || b.opened.localeCompare(a.opened)), [apaFunds]);
  const [fundId, setFundId] = useState<string>('');
  const fund = funds.find((f) => f.id === fundId) ?? funds[0];
  const [editFund, setEditFund] = useState<ApaFund | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [from, setFrom] = useState(todayIso().slice(0, 8) + '01');
  const [until, setUntil] = useState(todayIso());
  const [saved, setSaved] = useState<string | null>(null);
  const [year, setYear] = useState(Number(todayIso().slice(0, 4)));
  const [budgetEdit, setBudgetEdit] = useState<Record<string, string>>({});

  const done = (w: string | null | void) => {
    if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  };
  const fail = (e: any) => Alert.alert(t('fin.title'), String(e?.message ?? e));

  // ---- funds ----
  const saveFund = async () => {
    if (!editFund) return;
    if (!editFund.name.trim()) return Alert.alert(t('fin.fund'), t('fin.fundName'));
    await saveRow(storage.APA_FUNDS_KEY, { ...editFund, name: editFund.name.trim(), notes: editFund.notes?.trim() || undefined });
    setFundId(editFund.id);
    setEditFund(null);
    playSuccessSound();
  };
  const closeFund = (f: ApaFund) =>
    Alert.alert(t('fin.closeQ', { fund: f.name }), t('fin.closeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('fin.close'), onPress: () => void saveRow(storage.APA_FUNDS_KEY, { ...f, closed: todayIso() }) },
    ]);

  // ---- entries ----
  const startEntry = (kind: 'in' | 'out') => fund && setDraft({ kind, date: todayIso(), amount: '', currency: fund.currency, rate: '', description: '', supplier: '', receiptNo: '', poId: '', photos: [], ...(kind === 'out' ? { method: 'card' as PayMethod } : {}) });
  const orderOptions = useMemo(() => purchaseOrders.filter((o) => !o.deleted && o.status !== 'draft' && o.status !== 'cancelled').sort((a, b) => b.at - a.at).slice(0, 60), [purchaseOrders]);
  const saveEntry = async () => {
    if (!draft || !fund) return;
    const po = draft.kind === 'out' ? orderOptions.find((o) => o.id === draft.poId) : undefined;
    const now = Date.now();
    const e: ApaEntry = {
      id: uid('apa'), fundId: fund.id, date: draft.date, kind: draft.kind, amount: num(draft.amount) ?? 0, currency: draft.currency,
      ...(draft.currency !== fund.currency && num(draft.rate) ? { rate: num(draft.rate) } : {}),
      ...(draft.kind === 'out' && draft.centre ? { centre: draft.centre } : {}),
      description: draft.description.trim(),
      ...(draft.supplier.trim() ? { supplier: draft.supplier.trim() } : {}),
      ...(draft.method ? { method: draft.method } : {}),
      ...(draft.receiptNo.trim() ? { receiptNo: draft.receiptNo.trim() } : {}),
      ...(po ? { poId: po.id, poNo: po.no } : {}),
      ...(draft.photos.length ? { photos: draft.photos } : {}),
      by: me, ...(sync.me?.position ? { byRank: sync.me.position } : {}), at: now, updatedAt: now,
    };
    const why = entryProblem(e, fund);
    if (why) return Alert.alert(t('fin.cantSave'), tk(why, { cur: fund.currency, other: draft.currency }));
    await appendRow(storage.APA_ENTRIES_KEY, e);
    if (e.photos?.length && vessel?.imo) await photoQueue.enqueueInspection(vessel.imo, e);
    playSuccessSound();
    setSaved(`${e.kind === 'in' ? t('fin.moneyIn') : t('fin.payment')} — ${money(e.amount, e.currency)}`);
    setDraft(null);
  };
  const reverse = async (e: ApaEntry) => {
    if (reason.trim().length < 3) return Alert.alert(t('fin.reverse'), t('fin.reasonNeeded'));
    const now = Date.now();
    const r: ApaEntry = {
      id: uid('apa'), fundId: e.fundId, date: todayIso() < e.date ? e.date : todayIso(), kind: e.kind === 'in' ? 'out' : 'in', amount: e.amount, currency: e.currency,
      ...(e.rate ? { rate: e.rate } : {}), ...(e.centre ? { centre: e.centre } : {}),
      description: `Reversal of ${e.date} ${e.description}`, reverses: e.id, reason: reason.trim(),
      by: me, ...(sync.me?.position ? { byRank: sync.me.position } : {}), at: now, updatedAt: now,
    };
    await appendRow(storage.APA_ENTRIES_KEY, r);
    playSuccessSound();
    setOpen(null);
    setReason('');
  };

  const sum = fund ? fundSummary(fund, apaEntries) : null;
  const gone = useMemo(() => cancelledIds(apaEntries), [apaEntries]);
  const rows = sum ? [...sum.rows].reverse() : [];
  const shown = showAll ? rows : rows.slice(0, 30);

  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  const fundForm = editFund ? (
    <Card>
      <Label>{funds.some((f) => f.id === editFund.id) ? editFund.name : t('fin.newFund')}</Label>
      <Text style={styles.sub}>{t('fin.fundName')}</Text>
      <TextInput style={styles.input} value={editFund.name} onChangeText={(v) => setEditFund({ ...editFund, name: v })} placeholder={t('fin.fundNameEg')} accessibilityLabel={t('fin.fundName')} />
      <Text style={styles.sub}>{t('fin.noNames')}</Text>
      <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('fin.currency')}</Text>
      <View style={styles.chips}>{CURRENCIES.map((c) => chip(editFund.currency === c, c, () => setEditFund({ ...editFund, currency: c })))}</View>
      <SimpleDatePicker label={t('fin.opened')} value={editFund.opened} onChange={(d) => d && setEditFund({ ...editFund, opened: d })} />
      <Text style={styles.sub}>{t('fin.notes')}</Text>
      <TextInput style={styles.input} value={editFund.notes ?? ''} onChangeText={(v) => setEditFund({ ...editFund, notes: v })} accessibilityLabel={t('fin.notes')} />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void saveFund()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setEditFund(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
      </View>
    </Card>
  ) : null;

  const entryForm = draft && fund ? (
    <Card>
      <Label>{draft.kind === 'in' ? t('fin.moneyIn') : t('fin.payment')}</Label>
      <SimpleDatePicker label={t('fin.date')} value={draft.date} onChange={(d) => d && setDraft({ ...draft, date: d })} />
      <Text style={styles.sub}>{t('fin.amount')}</Text>
      <View style={[styles.row, { marginTop: 0, alignItems: 'center', gap: SIZES.xs }]}>
        <TextInput style={[styles.input, { width: 140, marginTop: 0 }]} value={draft.amount} onChangeText={(v) => setDraft({ ...draft, amount: v })} keyboardType="decimal-pad" accessibilityLabel={t('fin.amount')} />
        <Dropdown caption={t('fin.currency')} value={draft.currency} onChange={(c: string) => setDraft({ ...draft, currency: c })} options={[...new Set([fund.currency, ...CURRENCIES])].map((c) => ({ value: c, label: c }))} style={{ width: 170 }} />
      </View>
      {draft.currency !== fund.currency ? (
        <>
          <Text style={styles.sub}>{t('fin.rateFor', { cur: fund.currency, other: draft.currency })}</Text>
          <TextInput style={[styles.input, { width: 140 }]} value={draft.rate} onChangeText={(v) => setDraft({ ...draft, rate: v })} keyboardType="decimal-pad" accessibilityLabel={t('fin.rate')} />
          {num(draft.amount) && num(draft.rate) ? <Text style={styles.sub}>{`= ${money(num(draft.amount)! * num(draft.rate)!, fund.currency)}`}</Text> : null}
        </>
      ) : null}
      <Text style={styles.sub}>{draft.kind === 'in' ? t('fin.fromWhom') : t('fin.whatFor')}</Text>
      <TextInput style={styles.input} value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} accessibilityLabel={t('fin.whatFor')} />
      {draft.kind === 'out' ? (
        <>
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('fin.centre')}</Text>
          <View style={styles.chips}>{COST_CENTRES.map((c) => chip(draft.centre === c, tk(`fin.cc.${c}`), () => setDraft({ ...draft, centre: c }), c))}</View>
          <Text style={styles.sub}>{t('fin.supplier')}</Text>
          <TextInput style={styles.input} value={draft.supplier} onChangeText={(v) => setDraft({ ...draft, supplier: v })} accessibilityLabel={t('fin.supplier')} />
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('fin.paidBy')}</Text>
          <View style={styles.chips}>{PAY_METHODS.map((m) => chip(draft.method === m, tk(`fin.pm.${m}`), () => setDraft({ ...draft, method: m }), m))}</View>
          {orderOptions.length ? (
            <Dropdown caption={t('fin.po')} value={draft.poId} onChange={(v: string) => setDraft({ ...draft, poId: v })} options={[{ value: '', label: t('fin.noPo') }, ...orderOptions.map((o) => ({ value: o.id, label: `${o.no}${o.supplier ? ` · ${o.supplier}` : ''}` }))]} style={{ maxWidth: 420, marginTop: SIZES.sm }} />
          ) : null}
        </>
      ) : null}
      <Text style={styles.sub}>{t('fin.receiptNo')}</Text>
      <TextInput style={[styles.input, { width: 200 }]} value={draft.receiptNo} onChangeText={(v) => setDraft({ ...draft, receiptNo: v })} accessibilityLabel={t('fin.receiptNo')} />
      <PhotoPicker photos={draft.photos} onChange={(photos) => setDraft({ ...draft, photos })} hint={t('fin.receiptPhoto')} />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void saveEntry()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setDraft(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
      </View>
      <Text style={styles.sub}>{t('fin.onceNote')}</Text>
    </Card>
  ) : null;

  // ---- budget ----
  const cur = budgetCurrency(year, budgetLines, apaFunds);
  const by = budgetYear(year, cur, budgetLines, apaFunds, apaEntries, purchaseOrders);
  const line = (c: CostCentre) => budgetLines.find((b) => b.id === `${year}:${c}`);
  const saveBudget = async (c: CostCentre) => {
    const raw = budgetEdit[c];
    if (raw === undefined) return;
    const v = num(raw) ?? 0;
    await saveRow(storage.BUDGET_KEY, { id: `${year}:${c}`, year, centre: c, amount: v, currency: cur, updatedAt: Date.now() });
    setBudgetEdit((m) => { const n = { ...m }; delete n[c]; return n; });
  };
  const setBudgetCurrency = (c: string) => {
    const mine = budgetLines.filter((b) => b.year === year);
    if (!mine.length) return void saveRow(storage.BUDGET_KEY, { id: `${year}:other`, year, centre: 'other', amount: 0, currency: c, updatedAt: Date.now() });
    void saveRows(storage.BUDGET_KEY, mine.map((b) => ({ ...b, currency: c, updatedAt: Date.now() })));
  };

  // After every hook: the rules give a crew member none of it anyway.
  if (!officer) {
    return (
      <Screen scroll>
        <ScreenTitle title={t('fin.title')} help="APA and budget" />
        <Text style={styles.sub}>{t('fin.officersOnly')}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title={t('fin.title')} subtitle={fund && sum ? `${fund.name} · ${money(sum.closing, fund.currency)}` : t('fin.subtitle')} help="APA and budget" />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}
      <View style={styles.chips}>
        {chip(tab === 'apa', 'APA', () => setTab('apa'))}
        {chip(tab === 'budget', t('fin.budget'), () => setTab('budget'))}
      </View>

      {tab === 'apa' ? (
        <>
          <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.xs }]}>
            {funds.length ? <Dropdown caption={t('fin.fund')} value={fund?.id ?? ''} onChange={(v: string) => { setFundId(v); setDraft(null); setOpen(null); }} options={funds.map((f) => ({ value: f.id, label: `${f.name} · ${f.currency}${f.closed ? ` · ${t('fin.closed')}` : ''}` }))} style={{ flex: 1, minWidth: 220, maxWidth: 420 }} /> : null}
            <TouchableOpacity style={styles.small} onPress={() => setEditFund({ id: uid('fund'), name: '', currency: fund?.currency ?? 'EUR', opened: todayIso(), updatedAt: Date.now() })}><Text style={styles.smallText}>{`+ ${t('fin.newFund')}`}</Text></TouchableOpacity>
            {fund ? <TouchableOpacity style={styles.small} onPress={() => setEditFund(fund)}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity> : null}
          </View>
          {fundForm}
          {!funds.length && !editFund ? <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>{t('fin.empty')}</Text> : null}

          {fund && sum ? (
            <>
              <Card>
                <Text style={styles.sub}>{t('fin.balance')}</Text>
                <Text style={[styles.name, { fontSize: 26, color: sum.closing < 0 ? COLORS.danger : COLORS.text }]}>{money(sum.closing, fund.currency)}</Text>
                <Text style={styles.sub}>{`${t('fin.received')} ${money(sum.received, fund.currency)} · ${t('fin.spent')} ${money(sum.spent, fund.currency)}${fund.closed ? ` · ${t('fin.closedOn', { date: fund.closed })}` : ''}`}</Text>
                {Object.keys(sum.byCentre).length ? (
                  <View style={{ marginTop: SIZES.sm }}>
                    {(Object.entries(sum.byCentre) as [CostCentre, number][]).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                      <Text key={c} style={styles.sub}>{`${tk(`fin.cc.${c}`)} — ${money(v, fund.currency)}`}</Text>
                    ))}
                  </View>
                ) : null}
              </Card>

              {!fund.closed ? (
                <View style={[styles.row, { gap: SIZES.xs }]}>
                  <TouchableOpacity style={styles.btn} onPress={() => startEntry('out')}><Text style={styles.btnText}>{`+ ${t('fin.payment')}`}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.small} onPress={() => startEntry('in')}><Text style={styles.smallText}>{`+ ${t('fin.moneyIn')}`}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => closeFund(fund)}><Text style={styles.link}>{t('fin.closeFund')}</Text></TouchableOpacity>
                </View>
              ) : null}
              {entryForm}

              <Label style={{ marginTop: SIZES.md }}>{t('fin.entries')}</Label>
              {!rows.length ? <Text style={styles.sub}>{t('fin.noEntries')}</Text> : null}
              {shown.map((e) => {
                const out = gone.has(e.id);
                const v = inFund(e, fund) ?? 0;
                const expanded = open === e.id;
                return (
                  <View key={e.id} style={[styles.item, { borderLeftColor: e.reverses ? COLORS.textLight : e.kind === 'in' ? COLORS.success : COLORS.primary }]}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }} onPress={() => { setOpen(expanded ? null : e.id); setReason(''); }}>
                      <MciIcon name={e.reverses ? 'undo-variant' : e.kind === 'in' ? 'arrow-down-bold' : 'arrow-up-bold'} size={18} color={e.kind === 'in' ? COLORS.success : COLORS.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, out && !e.reverses ? { textDecorationLine: 'line-through', color: COLORS.textLight } : null]}>{e.description}</Text>
                        <Text style={styles.sub}>{[e.date, e.centre ? tk(`fin.cc.${e.centre}`) : '', e.supplier ?? '', e.poNo ?? '', e.photos?.length ? '📎' : '', out && !e.reverses ? t('fin.reversed') : ''].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Text style={[styles.name, { color: e.kind === 'in' ? COLORS.success : COLORS.text }, out ? { textDecorationLine: 'line-through', color: COLORS.textLight } : null]}>{`${e.kind === 'in' ? '+' : '−'}${money(v, fund.currency)}`}</Text>
                    </TouchableOpacity>
                    {expanded ? (
                      <View style={{ marginTop: SIZES.sm }}>
                        {e.currency !== fund.currency ? <Text style={styles.sub}>{`${money(e.amount, e.currency)} @ ${e.rate}`}</Text> : null}
                        <Text style={styles.sub}>{[e.method ? tk(`fin.pm.${e.method}`) : '', e.receiptNo ? `${t('fin.receiptNo')} ${e.receiptNo}` : '', e.byRank ? `${e.by} (${e.byRank})` : e.by].filter(Boolean).join(' · ')}</Text>
                        {e.reason ? <Text style={styles.sub}>{`${t('fin.reason')}: ${e.reason}`}</Text> : null}
                        {e.photos?.length ? <View style={[styles.row, { gap: SIZES.xs }]}>{e.photos.map((p) => <EvidencePhoto key={p.id} vessel={vessel?.imo ?? ''} inspectionId={e.id} photo={p} />)}</View> : null}
                        {!out && !fund.closed ? (
                          <>
                            <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('fin.reverseWhy')}</Text>
                            <TextInput style={styles.input} value={reason} onChangeText={setReason} accessibilityLabel={t('fin.reason')} />
                            <TouchableOpacity style={styles.small} onPress={() => void reverse(e)}><Text style={styles.smallText}>{t('fin.reverse')}</Text></TouchableOpacity>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {rows.length > shown.length ? <TouchableOpacity onPress={() => setShowAll(true)}><Text style={styles.link}>{t('fin.showAll', { n: rows.length })}</Text></TouchableOpacity> : null}

              <Label style={{ marginTop: SIZES.md }}>{t('fin.statement')}</Label>
              <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.sm }]}>
                <View style={{ minWidth: 160 }}><SimpleDatePicker label={t('common.from')} value={from} onChange={(d) => setFrom(d || from)} /></View>
                <View style={{ minWidth: 160 }}><SimpleDatePicker label={t('common.to')} value={until} onChange={(d) => setUntil(d || until)} /></View>
                <TouchableOpacity style={styles.btn} onPress={() => void exportApaStatement(fund, apaEntries, from, until, vessel).then(done, fail)}><Text style={styles.btnText}>PDF</Text></TouchableOpacity>
                <TouchableOpacity style={styles.small} onPress={() => void apaStatementSheet(fund, apaEntries, from, until, vessel).then(done, fail)}><Text style={styles.smallText}>Excel</Text></TouchableOpacity>
              </View>
              <Text style={styles.sub}>{t('fin.statementNote')}</Text>
            </>
          ) : null}
        </>
      ) : (
        <>
          <View style={[styles.row, { alignItems: 'center', gap: SIZES.sm }]}>
            <TouchableOpacity onPress={() => setYear(year - 1)} accessibilityLabel={t('fin.prevYear')}><MciIcon name="chevron-left" size={26} color={COLORS.primary} /></TouchableOpacity>
            <Text style={[styles.name, { fontSize: 20 }]}>{String(year)}</Text>
            <TouchableOpacity onPress={() => setYear(year + 1)} accessibilityLabel={t('fin.nextYear')}><MciIcon name="chevron-right" size={26} color={COLORS.primary} /></TouchableOpacity>
            <Dropdown caption={t('fin.currency')} value={cur} onChange={setBudgetCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} style={{ width: 170 }} />
          </View>
          <Card>
            <Text style={styles.sub}>{t('fin.budgetTotal')}</Text>
            <Text style={[styles.name, { fontSize: 22 }]}>{money(by.total.budget, cur)}</Text>
            <Text style={styles.sub}>{`${t('fin.spent')} ${money(by.total.spent, cur)} · ${t('fin.committed')} ${money(by.total.committed, cur)} · ${t('fin.left')} ${money(by.total.left, cur)}`}</Text>
            {by.skipped ? <Text style={[styles.sub, { color: COLORS.warning }]}>{t('fin.skipped', { n: by.skipped, cur })}</Text> : null}
          </Card>
          {COST_CENTRES.map((c) => {
            const r = by.rows.find((x) => x.centre === c);
            const used = r?.used ?? null;
            const color = used == null ? COLORS.textLight : used > 1 ? COLORS.danger : used > 0.9 ? COLORS.warning : COLORS.success;
            const editing = budgetEdit[c];
            return (
              <View key={c} style={[styles.item, { borderLeftColor: color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <Text style={[styles.name, { flex: 1 }]}>{tk(`fin.cc.${c}`)}</Text>
                  <TextInput
                    style={[styles.input, { width: 130, marginTop: 0, textAlign: 'right' }]}
                    value={editing ?? (line(c)?.amount ? String(line(c)!.amount) : '')}
                    onChangeText={(v) => setBudgetEdit((m) => ({ ...m, [c]: v }))}
                    onBlur={() => void saveBudget(c)}
                    onSubmitEditing={() => void saveBudget(c)}
                    keyboardType="decimal-pad"
                    placeholder={t('fin.budget')}
                    accessibilityLabel={`${t('fin.budget')} ${tk(`fin.cc.${c}`)}`}
                  />
                </View>
                {r && (r.spent || r.committed) ? (
                  <>
                    <Text style={styles.sub}>{`${t('fin.spent')} ${money(r.spent, cur)}${r.apa && r.orders ? ` (APA ${money(r.apa, cur)} + ${t('fin.orders')} ${money(r.orders, cur)})` : ''}${r.committed ? ` · ${t('fin.committed')} ${money(r.committed, cur)}` : ''}`}</Text>
                    {r.budget ? <Text style={[styles.sub, { color }]}>{`${t('fin.left')} ${money(r.left, cur)} · ${Math.round((used ?? 0) * 100)} %`}</Text> : null}
                    {r.budget ? <View style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.border, marginTop: 4, overflow: 'hidden' }}><View style={{ height: 6, width: `${Math.min(100, Math.round((used ?? 0) * 100))}%`, backgroundColor: color }} /></View> : null}
                  </>
                ) : null}
              </View>
            );
          })}
          <Text style={styles.sub}>{t('fin.budgetNote')}</Text>
          <View style={[styles.row, { gap: SIZES.sm }]}>
            <TouchableOpacity style={styles.btn} onPress={() => void exportBudget(year, cur, by, vessel).then(done, fail)}><Text style={styles.btnText}>PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => void budgetSheet(year, cur, by, vessel).then(done, fail)}><Text style={styles.smallText}>Excel</Text></TouchableOpacity>
          </View>
        </>
      )}
    </Screen>
  );
}
