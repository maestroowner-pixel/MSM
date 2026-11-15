// ===================================
// "On the plan: Main deck ›" under a defect or a yard job — where it is on the
// ship's plan (types/gaPlan.ts), and for the person who may, a way to put it
// there or move it. Nothing at all while the gaPlan module is off.
// ===================================

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { moduleOn } from '../constants/modules';
import { SIZES } from '../theme';
import { GaPinKind } from '../types/gaPlan';
import { pinFor } from '../services/gaPlan';
import { t, useT } from '../utils/i18n';

export function PlanPinLink({ kind, refId, editable }: { kind: GaPinKind; refId: string; editable: boolean }) {
  useT();
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const { gaSheets, gaPins } = useData();
  if (!moduleOn('gaPlan')) return null;
  const pin = pinFor(gaPins, kind, refId);
  const sheet = pin ? gaSheets.find((s) => s.id === pin.sheetId && !s.removed) : undefined;
  if (!sheet && !editable) return null;
  const link = { color: COLORS.primary, fontWeight: '600' as const, fontSize: 14 };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.sm }}>
      {sheet ? (
        <TouchableOpacity onPress={() => nav.navigate('GaPlan', { sheet: sheet.id, focus: pin!.id })} accessibilityRole="link">
          <Text style={link}>{`📍 ${t('ga.onPlan', { deck: sheet.name })} ›`}</Text>
        </TouchableOpacity>
      ) : null}
      {editable ? (
        <TouchableOpacity onPress={() => nav.navigate('GaPlan', { pickKind: kind, pickRef: refId, ...(sheet ? { sheet: sheet.id } : {}) })}>
          <Text style={link}>{sheet ? t('ga.move') : `📍 ${t('ga.putOn')}`}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
