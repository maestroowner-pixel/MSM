// ===================================
// Renders a LegalDoc (title, effective date, headed sections).
// Shared by the consent gate and the Settings-accessible legal screens.
// ===================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../theme';
import { LegalDoc } from '../constants/legal';

export default function LegalBody({ doc, showTitle = true }: { doc: LegalDoc; showTitle?: boolean }) {
  return (
    <View>
      {showTitle ? <Text style={styles.title}>{doc.title}</Text> : null}
      <Text style={styles.effective}>Effective {doc.effectiveDate}</Text>
      {doc.sections.map((s, i) => (
        <View key={i} style={styles.section}>
          {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
          {s.paragraphs.map((p, j) => (
            <Text key={j} style={styles.para}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: SIZES.h3, fontWeight: '800', color: COLORS.textDark, marginBottom: 2 },
  effective: { fontSize: SIZES.small, color: COLORS.textLight, marginBottom: SIZES.md },
  section: { marginBottom: SIZES.md },
  heading: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primaryDark, marginBottom: SIZES.xs },
  para: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 21, marginBottom: SIZES.xs },
});
