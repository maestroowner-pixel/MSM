// ===================================
// Web Alert shim.
// react-native-web does NOT implement Alert.alert (it's a silent no-op), so on
// web every Alert.alert in the app — success/error toasts, delete/reset
// confirmations — would show nothing. Patch it to use the browser's native
// window.alert / window.confirm. Imported once for its side effect at startup.
// Native (iOS/Android) is untouched.
// ===================================

import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web') {
  const g: any = globalThis as any;

  (Alert as any).alert = (
    title?: string,
    message?: string,
    buttons?: Array<{ text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) => {
    const text = [title, message].filter(Boolean).join('\n\n');

    // 0–1 button → a simple alert; fire the (single) button's handler after OK.
    if (!buttons || buttons.length <= 1) {
      try { g.window?.alert?.(text); } catch { /* ignore */ }
      buttons?.[0]?.onPress?.();
      return;
    }

    // 2+ buttons → confirm(). OK runs the primary (non-cancel) action, Cancel the
    // cancel one. A 3rd button degrades to one of these — acceptable on web.
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const confirmBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
    let ok = false;
    try { ok = !!g.window?.confirm?.(text); } catch { ok = false; }
    if (ok) confirmBtn?.onPress?.();
    else cancelBtn?.onPress?.();
  };
}
