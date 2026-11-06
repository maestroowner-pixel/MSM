// ===================================
// A supplier's invoice against the order (plan AI-2, services/purchaseAi.ts
// checkInvoice): the AI reads the PDF or photo, the app compares line by line —
// invoiced against what came aboard and what was ordered, the price against the
// one agreed, delivery against the quote, the total against its own lines.
//
// Nothing is stored: a received order is closed to writes (firestore.rules), and
// the invoice stays the supplier's paper. The panel says what to query; paying
// it is the APA entry on Finance, as before.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { Card, Label } from './ui';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { PurchaseOrder } from '../types/orders';
import { aiOrLater, removeAiJob } from '../services/aiQueue';
import { pickDocForAi } from '../services/medFiles';
import { money } from '../services/finance';
import { checkInvoice, deliveryAbove, InvoiceAiReply, InvoiceCheck, keyIds, linesForAi } from '../services/purchaseAi';
import { uiDate } from '../utils/dates';
import { makeStyles } from '../screens/SafetySc';
import { t, useT } from '../utils/i18n';

const fig = (n?: number) => (n == null ? '—' : money(n, '').trim());

export function InvoiceCheckPanel({ o, waited, waitedLines, jobId }: { o: PurchaseOrder; waited?: InvoiceAiReply; waitedLines?: string[]; jobId?: string }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [reply, setReply] = useState<{ r: InvoiceAiReply; lines: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // An invoice that waited for a connection (services/aiQueue.ts) opens here, once.
  const taken = useRef(false);
  useEffect(() => {
    if (!waited || taken.current) return;
    taken.current = true;
    setReply({ r: waited, lines: waitedLines ?? keyIds(o) });
    if (jobId) void removeAiJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, jobId]);

  // Against the order as it is now: a delivery recorded since is counted.
  const c: InvoiceCheck | null = useMemo(() => (reply ? checkInvoice(o, reply.r, reply.lines) : null), [o, reply]);

  const read = async () => {
    const f = await pickDocForAi();
    if (!f) return;
    setBusy(true);
    setNote(null);
    try {
      const comma = f.dataUri.indexOf(',');
      const lines = keyIds(o);
      const out = await aiOrLater<InvoiceAiReply>('invoice', { mediaType: f.dataUri.slice(5, f.dataUri.indexOf(';')), data: f.dataUri.slice(comma + 1), lines: linesForAi(o) }, {
        label: `${o.no}${o.supplier ? ` · ${o.supplier}` : ''}`,
        target: { po: o.id, lineIds: lines },
      });
      if ('queued' in out) setNote(t('ai.queued'));
      else setReply({ r: out.result, lines });
    } catch (e: any) {
      Alert.alert(t('inv.title'), e?.message === 'ai.tooBig' ? t('ai.tooBig') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const cur = c?.currency ?? c?.orderCurrency ?? '';
  return (
    <Card style={{ marginTop: SIZES.md }}>
      <Label>{t('inv.title')}</Label>
      <Text style={styles.sub}>{t('inv.intro')}</Text>
      <View style={[styles.row, { gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void read()}>
          <Text style={styles.smallText}>{busy ? t('rfq.aiReading') : c ? t('inv.another') : t('inv.read')}</Text>
        </TouchableOpacity>
        {c ? <TouchableOpacity onPress={() => setReply(null)}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {note ? <Text style={styles.sub}>{note}</Text> : null}

      {c ? (
        <>
          <Text style={[styles.name, { marginTop: SIZES.sm }]}>
            {[c.number ? t('inv.no', { no: c.number }) : t('inv.noNo'), c.date ? uiDate(c.date) : '', c.total != null ? money(c.total, cur) : ''].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[styles.sub, { color: c.problems ? COLORS.danger : COLORS.success, fontWeight: '700' }]}>
            {c.problems ? t('inv.problems', { n: c.problems }) : t('inv.clean')}
          </Text>
          {!c.sameCurrency ? <Text style={[styles.sub, { color: COLORS.warning }]}>{t('inv.otherCur', { inv: c.currency ?? '', po: c.orderCurrency ?? '' })}</Text> : null}

          {c.rows.map((r, i) => {
            const bad = r.issues.some((x) => x !== 'notInvoiced');
            return (
              <View key={r.lineId} style={[styles.item, { borderLeftColor: bad ? COLORS.danger : r.issues.length ? COLORS.warning : r.invoiced ? COLORS.success : COLORS.border, marginTop: SIZES.xs }]}>
                <Text style={styles.name}>{`${i + 1}. ${r.description}`}</Text>
                <Text style={styles.sub}>{t('inv.qtys', { ord: r.ordered, rcv: r.received, inv: r.invoiced, unit: r.unit })}</Text>
                {r.price != null || r.agreed != null ? <Text style={styles.sub}>{t('inv.prices', { agreed: fig(r.agreed), price: fig(r.price) })}</Text> : null}
                {r.issues.map((x) => (
                  <Text key={x} style={[styles.sub, { color: x === 'notInvoiced' ? COLORS.warning : COLORS.danger, fontWeight: '700' }]}>{t(`inv.issue.${x}`)}</Text>
                ))}
              </View>
            );
          })}

          {c.extra.length ? (
            <View style={[styles.item, { borderLeftColor: COLORS.danger, marginTop: SIZES.xs }]}>
              <Text style={styles.name}>{t('inv.extra', { n: c.extra.length })}</Text>
              {c.extra.map((x, i) => <Text key={i} style={styles.sub}>{`${x.description}${x.amount != null ? ` · ${fig(x.amount)}` : ''}`}</Text>)}
            </View>
          ) : null}

          {c.delivery != null ? (
            <Text style={[styles.sub, deliveryAbove(c) ? { color: COLORS.danger, fontWeight: '700' } : null]}>
              {t('inv.delivery', { inv: fig(c.delivery), agreed: c.agreedDelivery != null ? fig(c.agreedDelivery) : '—' })}
            </Text>
          ) : null}
          {c.totalOff ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('inv.totalOff', { total: fig(c.total), sum: fig(c.computed) })}</Text> : null}
          {c.unreadable ? <Text style={styles.sub}>{t('dpt.couldNot', { what: c.unreadable })}</Text> : null}
          <Text style={styles.sub}>{t('inv.note')}</Text>
        </>
      ) : null}
    </Card>
  );
}
