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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, GLASS, SCREEN_BG } from '../theme';
import { ComplianceStatus, CategoryKey } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';

type GlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Monochrome category glyph — single colour, used where a bare icon is wanted.
export function CategoryIcon({
  category,
  size = 24,
  color = COLORS.primaryDark,
}: {
  category: CategoryKey;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={CATEGORY_MAP[category].icon as GlyphName} size={size} color={color} />;
}

// Teal rounded chip with a white glyph inside — the standard icon container.
export function IconChip({ name, size = 24 }: { name: GlyphName; size?: number }) {
  const box = Math.round(size * 1.55);
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.3),
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={name} size={size} color={COLORS.textWhite} />
    </View>
  );
}

// Category icon on a teal chip — used across lists, tiles and headers.
export function CategoryBadge({ category, size = 24 }: { category: CategoryKey; size?: number }) {
  return <IconChip name={CATEGORY_MAP[category].icon as GlyphName} size={size} />;
}

// Maps the legacy section/row emojis to a monochrome glyph (Manual, Settings, tabs).
const EMOJI_GLYPH: Record<string, GlyphName> = {
  'ℹ️': 'information',
  '⏱️': 'timer-outline',
  '☁️': 'cloud',
  '⚓': 'anchor',
  '💾': 'content-save',
  '📊': 'chart-box',
  '📎': 'paperclip',
  '📜': 'certificate',
  '📤': 'tray-arrow-up',
  '📥': 'tray-arrow-down',
  '⬇️': 'tray-arrow-down',
  '🗑️': 'delete',
  '🛟': 'lifebuoy',
  '🧪': 'test-tube',
  '🧯': 'fire-extinguisher',
  '🧰': 'toolbox',
  '♻️': 'backup-restore',
  '📈': 'chart-line',
  '📖': 'book-open-variant',
  '🔒': 'lock',
  '⚠️': 'alert',
  '👑': 'crown',
  '📱': 'cellphone',
  '📄': 'file-document',
  '⚙️': 'cog',
};

export function emojiGlyph(emoji: string): GlyphName {
  return EMOJI_GLYPH[emoji] ?? 'help-circle-outline';
}

// Bare mapped glyph (single colour).
export function Glyph({ emoji, size = 22, color = COLORS.primaryDark }: { emoji: string; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={emojiGlyph(emoji)} size={size} color={color} />;
}

// Mapped glyph on a teal chip.
export function GlyphBadge({ emoji, size = 22 }: { emoji: string; size?: number }) {
  return <IconChip name={emojiGlyph(emoji)} size={size} />;
}

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
