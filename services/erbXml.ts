// ===================================
// A record book month as XML (20 Nov 2026, Panama MMC-193 §3.3.7c: the
// electronic record book exports its records in XML).
//
// The same records as records.json in the Master's signed copy, written out as
// elements: every entry version, the Master's verifications, the reasons for
// entries held back, the keys that sealed them and the month's access log. It
// goes INTO the signed copy and is listed in its manifest, so a changed byte
// shows like any other file's (services/signedCopy).
//
// The shape is generic on purpose — a field is an element of the same name, a
// list repeats <item>, a key that is not an XML name becomes <field name="…">
// — so a field added to a book later is exported without touching this file.
// Times stored as milliseconds carry `utc` beside the number.
// Pure: runs under Node in `npm run check:seal`.
// ===================================

import type { CopyManifest, CopyRecords } from './signedCopy';

export const XML_NS = 'https://ismpilot.com/xml/erb-copy/1';

const esc = (s: string) =>
  s
    // Characters XML 1.0 cannot hold at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const isName = (k: string) => NAME.test(k) && !/^xml/i.test(k);

/** A number under a time-like key that reads as a date from 2000 to 2100. */
const isTime = (k: string, v: number) => /(^at$|At$|^updated|^exported|^printed)/.test(k) && v > 946684800000 && v < 4102444800000;

function el(k: string, v: unknown, pad: string): string {
  if (v === undefined || v === null || typeof v === 'function') return '';
  const open = isName(k) ? k : `field name="${esc(k)}"`;
  const close = isName(k) ? k : 'field';
  if (Array.isArray(v)) {
    const inner = v.map((x) => el('item', x, pad + ' ')).join('');
    return inner ? `${pad}<${open}>\n${inner}${pad}</${close}>\n` : `${pad}<${open}/>\n`;
  }
  if (typeof v === 'object') {
    const inner = Object.keys(v as object)
      .sort()
      .map((c) => el(c, (v as any)[c], pad + ' '))
      .join('');
    return inner ? `${pad}<${open}>\n${inner}${pad}</${close}>\n` : `${pad}<${open}/>\n`;
  }
  if (typeof v === 'number') {
    const utc = isTime(k, v) ? ` utc="${new Date(v).toISOString()}"` : '';
    return `${pad}<${open}${utc}>${v}</${close}>\n`;
  }
  return `${pad}<${open}>${esc(String(v))}</${close}>\n`;
}

function list(tag: string, one: string, rows: object[] | undefined, pad: string): string {
  if (!rows?.length) return `${pad}<${tag}/>\n`;
  return `${pad}<${tag} count="${rows.length}">\n${rows.map((r) => el(one, r, pad + ' ')).join('')}${pad}</${tag}>\n`;
}

/** The month's records as one XML document (UTF-8). `head` = the copy's manifest without its file list. */
export function recordsXml(head: Omit<CopyManifest, 'files'>, r: CopyRecords): string {
  const p = ' ';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    `<recordBookCopy xmlns="${XML_NS}" format="${esc(head.format)}">\n`,
    el('book', head.book, p),
    el('title', head.title, p),
    el('month', head.month, p),
    el('vessel', head.vessel, p),
    el('software', head.software, p),
    el('exportedAt', head.exportedAt, p),
    el('master', head.master, p),
    list('entries', 'entry', r.entries, p),
    list('verifications', 'verification', r.verifications, p),
    list('heldBack', 'note', r.notes, p),
    list('keys', 'key', r.keys, p),
    list('accessLog', 'event', r.access, p),
    '</recordBookCopy>\n',
  ].join('');
}
