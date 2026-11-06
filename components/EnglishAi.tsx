// ===================================
// "In English (AI)" under a box the crew writes in (plan AI-9,
// services/englishAi.ts): the English comes back beside what was written, the
// writer takes it or keeps their own. Shown only with the AI on and something
// written; names leave the device as tokens and come back.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { useTheme } from '../contexts/ThemeContext';
import { aiCall, aiReady } from '../services/ai';
import { isNetworkError } from '../services/aiQueue';
import { EnglishKind, EnglishRead, EnglishReply, maskPeople, MAX_ENGLISH, readEnglish } from '../services/englishAi';
import { peopleOf } from '../services/incidentAi';
import { Palette, SIZES } from '../theme';
import { t, useT } from '../utils/i18n';

export function EnglishAi({ value, onChange, kind }: { value: string; onChange: (v: string) => void; kind: EnglishKind }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const sync = useSync();
  const { crew } = useData();
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<(EnglishRead & { of: string }) | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Typed on after asking: the English no longer matches the box.
  useEffect(() => {
    if (read && read.of !== value) setRead(null);
  }, [value, read]);

  if (!aiReady(sync.enrolled) || value.trim().length < 2) return note ? <Text style={styles.sub}>{note}</Text> : null;

  const go = async () => {
    setBusy(true);
    setNote(null);
    try {
      const of = value;
      const masked = maskPeople(of.slice(0, MAX_ENGLISH), peopleOf({ crew }));
      const r = readEnglish(await aiCall<EnglishReply>('english', { text: masked.text, kind }), masked.text, masked.tokens, of);
      if (!r) setNote(t('eng.nothing'));
      else if (r.same) setNote(t('eng.already'));
      else setRead({ ...r, of });
    } catch (e: any) {
      setNote(isNetworkError(e) ? t('eng.offline') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {read ? (
        <View style={styles.box}>
          <Text style={styles.sub}>{t('eng.head')}</Text>
          <Text style={styles.text}>{read.english}</Text>
          {read.lost.length ? <Text style={[styles.sub, { color: COLORS.warning }]}>{t('eng.lost', { names: read.lost.join(', ') })}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                onChange(read.english);
                setRead(null);
                setNote(t('eng.used'));
              }}
            >
              <Text style={styles.btnText}>{t('eng.use')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRead(null)} hitSlop={8}>
              <Text style={styles.link}>{t('eng.keep')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => void go()} disabled={busy} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
          <Text style={[styles.link, busy && { opacity: 0.5 }]}>{busy ? t('eng.working') : t('eng.go')}</Text>
        </TouchableOpacity>
      )}
      {note && !read ? <Text style={styles.sub}>{note}</Text> : null}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    text: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 2 },
    box: { borderLeftWidth: 3, borderLeftColor: COLORS.primary, paddingLeft: SIZES.sm, marginTop: SIZES.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.sm },
    btn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    btnText: { color: COLORS.textWhite, fontWeight: '700' },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small, marginTop: SIZES.xs },
  });
