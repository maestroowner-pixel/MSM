// The document itself, readable on the page (web): a PDF in the browser's own
// viewer, an image as an image. Native shows nothing here and keeps the "Open"
// button (components/DocViewer.tsx).
//
// A file still held on this device is a `data:` URI, and Chrome will not show a
// data: PDF in a frame — so it is turned into a blob: URL first.
import React, { useEffect, useMemo } from 'react';

function toBlobUrl(dataUri: string): string {
  const comma = dataUri.indexOf(',');
  const mime = /^data:([^;,]+)/.exec(dataUri)?.[1] ?? 'application/octet-stream';
  const bin = atob(dataUri.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export function DocViewer({ uri, name }: { uri: string; name?: string }) {
  const src = useMemo(() => (uri.startsWith('data:') ? toBlobUrl(uri) : uri), [uri]);
  useEffect(() => () => {
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
  }, [src]);
  const isImage = /^data:image\//i.test(uri) || /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(name ?? uri);
  const box: React.CSSProperties = { width: '100%', height: '78vh', border: '1px solid #c8d0db', borderRadius: 10, background: '#fff', marginTop: 12 };
  if (isImage) {
    return React.createElement('img', { src, alt: name ?? 'Document', style: { ...box, height: 'auto', maxHeight: '78vh', objectFit: 'contain' } });
  }
  return React.createElement('iframe', { src, title: name ?? 'Document', style: box });
}
