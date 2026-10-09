// ===================================
// Documents — the vessel's SMS, procedures, circulars and standing orders, and
// who has read and signed for each (types/docs.ts).
//
// Top of the screen is the question each crew member opens it with: "what have
// I still to read?" — worked out for the person this device signs as (its own
// account, or the name last picked on it). Below, every document with how many
// of the crew list have signed its current revision, so an officer sees at a
// glance which circular is still going round.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { DOC_CATEGORY_LABEL, IsmDoc } from '../types/docs';
import { personName, roleAtLeast } from '../types/role';
import { iHaveRead, readStatus, reviewState } from '../services/docs';
import { todayIso } from '../services/pms';
import { uid } from '../utils/id';

export default function DocsSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { docs, docAcks, crew, prefs } = useData();
  const sync = useSync();
  const [q, setQ] = useState('');
  const today = todayIso();

  // Who "I" am on this device: its account, else the crew member last picked.
  const me = useMemo(() => {
    if (sync.me) return { key: `device:${sync.me.id}`, name: personName(sync.me) };
    const c = crew.find((x) => x.id === prefs?.lastCrewId && !x.deleted);
    return c ? { key: c.id, name: c.name } : null;
  }, [sync.me, crew, prefs?.lastCrewId]);

  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return docs
      .filter((d) => !n || [d.title, d.docNo, DOC_CATEGORY_LABEL[d.category]].some((v) => v?.toLowerCase().includes(n)))
      .sort((a, b) => (a.docNo ?? a.title).localeCompare(b.docNo ?? b.title, undefined, { numeric: true }));
  }, [docs, q]);

  const mine = useMemo(
    () => (me ? shown.filter((d) => d.mustRead !== false && !iHaveRead(d, docAcks, me.key, me.name)) : []),
    [shown, docAcks, me]
  );

  const open = (d: IsmDoc) => nav.navigate('Doc', { id: d.id });

  const Row = ({ d, highlight }: { d: IsmDoc; highlight?: boolean }) => {
    const st = readStatus(d, docAcks, crew);
    const rv = reviewState(d, today);
    return (
      <TouchableOpacity style={styles.row} onPress={() => open(d)} activeOpacity={0.7}>
        <View style={[styles.bar, { backgroundColor: highlight ? COLORS.warning : rv === 'overdue' ? COLORS.danger : COLORS.primary }]} />
        <MciIcon name={d.fileUri || d.filePending ? 'file-pdf-box' : 'text-box-outline'} size={22} color={COLORS.textLight} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{d.title}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[d.docNo, `Rev ${d.revision}`, DOC_CATEGORY_LABEL[d.category], rv === 'overdue' ? 'review overdue' : rv === 'soon' ? 'review due' : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {d.mustRead !== false && st.required ? (
          <Text style={[styles.count, st.unread.length ? { color: COLORS.warning } : { color: COLORS.success }]}>
            {`${st.read.length}/${st.required}`}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle title="Documents" subtitle="SMS, procedures, circulars — read and sign" help="ISM documents" />

      <TextInput
        style={styles.search}
        value={q}
        onChangeText={setQ}
        placeholder="Search title, number, type…"
        placeholderTextColor={COLORS.textLight}
      />

      {mine.length ? (
        <>
          <Label>{`To read — ${me!.name} (${mine.length})`}</Label>
          {mine.map((d) => <Row key={`m${d.id}`} d={d} highlight />)}
        </>
      ) : me && docs.length ? (
        <Text style={styles.allRead}>✓ {me.name} has read every document that must be read.</Text>
      ) : null}

      <View style={styles.head}>
        <Label>{`All documents (${shown.length})`}</Label>
        {canEdit ? (
          <TouchableOpacity onPress={() => nav.navigate('Doc', { id: uid('doc'), isNew: true })} hitSlop={10}>
            <Text style={styles.add}>+ Add document</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {docs.length === 0 ? (
        <Empty
          text={
            canEdit
              ? 'No documents yet. Add the SMS manual and procedures from the office (PDF), or write a circular or standing orders here — the crew then read and sign for each.'
              : 'No documents yet. Officers add the SMS, procedures and circulars here.'
          }
        />
      ) : (
        shown.map((d) => <Row key={d.id} d={d} />)
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    search: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.md },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.md },
    add: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    allRead: { color: COLORS.success, fontWeight: '600', fontSize: SIZES.small, marginBottom: SIZES.sm },
    row: { flexDirection: 'row', alignItems: 'center', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingRight: SIZES.md, marginBottom: SIZES.sm, overflow: 'hidden', gap: SIZES.sm },
    bar: { width: 5, alignSelf: 'stretch', marginRight: 2 },
    title: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    count: { fontSize: SIZES.body, fontWeight: '800' },
  });
