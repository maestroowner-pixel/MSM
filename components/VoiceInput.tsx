// ===================================
// A microphone for a text box — in a browser that can listen (Chrome, Edge,
// Safari: the Web Speech API), dictation straight into the box. On a phone the
// keyboard's own microphone does the same, so nothing is shown there.
// ===================================

import React, { useRef, useState } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { t, useT } from '../utils/i18n';
import { SIZES } from '../theme';

export function VoiceInput({ onText }: { onText: (t: string) => void }) {
  const COLORS = useTheme();
  useT();
  const [on, setOn] = useState(false);
  const rec = useRef<any>(null);
  const SR = Platform.OS === 'web' ? (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition : undefined;
  if (!SR) return null;
  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = (globalThis as any).navigator?.language || 'en-GB';
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onText(String(e.results[i][0].transcript).trim());
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };
  return (
    <TouchableOpacity onPress={toggle} accessibilityLabel={on ? t('vi.stop') : t('vi.speak')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: on ? COLORS.danger : COLORS.primary, backgroundColor: on ? COLORS.danger : 'transparent', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
      <MciIcon name="microphone" size={16} color={on ? COLORS.textWhite : COLORS.primary} />
      <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: on ? COLORS.textWhite : COLORS.primary }}>{on ? t('vi.listening') : t('vi.speak')}</Text>
    </TouchableOpacity>
  );
}
