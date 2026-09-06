// ===================================
// Closing a screen that may have nothing behind it.
//
// `navigation.goBack()` is a no-op when the stack has one entry, and it fails
// SILENTLY — the button appears dead. That never happened while every screen was
// reached by tapping through the app, and started happening the moment screens
// got URLs: open /label, /defects or /join directly, or reload the page on one,
// and the browser hands React Navigation a stack of exactly one. Close then does
// nothing at all, which reads as a broken button rather than as "there is no
// previous screen".
//
// So: go back when there is somewhere to go, and otherwise go somewhere sensible.
// The Dashboard is the default because it is the app's home and every tab is one
// tap from it.
// ===================================

/* eslint-disable @typescript-eslint/no-explicit-any */

export function goBackOr(nav: any, fallback: string = 'Main'): void {
  if (nav?.canGoBack?.()) {
    nav.goBack();
    return;
  }
  try {
    nav?.navigate?.(fallback);
  } catch {
    /* nothing to fall back to — better a dead button than a crash */
  }
}
