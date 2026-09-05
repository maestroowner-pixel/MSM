// ===================================
// Web Alert shim.
//
// react-native-web does NOT implement Alert.alert — it is a silent no-op — so on
// web every confirmation and every error message in the app would simply not
// appear. Imported once for its side effect at startup; native is untouched.
//
// It drew on `window.alert` / `window.confirm` until 5 Sep 2026, and that was a
// mistake worth remembering: a browser lets the user tick "prevent this page
// from creating additional dialogs", after which `confirm()` returns false
// having shown nothing. The shim read that as Cancel, so restoring a backup
// quietly did nothing — and the same suppression sits in front of the dialog
// that SIGNS an inspection. The dialog is now drawn in the DOM, where nothing
// can suppress it and a refusal is always a real refusal.
// ===================================

import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web') {
  const g: any = globalThis as any;

  /**
   * A dialog the PAGE draws, not the browser.
   *
   * This used to call `window.alert` / `window.confirm`, and that turned out to
   * be load-bearing in the worst way: every browser lets a user tick "prevent
   * this page from creating additional dialogs", after which `confirm()` returns
   * false without showing anything. The shim read that as "Cancel" and the app
   * went silent — restoring a backup did nothing at all, with no error, and the
   * same suppression would have swallowed the confirmation that signs an
   * inspection. A dialog drawn in the DOM cannot be suppressed and cannot be
   * mistaken for a refusal.
   *
   * Deliberately plain: this is the fallback for React Native's Alert, so it has
   * no access to the app's theme and must look reasonable on any screen.
   */
  function showDialog(
    title: string,
    message: string,
    buttons: Array<{ text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ): void {
    const doc = g.document;
    if (!doc) {
      // No DOM at all (SSR, a worker): fall back to the old behaviour rather
      // than dropping the action on the floor.
      buttons.find((b) => b.style !== 'cancel')?.onPress?.();
      return;
    }

    const overlay = doc.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(8,22,28,.45);' +
      'display:flex;align-items:center;justify-content:center;padding:24px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    const card = doc.createElement('div');
    card.style.cssText =
      'background:#fff;border-radius:16px;max-width:460px;width:100%;padding:22px 24px;' +
      'box-shadow:0 18px 50px rgba(0,0,0,.28);color:#22333B;';

    if (title) {
      const h = doc.createElement('div');
      h.textContent = title;
      h.style.cssText = 'font-size:17px;font-weight:700;margin-bottom:8px;';
      card.appendChild(h);
    }
    if (message) {
      const p = doc.createElement('div');
      p.textContent = message;
      p.style.cssText = 'font-size:14px;line-height:1.45;white-space:pre-wrap;color:#4A5A62;';
      card.appendChild(p);
    }

    const row = doc.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap;';

    const close = () => {
      try { overlay.remove(); } catch { /* already gone */ }
      g.removeEventListener?.('keydown', onKey);
    };
    const onKey = (e: any) => {
      if (e?.key === 'Escape') {
        close();
        buttons.find((b) => b.style === 'cancel')?.onPress?.();
      }
    };
    g.addEventListener?.('keydown', onKey);

    const list = buttons.length ? buttons : [{ text: 'OK' }];
    list.forEach((b) => {
      const btn = doc.createElement('button');
      btn.textContent = b.text || 'OK';
      const destructive = b.style === 'destructive';
      const cancel = b.style === 'cancel';
      btn.style.cssText =
        'appearance:none;border:0;cursor:pointer;border-radius:10px;padding:10px 18px;' +
        'font-size:14px;font-weight:700;' +
        (cancel
          ? 'background:#EEF3F5;color:#33454E;'
          : destructive
            ? 'background:#E74C3C;color:#fff;'
            : 'background:#2E7D99;color:#fff;');
      btn.onclick = () => {
        close();
        b.onPress?.();
      };
      row.appendChild(btn);
    });

    card.appendChild(row);
    overlay.appendChild(card);
    doc.body.appendChild(overlay);
    // Focus the last button so Enter confirms, matching a native dialog.
    try { (row.lastChild as any)?.focus?.(); } catch { /* ignore */ }
  }

  (Alert as any).alert = (
    title?: string,
    message?: string,
    buttons?: Array<{ text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) => {
    showDialog(title ?? '', message ?? '', buttons ?? []);
  };
}
