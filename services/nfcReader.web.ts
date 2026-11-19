// A browser cannot read NFC (Web NFC is Chrome on Android only, and not the officer's
// desk computer) — every NFC button is hidden and the QR and the name list stay. See nfcReader.ts.

export interface TagRead {
  uid: string;
  payload: string | null;
}

export const nfcReady = async (): Promise<boolean> => false;
export const nfcSwitchedOff = async (): Promise<boolean> => false;
export const readTag = async (_prompt: string, _opts?: { background?: boolean }): Promise<TagRead | null> => null;
export const claimNfc = (): (() => void) => () => {};
export const nfcClaimed = () => false;
export const cancelRead = async (): Promise<void> => {};
export async function writeTag(_uri: string, _prompt: string, _refuse?: (uid: string) => boolean): Promise<string> {
  throw new Error('nfc');
}
