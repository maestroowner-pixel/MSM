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
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

const hhmm = (t = Date.now()) => new Date(t).toTimeString().slice(0, 5);
const KIND_ICON: Record<SearchKind, string> = { stowaway: 'account-search-outline', bomb: 'bomb' };

export default function SearchesSc() {
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
    if (result && !who) return Alert.alert('Who searched it?', 'Choose your name below.');
    const k = `${s.id}:${areaId}`;
    if (result === 'found' && !(notes[k] ?? '').trim()) return Alert.alert('Found', 'Write what was found and where — then press Found.');
    const areas = s.areas.map((a) => (a.areaId !== areaId ? a : result ? { ...a, result, by: who, at: Date.now(), ...((notes[k] ?? '').trim() ? { note: notes[k].trim() } : {}) } : { areaId: a.areaId, name: a.name, ...(a.team ? { team: a.team } : {}) }));
    await saveRow(storage.SEARCHES_KEY, { ...s, areas });
    if (result === 'found') Alert.alert('Report to the bridge now', s.kind === 'bomb' ? 'Do not touch it. Clear and close off the area; no radios or phones near it.' : 'Keep them in sight; do not approach alone.');
  };

  const close = async (s: SecuritySearch) => {
    if (!officer) return Alert.alert('Close the search', 'The SSO or the Master closes it.');
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name below.');
    const left = s.areas.length - searchDone(s);
    const found = s.areas.filter((a) => a.result === 'found').length;
    const text = (outcome[s.id] ?? '').trim() || (found ? `${found} area${found === 1 ? '' : 's'} with findings — see the areas` : 'All areas searched — nothing found');
    const go = async () => {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${SEARCH_LABEL[s.kind]} ${formatDate(s.date)} — closed` });
      if (!sig) return;
      await saveRow(storage.SEARCHES_KEY, { ...s, closed: { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}), outcome: text } });
      playSuccessSound();
    };
    if (left) return Alert.alert('Areas not searched', `${left} area${left === 1 ? '' : 's'} not marked. Close the search anyway?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Close', onPress: () => void go() }]);
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
    }, `${SEARCH_LABEL[s.kind]} ${s.date}`, vessel).then((w) => typeof w === 'string' && setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`), (e) => Alert.alert('PDF', String(e?.message ?? e)));

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
      <ScreenTitle title="Searches" subtitle="Stowaway and bomb searches — every area, by team" help="Security (ISPS)" />
      <View style={styles.chips}>
        {(['search', 'plan'] as const).map((k) => (
          <TouchableOpacity key={k} style={[styles.chip, page === k && styles.chipOn]} onPress={() => setPage(k)}>
            <Text style={[styles.chipText, page === k && styles.chipTextOn]}>{k === 'search' ? `Searches · ${open.length ? `${open.length} open` : closed.length}` : `Areas and teams · ${plan.areas.length}`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {page === 'plan' ? (
        <>
          <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>Who searches where. A new search copies these areas with their teams.{officer ? '' : ' Kept by the SSO and the officers.'}</Text>
          <Label>Teams</Label>
          {editPlan.teams.map((t) => (
            <Card key={t.id}>
              <TextInput style={[styles.input, { marginTop: 0, fontWeight: '700' }]} editable={officer} value={t.name} onChangeText={(v) => setDraft({ ...editPlan, teams: editPlan.teams.map((x) => (x.id === t.id ? { ...x, name: v } : x)) })} placeholder="Team name" placeholderTextColor={COLORS.textLight} />
              <View style={styles.chips}>
                {people.map((p) => {
                  const on = t.members.includes(p.name);
                  return (
                    <TouchableOpacity key={p.id} disabled={!officer} style={[styles.chip, on && styles.chipOn]} onPress={() => setDraft({ ...editPlan, teams: editPlan.teams.map((x) => (x.id === t.id ? { ...x, members: on ? x.members.filter((n) => n !== p.name) : [...x.members, p.name] } : x)) })}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                {!people.length ? <Text style={styles.sub}>The crew list is empty.</Text> : null}
              </View>
              <Text style={styles.sub}>{`${editPlan.areas.filter((a) => a.teamId === t.id).length} areas`}</Text>
            </Card>
          ))}
          {officer ? <TouchableOpacity onPress={() => setDraft({ ...editPlan, teams: [...editPlan.teams, { id: uid('tm'), name: `Team ${editPlan.teams.length + 1}`, members: [] }] })}><Text style={styles.link}>+ Team</Text></TouchableOpacity> : null}

          <Label>Areas</Label>
          {editPlan.areas.map((a) => (
            <View key={a.id} style={[styles.row, { marginVertical: 2, gap: SIZES.xs }]}>
              <TextInput style={[styles.input, { flex: 2, minWidth: 200, marginTop: 0 }]} editable={officer} value={a.name} onChangeText={(v) => setArea(a.id, { name: v })} placeholder="Area" placeholderTextColor={COLORS.textLight} />
              <Dropdown caption="TEAM" value={a.teamId ?? ''} onChange={(v: string) => officer && setArea(a.id, { teamId: v || undefined })} options={[{ value: '', label: '—' }, ...editPlan.teams.map((t) => ({ value: t.id, label: t.name }))]} style={{ flex: 1, minWidth: 160 }} />
              <Dropdown caption="IN" value={a.only ?? ''} onChange={(v: string) => officer && setArea(a.id, { only: (v || undefined) as SearchKind | undefined })} options={[{ value: '', label: 'Both searches' }, { value: 'stowaway', label: 'Stowaway only' }, { value: 'bomb', label: 'Bomb only' }]} style={{ flex: 1, minWidth: 160 }} />
              {officer ? <TouchableOpacity onPress={() => setDraft({ ...editPlan, areas: editPlan.areas.filter((x) => x.id !== a.id) })} hitSlop={8} accessibilityLabel={`Remove area — ${a.name}`}><MciIcon name="delete-outline" size={20} color={COLORS.textLight} /></TouchableOpacity> : null}
            </View>
          ))}
          {officer ? (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setDraft({ ...editPlan, areas: [...editPlan.areas, { id: uid('ar'), name: '', teamId: editPlan.teams[0]?.id }] })}><Text style={styles.link}>+ Area</Text></TouchableOpacity>
              {draft ? (
                <>
                  <TouchableOpacity style={styles.btn} onPress={() => void savePlan()}><Text style={styles.btnText}>Save the plan</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setDraft(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
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
                  <Text style={styles.btnText}>{`Start a ${SEARCH_LABEL[k].toLowerCase()}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Card>
              <Label>{SEARCH_LABEL[start.kind]}</Label>
              {SEARCH_GUIDANCE[start.kind].map((g) => <Text key={g} style={styles.sub}>{`• ${g}`}</Text>)}
              <TextInput style={styles.input} value={start.reason} onChangeText={(v) => setStart({ ...start, reason: v })} placeholder={start.kind === 'bomb' ? 'Why — threat by phone at 14:20, suspect bag found…' : 'Why — before departure from…'} placeholderTextColor={COLORS.textLight} />
              <Text style={styles.sub}>{`${areasFor(plan, start.kind).length} areas, ${plan.teams.length} teams — from Areas and teams.`}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void begin()}><Text style={styles.btnText}>Start</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setStart(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Who is ticking the areas on this phone — at the top, before the long list of areas. */}
          {open.length && picker ? <View style={{ marginVertical: SIZES.sm }}><Text style={styles.sub}>Searching as</Text>{picker}</View> : null}
          {open.map((s) => {
            const teams = [...new Set(s.areas.map((a) => a.team ?? 'No team'))];
            const found = s.areas.filter((a) => a.result === 'found');
            return (
              <Card key={s.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <MciIcon name={KIND_ICON[s.kind]} size={22} color={s.kind === 'bomb' ? COLORS.danger : COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{`${SEARCH_LABEL[s.kind]} — started ${s.time}`}</Text>
                    <Text style={styles.sub}>{[s.reason, `${searchDone(s)} of ${s.areas.length} areas searched`].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
                {found.length ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '800' }]}>{`FOUND: ${found.map((a) => `${a.name} — ${a.note ?? ''}`).join('; ')}`}</Text> : null}
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
                                {a.result ? <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>{`${a.result === 'clear' ? 'Clear' : 'FOUND'} · ${a.by ?? ''} ${a.at ? hhmm(a.at) : ''}${a.note ? ` · ${a.note}` : ''}`}</Text> : null}
                              </View>
                              {!a.result ? (
                                <>
                                  <TextInput style={[styles.input, { flexBasis: 160, flexGrow: 1, marginTop: 0 }]} value={notes[k] ?? ''} onChangeText={(v) => setNotes({ ...notes, [k]: v })} placeholder="Note (what was found)" placeholderTextColor={COLORS.textLight} />
                                  <TouchableOpacity style={[styles.small, { borderColor: COLORS.success }]} onPress={() => void mark(s, a.areaId, 'clear')}><Text style={[styles.smallText, { color: COLORS.success }]}>Clear</Text></TouchableOpacity>
                                  <TouchableOpacity style={[styles.small, { borderColor: COLORS.danger }]} onPress={() => void mark(s, a.areaId, 'found')}><Text style={[styles.smallText, { color: COLORS.danger }]}>Found</Text></TouchableOpacity>
                                </>
                              ) : (
                                <TouchableOpacity onPress={() => void mark(s, a.areaId, undefined)}><Text style={styles.link}>Undo</Text></TouchableOpacity>
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
                    <TextInput style={styles.input} value={outcome[s.id] ?? ''} onChangeText={(v) => setOutcome({ ...outcome, [s.id]: v })} placeholder="Outcome — all clear; or what was found and what was done" placeholderTextColor={COLORS.textLight} multiline />
                    <View style={styles.row}>
                      <TouchableOpacity style={styles.btn} onPress={() => void close(s)}><Text style={styles.btnText}>Close and sign</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.small} onPress={() => void pdf(s)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </Card>
            );
          })}
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}

          {closed.length ? <Label>Searches done</Label> : null}
          {closed.map((s) => {
            const found = s.areas.some((a) => a.result === 'found');
            return (
              <View key={s.id} style={[styles.item, { borderLeftColor: found ? COLORS.danger : COLORS.success }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <MciIcon name={KIND_ICON[s.kind]} size={18} color={COLORS.textDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{`${SEARCH_LABEL[s.kind]} · ${formatDate(s.date)} ${s.time}`}</Text>
                    <Text style={styles.sub}>{[s.reason, `${searchDone(s)}/${s.areas.length} areas`, s.closed!.outcome, `signed ${s.closed!.by}`].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <TouchableOpacity style={styles.small} onPress={() => void pdf(s)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
          {!open.length && !closed.length && !start ? <Text style={styles.sub}>No searches recorded. Set the areas and teams first (Areas and teams), then start one before sailing.</Text> : null}
        </>
      )}
    </Screen>
  );
}
