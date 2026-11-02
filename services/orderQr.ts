// A purchase order's QR — pure, so its check needs no printing modules (services/qrLabel re-exports it).

/**
 * A purchase order's QR — on the order screen and the delivery-box label:
 * `msm://order/<id>`, a link the phone's own camera also opens. Labels printed
 * before 2.71 carry `po:<id>`, which the in-app scanner still reads.
 */
export const orderQrPayload = (id: string) => `msm://order/${encodeURIComponent(id)}`;
export function parseOrderQr(payload: string): string | null {
  const s = payload.trim();
  const m = /^msm:\/\/order\/(.+)$/i.exec(s) ?? /^po:(.+)$/i.exec(s);
  if (!m) return null;
  try { return decodeURIComponent(m[1].replace(/\/+$/, '')) || null; } catch { return null; }
}
