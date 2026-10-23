// ===================================
// Security → Searches (types/searches.ts): stowaway searches before sailing and
// bomb searches after a threat, area by area, team by team (15 Oct 2026).
//
//   Search  start one (kind, why); the guidance for its kind on top; the areas
//           grouped by team, each marked Clear or Found — with a note — by whoever
//           searched it, from their own phone; the SSO / Master closes it with
//           the outcome and signs. PDF for the record.
//   Plan    the vessel's areas and teams — who searches where. Kept by the
//           officers; starts from a typical yacht.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { isAboard } from '../types/crew';
import { personName, roleAtLeast } from '../types/role';
import { PLAN_ID, SEARCH_GUIDANCE, SEARCH_LABEL, SearchArea, SearchKind, SearchPlan, SecuritySearch, areasFor, defaultPlan, searchDone } from '../types/searches';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { vesselHeader } from '../services/export';
import { exportDocPdf } from '../services/hospitalReport';
import { formatDate, uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, t as tt, tn, useT } from '../utils/i18n';

const hhmm = (t = Date.now()) => new Date(t).toTimeString().slice(0, 5);
const KIND_ICON: Record<SearchKind, string> = { stowaway: 'account-search-outline', bomb: 'bomb' };

export default function SearchesSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { searchPlans, searches, crew, vessel, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const people = useMemo(() => crew.filter(isAboard), [crew]);
  const plan: SearchPlan = searchPlans.find((p) => p.id === PLAN_ID) ?? defaultPlan();
  const [page, setPage] = useState<'search' | 'plan'>('search');
  const [start, setStart] = useState<{ kind: SearchKind; reason: string } | null>(null);
  const [outcome, setOutcome] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<SearchPlan | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const open = searches.filter((s) => !s.closed).sort((a, b) => b.updatedAt - a.updatedAt);
  const closed = searches.filter((s) => s.closed).sort((a, b) => b.closed!.at - a.closed!.at);
  const who = signer?.name ?? (sync.me ? personName(sync.me) : '');

  const begin = async () => {
    if (!start) return;
    const s: SecuritySearch = { id: uid('srch'), kind: start.kind, date: todayIso(), time: hhmm(), ...(start.reason.trim() ? { reason: start.reason.trim() } : {}), areas: areasFor(plan, start.kind), updatedAt: Date.now() };
    await saveRow(storage.SEARCHES_KEY, s);
    setStart(null);
    playSuccessSound();
  };

  const mark = async (s: SecuritySearch, areaId: string, result: 'clear' | 'found' | undefined) => {
    if (result && !who) return Alert.alert(t('srch.whoSearched'), t('pd.chooseName'));
    const k = `${s.id}:${areaId}`;
    if (result === 'found' && !(notes[k] ?? '').trim()) return Alert.alert(t('srch.found'), t('srch.foundNote'));
    const areas = s.areas.map((a) => (a.areaId !== areaId ? a : result ? { ...a, result, by: who, at: Date.now(), ...((notes[k] ?? '').trim() ? { note: notes[k].trim() } : {}) } : { areaId: a.areaId, name: a.name, ...(a.team ? { team: a.team } : {}) }));
    await saveRow(storage.SEARCHES_KEY, { ...s, areas });
    if (result === 'found') Alert.alert(t('srch.reportBridge'), s.kind === 'bomb' ? t('srch.bombDont') : t('srch.stowDont'));
  };

  const close = async (s: SecuritySearch) => {
    if (!officer) return Alert.alert(t('srch.closeQ'), t('srch.ssoCloses'));
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const left = s.areas.length - searchDone(s);
    const found = s.areas.filter((a) => a.result === 'found').length;
    const text = (outcome[s.id] ?? '').trim() || (found ? `${found} area${found === 1 ? '' : 's'} with findings — see the areas` : 'All areas searched — nothing found');
    const go = async () => {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${SEARCH_LABEL[s.kind]} ${formatDate(s.date)} — closed` });
      if (!sig) return;
      await saveRow(storage.SEARCHES_KEY, { ...s, closed: { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}), outcome: text } });
      playSuccessSound();
    };
    if (left) return Alert.alert(t('srch.notSearched'), t('srch.notMarked', { x: tn('n.area', left) }), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.close'), onPress: () => void go() }]);
    await go();
  };

  const pdf = (s: SecuritySearch) =>
    exportDocPdf({
      title: `${SEARCH_LABEL[s.kind]} — ${formatDate(s.date)} ${s.time}`,
      vesselLine: vesselHeader(vessel),
      sections: [
        { title: 'Search', rows: [['Kind', SEARCH_LABEL[s.kind]], ['Started', `${formatDate(s.date)} ${s.time}`], ['Why', s.reason ?? '—'], ['Outcome', s.closed?.outcome ?? 'Not closed']] },
        { title: 'Areas', table: { head: ['Area', 'Team', 'Result', 'By', 'Time', 'Note'], rows: s.areas.map((a) => [a.name, a.team ?? '', a.result === 'found' ? 'FOUND' : a.result === 'clear' ? 'Clear' : 'not searched', a.by ?? '', a.at ? hhmm(a.at) : '', a.note ?? '']) } },
        { title: 'Signature', signatures: [{ role: 'Search led by (SSO / Master)', name: s.closed ? `${s.closed.by}${s.closed.byRank ? ` · ${s.closed.byRank}` : ''}` : '', detail: s.closed ? `${formatDate(new Date(s.closed.at).toISOString().slice(0, 10))} ${hhmm(s.closed.at)}` : '' }] },
      ],
    }, `${SEARCH_LABEL[s.kind]} ${s.date}`, vessel).then((w) => typeof w === 'string' && setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w })), (e) => Alert.alert('PDF', String(e?.message ?? e)));

  // ---- plan ----
  const editPlan = draft ?? plan;
  const setArea = (id: string, patch: Partial<SearchArea>) => setDraft({ ...editPlan, areas: editPlan.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const savePlan = async () => {
    if (!draft) return;
    await saveRow(storage.SEARCH_PLAN_KEY, { ...draft, id: PLAN_ID, areas: draft.areas.filter((a) => a.name.trim()), teams: draft.teams.filter((t) => t.name.trim()) });
    setDraft(null);
    playSuccessSound();
  };

  return (
    <Screen scroll>
      <ScreenTitle title={t('srch.title')} subtitle={t('srch.sub')} help="Security (ISPS)" />
      <View style={styles.chips}>
        {(['search', 'plan'] as const).map((k) => (
          <TouchableOpacity key={k} style={[styles.chip, page === k && styles.chipOn]} onPress={() => setPage(k)}>
            <Text style={[styles.chipText, page === k && styles.chipTextOn]}>{k === 'search' ? `${t('srch.title')} · ${open.length ? t('srch.openN', { n: open.length }) : closed.length}` : t('srch.areasTeamsN', { n: plan.areas.length })}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {page === 'plan' ? (
        <>
          <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>Who searches where. A new search copies these areas with their teams.{officer ? '' : ' Kept by the SSO and the officers.'}</Text>
          <Label>{t('srch.teams')}</Label>
          {editPlan.teams.map((t) => (
            <Card key={t.id}>
              <TextInput style={[styles.input, { marginTop: 0, fontWeight: '700' }]} editable={officer} value={t.name} onChangeText={(v) => setDraft({ ...editPlan, teams: editPlan.teams.map((x) => (x.id === t.id ? { ...x, name: v } : x)) })} placeholder={tt('srch.teamName')} placeholderTextColor={COLORS.textLight} />
              <View style={styles.chips}>
                {people.map((p) => {
                  const on = t.members.includes(p.name);
                  return (
                    <TouchableOpacity key={p.id} disabled={!officer} style={[styles.chip, on && styles.chipOn]} onPress={() => setDraft({ ...editPlan, teams: editPlan.teams.map((x) => (x.id === t.id ? { ...x, members: on ? x.members.filter((n) => n !== p.name) : [...x.members, p.name] } : x)) })}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                {!people.length ? <Text style={styles.sub}>{tt('cm.emptyCrew')}</Text> : null}
              </View>
              <Text style={styles.sub}>{`${editPlan.areas.filter((a) => a.teamId === t.id).length} areas`}</Text>
            </Card>
          ))}
          {officer ? <TouchableOpacity onPress={() => setDraft({ ...editPlan, teams: [...editPlan.teams, { id: uid('tm'), name: `Team ${editPlan.teams.length + 1}`, members: [] }] })}><Text style={styles.link}>{`+ ${t('srch.team')}`}</Text></TouchableOpacity> : null}

          <Label>{t('srch.areas')}</Label>
          {editPlan.areas.map((a) => (
            <View key={a.id} style={[styles.row, { marginVertical: 2, gap: SIZES.xs }]}>
              <TextInput style={[styles.input, { flex: 2, minWidth: 200, marginTop: 0 }]} editable={officer} value={a.name} onChangeText={(v) => setArea(a.id, { name: v })} placeholder={t('srch.area')} placeholderTextColor={COLORS.textLight} />
              <Dropdown caption={t('srch.teamCap')} value={a.teamId ?? ''} onChange={(v: string) => officer && setArea(a.id, { teamId: v || undefined })} options={[{ value: '', label: '—' }, ...editPlan.teams.map((t) => ({ value: t.id, label: t.name }))]} style={{ flex: 1, minWidth: 160 }} />
              <Dropdown caption={t('srch.inCap')} value={a.only ?? ''} onChange={(v: string) => officer && setArea(a.id, { only: (v || undefined) as SearchKind | undefined })} options={[{ value: '', label: t('srch.both') }, { value: 'stowaway', label: t('srch.stowOnly') }, { value: 'bomb', label: t('srch.bombOnly') }]} style={{ flex: 1, minWidth: 160 }} />
              {officer ? <TouchableOpacity onPress={() => setDraft({ ...editPlan, areas: editPlan.areas.filter((x) => x.id !== a.id) })} hitSlop={8} accessibilityLabel={`Remove area — ${a.name}`}><MciIcon name="delete-outline" size={20} color={COLORS.textLight} /></TouchableOpacity> : null}
            </View>
          ))}
          {officer ? (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setDraft({ ...editPlan, areas: [...editPlan.areas, { id: uid('ar'), name: '', teamId: editPlan.teams[0]?.id }] })}><Text style={styles.link}>{`+ ${t('srch.area')}`}</Text></TouchableOpacity>
              {draft ? (
                <>
                  <TouchableOpacity style={styles.btn} onPress={() => void savePlan()}><Text style={styles.btnText}>{t('srch.savePlan')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setDraft(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {!start ? (
            <View style={[styles.row, { marginTop: 0 }]}>
              {(['stowaway', 'bomb'] as SearchKind[]).map((k) => (
                <TouchableOpacity key={k} style={[styles.btn, { flexDirection: 'row', alignItems: 'center', gap: 6 }, k === 'bomb' && { backgroundColor: COLORS.danger }]} onPress={() => setStart({ kind: k, reason: k === 'stowaway' ? 'Before departure' : '' })}>
                  <MciIcon name={KIND_ICON[k]} size={16} color={COLORS.textWhite} />
                  <Text style={styles.btnText}>{k === 'bomb' ? t('srch.startBomb') : t('srch.startStow')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Card>
              <Label>{SEARCH_LABEL[start.kind]}</Label>
              {SEARCH_GUIDANCE[start.kind].map((g) => <Text key={g} style={styles.sub}>{`• ${g}`}</Text>)}
              <TextInput style={styles.input} value={start.reason} onChangeText={(v) => setStart({ ...start, reason: v })} placeholder={start.kind === 'bomb' ? t('srch.whyBomb') : t('srch.whyStow')} placeholderTextColor={COLORS.textLight} />
              <Text style={styles.sub}>{`${areasFor(plan, start.kind).length} areas, ${plan.teams.length} teams — from Areas and teams.`}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void begin()}><Text style={styles.btnText}>{t('srch.start')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setStart(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Who is ticking the areas on this phone — at the top, before the long list of areas. */}
          {open.length && picker ? <View style={{ marginVertical: SIZES.sm }}><Text style={styles.sub}>{t('srch.as')}</Text>{picker}</View> : null}
          {open.map((s) => {
            const teams = [...new Set(s.areas.map((a) => a.team ?? 'No team'))];
            const found = s.areas.filter((a) => a.result === 'found');
            return (
              <Card key={s.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <MciIcon name={KIND_ICON[s.kind]} size={22} color={s.kind === 'bomb' ? COLORS.danger : COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{`${SEARCH_LABEL[s.kind]} — ${t('srch.startedAt', { time: s.time })}`}</Text>
                    <Text style={styles.sub}>{[s.reason, t('srch.progress', { k: searchDone(s), n: s.areas.length })].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
                {found.length ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '800' }]}>{`${t('srch.foundCaps')}: ${found.map((a) => `${a.name} — ${a.note ?? ''}`).join('; ')}`}</Text> : null}
                {SEARCH_GUIDANCE[s.kind].slice(1, 4).map((g) => <Text key={g} style={styles.sub}>{`• ${g}`}</Text>)}
                {teams.map((t) => {
                  const team = plan.teams.find((x) => x.name === t);
                  return (
                    <View key={t} style={{ marginTop: SIZES.sm }}>
                      <Text style={[styles.sub, { fontWeight: '800', color: COLORS.textDark }]}>{`${t}${team?.members.length ? ` — ${team.members.join(', ')}` : ''}`}</Text>
                      {s.areas.filter((a) => (a.team ?? 'No team') === t).map((a) => {
                        const k = `${s.id}:${a.areaId}`;
                        const c = a.result === 'found' ? COLORS.danger : a.result === 'clear' ? COLORS.success : COLORS.border;
                        return (
                          <View key={a.areaId} style={[styles.item, { borderLeftColor: c, marginBottom: 4 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }}>
                              <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 }}>
                                <Text style={styles.name}>{a.name}</Text>
                                {a.result ? <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>{`${a.result === 'clear' ? tt('srch.clear') : tt('srch.foundCaps')} · ${a.by ?? ''} ${a.at ? hhmm(a.at) : ''}${a.note ? ` · ${a.note}` : ''}`}</Text> : null}
                              </View>
                              {!a.result ? (
                                <>
                                  <TextInput style={[styles.input, { flexBasis: 160, flexGrow: 1, marginTop: 0 }]} value={notes[k] ?? ''} onChangeText={(v) => setNotes({ ...notes, [k]: v })} placeholder={tt('srch.notePh')} placeholderTextColor={COLORS.textLight} />
                                  <TouchableOpacity style={[styles.small, { borderColor: COLORS.success }]} onPress={() => void mark(s, a.areaId, 'clear')}><Text style={[styles.smallText, { color: COLORS.success }]}>{tt('srch.clear')}</Text></TouchableOpacity>
                                  <TouchableOpacity style={[styles.small, { borderColor: COLORS.danger }]} onPress={() => void mark(s, a.areaId, 'found')}><Text style={[styles.smallText, { color: COLORS.danger }]}>{tt('srch.found')}</Text></TouchableOpacity>
                                </>
                              ) : (
                                <TouchableOpacity onPress={() => void mark(s, a.areaId, undefined)}><Text style={styles.link}>{tt('srch.undo')}</Text></TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
                {officer ? (
                  <>
                    <TextInput style={styles.input} value={outcome[s.id] ?? ''} onChangeText={(v) => setOutcome({ ...outcome, [s.id]: v })} placeholder={t('srch.outcomePh')} placeholderTextColor={COLORS.textLight} multiline />
                    <View style={styles.row}>
                      <TouchableOpacity style={styles.btn} onPress={() => void close(s)}><Text style={styles.btnText}>{t('srch.closeSign')}</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.small} onPress={() => void pdf(s)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </Card>
            );
          })}
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}

          {closed.length ? <Label>{t('srch.done')}</Label> : null}
          {closed.map((s) => {
            const found = s.areas.some((a) => a.result === 'found');
            return (
              <View key={s.id} style={[styles.item, { borderLeftColor: found ? COLORS.danger : COLORS.success }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <MciIcon name={KIND_ICON[s.kind]} size={18} color={COLORS.textDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{`${SEARCH_LABEL[s.kind]} · ${uiDate(s.date)} ${s.time}`}</Text>
                    <Text style={styles.sub}>{[s.reason, t('srch.areasN', { k: searchDone(s), n: s.areas.length }), s.closed!.outcome, t('srch.signedBy', { by: s.closed!.by })].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <TouchableOpacity style={styles.small} onPress={() => void pdf(s)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
          {!open.length && !closed.length && !start ? <Text style={styles.sub}>{t('srch.empty')}</Text> : null}
        </>
      )}
    </Screen>
  );
}
