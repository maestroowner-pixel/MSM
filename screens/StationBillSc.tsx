// ===================================
// The muster list (route `StationBill` `muster-list`; types/stationBill.ts, services/stationBill.ts).
//
// Everyone reads the revision in force, page by page: the positions and who holds
// them, then each alarm — fire, abandon ship, man overboard, oil spill, security by
// ISPS level — with its signal and every position's station, duty and area. Each
// page prints (PDF, English); so does the whole list.
//
// The Master edits a DRAFT kept on this device (msm:station_bill_draft): positions,
// the person in each (from the crew list, or filled by rank), the duties per alarm,
// the areas of responsibility, the signals — and issues it as the next revision.
// Officers see what is out of date (positions empty, people aboard not on it).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { goBackOr } from '../utils/nav';
import { personName, roleAtLeast } from '../types/role';
import { isAboard } from '../types/crew';
import { ALARMS, AlarmKind, BillDraft, BillDuty, BillRow, BillZone, DutyKey, StationBill, ZoneKind } from '../types/stationBill';
import { billGaps, currentBill, draftFrom, draftProblem, fillFromCrew, issueBill, nextNo, standardBill } from '../services/stationBill';
import { shareAlarm, shareBill } from '../services/stationBillReport';
import { todayIso } from '../services/pms';
import * as storage from '../services/storage';
import { playSuccessSound } from '../utils/sound';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { t, tk, useT } from '../utils/i18n';

