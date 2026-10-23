// ===================================
// Which categories need the QR label scanned — the exceptions to the vessel's rule.
//
// WHY THIS EXISTS. "Scan before you sign" is a good rule for equipment that has a
// label: an extinguisher, a liferaft, a BA set. It is the wrong rule for an
// INVENTORY — the contents of a rescue boat, the loose gear in a fire locker —
// where the useful thing is a complete list checked off item by item, and nobody
// is going to put a sticker on every bailer, drogue and spanner. Asked for by a
// vessel on 25 Sep 2026, in those words.
//
// Before this the vessel had one switch for the whole register, so the honest
// choices were to label a hundred small items or to turn the rule off for the
// extinguishers too. Neither is a rule.
//
// The list stored is the EXEMPT one (services/signingPolicy `scanExempt`), so a
// category added later is covered by default — the rule does not quietly stop
// applying to new equipment.
// ===================================

import React, { useMemo } from 'react';
import { Alert, SectionList, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, CategoryBadge, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { GROUP_ORDER, visibleCategories, catLabel, groupLabel } from '../constants/categories';
import { CategoryKey, Group } from '../types/equipment';
import { writeSigningPolicy } from '../services/policy';
import { scanRequiredByDefault, scanRequiredFor } from '../services/signingPolicy';
import { t, tn, useT } from '../utils/i18n';



export default function ScanRulesSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { signingPolicy, setSigningPolicy, byCategory, categories: ownCats } = useData();
  const sync = useSync();

  // Same rank as the rule itself: a Master sets it, everyone else reads it. A
  // crew member who cannot see WHY an inspection asks for a scan will assume the
  // app is broken, so the screen is never hidden — only its switches are.
  const solo = !sync.enrolled;
  const isMaster = solo || sync.role === 'superadmin';

  const sections = useMemo(
    () =>
      GROUP_ORDER
        .map((group) => ({
          title: groupLabel(group),
          data: visibleCategories().filter((c) => c.group === group),
        }))
        .filter((s) => s.data.length),
    // CATEGORIES is mutated in place when the vessel adds a heading, so React
    // needs the vessel list as the dependency that changes.
    [ownCats]
  );

  const shown = visibleCategories();
  const exemptCount = shown.filter((c) => !scanRequiredFor(signingPolicy, c.key)).length;

  /**
   * Both lists, kept honest against the default.
   *
   * Lifting and mooring gear is exempt unless the vessel says otherwise (see
   * `scanRequiredByDefault`), everything else is covered unless it says
   * otherwise. So a switch writes to whichever list contradicts the default and
   * clears the other — the stored policy then never carries an entry that agrees
   * with the default and says nothing.
   */
  const toggle = async (key: CategoryKey, required: boolean) => {
    const exempt = new Set(signingPolicy.scanExempt ?? []);
    const covered = new Set(signingPolicy.scanRequired ?? []);
    exempt.delete(key);
    covered.delete(key);
    if (required !== scanRequiredByDefault(key)) (required ? covered : exempt).add(key);
    const { error } = await writeSigningPolicy(
      signingPolicy,
      { scanExempt: [...exempt], scanRequired: [...covered] },
      setSigningPolicy,
      { synced: sync.status === 'synced', isMaster: sync.role === 'superadmin' }
    );
    if (error) {
      Alert.alert(
        t('common.savedLocalOnly'),
        t('common.notAccepted', { error })
      );
    }
  };

  return (
    <Screen>
      <ScreenTitle
        title={t('scan.title')}
        subtitle={
          signingPolicy.requireScan
            ? t('scan.sub', { k: shown.length - exemptCount, n: shown.length })
            : t('scan.subOff')
        }
      />

      {!signingPolicy.requireScan ? (
        <Card>
          <Label>{t('scan.offTitle')}</Label>
          <Text style={styles.note}>
            {t('scan.offBody')}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Label>{t('scan.meansTitle')}</Label>
        <Text style={styles.note}>
          {t('scan.meansBody')}
          {isMaster ? '' : ` ${t('scan.masterOnly')}`}
        </Text>
      </Card>

      <SectionList
        sections={sections}
        keyExtractor={(c) => c.key}
        contentContainerStyle={{ paddingBottom: SIZES.xxl }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Label style={styles.group}>{section.title}</Label>}
        renderItem={({ item }) => {
          const required = scanRequiredFor(signingPolicy, item.key);
          const count = (byCategory[item.key] ?? []).length;
          return (
            <View style={styles.row}>
              <CategoryBadge category={item.key} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {catLabel(item)}
                </Text>
                <Text style={styles.rowSub}>
                  {tn('n.item', count)} ·{' '}
                  {required ? t('scan.scanLabel') : t('scan.fromList')}
                </Text>
              </View>
              <Switch
                value={required}
                disabled={!isMaster}
                onValueChange={(v) => void toggle(item.key, v)}
                trackColor={{ true: COLORS.primary, false: COLORS.border }}
              />
            </View>
          );
        }}
      />
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    note: { color: COLORS.textLight, fontSize: SIZES.small, lineHeight: 17, paddingTop: SIZES.xs },
    group: { marginTop: SIZES.lg, marginBottom: SIZES.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.md,
      paddingVertical: SIZES.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    rowTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.text },
    rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
  });
