// ===================================
// Biometric confirmation — NATIVE (iOS / Android). The web build uses
// biometric.web.ts (WebAuthn: Touch ID, Windows Hello).
//
// Loaded defensively, like expo-secure-store in firebaseService: a store build
// made before expo-local-authentication was added has no native module, and
// requiring the JS wrapper there throws a redbox even inside try/catch. On such
// a build this reports "not available" and signing falls back to the PIN.
//
// What a success proves, and no more: someone whose finger is enrolled
// in THIS handset's own settings confirmed. The phone does not say whose — which
// is why services/signature.ts offers it only for the device's own account.
// ===================================

import { Platform } from 'react-native';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'biometric';

let _la: any | null | undefined;
function la(): any | null {
  if (_la !== undefined) return _la;
  _la = null;
  if (Platform.OS === 'windows') return _la;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (requireOptionalNativeModule && requireOptionalNativeModule('ExpoLocalAuthentication')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _la = require('expo-local-authentication');
    }
  } catch {
    _la = null;
  }
  return _la;
}

/** The kind this device offers, or null when it has none enrolled (or no module). */
export async function biometricKind(): Promise<BiometricKind | null> {
  const L = la();
  if (!L) return null;
  try {
    if (!(await L.hasHardwareAsync()) || !(await L.isEnrolledAsync())) return null;
    // A fingerprint or nothing: a face is not a signature (10 Oct 2026). An
    // iPhone with Face ID, a phone with face or iris unlock only — the signer
    // uses the PIN or signs by hand instead.
    const types: number[] = await L.supportedAuthenticationTypesAsync();
    const T = L.AuthenticationType ?? {};
    return types.includes(T.FINGERPRINT) ? 'fingerprint' : null;
  } catch {
    return null;
  }
}

/**
 * Ask for the finger. Biometrics only — the device passcode is NOT
 * accepted as a fallback, because on a ship the passcode of a shared phone is
 * known to half the crew. Our own signing PIN is the fallback instead.
 */
export async function confirmBiometric(reason: string): Promise<boolean> {
  const L = la();
  if (!L) return false;
  try {
    const r = await L.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
      fallbackLabel: '',
      // Android: class-3 ("strong") biometrics only. On a phone with both, this
      // leaves out the face unlock most makers ship as class 2.
      biometricsSecurityLevel: 'strong',
    });
    return !!r?.success;
  } catch {
    return false;
  }
}
