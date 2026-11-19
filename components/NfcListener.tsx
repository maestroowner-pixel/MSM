// ===================================
// A wristband held to the phone anywhere in the app opens its person (screens/NfcPersonSc),
// an equipment tag its item — and counts as the label scanned (services/signingPolicy).
//
// Android only: it reads with no sheet, so the app can listen while it is in front. A
// screen with taps of its own (the gangway scanner, the muster, a round — useNfcTaps)
// claims the reader and this stands aside; a one-off read (giving a tag out, a signature
// by wristband) takes the reader from it. iOS shows a sheet for every read and cannot
// listen in the background — there the scanner's "Tap a wristband" is the way.
// A muster station's tag opens the muster; a checkpoint's means nothing outside a round.
// Nothing with the module off, in a browser, or in a build without NFC.
// ===================================

import { useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { useData } from '../contexts/DataContext';
import { moduleOn } from '../constants/modules';
import { nfcClaimed, nfcReady, readTag } from '../services/nfcReader';
import { resolveTap } from '../services/nfcTags';
import { recordScanProof } from '../services/signingPolicy';
import { t } from '../utils/i18n';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mounted beside the navigator (index.tsx), so it is handed the container's navigate. */
export function NfcListener({ navigate }: { navigate: (route: string, params?: object) => void }) {
  const { nfcTags, flat, recordScan } = useData();
  const on = Platform.OS === 'android' && moduleOn('nfc');
  const tagsRef = useRef(nfcTags);
  tagsRef.current = nfcTags;
  const flatRef = useRef(flat);
  flatRef.current = flat;
  const scanRef = useRef(recordScan);
  scanRef.current = recordScan;
  const navRef = useRef(navigate);
  navRef.current = navigate;

  useEffect(() => {
    if (!on) return;
    let alive = true;
    void (async () => {
      if (!(await nfcReady())) return;
      while (alive) {
        if (nfcClaimed() || AppState.currentState !== 'active') {
          await sleep(700);
          continue;
        }
        const read = await readTag('', { background: true });
        if (!alive) break;
        // Nothing read: another read took the reader, or the app went to the back.
        if (!read || nfcClaimed()) {
          await sleep(800);
          continue;
        }
        const r = resolveTap(read.uid, read.payload, tagsRef.current);
        if (!r.ok) Alert.alert(t('nfc.band'), t(`nfc.why.${r.why}`));
        else if (r.tag.kind === 'person') navRef.current('NfcPerson', { ref: r.tag.ref });
        else if (r.tag.kind === 'muster' && moduleOn('muster')) navRef.current('Muster');
        else if (r.tag.kind === 'item') {
          // ItemDetail is keyed by {category, id}; the category comes from the register, as for a scanned label.
          const item = flatRef.current.find((x) => x.id === r.tag.ref);
          if (!item) Alert.alert(t('nfc.tag'), t('scn.staleTitle'));
          else {
            recordScanProof(item.id, 'nfc');
            void scanRef.current(item.id);
            navRef.current('ItemDetail', { category: item.category, id: item.id });
          }
        }
        // The same wristband is still on the phone for a moment: let it go.
        await sleep(1500);
      }
    })();
    return () => {
      alive = false;
    };
  }, [on]);

  return null;
}
