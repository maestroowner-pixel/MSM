// The password of a .msm backup (services/backupCrypto.ts). `ask` before an export: a
// password, '' for none (the person's choice), null when they cancel. `open` on a
// restore: a plain file passes straight through, a protected one returns what is inside,
// null when they cancel.

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { decryptBackup, isEncryptedBackup, MIN_BACKUP_PASSWORD } from '../services/backupCrypto';
import { SIZES } from '../theme';
import { t, useT } from '../utils/i18n';

export function useBackupPassword() {
  useT();
  const COLORS = useTheme();
  const [asking, setAsking] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const settleAsk = useRef<((password: string | null) => void) | null>(null);
  const settleOpen = useRef<((inside: string | null) => void) | null>(null);

  const clear = () => {
    setAsking(false);
    setFile(null);
    setPassword('');
    setAgain('');
    setError('');
  };
  const finishAsk = (answer: string | null) => {
    clear();
    settleAsk.current?.(answer);
    settleAsk.current = null;
  };
  const finishOpen = (inside: string | null) => {
    clear();
    settleOpen.current?.(inside);
    settleOpen.current = null;
  };

  const ask = (): Promise<string | null> => {
    setAsking(true);
    return new Promise((resolve) => { settleAsk.current = resolve; });
  };

  const open = (f: { name: string; text: string }): Promise<string | null> => {
    if (!isEncryptedBackup(f.text)) return Promise.resolve(f.text);
    setFile(f);
    return new Promise((resolve) => { settleOpen.current = resolve; });
  };

  const protect = () => {
    if (password.length < MIN_BACKUP_PASSWORD) return setError(t('bak.pwShort', { n: MIN_BACKUP_PASSWORD }));
    if (password !== again) return setError(t('bak.pwDiffer'));
    finishAsk(password);
  };

  const submit = async () => {
    if (!file || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      finishOpen(await decryptBackup(file.text, password));
    } catch (e: any) {
      const code = String(e?.message ?? '');
      setError(t(code === 'newer-file' ? 'bak.pwNewer' : code === 'bad-file' ? 'sdm.pwBad' : 'sdm.pwWrong'));
    } finally {
      setBusy(false);
    }
  };

  const field = { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, padding: SIZES.sm, color: COLORS.textDark, marginTop: SIZES.xs };
  const button = (label: string, onPress: () => void, color: string) => (
    <TouchableOpacity onPress={onPress}><Text style={{ color, fontWeight: '700' }}>{label}</Text></TouchableOpacity>
  );

  const ui = (
    <Modal visible={asking || !!file} transparent animationType="fade" onRequestClose={busy ? undefined : () => (asking ? finishAsk(null) : finishOpen(null))}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md }}>
        <View style={{ ...COLORS.glassCard, backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusMd, padding: SIZES.md, width: '100%', maxWidth: 420 }}>
          <Text style={{ fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark }}>{t(asking ? 'bak.askTitle' : 'bak.openTitle')}</Text>
          <Text style={{ fontSize: SIZES.small, color: COLORS.textLight, marginVertical: SIZES.xs }}>{asking ? t('bak.askHint') : t('bak.openHint', { file: file?.name ?? '' })}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            placeholder={asking ? t('bak.pwPh', { n: MIN_BACKUP_PASSWORD }) : t('sdm.pwPh')}
            placeholderTextColor={COLORS.textLight}
            style={field}
          />
          {asking ? (
            <TextInput
              value={again}
              onChangeText={setAgain}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('bak.pwAgain')}
              placeholderTextColor={COLORS.textLight}
              style={field}
            />
          ) : null}
          {error ? <Text style={{ color: COLORS.danger, fontSize: SIZES.small, marginTop: SIZES.xs, fontWeight: '700' }}>{error}</Text> : null}
          {busy ? (
            <View style={{ marginTop: SIZES.sm, alignItems: 'center' }}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={{ fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.xs }}>{t('bak.slow')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SIZES.md, marginTop: SIZES.sm }}>
              {button(t('common.cancel'), () => (asking ? finishAsk(null) : finishOpen(null)), COLORS.textLight)}
              {asking ? button(t('bak.noPw'), () => finishAsk(''), COLORS.textDark) : null}
              {asking ? button(t('bak.withPw'), protect, COLORS.primary) : button(t('sdm.pwOpen'), () => void submit(), COLORS.primary)}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return { ask, open, ui };
}
