// ===================================
// Waiting for taps — the gangway, a round, the muster station, the boat landing. Elsewhere
// a tap opens the wristband's person (components/NfcListener).
//
// Android reads with no sheet, so while the screen is open it simply listens: tap after
// tap. iOS shows its sheet for each read and the person starts it ("Tap a wristband"); the
// sheet comes back for the next tap until they cancel it. Each tap is checked against the
// vessel's register (services/nfcTags.resolveTap) before the screen sees it.
//
// Nothing at all with the module off, in a browser, or in a build without NFC.
// ===================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useData } from '../contexts/DataContext';
import { moduleOn } from '../constants/modules';
import { cancelRead, claimNfc, nfcReady, readTag } from '../services/nfcReader';
import { TapResult, resolveTap } from '../services/nfcTags';

export function useNfcTaps(onTap: (r: TapResult) => void, prompt: string, enabled = true) {
  const { nfcTags } = useData();
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const run = useRef(false);
  const tagsRef = useRef(nfcTags);
  tagsRef.current = nfcTags;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  const on = enabled && moduleOn('nfc');

  // While the screen listens, the app-wide listener (components/NfcListener) does not.
  useEffect(() => (on ? claimNfc() : undefined), [on]);

  useEffect(() => {
    let live = true;
    if (on) void nfcReady().then((ok) => live && setAvailable(ok));
    return () => {
      live = false;
    };
  }, [on]);

  const stop = useCallback(() => {
    run.current = false;
    setListening(false);
    void cancelRead();
  }, []);

  const start = useCallback(async () => {
    if (run.current) return;
    run.current = true;
    setListening(true);
    while (run.current) {
      const read = await readTag(prompt);
      if (!run.current) break;
      if (!read) {
        // iOS: the sheet was cancelled or timed out — stop until asked again. Android: a
        // read that came back empty (the screen lost focus) — try again shortly.
        if (Platform.OS === 'ios') break;
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      tapRef.current(resolveTap(read.uid, read.payload, tagsRef.current));
      // The same wristband is still on the phone for a moment: let it go.
      await new Promise((r) => setTimeout(r, Platform.OS === 'ios' ? 300 : 1200));
    }
    run.current = false;
    setListening(false);
  }, [prompt]);

  // Android listens by itself while the screen is open.
  useEffect(() => {
    if (available && Platform.OS === 'android') void start();
    return () => stop();
  }, [available, start, stop]);

  return { available, listening, start, stop, needsStart: Platform.OS === 'ios' };
}
