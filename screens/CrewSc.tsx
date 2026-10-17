// ===================================
// Crew — the list of people who can sign an inspection.
//
// Not accounts, and not a login: see types/crew.ts for why a shared bridge
// tablet at 0300 is the wrong place for per-person passwords. This screen is the
// vocabulary the signature picker draws on, and it travels with the vessel.
//
// Retiring vs deleting is the only decision on the screen, and it matters:
// somebody who has signed off two years of monthly rounds should be retired when
// they leave, so the history keeps a live link and the picker stays short.
// Deleting is offered because a typo shouldn't be permanent — and it is safe,
// because a signature stores the NAME, not a reference to this row.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { loadCrewPhotos } from '../services/crewPhotos';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { moduleOn } from '../constants/modules';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { crewListGaps, crewListRows, planCrewImport } from '../services/crewList';
import { exportCrewListPdf, exportCrewSheet, exportCrewTemplate, pickCrewSheet } from '../services/crewListReport';
import { pickSheetRows } from '../services/sheetFiles';
import { aiRenameHeadings, rowsToWorkbook } from '../services/aiImport';
import { aiReady } from '../services/ai';
import { CrewRow, parseCrewWorkbook } from '../services/crewList';
import { crewIssues, issueSummary, worstIssue } from '../services/crewIssues';
import { useSdmImport } from '../components/useSdmImport';
import { SIZES, Palette } from '../theme';
import { CrewMember } from '../types/crew';
import { uid } from '../utils/id';
import { statusFromDate } from '../utils/dates';
import { useSync } from '../contexts/SyncContext';
import * as accounts from '../services/accounts';
import { EnrolledDevice, personName } from '../types/role';

