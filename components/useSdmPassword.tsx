// Asks for the password of an encrypted .sdm file (services/sdmCrypto.ts) and returns what is inside.
// A plain file passes straight through. Null when the person cancels.

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { decryptSdm, isEncryptedSdm } from '../services/sdmCrypto';
import { SIZES } from '../theme';
import { t, useT } from '../utils/i18n';

export function useSdmPassword() {
  useT();
  const COLORS = useTheme();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const settle = useRef<((inside: string | null) => void) | null>(null);

  const finish = (inside: string | null) => {
    setFile(null);
    setPassword('');
    setError('');
    settle.current?.(inside);
    settle.current = null;
  };

  const open = (f: { name: string; text: string }): Promise<string | null> => {
    if (!isEncryptedSdm(f.text)) return Promise.resolve(f.text);
    setFile(f);
    return new Promise((resolve) => { settle.current = resolve; });
  };

  const submit = async () => {
    if (!file || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      finish(await decryptSdm(file.text, password));
    } catch (e: any) {
      const code = String(e?.message ?? '');
      setError(t(code === 'newer-file' ? 'sdm.pwNewer' : code === 'bad-file' ? 'sdm.pwBad' : 'sdm.pwWrong'));
    } finally {
      setBusy(false);
    }
  };

  const ui = (
    <Modal visible={!!file} transparent animationType="fade" onRequestClose={busy ? undefined : () => finish(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md }}>
        <View style={{ ...COLORS.glassCard, backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusMd, padding: SIZES.md, width: '100%', maxWidth: 420 }}>
          <Text style={{ fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark }}>{t('sdm.pwTitle')}</Text>
          <Text style={{ fontSize: SIZES.small, color: COLORS.textLight, marginVertical: SIZES.xs }}>{t('sdm.pwHint', { file: file?.name ?? '' })}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            placeholder={t('sdm.pwPh')}
            placeholderTextColor={COLORS.textLight}
            style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, padding: SIZES.sm, color: COLORS.textDark }}
          />
          {error ? <Text style={{ color: COLORS.danger, fontSize: SIZES.small, marginTop: SIZES.xs, fontWeight: '700' }}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: SIZES.sm }} /> : (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: SIZES.md, marginTop: SIZES.sm }}>
              <TouchableOpacity onPress={() => finish(null)}><Text style={{ color: COLORS.textLight, fontWeight: '700' }}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => void submit()}><Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('sdm.pwOpen')}</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return { open, ui };
}
