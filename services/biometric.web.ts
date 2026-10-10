// ===================================
// Biometric confirmation — WEB. Touch ID on a Mac, Windows Hello on a PC, the
// phone's own unlock in a mobile browser: the browser's platform authenticator,
// through WebAuthn.
//
// There is no server in this exchange, so it is a LOCAL check, the same strength
// as the native one: a credential is created once on this browser (bound to this
// site and this computer), and each signature asks the browser to use it with
// `userVerification: 'required'` — which it does only after the finger, face or
// Windows Hello PIN. Success is the browser saying the user was verified.
//
// The credential id is kept in localStorage. Cleared site data means one more
// "create" the next time, nothing worse.
// ===================================

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'biometric';

const CRED_KEY = 'msm:webauthn_cred';

function rand(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function biometricKind(): Promise<BiometricKind | null> {
  try {
    const PKC: any = (globalThis as any).PublicKeyCredential;
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return null;
    if (!window.isSecureContext) return null;
    // Only a Mac's Touch ID. In a browser the platform authenticator does not say
    // which it uses: on an iPad or a phone it is Face ID or face unlock, on a PC
    // Windows Hello may be a face — and a face is not a signature (10 Oct 2026).
    // Those devices sign with the PIN or by hand.
    const mac = /Macintosh/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 0);
    if (!mac) return null;
    return (await PKC.isUserVerifyingPlatformAuthenticatorAvailable()) ? 'fingerprint' : null;
  } catch {
    return null;
  }
}

/** The stored credential, or `created` when one was made (and the user verified) just now. */
async function credentialId(): Promise<Uint8Array | 'created' | null> {
  try {
    const have = localStorage.getItem(CRED_KEY);
    if (have) return fromB64(have);
  } catch {
    /* storage blocked: create a fresh one below */
  }
  const cred: any = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'ISMpilot', id: location.hostname },
      user: { id: rand(16), name: 'ismpilot-signature', displayName: 'ISMpilot signature' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  } as any);
  if (!cred?.rawId) return null;
  try {
    localStorage.setItem(CRED_KEY, toB64(cred.rawId));
  } catch {
    /* fine — asked again next time */
  }
  // Creating it already required the user to verify: that is this signature.
  return 'created';
}

export async function confirmBiometric(_reason: string): Promise<boolean> {
  try {
    const id = await credentialId();
    if (id === 'created') return true;
    if (!id) return false;
    const got: any = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id, transports: ['internal'] } as any],
        userVerification: 'required',
        timeout: 60000,
      },
    } as any);
    return !!got;
  } catch {
    return false;
  }
}
