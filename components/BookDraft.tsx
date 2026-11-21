// ===================================
// The record book form's draft (services/bookDraft.ts): opening the form brings
// back what was typed and not signed; every change is kept half a second later;
// closing the form or leaving the screen keeps the last keystrokes too. The
// screen calls `clear()` once the entry is signed, and shows `ui` in the form.
// ===================================

import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { clearBookDraft, loadBookDraft, saveBookDraft } from '../services/bookDraft';
import { shipStamp } from '../utils/shipTime';
import { uiDate } from '../utils/dates';
import { t } from '../utils/i18n';

const when = (at: number) => {
  const s = shipStamp(at);
  return `${uiDate(s.slice(0, 10))} ${s.slice(11, 16)}`;
};

export function useBookDraft<F extends object>(opts: { book: string; open: boolean; off?: boolean; f: F; setF: (f: F) => void; blank: () => F }) {
  const { book, open, off, f, setF } = opts;
  const COLORS = useTheme();
  const blankRef = useRef(opts.blank);
  blankRef.current = opts.blank;
  const ready = useRef(false);
  const pending = useRef(false);
  const latest = useRef(f);
  const [restored, setRestored] = useState<number | null>(null);
  const [kept, setKept] = useState<number | null>(null);
  const live = open && !off;

  // Opening the form: bring the draft back. Closing it (or leaving the screen): keep the last change.
  useEffect(() => {
    if (!live) return;
    let on = true;
    ready.current = false;
    setRestored(null);
    setKept(null);
    void loadBookDraft(book, blankRef.current()).then((d) => {
      if (!on) return;
      if (d) {
        setF(d.f);
        latest.current = d.f;
        setRestored(d.at);
      }
      ready.current = true;
    });
    return () => {
      on = false;
      if (ready.current && pending.current) void saveBookDraft(book, latest.current, blankRef.current());
      pending.current = false;
      ready.current = false;
    };
  }, [live, book]);

  useEffect(() => {
    if (!live || !ready.current) return;
    latest.current = f;
    pending.current = true;
    const timer = setTimeout(() => {
      pending.current = false;
      void saveBookDraft(book, f, blankRef.current()).then((k) => setKept(k ? Date.now() : null));
    }, 500);
    return () => clearTimeout(timer);
  }, [f, live, book]);

  /** The entry is signed (or the draft thrown away): nothing to keep. */
  const clear = () => {
    pending.current = false;
    setRestored(null);
    setKept(null);
    void clearBookDraft(book);
  };
  const discard = () => {
    clear();
    const b = blankRef.current();
    latest.current = b;
    setF(b);
  };

  const ui = live && (restored || kept) ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm }}>
      <Text style={{ fontSize: SIZES.small, color: restored ? COLORS.warning : COLORS.textLight, fontWeight: restored ? '700' : '400' }}>
        {restored ? t('book.draftRestored', { when: when(restored) }) : t('book.draftKept', { when: when(kept!) })}
      </Text>
      <TouchableOpacity onPress={discard} hitSlop={8}>
        <Text style={{ fontSize: SIZES.small, color: COLORS.primary, fontWeight: '700' }}>{t('book.draftDiscard')}</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return { ui, clear };
}
