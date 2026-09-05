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

import React, { useMemo, useState } from 'react';
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
import { playErrorSound, playSuccessSound } from '../utils/sound';

export default function EnrolSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { vessel } = useData();
  const { connect, status } = useSync();
  const imo = (vessel?.imo ?? '').replace(/\D/g, '');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<enrolment.EnrolResult | null>(null);

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
      <ScreenTitle title="Join this vessel" subtitle="With the name and PIN the Master gave you" />

      {!imo ? (
        <Card>
          <Label>Vessel IMO required</Label>
          <Text style={styles.note}>
            Set the vessel's IMO number in Settings → Vessel first — it is what identifies the
            register you are joining.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Label>Your details</Label>
        <Text style={styles.note}>
          Spell your name the way it appears on the invitation. If it was issued as "Jez", "Jeremy"
          will not be recognised.
        </Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, styles.pin]}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, BOOTSTRAP_MAX))}
          placeholder={`${PIN_LENGTH}-digit PIN`}
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
            <Text style={styles.primaryBtnText}>Join</Text>
          </TouchableOpacity>
        )}
      </Card>

      {result?.status === 'ok' ? (
        <Card>
          <Label>You are in</Label>
          <Text style={styles.note}>
            This device is enrolled as {ROLE_LABEL[result.role]}
            {result.firstName ? ` for ${result.firstName} ${result.lastName ?? ''}`.trimEnd() : ''}.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.goBack()}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {/* Approval lands here without a restart: SyncContext keeps asking while
          this device is pending, so `status` flips to 'synced' the moment a Master
          lets it in — and the officer standing in front of them sees it happen
          instead of being told to reopen the app. */}
      {result?.status === 'pending' && status === 'synced' ? (
        <Card>
          <Label>Approved</Label>
          <Text style={styles.note}>
            A Master has let this device in. It is syncing with the vessel now — nothing else is
            needed here.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.goBack()}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </Card>
      ) : result?.status === 'pending' ? (
        <Card>
          <Label>Waiting for approval</Label>
          <Text style={styles.note}>
            Your details were recognised and this device is in the queue. A Master has to let it in
            from Settings → Accounts. This screen updates by itself as soon as they do.
          </Text>
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SIZES.md }} />

          {/* The one case the queue cannot solve: this IS the vessel's Master,
              on a device that lost its identity, waiting for an approval only
              they could give. Offered only to somebody holding the setup code. */}
          <TouchableOpacity
            style={styles.recoverBtn}
            onPress={() =>
              Alert.alert(
                'Take over as Master?',
                'Only do this if you manage this vessel and its Master device is gone — a cleared ' +
                  'browser, a lost or wiped phone.\n\nThis device becomes the Master. Everything on ' +
                  'the vessel is kept; the other devices stay as they are and can be reviewed in ' +
                  'Accounts → Devices.\n\nIt needs the vessel setup code in the PIN field above.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Take over', style: 'destructive', onPress: () => void submit(true) },
                ]
              )
            }
          >
            <Text style={styles.recoverText}>I am the Master and have the setup code</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {result?.status === 'reenrol' ? (
        <Card>
          <Label>Enrol again</Label>
          <Text style={styles.note}>
            This device was registered under an older scheme, so there is nothing left to recognise
            it by. Enter your name and PIN above once more.
          </Text>
        </Card>
      ) : null}

      {result?.status === 'refused' ? (
        <Card>
          <Label>Not recognised</Label>
          <Text style={styles.note}>{result.message}</Text>
          <Text style={styles.note}>
            The usual cause is the spelling of the name rather than the PIN. Ask the Master to read
            the invitation back to you — they can see it in full.
          </Text>
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
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 17 },
  });