type Page = 'rows' | AlarmKind | 'zones';
const PAGES: Page[] = ['rows', ...ALARMS, 'zones'];
const LEVELS: DutyKey[] = ['sec1', 'sec2', 'sec3'];
const ZONE_KINDS: ZoneKind[] = ['space', 'boat', 'station', 'other'];
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export default function StationBillSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const sync = useSync();
  const { crew, stationBills, vessel, appendRow } = useData();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  // The Master issues the list (rules: isSuper); a device on no vessel keeps its own.
  const master = !sync.enrolled || roleAtLeast(sync.role, 'superadmin');
  const me = sync.me ? personName(sync.me) : 'Master';

  const bill = currentBill(stationBills);
  const [page, setPage] = useState<Page>('rows');
  const [level, setLevel] = useState<DutyKey>('sec1');
  const [draft, setDraft] = useState<BillDraft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // A draft left on this device comes back.
  useEffect(() => {
    if (!master) return;
    void storage.loadList<BillDraft>(storage.STATION_BILL_DRAFT_KEY).then((l) => { if (l[0]) setDraft(l[0]); }).catch(() => {});
  }, [master]);
  const keep = (d: BillDraft | null) => {
    setDraft(d);
    void storage.saveList(storage.STATION_BILL_DRAFT_KEY, d ? [d] : []);
  };

  const aboard = useMemo(() => crew.filter((c) => isAboard(c)), [crew]);
  const gaps = useMemo(() => billGaps(bill, crew), [bill, crew]);
  const shown: Pick<StationBill, 'rows' | 'zones' | 'signals'> | undefined = draft ?? bill;
  const zones = (shown?.zones ?? []).filter((z) => !z.removed);
  const zoneName = (id?: string) => zones.find((z) => z.id === id)?.name ?? '';
  const key: DutyKey | null = page === 'security' ? level : page === 'rows' || page === 'zones' ? null : page;

  const arm = (what: string, run: () => void) => {
    if (armed !== what) {
      setArmed(what);
      setTimeout(() => setArmed((a) => (a === what ? null : a)), 5000);
      return;
    }
    setArmed(null);
    run();
  };
  const done = (w: string | null | void) => {
    if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  };
  const fail = (e: any) => setErr(String(e?.message ?? e));

  // ---- editing the draft ----
  const setRow = (id: string, patch: Partial<BillRow>) => draft && keep({ ...draft, rows: draft.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const setDuty = (r: BillRow, k: DutyKey, patch: Partial<BillDuty>) =>
    setRow(r.id, { duties: { ...r.duties, [k]: { duty: '', ...r.duties[k], ...patch } } });
  const setZone = (id: string, patch: Partial<BillZone>) => draft && keep({ ...draft, zones: draft.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) });
  const issue = async () => {
    if (!draft) return;
    const p = draftProblem(draft);
    if (p) return setErr(tk(p));
    const b = issueBill(draft, stationBills, crew, me, Date.now());
    await appendRow(storage.STATION_BILLS_KEY, b);
    keep(null);
    playSuccessSound();
    setSaved(t('sb.issued', { rev: b.rev }));
  };

  const pageLabel = (p: Page) => (p === 'rows' ? t('sb.page.rows') : p === 'zones' ? t('sb.page.zones') : tk(`sb.alarm.${p}`));

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle
        title={t('sb.title')}
        subtitle={draft ? t('sb.editing', { from: draft.from ? t('sb.revN', { rev: draft.from }) : t('sb.standard') }) : bill ? t('sb.inForce', { rev: bill.rev, date: uiDate(isoOf(bill.issuedAt)), by: bill.issuedBy }) : t('sb.none')}
        help="Muster list"
      />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      {err ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{err}</Text> : null}

      {/* What is out of date — the list must follow the crew (SOLAS III/37.2). */}
      {officer && bill && !draft && (gaps.unfilled.length || gaps.notOnList.length || gaps.gone.length || gaps.twice.length) ? (
        <Card style={{ borderLeftWidth: 6, borderLeftColor: COLORS.warning }}>
          <Label>{t('sb.gaps')}</Label>
          {gaps.notOnList.length ? <Text style={styles.line}>{t('sb.gap.notOnList', { names: gaps.notOnList.map((c) => c.name).join(', ') })}</Text> : null}
          {gaps.gone.length ? <Text style={styles.line}>{t('sb.gap.gone', { rows: gaps.gone.map((r) => `${r.no} ${r.position} (${r.name ?? ''})`).join(', ') })}</Text> : null}
          {gaps.unfilled.length ? <Text style={styles.line}>{t('sb.gap.unfilled', { rows: gaps.unfilled.map((r) => `${r.no} ${r.position}`).join(', ') })}</Text> : null}
          {gaps.twice.length ? <Text style={styles.line}>{t('sb.gap.twice', { names: gaps.twice.map((c) => c.name).join(', ') })}</Text> : null}
        </Card>
      ) : null}

      {master && !draft ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => { setErr(null); keep(draftFrom(bill)); }}>
            <MciIcon name="pencil-outline" size={18} color={COLORS.textWhite} />
            <Text style={styles.btnText}>{bill ? t('sb.edit') : t('sb.startStd')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!shown ? <Empty text={master ? t('sb.noneMaster') : t('sb.noneCrew')} /> : (
        <>
          <View style={styles.chips}>
            {PAGES.map((p) => (
              <TouchableOpacity key={p} style={[styles.chip, page === p && styles.chipOn]} onPress={() => setPage(p)}>
                <Text style={[styles.chipText, page === p && { color: COLORS.textWhite }]}>{pageLabel(p)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ---- an alarm: its signal, then every position ---- */}
          {key ? (
            <Card>
              {page === 'security' ? (
                <View style={styles.chips}>
                  {LEVELS.map((l, i) => (
                    <TouchableOpacity key={l} style={[styles.chip, level === l && styles.chipOn]} onPress={() => setLevel(l)}>
                      <Text style={[styles.chipText, level === l && { color: COLORS.textWhite }]}>{t('sb.level', { n: i + 1 })}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <Label>{t('sb.signal')}</Label>
              {draft ? (
                <TextInput style={styles.input} multiline value={draft.signals[page as AlarmKind] ?? ''} onChangeText={(v) => keep({ ...draft, signals: { ...draft.signals, [page]: v } })} placeholder={t('sb.signalPh')} accessibilityLabel={t('sb.signal')} />
              ) : (
                <Text style={styles.line}>{shown.signals[page as AlarmKind] ?? '—'}</Text>
              )}
              {shown.rows.map((r) => {
                const d = r.duties[key];
                const editing = !!draft && open === r.id;
                return (
                  <View key={r.id} style={styles.person}>
                    <View style={{ flex: 1 }}>
                      {/* Only the heading opens and closes: a tap in a field below must not fold the row. */}
                      <TouchableOpacity activeOpacity={draft ? 0.7 : 1} disabled={!draft} onPress={() => setOpen(editing ? null : r.id)}>
                        <Text style={styles.personName}>{`${r.no}. ${r.position}${r.name ? ` — ${r.name}` : ''}`}</Text>
                        {!editing ? (
                          d ? <Text style={styles.line}>{[d.station, d.duty, zoneName(d.zoneId)].filter(Boolean).join(' · ')}</Text> : <Text style={styles.sub}>{t('sb.noDuty')}</Text>
                        ) : null}
                      </TouchableOpacity>
                      {!editing ? null : (
                        <View>
                          <TextInput style={styles.input} value={d?.station ?? ''} onChangeText={(v) => setDuty(r, key, { station: v })} placeholder={t('sb.stationPh')} accessibilityLabel={t('sb.station')} />
                          <TextInput style={[styles.input, { minHeight: 56 }]} multiline value={d?.duty ?? ''} onChangeText={(v) => setDuty(r, key, { duty: v })} placeholder={t('sb.dutyPh')} accessibilityLabel={t('sb.duty')} />
                          <View style={styles.chips}>
                            {zones.map((z) => (
                              <TouchableOpacity key={z.id} style={[styles.chip, d?.zoneId === z.id && styles.chipOn]} onPress={() => setDuty(r, key, { zoneId: d?.zoneId === z.id ? undefined : z.id })}>
                                <Text style={[styles.chipText, d?.zoneId === z.id && { color: COLORS.textWhite }]}>{z.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                    {draft ? <MciIcon name={editing ? 'chevron-up' : 'pencil-outline'} size={18} color={COLORS.textLight} /> : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* ---- positions and who holds them ---- */}
          {page === 'rows' ? (
            <Card>
              {draft ? (
                <View style={[styles.row, { marginTop: 0 }]}>
                  <TouchableOpacity style={styles.small} onPress={() => keep({ ...draft, rows: fillFromCrew(draft.rows, crew) })}><Text style={styles.smallText}>{t('sb.fill')}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.small} onPress={() => { const no = nextNo(draft.rows); keep({ ...draft, rows: [...draft.rows, { id: uid('sbr'), no, position: '', duties: {} }] }); setOpen(null); }}><Text style={styles.smallText}>{t('sb.addRow')}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.small} onPress={() => arm('std', () => keep({ ...standardBill(), from: draft.from }))}><Text style={styles.smallText}>{armed === 'std' ? t('sb.stdSure') : t('sb.std')}</Text></TouchableOpacity>
                </View>
              ) : null}
              {shown.rows.map((r) => {
                const editing = !!draft && open === r.id;
                const dep = r.deputyNo ? shown.rows.find((x) => x.no === r.deputyNo) : undefined;
                const holder = r.crewId ? crew.find((c) => c.id === r.crewId) : undefined;
                return (
                  <View key={r.id} style={styles.person}>
                    <View style={{ flex: 1 }}>
                      <TouchableOpacity disabled={!draft} onPress={() => setOpen(editing ? null : r.id)}>
                        <Text style={styles.personName}>{`${r.no}. ${r.position || '—'}`}</Text>
                        <Text style={[styles.line, !r.crewId && { color: COLORS.warning }]}>{r.crewId ? `${holder?.name ?? r.name ?? ''}${holder && !isAboard(holder) ? ` · ${t('sb.notAboard')}` : ''}` : t('sb.unfilled')}</Text>
                        {dep ? <Text style={styles.sub}>{t('sb.deputy', { row: `${dep.no}. ${dep.position}` })}</Text> : null}
                      </TouchableOpacity>
                      {editing ? (
                        <View>
                          <View style={styles.row}>
                            <TextInput style={[styles.input, { width: 64 }]} keyboardType="number-pad" value={String(r.no)} onChangeText={(v) => setRow(r.id, { no: Number(v.replace(/\D/g, '')) || 0 })} accessibilityLabel={t('sb.no')} />
                            <TextInput style={[styles.input, { flex: 1, minWidth: 160 }]} value={r.position} onChangeText={(v) => setRow(r.id, { position: v })} placeholder={t('sb.positionPh')} accessibilityLabel={t('sb.position')} />
                          </View>
                          <Text style={styles.sub}>{t('sb.holder')}</Text>
                          <View style={styles.chips}>
                            <TouchableOpacity style={[styles.chip, !r.crewId && styles.chipOn]} onPress={() => setRow(r.id, { crewId: undefined, name: undefined })}>
                              <Text style={[styles.chipText, !r.crewId && { color: COLORS.textWhite }]}>—</Text>
                            </TouchableOpacity>
                            {aboard.map((c) => (
                              <TouchableOpacity key={c.id} style={[styles.chip, r.crewId === c.id && styles.chipOn]} onPress={() => setRow(r.id, { crewId: c.id, name: c.name })}>
                                <Text style={[styles.chipText, r.crewId === c.id && { color: COLORS.textWhite }]}>{c.rank ? `${c.name} · ${c.rank}` : c.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <Text style={styles.sub}>{t('sb.deputyQ')}</Text>
                          <View style={styles.chips}>
                            <TouchableOpacity style={[styles.chip, !r.deputyNo && styles.chipOn]} onPress={() => setRow(r.id, { deputyNo: undefined })}>
                              <Text style={[styles.chipText, !r.deputyNo && { color: COLORS.textWhite }]}>—</Text>
                            </TouchableOpacity>
                            {shown.rows.filter((x) => x.id !== r.id).map((x) => (
                              <TouchableOpacity key={x.id} style={[styles.chip, r.deputyNo === x.no && styles.chipOn]} onPress={() => setRow(r.id, { deputyNo: x.no })}>
                                <Text style={[styles.chipText, r.deputyNo === x.no && { color: COLORS.textWhite }]}>{`${x.no}. ${x.position}`}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TouchableOpacity onPress={() => arm(`rm:${r.id}`, () => { keep({ ...draft!, rows: draft!.rows.filter((x) => x.id !== r.id) }); setOpen(null); })}>
                            <Text style={[styles.link, { color: COLORS.danger, marginTop: SIZES.sm }]}>{armed === `rm:${r.id}` ? t('sb.removeSure') : t('sb.remove')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                    {draft ? <MciIcon name={editing ? 'chevron-up' : 'pencil-outline'} size={18} color={COLORS.textLight} /> : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* ---- areas of responsibility ---- */}
          {page === 'zones' ? (
            <Card>
              <Text style={styles.sub}>{t('sb.zonesIntro')}</Text>
              {zones.map((z) => (
                <View key={z.id} style={styles.person}>
                  <View style={{ flex: 1 }}>
                    {draft ? (
                      <>
                        <TextInput style={styles.input} value={z.name} onChangeText={(v) => setZone(z.id, { name: v })} accessibilityLabel={t('sb.zoneName')} />
                        <View style={styles.chips}>
                          {ZONE_KINDS.map((k) => (
                            <TouchableOpacity key={k} style={[styles.chip, z.kind === k && styles.chipOn]} onPress={() => setZone(z.id, { kind: k })}>
                              <Text style={[styles.chipText, z.kind === k && { color: COLORS.textWhite }]}>{tk(`sb.zone.${k}`)}</Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity onPress={() => arm(`z:${z.id}`, () => keep({ ...draft, zones: draft.zones.filter((x) => x.id !== z.id) }))}>
                            <Text style={[styles.link, { color: COLORS.danger }]}>{armed === `z:${z.id}` ? t('sb.removeSure') : t('sb.remove')}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.personName}>{z.name}</Text>
                        <Text style={styles.sub}>{tk(`sb.zone.${z.kind}`)}</Text>
                      </>
                    )}
                  </View>
                </View>
              ))}
              {draft ? (
                <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => keep({ ...draft, zones: [...draft.zones, { id: uid('sbz'), name: '', kind: 'space' }] })}>
                  <Text style={styles.smallText}>{t('sb.addZone')}</Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          ) : null}

          {/* ---- issue the draft ---- */}
          {draft ? (
            <Card style={{ borderLeftWidth: 6, borderLeftColor: COLORS.primary }}>
              <Label>{t('sb.changed')}</Label>
              <TextInput style={[styles.input, { minHeight: 50 }]} multiline value={draft.note ?? ''} onChangeText={(v) => keep({ ...draft, note: v })} placeholder={t('sb.changedPh')} accessibilityLabel={t('sb.changed')} />
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => arm('issue', () => void issue().catch(fail))}>
                  <MciIcon name="check-decagram-outline" size={18} color={COLORS.textWhite} />
                  <Text style={styles.btnText}>{armed === 'issue' ? t('sb.issueSure', { rev: Math.max(0, ...stationBills.map((b) => b.rev)) + 1 }) : t('sb.issue', { rev: Math.max(0, ...stationBills.map((b) => b.rev)) + 1 })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => arm('drop', () => { keep(null); setOpen(null); })}>
                  <Text style={[styles.link, { color: COLORS.danger }]}>{armed === 'drop' ? t('sb.dropSure') : t('sb.drop')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sub}>{t('sb.issueNote')}</Text>
            </Card>
          ) : null}

          {/* ---- paper ---- */}
          {bill && !draft ? (
            <View style={styles.row}>
              {page !== 'rows' && page !== 'zones' ? (
                <TouchableOpacity style={styles.small} onPress={() => void shareAlarm(bill, page, vessel, todayIso(), true).then(done, fail)}>
                  <Text style={styles.smallText}>{t('sb.printAlarm', { alarm: tk(`sb.alarm.${page}`) })}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.small} onPress={() => void shareBill(bill, vessel, todayIso(), true).then(done, fail)}>
                <Text style={styles.smallText}>{t('sb.printAll')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ---- earlier revisions ---- */}
          {!draft && stationBills.length > 1 ? (
            <Card>
              <Label>{t('sb.revisions')}</Label>
              {[...stationBills].sort((a, b) => b.rev - a.rev).map((b) => (
                <View key={b.id} style={[styles.row, { marginTop: SIZES.xs }]}>
                  <Text style={[styles.line, { flex: 1 }]}>{`${t('sb.revN', { rev: b.rev })} · ${uiDate(isoOf(b.issuedAt))} · ${b.issuedBy}${b.note ? ` · ${b.note}` : ''}`}</Text>
                  <TouchableOpacity onPress={() => void shareBill(b, vessel, todayIso(), b.id === bill?.id).then(done, fail)}>
                    <Text style={styles.link}>PDF</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    line: { color: COLORS.text, fontSize: SIZES.small, marginTop: 4 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.sm },
    chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.small },
    btn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    small: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    link: { color: COLORS.primary, fontWeight: '700' },
    person: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm, paddingVertical: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
    personName: { color: COLORS.textDark, fontWeight: '700', fontSize: SIZES.body, flexShrink: 1 },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, marginTop: SIZES.sm, color: COLORS.textDark },
  });
