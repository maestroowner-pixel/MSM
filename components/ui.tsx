// ===================================
// Shared UI building blocks
// ===================================

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
  ScrollView,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { ComplianceStatus, CategoryKey } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';

type GlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Categories whose standard IMO/ISO safety pictogram is rendered from a white
// silhouette PNG (the icon font has no matching glyph). Tinted to the icon colour.
const CATEGORY_IMAGE_ICONS: Partial<Record<CategoryKey, ImageSourcePropType>> = {
  liferafts: require('../assets/cat-icons/liferaft.png'),
  lifejackets: require('../assets/cat-icons/lifejacket.png'),
  immersion_suits: require('../assets/cat-icons/immersion-suit.png'),
  inflatable_lifejackets: require('../assets/cat-icons/inflatable-lifejacket.png'),
  eebd: require('../assets/cat-icons/eebd.png'),
  fixed_co2: require('../assets/cat-icons/fixed-co2.png'),
  fire_detectors: require('../assets/cat-icons/fire-detector.png'),
};

// Monochrome category glyph — single colour, used where a bare icon is wanted.
export function CategoryIcon({
  category,
  size = 24,
  color,
}: {
  category: CategoryKey;
  size?: number;
  color?: string;
}) {
  const c = useTheme();
  const img = CATEGORY_IMAGE_ICONS[category];
  if (img) {
    return <Image source={img} style={{ width: size, height: size, tintColor: color ?? c.primaryDark }} />;
  }
  return (
    <MaterialCommunityIcons
      name={CATEGORY_MAP[category].icon as GlyphName}
      size={size}
      color={color ?? c.primaryDark}
    />
  );
}

// Rounded chip with a white glyph (or silhouette image) inside — the standard icon container.
export function IconChip({
  name,
  size = 24,
  color,
  image,
}: {
  name?: GlyphName;
  size?: number;
  color?: string;
  image?: ImageSourcePropType;
}) {
  const c = useTheme();
  const box = Math.round(size * 1.55);
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.3),
        backgroundColor: color ?? c.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {image ? (
        <Image source={image} style={{ width: size, height: size, tintColor: c.textWhite }} />
      ) : (
        <MaterialCommunityIcons name={name} size={size} color={c.textWhite} />
      )}
    </View>
  );
}

// Category icon on a chip — teal everywhere except the colorful theme, where it
// takes the category's group colour (LSA green / FFE red / OTHER teal).
export function CategoryBadge({ category, size = 24 }: { category: CategoryKey; size?: number }) {
  const c = useTheme();
  const group = CATEGORY_MAP[category].group;
  const img = CATEGORY_IMAGE_ICONS[category];
  return (
    <IconChip
      name={CATEGORY_MAP[category].icon as GlyphName}
      image={img}
      size={size}
      color={c.groupColors[group]}
    />
  );
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
  '🔔': 'bell-ring',
  '🎨': 'palette',
  '👑': 'crown',
  '📱': 'cellphone',
  '📄': 'file-document',
  '⚙️': 'cog',
};

export function emojiGlyph(emoji: string): GlyphName {
  return EMOJI_GLYPH[emoji] ?? 'help-circle-outline';
}

// Bare mapped glyph (single colour).
export function Glyph({ emoji, size = 22, color }: { emoji: string; size?: number; color?: string }) {
  const c = useTheme();
  return <MaterialCommunityIcons name={emojiGlyph(emoji)} size={size} color={color ?? c.primaryDark} />;
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
  const c = useTheme();
  return (
    <LinearGradient colors={c.bgGradient} style={{ flex: 1 }}>
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
  const styles = useStyles();
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
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

// Status hues are identical across themes, so this stays a plain map/function.
const STATUS_META: Record<ComplianceStatus, { label: string; color: string }> = {
  expired: { label: 'Expired', color: COLORS.danger },
  due: { label: 'Due soon', color: COLORS.warning },
  ok: { label: 'OK', color: COLORS.success },
  none: { label: 'No date', color: COLORS.textLight },
};

export function StatusPill({ status, text }: { status: ComplianceStatus; text?: string }) {
  const styles = useStyles();
  const meta = STATUS_META[status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.color }]}>
      <Text style={styles.pillText}>{text ?? meta.label}</Text>
    </View>
  );
}

export function StatusDot({ status }: { status: ComplianceStatus }) {
  const styles = useStyles();
  return <View style={[styles.dot, { backgroundColor: STATUS_META[status].color }]} />;
}

export function statusColor(status: ComplianceStatus): string {
  return STATUS_META[status].color;
}

export function Empty({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const styles = useStyles();
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    title: { fontSize: SIZES.h2, fontWeight: '700', color: COLORS.textDark },
    subtitle: { fontSize: SIZES.body, color: COLORS.textLight, marginTop: 2 },
    card: {
      ...COLORS.glassCard,
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

function useStyles() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