export default function CrewSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { crew, vessel, inspections: trail, certificates, crewPrivate, saveCrewMember, saveCrewPrivate, removeCrewMember } = useData();
  // ID card photos on this device (services/crewPhotos) — the faces in the list.
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useFocusEffect(
    React.useCallback(() => {
      void loadCrewPhotos().then(setPhotos);
    }, [])
  );

  /**
   * Only a Master edits this list.
   *
   * Everyone else already IS on it: a device is bound to a named person when it
   * enrols, so asking an officer to type their own name again is asking the same
   * question twice and inviting two spellings of it. What the Master adds on top
   * is the RANK, and people who sign but carry no device — a bosun without a
   * phone still has to be a signer, which is why this list is not simply the
   * device list.
   */
  const { role: myRole, enrolled: isEnrolled } = useSync();
  // With crew management on (`crewCerts`), the Chief Officer keeps the list too,
  // and a device not joined to any vessel is its owner's to fill in.
  const crewMgmt = moduleOn('crewCerts');
  const isMaster = myRole === 'superadmin' || (crewMgmt && (myRole === 'admin' || !isEnrolled));
  const rankKnown = myRole !== null || (crewMgmt && !isEnrolled);

  const imo = (vessel?.imo ?? '').replace(/\D/g, '');
  const [enrolled, setEnrolled] = useState<EnrolledDevice[]>([]);

  useEffect(() => {
    if (!imo || !isMaster) return;
    try {
      return accounts.watchDevices(imo, setEnrolled);
    } catch {
      return;
    }
  }, [imo, isMaster]);

  /** Enrolled people who are not on the signing list yet — one tap, no typing. */
  const missing = useMemo(() => {
    const have = new Set(crew.map((c) => c.name.trim().toLowerCase()));
    const seen = new Set<string>();
    return enrolled.filter((d) => {
      const n = personName(d).trim();
      if (!n || have.has(n.toLowerCase()) || seen.has(n.toLowerCase())) return false;
      seen.add(n.toLowerCase());
      return true;
    });
  }, [enrolled, crew]);

  const addEnrolled = async (d: EnrolledDevice) => {
    const now = Date.now();
    await saveCrewMember({
      id: uid('crew'),
      name: personName(d),
      // The rank came with the invitation, so the signature line is filled in
      // without anyone retyping it — and it reads the same on every device.
      ...(d.position ? { rank: d.position } : {}),
      active: true,
      addedAt: now,
      updatedAt: now,
    });
  };

  const importSdm = useSdmImport();
  // What needs doing per person (expired / due / missing), for the row badge.
  const issuesOf = (c: CrewMember) => (crewMgmt ? crewIssues(c, crewPrivate.find((p) => p.id === c.id), certificates, isMaster) : []);

  // ---- Crew list (FAL Form 5) and Excel import ----
  const [listing, setListing] = useState(false);
  const [arrival, setArrival] = useState(true);
  const [port, setPort] = useState('');
  const [listDate, setListDate] = useState(new Date().toISOString().slice(0, 10));
  const [listSaved, setListSaved] = useState<string | null>(null);
  const listRows = useMemo(() => crewListRows(crew, crewPrivate), [crew, crewPrivate]);
  const listGaps = useMemo(() => crewListGaps(listRows), [listRows]);

  const makeList = async () => {
    if (!listRows.length) return Alert.alert('Crew list', 'Nobody is on board in the crew list.');
    try {
      const where = await exportCrewListPdf({ vessel, arrival, port: port.trim(), date: listDate, rows: listRows });
      if (typeof where === 'string') setListSaved(where === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${where}”`);
    } catch (e: any) {
      Alert.alert('Crew list', String(e?.message ?? e));
    }
  };

  // Any crew list, its columns named any way: the AI reads the headings (and masked samples), never the list (services/aiImport).
  const importAi = async () => {
    try {
      const file = await pickSheetRows();
      if (!file) return;
      setListSaved('The AI is reading the columns…');
      const r = await aiRenameHeadings(file.rows, 'crew');
      setListSaved(null);
      await importSheet({ name: file.name, rows: parseCrewWorkbook(rowsToWorkbook(r.rows)) }, `Columns read by the AI: ${r.mapped.map((m) => `${m.from} → ${m.to}`).join('; ')}.`);
    } catch (e: any) {
      setListSaved(null);
      Alert.alert('Import', String(e?.message ?? e));
    }
  };

  const importSheet = async (given?: { name: string; rows: CrewRow[] }, note?: string) => {
    try {
      const picked = given ?? (await pickCrewSheet());
      if (!picked) return;
      if (!picked.rows.length) return Alert.alert('Import', `No crew found in “${picked.name}”. Use the crew list template.`);
      const plan = planCrewImport(picked.rows, crew, crewPrivate);
      const unknown = picked.rows.filter((r) => r.nationalityUnknown).map((r) => `${r.name}: “${r.nationalityUnknown}”`);
      const apply = async () => {
        for (const m of plan.members) await saveCrewMember(m);
        for (const p of plan.privates) await saveCrewPrivate(JSON.parse(JSON.stringify(p)));
        Alert.alert('Crew imported', `${plan.added.length} added, ${plan.updated.length} updated — all signed on.`);
      };
      Alert.alert(
        `Import ${picked.rows.length} from “${picked.name}”?`,
        [
          note ?? null,
          plan.added.length ? `New: ${plan.added.join(', ')}.` : null,
          plan.updated.length ? `Updated (already on the list): ${plan.updated.join(', ')}.` : null,
          'Everyone in the sheet is signed on. Empty cells leave what the app already has.',
          unknown.length ? `Nationality not recognised — enter the 2-letter code: ${unknown.join('; ')}.` : null,
        ].filter(Boolean).join('\n\n'),
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Import', onPress: () => void apply() }]
      );
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    }
  };

  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [editing, setEditing] = useState<CrewMember | null>(null);

  const sorted = useMemo(
    () => [...crew].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [crew]
  );

  // How many signatures each person is carrying — shown so the master can see at
  // a glance that deleting somebody is throwing away a link to real history.
  const signedCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of trail) {
      if (i.byId) counts.set(i.byId, (counts.get(i.byId) ?? 0) + 1);
    }
    return counts;
  }, [trail]);

  const reset = () => {
    setName('');
    setRank('');
    setEditing(null);
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    const now = Date.now();
    if (editing) {
      await saveCrewMember({ ...editing, name: n, rank: rank.trim() || undefined });
    } else {
      await saveCrewMember({
        id: uid('crew'),
        name: n,
        rank: rank.trim() || undefined,
        active: true,
        addedAt: now,
        updatedAt: now,
      });
    }
    reset();
  };

  const startEdit = (c: CrewMember) => {
    setEditing(c);
    setName(c.name);
    setRank(c.rank ?? '');
  };

  const toggleActive = (c: CrewMember) => saveCrewMember({ ...c, active: !c.active });

  const confirmDelete = (c: CrewMember) => {
    const n = signedCount.get(c.id) ?? 0;
    Alert.alert(
      'Remove from crew list',
      n > 0
        ? `${c.name} has signed ${n} inspection${n === 1 ? '' : 's'}. Those records keep the name and stay exactly as they are — but the link back to this entry is lost. Retiring instead keeps everything joined up.`
        : `Remove ${c.name} from the crew list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(c.active ? [{ text: 'Retire instead', onPress: () => void toggleActive(c) }] : []),
        { text: 'Remove', style: 'destructive' as const, onPress: () => void removeCrewMember(c.id) },
      ]
    );
  };

  /** Each person's own certificates: how many, and how many need action. */
  const papers = useMemo(() => {
    const m = new Map<string, { total: number; expired: number; due: number }>();
    for (const cert of certificates) {
      if (cert.scope !== 'crew' || !cert.crewId) continue;
      const p = m.get(cert.crewId) ?? { total: 0, expired: 0, due: 0 };
      const st = statusFromDate(cert.expiryDate);
      p.total += 1;
      if (st === 'expired') p.expired += 1;
      if (st === 'due') p.due += 1;
      m.set(cert.crewId, p);
    }
    return m;
  }, [certificates]);

  const renderRow = ({ item: c }: { item: CrewMember }) => {
    const n = signedCount.get(c.id) ?? 0;
    const p = papers.get(c.id);
    return (
      <Card>
        <TouchableOpacity style={styles.row} disabled={!crewMgmt} onPress={() => nav.navigate('CrewMember', { id: c.id })} activeOpacity={0.7}>
          {photos[c.id] ? (
            <Image source={{ uri: photos[c.id] }} style={{ width: 36, height: 46, borderRadius: 5, opacity: c.active ? 1 : 0.5 }} />
          ) : (
            <MciIcon
              name={c.active ? 'account' : 'account-off'}
              size={24}
              color={c.active ? COLORS.primary : COLORS.textLight}
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, !c.active && { color: COLORS.textLight }]}>{c.name}</Text>
            <Text style={styles.meta}>
              {[c.rank, c.cabin ? `cabin ${c.cabin}` : null, c.active ? null : 'Retired', crewMgmt && c.active && c.onBoard === false ? 'Signed off' : null, n ? `${n} signed` : null].filter(Boolean).join(' · ') ||
                'No rank set'}
            </Text>
            {(() => {
              const iss = c.active && c.onBoard !== false ? issuesOf(c) : [];
              const w = worstIssue(iss);
              return w ? (
                <Text style={[styles.meta, { fontWeight: '700', color: w === 'expired' ? COLORS.danger : COLORS.warning }]}>{`⚠ ${issueSummary(iss)}`}</Text>
              ) : null;
            })()}
            {moduleOn('crewCerts') ? (
            <TouchableOpacity onPress={() => nav.navigate('Main', { screen: 'Certificates', params: { tab: 'crew' } })} hitSlop={6}>
              <Text
                style={[
                  styles.meta,
                  p?.expired ? { color: COLORS.danger, fontWeight: '600' } : p?.due ? { color: COLORS.warning, fontWeight: '600' } : null,
                ]}
              >
                {p
                  ? [`${p.total} certificate${p.total === 1 ? '' : 's'}`, p.expired ? `${p.expired} expired` : null, p.due ? `${p.due} due soon` : null]
                      .filter(Boolean)
                      .join(' · ')
                  : 'No certificates recorded'}
              </Text>
            </TouchableOpacity>
            ) : null}
          </View>
          {isMaster ? (
            <>
              <TouchableOpacity onPress={() => startEdit(c)} hitSlop={10} style={styles.rowBtn}>
                <MciIcon name="pencil" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleActive(c)} hitSlop={10} style={styles.rowBtn}>
                <MciIcon
                  name={c.active ? 'account-arrow-right' : 'account-arrow-left'}
                  size={20}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(c)} hitSlop={10} style={styles.rowBtn}>
                <MciIcon name="delete" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            </>
          ) : null}
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle
        title={crewMgmt ? 'Crew list' : 'Crew'}
        subtitle={
          isMaster
            ? 'Who can sign an inspection. Names go on the record.'
            : 'Who can sign an inspection on this vessel.'
        }
      />

      {crewMgmt && isMaster ? (
        <Card>
          <Label>Crew list</Label>
          <Text style={styles.meta}>The IMO FAL Form 5 for port, agent and immigration — everyone on board. Or load the crew from Excel: fill the template on a computer and import it — or export the crew, correct it in Excel and import it back. A list from the agent reads too (Surname / Given names, Passport, DOB).</Text>
          <View style={styles.listBtns}>
            <TouchableOpacity style={styles.listBtn} onPress={() => setListing((v) => !v)}>
              <MciIcon name="file-pdf-box" size={18} color={COLORS.textWhite} />
              <Text style={styles.listBtnText}>Crew list (PDF)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.listBtnOutline} onPress={() => void exportCrewTemplate().catch((e) => Alert.alert('Template', String(e?.message ?? e)))}>
              <Text style={styles.listBtnOutlineText}>Excel template</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.listBtnOutline} onPress={() => void importSheet()}>
              <Text style={styles.listBtnOutlineText}>Import from Excel</Text>
            </TouchableOpacity>
            {aiReady(isEnrolled) ? (
              <TouchableOpacity style={styles.listBtnOutline} onPress={() => void importAi()}>
                <MciIcon name="creation" size={16} color={COLORS.primary} />
                <Text style={styles.listBtnOutlineText}>Any list (AI)</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.listBtnOutline} onPress={() => void exportCrewSheet(crew, crewPrivate, vessel).then((w) => { if (typeof w === 'string') setListSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`); }).catch((e) => Alert.alert('Export', String(e?.message ?? e)))}>
              <Text style={styles.listBtnOutlineText}>Export to Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.listBtnOutline} onPress={() => void importSdm()}>
              <Text style={styles.listBtnOutlineText}>Import SDM file (.sdm)</Text>
            </TouchableOpacity>
          </View>
          {listing ? (
            <View style={{ marginTop: SIZES.md }}>
              <View style={styles.listBtns}>
                {[true, false].map((a) => (
                  <TouchableOpacity key={String(a)} style={[styles.chip, arrival === a && styles.chipOn]} onPress={() => setArrival(a)}>
                    <Text style={[styles.chipText, arrival === a && styles.chipTextOn]}>{a ? 'Arrival' : 'Departure'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.input} value={port} onChangeText={setPort} placeholder={`Port of ${arrival ? 'arrival' : 'departure'}`} placeholderTextColor={COLORS.textLight} />
              <View style={{ marginTop: SIZES.sm }}>
                <SimpleDatePicker label={`Date of ${arrival ? 'arrival' : 'departure'}`} value={listDate} onChange={setListDate} />
              </View>
              {listGaps.length ? (
                <Text style={[styles.meta, { color: COLORS.warning, marginTop: SIZES.sm }]}>{`Missing — ${listGaps.slice(0, 6).join('; ')}${listGaps.length > 6 ? `; and ${listGaps.length - 6} more` : ''}`}</Text>
              ) : null}
              <TouchableOpacity style={[styles.primaryBtn, { marginTop: SIZES.md }]} onPress={() => void makeList()}>
                <Text style={styles.primaryBtnText}>{`Create the crew list — ${listRows.length} on board`}</Text>
              </TouchableOpacity>
              {listSaved ? <Text style={[styles.meta, { color: COLORS.success, fontWeight: '700', textAlign: 'center' }]}>{`✓ ${listSaved}`}</Text> : null}
            </View>
          ) : listSaved ? <Text style={[styles.meta, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${listSaved}`}</Text> : null}
        </Card>
      ) : null}

      {crewMgmt ? (
        <TouchableOpacity style={styles.matrixLink} onPress={() => nav.navigate('CrewMatrix')}>
          <MciIcon name="table-large" size={20} color={COLORS.primary} />
          <Text style={styles.matrixText}>Crew matrix — certificates, on board, sign on / off</Text>
          <Text style={styles.matrixText}>›</Text>
        </TouchableOpacity>
      ) : null}

      {!rankKnown ? (
        <Card>
          <Label>Working out what this device may do</Label>
          <Text style={styles.meta}>
            The list opens once the vessel has confirmed this device's rank.
          </Text>
        </Card>
      ) : null}

      {/* Reachable by URL even though Settings no longer offers it to a member. */}
      {rankKnown && !isMaster ? (
        <Card>
          <Label>The Master keeps this list</Label>
          <Text style={styles.meta}>
            You are already on it — your name and rank came from the account you were issued, and
            you can sign an inspection without doing anything here. Additions and changes are the
            Master's.
          </Text>
        </Card>
      ) : null}

      {isMaster && missing.length ? (
        <Card>
          <Label>Already enrolled, not yet a signer</Label>
          <Text style={styles.meta}>
            These people have a device on this vessel. Adding them here takes the name from their
            account, so it cannot be spelled two ways.
          </Text>
          {missing.map((d) => (
            <TouchableOpacity key={d.id} style={styles.enrolRow} onPress={() => void addEnrolled(d)}>
              <MciIcon name="account-plus" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{personName(d)}</Text>
                {d.position ? <Text style={styles.meta}>{d.position}</Text> : null}
              </View>
              <Text style={styles.meta}>Add</Text>
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}

      {isMaster ? (
      <Card>
        <Label>{editing ? 'Edit crew member' : 'Add crew member'}</Label>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          value={rank}
          onChangeText={setRank}
          placeholder="Rank / role (Third Officer, Bosun…)"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
          onSubmitEditing={submit}
        />
        <View style={styles.formBtns}>
          {editing ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, !name.trim() && { opacity: 0.4 }]}
            onPress={submit}
            disabled={!name.trim()}
          >
            <Text style={styles.primaryBtnText}>{editing ? 'Save' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
      </Card>
      ) : null}

      {/* Part of the page's own scroll. As a FlatList below the add form it got
          whatever height was left — on a laptop a strip two rows tall that
          could not be moved through (9 Oct 2026). A crew list is tens of rows. */}
      {sorted.length ? (
        sorted.map((c) => <React.Fragment key={c.id}>{renderRow({ item: c })}</React.Fragment>)
      ) : (
        <Empty
          text={
            isMaster
              ? 'No crew yet.\nAdd the people who will be carrying out the rounds.'
              : 'The Master has not named any signers yet.'
          }
        />
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    listBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.sm },
    listBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md },
    listBtnText: { color: COLORS.textWhite, fontWeight: '700' },
    listBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md },
    listBtnOutlineText: { color: COLORS.primary, fontWeight: '700' },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600' },
    chipTextOn: { color: COLORS.textWhite },
    matrixLink: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    matrixText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body, flexShrink: 1 },
    rowBtn: { padding: SIZES.xs },
    enrolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      paddingVertical: SIZES.sm,
    },
    name: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    meta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      color: COLORS.text,
      backgroundColor: COLORS.card,
      marginTop: SIZES.sm,
    },
    formBtns: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
    primaryBtn: {
      flex: 1,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700' },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: '700' },
  });
