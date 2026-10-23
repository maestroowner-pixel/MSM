// ===================================
// "Where does this device stand, and what is the next step?"
//
// WHY THIS EXISTS. Joining a vessel has an ORDER — set the IMO, then enrol, then
// (for everyone but the first device) wait to be approved — and until now nothing
// in the app said so. A crew member opened Settings, found "Join this vessel"
// next to "Accounts" and "Defects", and had no way to know which came first or
// whether it had worked: sync failed silently and stayed `off`.
//
// A runbook in a document does not fix that, because the person holding the phone
// is not holding the document. So the app states the next step itself, and only
// the next one — the step after it is not useful yet and only adds noise.
//
// The card is at the TOP of Settings on purpose: it is the first thing that
// matters on a new device and the first thing to check when something is wrong.
// ===================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { tk, useT } from '../utils/i18n';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { uiDateTime } from '../utils/dates';
import * as fb from '../services/firebaseService';

type Step = {
  icon: string;
  tone: 'todo' | 'waiting' | 'done' | 'off';
  title: string;
  body: string;
  action?: { label: string; go: () => void };
  /**
   * A step whose action is not the next thing to DO — it only opens a related
   * screen. Those ride small, on the header line, so the card's big button
   * stays reserved for the step it is actually asking for.
   */
  inlineAction?: boolean;
};

export function ConnectionCard() {
  const COLORS = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { vessel } = useData();
  const { status, role, enrolled, lastSyncAt, connect, lastError } = useSync();

  const imo = (vessel?.imo ?? '').replace(/\D/g, '');

  const step: Step = useMemo(() => {
    if (!fb.syncSupported()) {
      return {
        icon: 'cloud-off-outline',
        tone: 'off',
        title: t('cc.offline'),
        body: fb.WINDOWS_SYNC_MESSAGE,
      };
    }
    if (!imo) {
      return {
        icon: 'ferry',
        tone: 'todo',
        title: t('cc.step1'),
        body: t('cc.step1Body'),
      };
    }
    if (!enrolled) {
      return {
        icon: 'login',
        tone: 'todo',
        title: t('cc.step2'),
        // `lastError` here means the device was ON the vessel and is not any
        // more — removed by a Master, or the register reset. Saying so is the
        // difference between "you have not joined yet" and "you were taken off";
        // the second explains why the register stopped moving.
        body:
          (lastError ? `${lastError}\n\n` : '') + t('cc.step2Body'),
        action: { label: t('cc.join'), go: () => nav.navigate('Enrol') },
      };
    }
    if (status === 'pending') {
      return {
        icon: 'account-clock',
        tone: 'waiting',
        title: t('cc.step3'),
        body: t('cc.step3Body'),
        // Approval cannot announce itself: this device's rights live in a token it
        // has not been given yet, so something on this side has to ask again.
        action: { label: t('cc.checkNow'), go: () => void connect() },
      };
    }
    if (status === 'synced') {
      return {
        icon: 'cloud-check-outline',
        tone: 'done',
        title: role ? t('cc.connectedAs', { role: tk(`role.${role}`) }) : t('cc.connected'),
        body: lastSyncAt
          ? t('cc.lastSynced', { when: uiDateTime(lastSyncAt) }) + ' ' + t('cc.travel')
          : t('cc.travel'),
        // The card is titled "This device", so the screen that says who this
        // device signs as — and how to sign off — belongs behind it. It used to be
        // a row at the foot of the Vessel section: the same words, in a second
        // place, several sections down from the panel already carrying them.
        action: { label: t('cc.whoSigns'), go: () => nav.navigate('Enrol') },
        inlineAction: true,
      };
    }
    if (status === 'connecting') {
      return { icon: 'cloud-sync-outline', tone: 'waiting', title: t('cc.connecting'), body: t('cc.asking') };
    }
    if (status === 'error') {
      return {
        icon: 'cloud-alert',
        tone: 'waiting',
        title: t('cc.couldNot'),
        body:
          t('cc.couldNotBody') +
          // The actual reason, when there is one. Without it every failure reads
          // the same and there is nothing for the user — or us — to act on.
          (lastError ? `\n\n${lastError}` : ''),
        action: { label: t('cc.tryAgain'), go: () => void connect() },
      };
    }
    return {
      icon: 'cloud-off-outline',
      tone: 'off',
      title: t('cc.notSyncing'),
      body: t('cc.notSyncingBody'),
      action: { label: t('cc.join'), go: () => nav.navigate('Enrol') },
    };
  }, [imo, enrolled, status, role, lastSyncAt, lastError, nav, connect, t]);

  const tint =
    step.tone === 'done' ? COLORS.success : step.tone === 'waiting' ? COLORS.warning : COLORS.primary;

  return (
    <Card>
      <View style={styles.head}>
        <MciIcon name={step.icon as any} size={22} color={tint} />
        <View style={{ flex: 1 }}>
          <Label>{t('cc.thisDevice')}</Label>
          <Text style={[styles.title, { color: tint }]}>{step.title}</Text>
        </View>
        {step.action && step.inlineAction ? (
          <TouchableOpacity style={[styles.linkBtn, { borderColor: tint }]} onPress={step.action.go}>
            <Text style={[styles.linkBtnText, { color: tint }]}>{step.action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.body}>{step.body}</Text>
      {step.action && !step.inlineAction ? (
        <TouchableOpacity style={[styles.btn, { backgroundColor: tint }]} onPress={step.action.go}>
          <Text style={styles.btnText}>{step.action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    title: { fontSize: SIZES.h5, fontWeight: '700', marginTop: 2 },
    body: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 17 },
    btn: {
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
      marginTop: SIZES.md,
    },
    btnText: { color: COLORS.textWhite, fontWeight: '700' },
    linkBtn: {
      borderWidth: 1,
      borderRadius: SIZES.radiusSm,
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.xs,
    },
    linkBtnText: { fontSize: SIZES.small, fontWeight: '700' },
  });
