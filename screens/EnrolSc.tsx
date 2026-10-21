// ===================================
// Enrol — the screen a person sees once, holding the name and PIN they were given.
//
// It asks for a name as well as the PIN on purpose. The PIN alone would be a
// shared password wearing a different hat; the pair is what lets the register say
// WHO enrolled, and what lets a Master revoke one person without disturbing the
// rest of the crew.
//
// The three outcomes are shown as they are, because each one needs a different
// thing from the user: a session (nothing to do), a wait (find the Master), or a
// refusal (check the spelling — it is nearly always the name, not the PIN).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { BOOTSTRAP_MAX, PIN_LENGTH, ROLE_LABEL, isEnterableCode } from '../types/role';
import * as enrolment from '../services/enrolment';
import * as accounts from '../services/accounts';
import * as fb from '../services/firebaseService';
import * as trial from '../services/trial';
import { EnrolledDevice, personName } from '../types/role';
import { resetAllData } from '../services/storage';
import { clearAttachmentsDir } from '../services/attachments';
import * as snapshot from '../services/snapshot';
import { playErrorSound, playSuccessSound } from '../utils/sound';
import { goBackOr } from '../utils/nav';
import { t, t as tt, tn, useT } from '../utils/i18n';

export default function EnrolSc() {
  useT();
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { vessel, reload } = useData();
  const { connect, disconnect, status, role, enrolled } = useSync();
  const imo = (vessel?.imo ?? '').replace(/\D/g, '');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<enrolment.EnrolResult | null>(null);

  /**
   * Who this device already is.
   *
   * Once a device has joined, three empty boxes asking for a name and a PIN are
   * not just useless — they read as "you are not in", which is the opposite of
   * the truth. What the officer wants here is confirmation: their name, their
   * rank, and the way out. The record is read live from the vessel rather than
   * remembered locally, so a rank the Master changes an hour later shows up
   * without anyone reinstalling anything.
   */
  const [me, setMe] = useState<EnrolledDevice | null>(null);
  const [signingOff, setSigningOff] = useState(false);

  useEffect(() => {
    if (!imo || !enrolled) {
      setMe(null);
      return;
    }
    let live = true;
    let stop = () => {};
    void fb.getLocalDeviceId().then((myId) => {
      if (!live) return;
      try {
        stop = accounts.watchDevices(imo, (rows) => setMe(rows.find((d) => d.id === myId) ?? null));
      } catch {
        /* not a member yet — the form below is the right thing to show */
      }
    });
    return () => {
      live = false;
      stop();
    };
  }, [imo, enrolled, status]);

  /**
   * Leave the vessel from this device.
   *
   * Two separate questions, asked separately, because they have different
   * consequences and only one of them is reversible by walking to the Master.
   * Signing off ends the session and clears the secret, so the device stops
   * syncing and cannot let itself back in. Erasing is about the copy of the
   * register sitting on THIS handset, which is what matters when it is being
   * handed to somebody else or sold.
   *
   * Neither buys a fresh trial. The 60 days are counted from the vessel's own
   * first launch, mirrored to the account, so a device that signs off, wipes and
   * rejoins finds the clock exactly where it left it — and rejoining needs a new
   * invitation and a Master's approval regardless.
   */
  const signOff = async (wipe: boolean) => {
    setSigningOff(true);
    try {
      await fb.signOutDevice();
      disconnect();
      if (wipe) {
        await resetAllData();
        await clearAttachmentsDir().catch(() => {});
        // The snapshots hold the register that was just erased — leaving them
        // would make "erase" untrue, exactly as it would after Reset all data.
        await snapshot.clearSnapshots().catch(() => {});
        // And the screens have to be told. Wiping storage does not re-render
        // anything by itself; without this the register stayed on screen until
        // the app was restarted, which is what made sign-off look like it had
        // done nothing.
        await reload();
      }
      setResult(null);
      setMe(null);
      playSuccessSound();
      Alert.alert(
        t('en.signedOff'),
        wipe
          ? t('en.signedOffWiped')
          : t('en.signedOffKept')
      );
    } catch (e: any) {
      playErrorSound();
      Alert.alert(t('en.couldNotSignOff'), e?.message ?? String(e));
    } finally {
      setSigningOff(false);
    }
  };

  const confirmSignOff = async () => {
    const t = await trial.getTrialInfo().catch(() => null);
    const trialLine = !t
      ? ''
      : t.expired
        ? `\n\n${tt('en.trialEnded')}`
        : `\n\n${tt('en.trialLeft', { x: tn('n.day', t.daysLeft) })}`;
    Alert.alert(
      tt('en.signOffQ'),
      tt('en.signOffBody') +
        trialLine,
      [
        { text: tt('common.cancel'), style: 'cancel' },
        { text: tt('en.signOff'), style: 'destructive', onPress: () => void signOff(false) },
        { text: tt('en.signOffErase'), style: 'destructive', onPress: () => void signOff(true) },
      ]
    );
  };

  /**
   * Take the vessel over with the setup code.
   *
   * Offered from BOTH outcomes a locked-out Master can land on, and that is the
   * whole point of it being a function rather than a button in one card:
   *
   *   • pending  — the device is in a queue only a Master could empty;
   *   • refused  — there IS no invitation in that name, which is what a Master
   *                whose own device was demoted or removed will always hit.
   *
   * The second case used to have no way out inside the app. A vessel that lost
   * its last Master (one tap on "Make Officer", on its own row) could not
   * recover itself at all — the code accepted the setup code perfectly well,
   * but nothing on screen would send it. Refusal is exactly when this has to be
   * reachable.
   */
  const offerTakeover = () =>
    Alert.alert(
      t('en.takeoverQ'),
      t('en.takeoverBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('en.takeover'), style: 'destructive', onPress: () => void submit(true) },
      ]
    );

  const takeoverButton = (
    <TouchableOpacity style={styles.recoverBtn} onPress={offerTakeover}>
      <Text style={styles.recoverText}>{t('en.iAmMaster')}</Text>
    </TouchableOpacity>
  );

  // Accepts BOTH an issued 8-digit PIN and the longer bootstrap code the very
  // first device uses — both are digits, so the number pad still stands (see
  // types/role.ts on why this field is digits-only).
  const ready = !!imo && !!firstName.trim() && !!lastName.trim() && isEnterableCode(pin);

  const submit = async (takeover = false) => {
    if (!ready || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await enrolment.enrol(imo, firstName, lastName, pin, takeover);
      setResult(res);
      if (res.status === 'ok') {
        playSuccessSound();
        setPin('');
        // Take the session straight into use — otherwise the crew member sees
        // "you are in" and nothing syncs until the next launch.
        void connect();
      } else if (res.status === 'refused') {
        playErrorSound();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenTitle
        title={enrolled ? t('en.thisVessel') : t('cs.join')}
        subtitle={enrolled ? t('en.whoSigns') : t('en.withName')}
      />

      {!imo ? (
        <Card>
          <Label>{t('en.imoReq')}</Label>
          <Text style={styles.note}>
            {t('en.imoBody')}
          </Text>
        </Card>
      ) : null}

      {/* Already aboard: identity, not a form. */}
      {enrolled && me ? (
        <Card>
          <Label>{t('en.thisDevice')}</Label>
          <Text style={styles.who}>{personName(me) || t('en.noName')}</Text>
          {me.position ? <Text style={styles.position}>{me.position}</Text> : null}
          <Text style={styles.note}>
            {ROLE_LABEL[me.role]}
            {me.disabled && !me.retiredAt
              ? ` · ${t('en.switchedOff')}`
              : me.approved
                ? ` · ${t('en.approvedL')}`
                : ` · ${t('en.waitingL')}`}
            {status === 'synced' ? ` · ${t('en.syncing')}` : ''}
          </Text>
          <Text style={styles.note}>
            {t('en.nameFromAccount')}
          </Text>
          <TouchableOpacity
            style={[styles.recoverBtn, signingOff && { opacity: 0.5 }]}
            disabled={signingOff}
            onPress={() => void confirmSignOff()}
          >
            <MciIcon name="logout" size={18} color={COLORS.danger} />
            <Text style={styles.recoverText}>{t('en.signOffDevice')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {/* Enrolled, but the vessel has no record we can read yet (still pending, or
          offline). Say so rather than showing a form that would enrol twice. */}
      {enrolled && !me ? (
        <Card>
          <Label>{t('en.joined')}</Label>
          <Text style={styles.note}>
            {role ? `${t('en.enrolledAs', { role: ROLE_LABEL[role] })} ` : ''}
            {t('en.recordNotBack')}
          </Text>
          <TouchableOpacity
            style={[styles.recoverBtn, signingOff && { opacity: 0.5 }]}
            disabled={signingOff}
            onPress={() => void confirmSignOff()}
          >
            <MciIcon name="logout" size={18} color={COLORS.danger} />
            <Text style={styles.recoverText}>{t('en.signOffDevice')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {!enrolled ? (
      <Card>
        <Label>{t('en.details')}</Label>
        <Text style={styles.note}>
          {t('en.spell')}
        </Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t('common.firstName')}
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder={t('common.lastName')}
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, styles.pin]}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, BOOTSTRAP_MAX))}
          placeholder={t('en.pinPh', { n: PIN_LENGTH })}
          placeholderTextColor={COLORS.textLight}
          keyboardType="number-pad"
          maxLength={BOOTSTRAP_MAX}
        />

        {busy ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SIZES.lg }} />
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, !ready && { opacity: 0.4 }]}
            disabled={!ready}
            onPress={() => void submit()}
          >
            <MciIcon name="login" size={18} color={COLORS.textWhite} />
            <Text style={styles.primaryBtnText}>{t('en.join')}</Text>
          </TouchableOpacity>
        )}
      </Card>
      ) : null}

      {result?.status === 'ok' ? (
        <Card>
          <Label>{t('en.youAreIn')}</Label>
          <Text style={styles.note}>
            {t('en.enrolledAsL', { role: ROLE_LABEL[result.role] })}
            {result.firstName ? ` ${t('en.forName', { name: `${result.firstName} ${result.lastName ?? ''}`.trimEnd() })}` : ''}
            {result.position ? `, ${result.position}` : ''}.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => goBackOr(nav)}>
            <Text style={styles.primaryBtnText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {/* Approval lands here without a restart: SyncContext keeps asking while
          this device is pending, so `status` flips to 'synced' the moment a Master
          lets it in — and the officer standing in front of them sees it happen
          instead of being told to reopen the app. */}
      {result?.status === 'pending' && status === 'synced' ? (
        <Card>
          <Label>{t('en.approved')}</Label>
          <Text style={styles.note}>
            {t('en.approvedBody')}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => goBackOr(nav)}>
            <Text style={styles.primaryBtnText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </Card>
      ) : result?.status === 'pending' ? (
        <Card>
          <Label>{t('en.waiting')}</Label>
          <Text style={styles.note}>
            {t('en.waitingBody')}
          </Text>
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SIZES.md }} />

          {/* The one case the queue cannot solve: this IS the vessel's Master,
              on a device that lost its identity, waiting for an approval only
              they could give. Offered only to somebody holding the setup code. */}
          {takeoverButton}
        </Card>
      ) : null}

      {result?.status === 'reenrol' ? (
        <Card>
          <Label>{t('en.again')}</Label>
          <Text style={styles.note}>
            {t('en.againBody')}
          </Text>
        </Card>
      ) : null}

      {result?.status === 'refused' ? (
        <Card>
          <Label>{t('en.refused')}</Label>
          <Text style={styles.note}>{result.message}</Text>
          <Text style={styles.note}>
            {t('en.refusedBody')}
          </Text>
          {/* And the unusual cause, which no amount of re-typing will fix: there
              is no Master left to ask. See `offerTakeover`. */}
          {takeoverButton}
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      color: COLORS.text,
      backgroundColor: COLORS.card,
      marginTop: SIZES.sm,
    },
    pin: { letterSpacing: 4, fontSize: SIZES.h5, fontWeight: '700' },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.lg,
      marginTop: SIZES.lg,
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
    recoverBtn: {
      marginTop: SIZES.lg,
      paddingTop: SIZES.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      alignItems: 'center',
    },
    recoverText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    who: { fontSize: SIZES.h4, fontWeight: '700', color: COLORS.text, marginTop: SIZES.xs },
    position: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.primary, marginTop: 2 },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 17 },
  });
