// ===================================
// Under a record book's form: the late-entry warning with its reason, and the
// switch "Entered from the paper record book" with the page (services/entryOrigin).
// The values live in the form itself, so the book's draft keeps them too.
// ===================================

import React from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { uiDate } from '../utils/dates';
import { t } from '../utils/i18n';

export interface OriginForm { lateWhy: string; fromPaper: boolean; paperPage: string }
export const ORIGIN_BLANK: OriginForm = { lateWhy: '', fromPaper: false, paperPage: '' };

export function EntryOriginFields({ later, value, onChange }: { later?: { date: string; time?: string }; value: OriginForm; onChange: (v: OriginForm) => void }) {
  const COLORS = useTheme();
  const input = { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SIZES.sm, color: COLORS.textDark, marginTop: 4 } as const;
  return (
    <View style={{ marginTop: SIZES.sm }}>
      {later ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: COLORS.warning, paddingLeft: SIZES.sm, marginBottom: SIZES.sm }}>
          <Text style={{ color: COLORS.textDark, fontWeight: '600' }}>{t('origin.late', { when: `${uiDate(later.date)}${later.time ? ` ${later.time}` : ''}` })}</Text>
          {!value.fromPaper ? (
            <TextInput style={input} value={value.lateWhy} onChangeText={(v) => onChange({ ...value, lateWhy: v })} placeholder={t('origin.lateWhy')} placeholderTextColor={COLORS.textLight} />
          ) : (
            <Text style={{ color: COLORS.textLight, marginTop: 2 }}>{t('origin.paperIsReason')}</Text>
          )}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: COLORS.textDark, flex: 1 }}>{t('origin.fromPaper')}</Text>
        <Switch value={value.fromPaper} onValueChange={(v) => onChange({ ...value, fromPaper: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
      </View>
      {value.fromPaper ? (
        <TextInput style={input} value={value.paperPage} onChangeText={(v) => onChange({ ...value, paperPage: v })} placeholder={t('origin.page')} placeholderTextColor={COLORS.textLight} />
      ) : null}
    </View>
  );
}
