// ===================================
// Shared UI building blocks
// ===================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, GLASS, SCREEN_BG } from '../theme';
import { ComplianceStatus } from '../types/equipment';

export function Screen({
  children,
  scroll = false,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={SCREEN_BG.gradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, padding: SIZES.lg }, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: SIZES.lg }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  return content;
}

const STATUS_META: Record<ComplianceStatus, { label: string; color: string }> = {
  expired: { label: 'Expired', color: COLORS.danger },
  due: { label: 'Due soon', color: COLORS.warning },
  ok: { label: 'OK', color: COLORS.success },
  none: { label: 'No date', color: COLORS.textLight },
};

export function StatusPill({ status, text }: { status: ComplianceStatus; text?: string }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.color }]}>
      <Text style={styles.pillText}>{text ?? meta.label}</Text>
    </View>
  );
}

export function StatusDot({ status }: { status: ComplianceStatus }) {
  return <View style={[styles.dot, { backgroundColor: STATUS_META[status].color }]} />;
}

export function statusColor(status: ComplianceStatus): string {
  return STATUS_META[status].color;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: { fontSize: SIZES.h2, fontWeight: '700', color: COLORS.textDark },
  subtitle: { fontSize: SIZES.body, color: COLORS.textLight, marginTop: 2 },
  card: {
    ...GLASS.card,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    marginBottom: SIZES.md,
  },
  pill: {
    borderRadius: SIZES.radiusRound,
    paddingHorizontal: SIZES.md,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillText: { color: COLORS.textWhite, fontSize: SIZES.small, fontWeight: '700' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: SIZES.xxxl },
  emptyText: { color: COLORS.textLight, fontSize: SIZES.h5, textAlign: 'center' },
  label: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '600' },
});
