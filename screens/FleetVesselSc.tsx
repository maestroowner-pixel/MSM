// ===================================
// One vessel, from the office — the superintendent's view (screens/FleetSc).
//
// Three tabs, in the order a superintendent works a vessel:
//   Certificates  vessel, crew and equipment certificates with their expiry —
//                 added and edited here, saved on the server into the vessel's
//                 register (functions `shoreSaveCertificate`); the crew aboard
//                 receive the change on their next sync.
//   Documents     the ISM documents and who has not signed the current
//                 revision — added, edited and re-issued here.
//   Equipment     what is expired or due, read-only: the crew inspect it aboard.
//   PMS           jobs overdue and due, read-only.
// …and the office tabs when their modules are on. Opened from Fleet's "Needs
// attention" with `tab` and `open` (a record id): that record's sheet opens at once.
// ===================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle, StatusPill } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import * as shore from '../services/shore';
import { moduleOn } from '../constants/modules';
import { VesselData } from '../services/fleetSummary';
import { readStatus } from '../services/docs';
import { pickDocument, toDataUri } from '../services/attachments';
import { pdfText } from '../utils/pdfText';
import { activeDeferral, jobDue, todayIso } from '../services/pms';
import { Certificate, CertificateScope, scopeOf } from '../types/certificate';
import { DOC_CATEGORY_LABEL, DocCategory, IsmDoc } from '../types/docs';
import { computeStatus, statusFromDate, uiDate } from '../utils/dates';
import { catLabel } from '../constants/categories';
import { uid } from '../utils/id';
import { approveDeferral, awaitsOffice, deferralsToAnswer, giveBack, ncAwaitsOffice, refuseDeferral, verify, verifyNc } from '../services/officeCheck';
import { PmsDefect, PmsDeferral } from '../types/pms';
import { RISK_COLOR } from '../services/permits';
import { NonConformity } from '../types/safety';
import { findingsOf, inspStatus, sortInspections } from '../services/extInspections';
import { downtimeDays, isOut } from '../services/critEq';
import { NC_STATE_LABEL, ncState } from '../services/safety';
import { Attachment } from '../types/equipment';
import { PurchaseOrder } from '../types/orders';
import { approvedNotPlaced, emergencyOpen, markReview, officeApprove, officeOrdered, officeQueue, officeReject, officeReturn, poStage } from '../services/poApproval';
import { PoProgress } from '../components/PoApprovalPanel';
import { t, tk, useT } from '../utils/i18n';

type Tab = 'certs' | 'docs' | 'equipment' | 'pms' | 'verify' | 'insp' | 'crit' | 'po';
const SCOPES: { key: CertificateScope; label: string }[] = [
  { key: 'vessel', label: 'Vessel' },
  { key: 'crew', label: 'Crew' },
  { key: 'equipment', label: 'Equipment' },
];

export default function FleetVesselSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const params = useRoute<any>().params ?? {};
  const imo: string = params.imo;
  const [v, setV] = useState<VesselData | null>(null);
  const [tab, setTab] = useState<Tab>(params.tab ?? 'certs');
  const opened = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [docEdit, setDocEdit] = useState<{ doc: IsmDoc; isNew: boolean } | null>(null);
  const [check, setCheck] = useState<{ defect?: PmsDefect; nc?: NonConformity; deferral?: PmsDeferral } | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);

  const load = useCallback(async () => {
    try {
      setV(await shore.loadVessel(imo));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [imo]);

  useEffect(() => {
    if (!moduleOn('fleet')) return;
    void (async () => {
      // Opened by link: the console's session may not be up yet.
      try {
        await shore.resume();
      } catch {
        /* load() reports it */
      }
      await load();
    })();
  }, [load]);

  // From "Needs attention": open the record's sheet once, as a tap on its row would.
  useEffect(() => {
    const id: string | undefined = params.open;
    if (!v || !id || opened.current === id) return;
    opened.current = id;
    const df = (v.deferrals ?? []).find((x) => x.id === id);
    const d = (v.defects ?? []).find((x) => x.id === id);
    const nc = (v.ncs ?? []).find((x) => x.id === id);
    const o = (v.orders ?? []).find((x) => x.id === id);
    if (df && !df.office) setCheck({ deferral: df });
    else if (d && awaitsOffice(d)) setCheck({ defect: d });
    else if (nc && ncAwaitsOffice(nc)) setCheck({ nc });
    else if (o) setPo(o);
  }, [v, params.open]);

  if (!v) {
    return (
      <Screen>
        <ScreenTitle title={t('certs.tab.vessel')} subtitle={`IMO ${imo}`} />
        {error ? <Text style={{ color: COLORS.danger }}>{error}</Text> : <ActivityIndicator color={COLORS.primary} />}
      </Screen>
    );
  }

  const certs = [...v.certificates].sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));
  const docs = v.docs.filter((d) => !d.deleted).sort((a, b) => (a.docNo ?? a.title).localeCompare(b.docNo ?? b.title, undefined, { numeric: true }));
  const owed = v.items
    .map((it) => ({ it, st: computeStatus(it) }))
    .filter((x) => x.st === 'expired' || x.st === 'due')
    .sort((a, b) => (a.st === b.st ? 0 : a.st === 'expired' ? -1 : 1));
  // Verified by the office (services/officeCheck): closures waiting for this superintendent.
  // On for the build, or for this vessel (a pilot) — the superintendent has no vessel of their own to read it from.
  const office = moduleOn('officeCheck') || v.modules?.officeCheck === true;
  const toVerify = (v.defects ?? []).filter(awaitsOffice).sort((a, b) => a.closed!.at - b.closed!.at);
  const ncsToVerify = (v.ncs ?? []).filter(ncAwaitsOffice).sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
  const toApprove = deferralsToAnswer(v.deferrals ?? [], v.jobs);
  const machineById = new Map(v.machines.filter((m) => !m.deleted).map((m) => [m.id, m]));
  const pmsOwed = v.jobs
    .filter((j) => !j.deleted && machineById.has(j.machineId))
    .map((j) => ({ j, st: jobDue(j, machineById.get(j.machineId), todayIso(), activeDeferral(j, v.deferrals ?? [])).status }))
    .filter((x) => x.st === 'expired' || x.st === 'due')
    .sort((a, b) => (a.st === b.st ? 0 : a.st === 'expired' ? -1 : 1));
  const tabs: [Tab, string][] = [['certs', `${t('fleet.certs')} · ${certs.length}`], ['docs', `${t('docs.title')} · ${docs.length}`], ['equipment', `${t('cat.title')} · ${owed.length}`], ['pms', `PMS · ${pmsOwed.length}`]];
  if (office) tabs.push(['verify', `${t('oc.tab')} · ${toVerify.length + ncsToVerify.length + toApprove.length}`]);
  // External inspections (types/extInspection.ts): on for the build or for this vessel.
  const today = todayIso();
  const insps = moduleOn('extInsp') || v.modules?.extInsp === true ? sortInspections(v.extInspections ?? [], v.ncs ?? [], today) : null;
  if (insps) tabs.push(['insp', `${t('ei.title')} · ${insps.length}`]);
  // Critical equipment (services/critEq): defects open on critical machines and every machine out of service.
  const critIds = new Set(v.machines.filter((m) => m.critical && !m.deleted).map((m) => m.id));
  const critList = moduleOn('critEq') || v.modules?.critEq === true
    ? (v.defects ?? []).filter((d) => isOut(d) || (!d.closed && critIds.has(d.machineId))).sort((a, b) => Number(isOut(b)) - Number(isOut(a)) || a.at - b.at)
    : null;
  if (critList) tabs.push(['crit', `${t('crq.tab')} · ${critList.length}`]);
  // Requisitions through the office (services/poApproval): to decide, approved but not placed, in work.
  const orders = (v.orders ?? []).filter((o) => !o.deleted);
  const poQueue = moduleOn('poApproval') || v.modules?.poApproval === true ? officeQueue(orders) : null;
  const poApproved = poQueue ? approvedNotPlaced(orders) : [];
  const poInWork = poQueue ? orders.filter((o) => o.approval?.length && (o.status === 'sent' || o.status === 'partial') && !emergencyOpen(o)).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  if (poQueue) tabs.push(['po', `${t('poa.tab')} · ${poQueue.length}`]);
  const poRow = (o: PurchaseOrder) => (
    <TouchableOpacity key={o.id} style={styles.row} onPress={() => setPo(o)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{`${o.no} · ${tk(`od.${o.dept}`)}${o.urgency && o.urgency !== 'routine' ? ` · ${tk(`po.urg.${o.urgency}`)}` : ''}`}</Text>
        <Text style={[styles.sub, emergencyOpen(o) && { color: COLORS.warning, fontWeight: '700' }]} numberOfLines={1}>
          {[emergencyOpen(o) ? t('poa.emergencyOpenShort') : tk(`poa.st.${poStage(o)}`), t('poa.linesN', { n: o.lines.filter((l) => l.qty > 0).length }), o.by].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <ScreenTitle title={v.name} subtitle={`IMO ${v.imo} · ${t('fv.supt')}`} />
      <View style={styles.tabs}>
        {tabs.map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'po' && poQueue ? (
        <>
          {poQueue.map(poRow)}
          {!poQueue.length ? <Empty text={t('poa.nothing')} /> : null}
          {poApproved.length ? <Label style={{ marginTop: SIZES.md }}>{t('poa.approvedNotPlaced')}</Label> : null}
          {poApproved.map(poRow)}
          {poInWork.length ? <Label style={{ marginTop: SIZES.md }}>{t('poa.inWork')}</Label> : null}
          {poInWork.slice(0, 20).map(poRow)}
        </>
      ) : tab === 'insp' && insps ? (
        <>
          {!insps.length ? <Empty text={t('ei.empty')} /> : null}
          {insps.map((x) => {
            const s = inspStatus(x, v.ncs ?? [], today);
            const c = s.detainedNow || s.state === 'overdue' ? COLORS.danger : s.state === 'open' ? COLORS.warning : COLORS.success;
            return (
              <View key={x.id} style={{ marginBottom: SIZES.sm }}>
                <Text style={styles.title}>{[tk(`ei.kind.${x.kind}`), x.port, uiDate(x.date)].filter(Boolean).join(' · ')}</Text>
                <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>
                  {[s.detainedNow ? t('ei.detainedNow') : x.detained && x.releasedOn ? t('ei.wasDetained', { date: uiDate(x.releasedOn) }) : null, tk(`ei.state.${s.state}`), s.total ? t('ei.closedK', { k: s.closed, n: s.total }) : null, s.verified ? t('ei.verifiedK', { k: s.verified }) : null, s.overdue ? t('ei.overdueN', { n: s.overdue }) : null].filter(Boolean).join(' · ')}
                </Text>
                <Text style={styles.sub}>{[x.no, x.authority, x.inspector, x.reportNo].filter(Boolean).join(' · ')}</Text>
                {findingsOf(x, v.ncs ?? []).map((nc) => (
                  <TouchableOpacity key={nc.id} style={styles.row} disabled={!(office && ncAwaitsOffice(nc))} onPress={() => setCheck({ nc })}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title} numberOfLines={2}>{`${nc.no} — ${nc.title}`}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{[NC_STATE_LABEL[ncState(nc, today)], nc.pscAction ? `${nc.pscAction} · ${tk(`ei.act.${nc.pscAction}`)}` : null, nc.office?.result === 'verified' ? t('ei.officeOk') : office && ncAwaitsOffice(nc) ? t('oc.tab') : null].filter(Boolean).join(' · ')}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </>
      ) : tab === 'crit' && critList ? (
        <>
          {critList.map((d) => (
            <View key={d.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{`${critIds.has(d.machineId) ? '⚑ ' : ''}${d.machineName} — ${d.description}`}</Text>
                <Text style={[styles.sub, isOut(d) && { color: COLORS.danger, fontWeight: '700' }]} numberOfLines={2}>
                  {[tk(`pms.defcat.${d.category}`), t('crq.raised', { date: uiDate(d.date) }), isOut(d) ? t('crq.outSince', { date: uiDate(d.outOfService!.from), n: downtimeDays(d, today) }) : null, d.awaitingSpares ? t('oc.sparesSince', { date: uiDate(d.awaitingSpares.since) }) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          ))}
          {!critList.length ? <Empty text={t('crq.nothing')} /> : null}
        </>
      ) : tab === 'verify' ? (
        <>
          {toApprove.map((d) => (
            <TouchableOpacity key={d.id} style={styles.row} onPress={() => setCheck({ deferral: d })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{`${d.machineName} — ${d.jobTitle}`}</Text>
                <Text style={styles.sub} numberOfLines={1}>{[t('od.row', { until: deferUntil(d) }), d.byRank ? `${d.by} (${d.byRank})` : d.by, uiDate(new Date(d.at).toISOString().slice(0, 10))].join(' · ')}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {toVerify.map((d) => (
            <TouchableOpacity key={d.id} style={styles.row} onPress={() => setCheck({ defect: d })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{`${d.machineName} — ${d.description}`}</Text>
                <Text style={styles.sub} numberOfLines={1}>{[tk(`pms.defcat.${d.category}`), t('oc.closedOn', { date: uiDate(d.closed!.date), who: d.closed!.byRank ? `${d.closed!.by} (${d.closed!.byRank})` : d.closed!.by }), d.closedBefore?.length ? t('oc.againN', { n: d.closedBefore.length }) : null].filter(Boolean).join(' · ')}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {ncsToVerify.map((nc) => (
            <TouchableOpacity key={nc.id} style={styles.row} onPress={() => setCheck({ nc })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{`${nc.no} — ${nc.title}`}</Text>
                <Text style={styles.sub} numberOfLines={1}>{t('oc.closedOn', { date: uiDate(new Date(nc.closedAt!).toISOString().slice(0, 10)), who: nc.closedByRank ? `${nc.closedBy} (${nc.closedByRank})` : nc.closedBy ?? '' })}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {!toVerify.length && !ncsToVerify.length && !toApprove.length ? <Empty text={t('oc.nothing')} /> : null}
        </>
      ) : tab === 'pms' ? (
        <>
          {pmsOwed.map(({ j, st }) => (
            <View key={j.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{j.title}</Text>
                <Text style={styles.sub} numberOfLines={1}>{machineById.get(j.machineId)!.name}</Text>
              </View>
              <StatusPill status={st} />
            </View>
          ))}
          {!pmsOwed.length ? <Empty text={t('ia.noPms')} /> : null}
        </>
      ) : tab === 'certs' ? (
        <>
          <TouchableOpacity onPress={() => setCert({ id: uid('cert'), name: '', scope: 'vessel', itemIds: [], createdAt: Date.now(), updatedAt: Date.now() })} style={styles.addRow}>
            <Text style={styles.link}>{t('crew.addCert')}</Text>
          </TouchableOpacity>
          {SCOPES.map(({ key, label }) => {
            const list = certs.filter((c) => scopeOf(c) === key);
            if (!list.length) return null;
            return (
              <View key={key}>
                <Label>{label}</Label>
                {list.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.row} onPress={() => setCert(c)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {[c.holderName, c.number, c.issuer, c.expiryDate ? t('crew.expires', { date: uiDate(c.expiryDate) }) : t('cm.noExpiry')].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <StatusPill status={statusFromDate(c.expiryDate)} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
          {!certs.length ? <Empty text={t('fv.noCerts')} /> : null}
        </>
      ) : tab === 'docs' ? (
        <>
          <TouchableOpacity
            onPress={() => setDocEdit({ isNew: true, doc: { id: uid('doc'), title: '', category: 'procedure', revision: 1, issued: todayIso(), mustRead: true, updatedAt: Date.now() } })}
            style={styles.addRow}
          >
            <Text style={styles.link}>{t('fv.addDoc')}</Text>
          </TouchableOpacity>
          {docs.map((d) => {
            const st = readStatus(d, v.acks, v.crew);
            return (
              <TouchableOpacity key={d.id} style={styles.row} onPress={() => setDocEdit({ doc: d, isNew: false })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{d.title}</Text>
                  <Text style={styles.sub} numberOfLines={2}>
                    {[d.docNo, t('docs.rev', { n: d.revision }), DOC_CATEGORY_LABEL[d.category]].filter(Boolean).join(' · ')}
                    {d.mustRead !== false && st.unread.length ? `\nNot signed: ${st.unread.map((p) => p.name).join(', ')}` : ''}
                  </Text>
                </View>
                {d.mustRead !== false && st.required ? (
                  <Text style={[styles.count, { color: st.unread.length ? COLORS.warning : COLORS.success }]}>{`${st.read.length}/${st.required}`}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {!docs.length ? <Empty text={t('fv.noDocs')} /> : null}
        </>
      ) : (
        <>
          {owed.map(({ it, st }) => (
            <View key={it.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{(it as any).name || (it as any).description || (it as any).serial || t('def.item')}</Text>
                <Text style={styles.sub} numberOfLines={1}>{[catLabel((it as any).category), (it as any).location].filter(Boolean).join(' · ')}</Text>
              </View>
              <StatusPill status={st} />
            </View>
          ))}
          {!owed.length ? <Empty text={t('fv.noOwed')} /> : null}
        </>
      )}

      {cert ? <CertEditor imo={imo} cert={cert} crew={v.crew} onClose={() => setCert(null)} onSaved={() => { setCert(null); void load(); }} /> : null}
      {check ? <OfficeCheckSheet imo={v.imo} check={check} onClose={() => setCheck(null)} onSaved={() => { setCheck(null); void load(); }} /> : null}
      {po ? <PoSheet imo={v.imo} order={po} onClose={() => { setPo(null); void load(); }} onSaved={() => { setPo(null); void load(); }} /> : null}
      {docEdit ? <DocEditor imo={imo} start={docEdit.doc} isNew={docEdit.isNew} onClose={() => setDocEdit(null)} onSaved={() => { setDocEdit(null); void load(); }} /> : null}
    </Screen>
  );
}

// ---- certificate editor ---------------------------------------------------------

function CertEditor({ imo, cert, crew, onClose, onSaved }: { imo: string; cert: Certificate; crew: VesselData['crew']; onClose: () => void; onSaved: () => void }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [c, setC] = useState<Certificate>(cert);
  const [busy, setBusy] = useState(false);
  const isNew = !cert.name;
  const set = (p: Partial<Certificate>) => setC((x) => ({ ...x, ...p }));
  const people = crew.filter((p) => p.active && !p.deleted);

  const save = async (remove = false) => {
    if (!remove && !c.name.trim()) return Alert.alert(t('crew.nameReq'), t('fv.nameCert'));
    setBusy(true);
    try {
      await shore.saveCertificate(imo, { ...c, name: c.name.trim() }, remove);
      onSaved();
    } catch (e: any) {
      Alert.alert(t('fv.notSaved'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const attach = async () => {
    const f = await pickDocument();
    if (!f) return;
    setBusy(true);
    try {
      const url = await shore.uploadFile(imo, c.id, `cert_${c.id}`, await toDataUri(f.uri, f.name ?? 'file'));
      set({ fileUri: url, fileName: f.name ?? 'file', fileKind: f.kind });
    } catch (e: any) {
      Alert.alert(t('fv.notUploaded'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={isNew ? t('fv.newCert') : t('fv.cert')} onClose={onClose} onSave={() => void save()} busy={busy}>
      <Label>{t('fv.kind')}</Label>
      <View style={styles.chips}>
        {SCOPES.map((s) => (
          <TouchableOpacity key={s.key} style={[styles.chip, scopeOf(c) === s.key && styles.chipOn]} onPress={() => set({ scope: s.key })}>
            <Text style={[styles.chipText, scopeOf(c) === s.key && styles.chipTextOn]}>{tk(`certs.tab.${s.key}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {scopeOf(c) === 'crew' ? (
        <>
          <Label>{t('fv.holder')}</Label>
          <View style={styles.chips}>
            {people.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.chip, c.crewId === p.id && styles.chipOn]} onPress={() => set({ crewId: p.id, holderName: p.name })}>
                <Text style={[styles.chipText, c.crewId === p.id && styles.chipTextOn]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
      <Label>{t('mt.namePh')}</Label>
      <TextInput style={styles.input} value={c.name} onChangeText={(t) => set({ name: t })} placeholder={t('fv.certPh')} placeholderTextColor={COLORS.textLight} />
      <Label>{t('fv.number')}</Label>
      <TextInput style={styles.input} value={c.number ?? ''} onChangeText={(t) => set({ number: t })} placeholder="—" placeholderTextColor={COLORS.textLight} />
      <Label>{t('fv.issuedBy')}</Label>
      <TextInput style={styles.input} value={c.issuer ?? ''} onChangeText={(t) => set({ issuer: t })} placeholder={t('fv.issuerPh')} placeholderTextColor={COLORS.textLight} />
      <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
        <View style={{ flex: 1 }}><SimpleDatePicker label={t('fv.issued')} value={c.issueDate} onChange={(d) => set({ issueDate: d })} /></View>
        <View style={{ flex: 1 }}><SimpleDatePicker label={t('fv.expires')} value={c.expiryDate} onChange={(d) => set({ expiryDate: d })} onClear={() => set({ expiryDate: undefined })} /></View>
      </View>
      <TouchableOpacity style={styles.fileBtn} onPress={() => void attach()}>
        <MciIcon name="paperclip" size={18} color={COLORS.primary} />
        <Text style={styles.link} numberOfLines={1}>{c.fileName ? `${c.fileName} — ${t('fv.replace')}` : t('fv.attachCert')}</Text>
      </TouchableOpacity>
      {!isNew ? (
        <TouchableOpacity
          style={styles.delete}
          onPress={() => Alert.alert(t('fv.removeCert'), t('fv.removeCertBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.remove'), style: 'destructive', onPress: () => void save(true) }])}
        >
          <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{t('fv.removeCert')}</Text>
        </TouchableOpacity>
      ) : null}
    </Sheet>
  );
}

// ---- document editor -------------------------------------------------------------

function DocEditor({ imo, start, isNew, onClose, onSaved }: { imo: string; start: IsmDoc; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [d, setD] = useState<IsmDoc>(start);
  const [bump, setBump] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<IsmDoc>) => setD((x) => ({ ...x, ...p }));
  const revision = bump ? start.revision + 1 : d.revision;

  const attach = async () => {
    const f = await pickDocument();
    if (!f) return;
    setBusy(true);
    try {
      const dataUri = await toDataUri(f.uri, f.name ?? 'document.pdf');
      const url = await shore.uploadFile(imo, d.id, `doc_${d.id}_r${revision}`, dataUri);
      // The words inside, so the crew can search the document by them.
      const text = await pdfText(dataUri).catch(() => null);
      set({ fileUri: url, fileName: f.name ?? 'document.pdf', filePending: false, ...(text ? { text } : {}) });
    } catch (e: any) {
      Alert.alert(t('fv.notUploaded'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async (withdraw = false) => {
    if (!withdraw && !d.title.trim()) return Alert.alert(t('risk.titleReq'), t('fv.nameDoc'));
    if (!withdraw && !d.body?.trim() && !d.fileUri) return Alert.alert(t('fv.nothingRead'), t('fv.attachOrWrite'));
    setBusy(true);
    try {
      await shore.saveDoc(imo, {
        ...d,
        title: d.title.trim(),
        revision,
        issued: bump ? todayIso() : d.issued,
        ...(withdraw ? { deleted: true } : {}),
        updatedAt: Date.now(),
      });
      onSaved();
    } catch (e: any) {
      Alert.alert(t('fv.notSaved'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={isNew ? t('fv.newDoc') : bump ? t('fv.issueRev', { n: revision }) : t('pax.document')} onClose={onClose} onSave={() => void save()} busy={busy} saveLabel={bump ? t('fv.issue') : t('common.save')}>
      <Label>{t('fv.titleReq')}</Label>
      <TextInput style={styles.input} value={d.title} onChangeText={(t) => set({ title: t })} placeholder={t('fv.docPh')} placeholderTextColor={COLORS.textLight} />
      <Label>{t('docs.no')}</Label>
      <TextInput style={styles.input} value={d.docNo ?? ''} onChangeText={(t) => set({ docNo: t })} placeholder="SMS-07-03" placeholderTextColor={COLORS.textLight} />
      <Label>{t('fv.type')}</Label>
      <View style={styles.chips}>
        {(Object.keys(DOC_CATEGORY_LABEL) as DocCategory[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.chip, d.category === k && styles.chipOn]} onPress={() => set({ category: k })}>
            <Text style={[styles.chipText, d.category === k && styles.chipTextOn]}>{DOC_CATEGORY_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ marginTop: SIZES.sm }}>
        <SimpleDatePicker label={t('docs.reviewDueCap')} value={d.reviewDue} onChange={(x) => set({ reviewDue: x })} onClear={() => set({ reviewDue: undefined })} />
      </View>
      <TouchableOpacity style={styles.fileBtn} onPress={() => void attach()}>
        <MciIcon name="paperclip" size={18} color={COLORS.primary} />
        <Text style={styles.link} numberOfLines={1}>{d.fileName ? `${d.fileName} — ${t('fv.replace')}` : t('fv.attachFile')}</Text>
      </TouchableOpacity>
      <Label>{t('fv.text')}</Label>
      <TextInput style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]} value={d.body ?? ''} onChangeText={(t) => set({ body: t })} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SIZES.md }}>
        <Text style={[styles.title, { flex: 1 }]}>{t('docs.mustRead')}</Text>
        <Switch value={d.mustRead !== false} onValueChange={(x) => set({ mustRead: x })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
      </View>
      {!isNew ? (
        <>
          <TouchableOpacity style={styles.outline} onPress={() => setBump((b) => !b)}>
            <Text style={styles.link}>{bump ? t('fv.keepRev', { n: start.revision }) : t('fv.newRev', { n: start.revision + 1 })}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.delete}
            onPress={() => Alert.alert(t('fv.withdraw'), t('fv.withdrawBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('fv.withdrawBtn'), style: 'destructive', onPress: () => void save(true) }])}
          >
            <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{t('fv.withdraw')}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </Sheet>
  );
}

/** "until 1 Dec 2026 or 12 500 h" — what a deferral moves the job to. */
function deferUntil(d: PmsDeferral): string {
  return [d.untilDate ? uiDate(d.untilDate) : null, d.untilHours != null ? `${d.untilHours} h` : null].filter(Boolean).join(t('od.or'));
}

/** The superintendent's answer on one closure: verify, or (a defect) return it to the vessel with the reason; on a deferral, approve or refuse. */
function OfficeCheckSheet({ imo, check, onClose, onSaved }: { imo: string; check: { defect?: PmsDefect; nc?: NonConformity; deferral?: PmsDeferral }; onClose: () => void; onSaved: () => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const d = check.defect;
  const nc = check.nc;
  const df = check.deferral;

  useEffect(() => {
    if (!d?.closed?.photos?.length) return;
    const owner = `${d.id}-closed`;
    void Promise.all(d.closed.photos.map((p: Attachment) => shore.photoUrl(imo, owner, p.id))).then((l) => setUrls(l.filter((u): u is string => !!u)));
  }, [d, imo]);

  const answer = async (back: boolean) => {
    if (back && note.trim().length < 3) return Alert.alert(df ? t('od.refuse') : t('oc.return'), df ? t('od.needReason') : t('oc.needReason'));
    setBusy(true);
    try {
      const me = { name: (await shore.myName()) || t('fv.supt'), rank: t('oc.office') };
      const now = Date.now();
      if (df) await shore.saveOfficeCheck(imo, 'pms_deferrals', back ? refuseDeferral(df, me, note, now) : approveDeferral(df, me, note, now));
      else if (d) await shore.saveOfficeCheck(imo, 'pms_defects', back ? giveBack(d, me, note, now) : verify(d, me, note, now));
      else if (nc) await shore.saveOfficeCheck(imo, 'ncs', verifyNc(nc, me, note, now));
      onSaved();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
  return (
    <Sheet title={df ? t('od.title') : d ? t('pd.defect') : nc!.no} onClose={onClose} onSave={() => void answer(false)} busy={busy} saveLabel={df ? t('od.approve') : t('oc.verify')}>
      {df ? (
        <>
          <Text style={styles.title}>{`${df.machineName} — ${df.jobTitle}`}</Text>
          <Text style={styles.sub}>{t('od.until', { until: deferUntil(df) })}</Text>
          <Label>{t('pj.reason')}</Label>
          <Text style={styles.title}>{df.reason}</Text>
          <Text style={styles.sub}>{`${uiDate(new Date(df.at).toISOString().slice(0, 10))} · ${who(df.by, df.byRank)}`}</Text>
          {/* The risk assessment the Master deferred on (plan item 39), as it was approved. */}
          <Label>{t('od.ra')}</Label>
          {df.ra ? (
            <>
              <Text style={styles.title}>{`${df.ra.no ? `${df.ra.no} · ` : ''}${df.ra.title}`}</Text>
              {df.ra.worst ? <Text style={[styles.sub, { color: RISK_COLOR[df.ra.worst], fontWeight: '800' }]}>{t('risk.residual', { level: tk(`risk.lvl.${df.ra.worst}`) })}</Text> : null}
              {df.ra.hazards.map((h, i) => (
                <Text key={i} style={styles.sub}>{`• ${h.hazard} — ${tk(`risk.lvl.${h.level}`)}${h.controls ? `\n   ${h.controls}` : ''}`}</Text>
              ))}
              <Text style={styles.sub}>{t('od.raApproved', { who: df.ra.approvedBy, when: uiDate(new Date(df.ra.approvedAt).toISOString().slice(0, 10)) })}</Text>
            </>
          ) : (
            <Text style={styles.sub}>{t('od.noRa')}</Text>
          )}
        </>
      ) : d ? (
        <>
          <Text style={styles.title}>{`${d.machineName} — ${tk(`pms.defcat.${d.category}`)}`}</Text>
          <Text style={styles.sub}>{`${d.description}\n${uiDate(d.date)} · ${who(d.by, d.byRank)}${d.responsible ? ` · ${t('oc.responsible')}: ${d.responsible}` : ''}`}</Text>
          <Label>{t('pd.rectified')}</Label>
          <Text style={styles.title}>{d.closed!.note}</Text>
          <Text style={styles.sub}>{`${uiDate(d.closed!.date)} · ${who(d.closed!.by, d.closed!.byRank)}`}</Text>
          {urls.length ? (
            <View style={styles.chips}>{urls.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 150, height: 110, borderRadius: SIZES.radiusMd }} />)}</View>
          ) : d.closed!.photos?.length ? <Text style={styles.sub}>{t('oc.photosPending', { n: d.closed!.photos.length })}</Text> : <Text style={styles.sub}>{t('oc.noPhoto')}</Text>}
          {d.closedBefore?.length ? (
            <>
              <Label>{t('oc.history')}</Label>
              {d.closedBefore.map((c) => <Text key={c.at} style={styles.sub}>{`${uiDate(c.date)} · ${who(c.by, c.byRank)}: ${c.note}`}</Text>)}
            </>
          ) : null}
        </>
      ) : nc ? (
        <>
          <Text style={styles.title}>{nc.title}</Text>
          <Text style={styles.sub}>{nc.what}</Text>
          {nc.actions.map((a) => <Text key={a.id} style={styles.sub}>{`• ${a.text}`}</Text>)}
          <Label>{t('pd.rectified')}</Label>
          <Text style={styles.title}>{nc.effectiveness ?? ''}</Text>
          <Text style={styles.sub}>{who(nc.closedBy, nc.closedByRank)}</Text>
        </>
      ) : null}
      <Label>{t('oc.note')}</Label>
      <TextInput style={[styles.input, { minHeight: 60 }]} value={note} onChangeText={setNote} multiline placeholder={df ? t('od.notePh') : d ? t('oc.notePh') : t('oc.noteNcPh')} placeholderTextColor={COLORS.textLight} />
      {d || df ? (
        <TouchableOpacity style={styles.delete} disabled={busy} onPress={() => void answer(true)}>
          <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{df ? t('od.refuse') : t('oc.return')}</Text>
        </TouchableOpacity>
      ) : null}
    </Sheet>
  );
}

/**
 * The office's decision on one requisition (services/poApproval): opening it marks it
 * "under review" for the vessel; then approve — reducing or striking lines, each with
 * its reason — return it for rework, or reject it; once approved, mark it placed if the
 * office ordered it itself. An emergency already sent is approved or rejected afterwards.
 */
function PoSheet({ imo, order, onClose, onSaved }: { imo: string; order: PurchaseOrder; onClose: () => void; onSaved: () => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [o, setO] = useState(order);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState<Record<string, { to: string; note: string }>>({});
  const [busy, setBusy] = useState(false);
  const stage = poStage(o);
  const late = emergencyOpen(o);
  const deciding = late || stage === 'office' || stage === 'review';
  const cutting = deciding && !late;

  const me = async () => ({ name: (await shore.myName()) || t('fv.supt'), rank: t('oc.office') });

  // Opened: the vessel sees "Under review" from now on.
  useEffect(() => {
    if (poStage(order) !== 'office') return;
    void (async () => {
      try {
        const next = markReview(order, await me(), Date.now());
        await shore.saveOfficeCheck(imo, 'purchase_orders', next);
        setO(next);
      } catch {
        /* the decision itself will say if writing fails */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, imo]);

  const run = async (make: (who: { name: string; rank: string }) => PurchaseOrder) => {
    setBusy(true);
    try {
      await shore.saveOfficeCheck(imo, 'purchase_orders', make(await me()));
      onSaved();
    } catch (e: any) {
      Alert.alert(t('poa.title'), e?.message === 'A reason is required' || e?.message === 'A reason is required for each line changed' ? t('poa.needReason') : e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };
  const approve = () =>
    void run((who) => {
      const changes: Record<string, { to: number; note: string }> = {};
      for (const [id, c] of Object.entries(qty)) {
        const n = Number(c.to.replace(',', '.'));
        if (c.to.trim() !== '' && Number.isFinite(n)) changes[id] = { to: n, note: c.note };
      }
      return officeApprove(o, who, Date.now(), note, changes);
    });
  const needNote = (fn: () => void) => (note.trim().length < 3 ? Alert.alert(t('poa.title'), t('poa.needReason')) : fn());
  const total = o.lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.qty, 0);
  const cur = o.lines.find((l) => l.currency)?.currency ?? '€';

  return (
    <Sheet
      title={o.no}
      onClose={onClose}
      onSave={deciding ? approve : stage === 'approved' ? () => void run((who) => officeOrdered(o, who, Date.now(), todayIso(), note)) : onClose}
      busy={busy}
      saveLabel={deciding ? t('poa.approve') : stage === 'approved' ? t('poa.ordered') : t('common.close')}
    >
      <Text style={styles.title}>{[tk(`od.${o.dept}`), o.urgency ? tk(`po.urg.${o.urgency}`) : null, o.deliveryPort, o.deliveryDate ? uiDate(o.deliveryDate) : null].filter(Boolean).join(' · ')}</Text>
      <Text style={styles.sub}>{[o.byRank ? `${o.by} (${o.byRank})` : o.by, uiDate(o.date), o.supplier].filter(Boolean).join(' · ')}</Text>
      {o.notes ? <Text style={styles.sub}>{o.notes}</Text> : null}
      {late ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('poa.emergencyOffice', { why: o.approval?.find((x) => x.kind === 'emergency')?.note ?? '' })}</Text> : null}

      <Label>{t('poa.linesN', { n: o.lines.length })}</Label>
      {o.lines.map((l) => {
        const c = qty[l.id];
        const changed = c && c.to.trim() !== '' && Number(c.to.replace(',', '.')) !== l.qty;
        return (
          <View key={l.id} style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={[styles.title, l.qty === 0 && { textDecorationLine: 'line-through', color: COLORS.textLight }]}>{l.description}</Text>
            <Text style={styles.sub}>{[`${l.qty} ${l.unit}`, l.partNo, l.impa ? `IMPA ${l.impa}` : null, l.maker, l.unitPrice != null ? `${l.currency ?? '€'} ${l.unitPrice}` : null, l.stockQty != null ? t('poa.stock', { n: l.stockQty }) : null].filter(Boolean).join(' · ')}</Text>
            {l.notes ? <Text style={styles.sub}>{l.notes}</Text> : null}
            {l.cut ? <Text style={[styles.sub, { color: COLORS.warning }]}>{`${t('poa.asked', { n: l.cut.asked })} — ${l.cut.note}`}</Text> : null}
            {cutting ? (
              <View style={{ flexDirection: 'row', gap: SIZES.xs, alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { width: 70 }]}
                  value={c?.to ?? ''}
                  onChangeText={(x) => setQty((q) => ({ ...q, [l.id]: { to: x, note: q[l.id]?.note ?? '' } }))}
                  keyboardType="numeric"
                  placeholder={String(l.qty)}
                  placeholderTextColor={COLORS.textLight}
                />
                <TouchableOpacity style={[styles.chip, c?.to === '0' && styles.chipOn]} onPress={() => setQty((q) => ({ ...q, [l.id]: { to: q[l.id]?.to === '0' ? '' : '0', note: q[l.id]?.note ?? '' } }))}>
                  <Text style={[styles.chipText, c?.to === '0' && styles.chipTextOn]}>{t('poa.strike')}</Text>
                </TouchableOpacity>
                {changed ? (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={c?.note ?? ''}
                    onChangeText={(x) => setQty((q) => ({ ...q, [l.id]: { to: q[l.id]?.to ?? '', note: x } }))}
                    placeholder={t('poa.lineWhy')}
                    placeholderTextColor={COLORS.textLight}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {total > 0 ? <Text style={styles.sub}>{t('poa.total', { sum: `${cur} ${total.toFixed(2)}` })}</Text> : null}

      <Label>{t('poa.title')}</Label>
      <PoProgress o={o} />

      {deciding || stage === 'approved' ? (
        <>
          <Label>{t('oc.note')}</Label>
          <TextInput style={[styles.input, { minHeight: 60 }]} value={note} onChangeText={setNote} multiline placeholder={stage === 'approved' ? t('poa.orderedPh') : t('poa.officeNotePh')} placeholderTextColor={COLORS.textLight} />
        </>
      ) : null}
      {deciding && !late ? (
        <TouchableOpacity style={styles.outline} disabled={busy} onPress={() => needNote(() => void run((who) => officeReturn(o, who, note, Date.now())))}>
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('poa.officeReturn')}</Text>
        </TouchableOpacity>
      ) : null}
      {deciding ? (
        <TouchableOpacity style={styles.delete} disabled={busy} onPress={() => needNote(() => void run((who) => officeReject(o, who, note, Date.now())))}>
          <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{t('poa.reject')}</Text>
        </TouchableOpacity>
      ) : null}
    </Sheet>
  );
}

function Sheet({ title, children, onClose, onSave, busy, saveLabel = t('common.save') }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void; busy: boolean; saveLabel?: string }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={[styles.link, { color: COLORS.textLight }]}>{t('common.cancel')}</Text></TouchableOpacity>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onSave} disabled={busy} hitSlop={8}><Text style={[styles.link, busy && { opacity: 0.5 }]}>{busy ? '…' : saveLabel}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: SIZES.lg }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: SIZES.xs, marginBottom: SIZES.md, flexWrap: 'wrap' },
    tab: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    tabOn: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    tabTextOn: { color: COLORS.textWhite },
    addRow: { alignSelf: 'flex-end', marginBottom: SIZES.sm },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    count: { fontSize: SIZES.body, fontWeight: '800' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4, marginBottom: SIZES.xs },
    fileBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.md },
    outline: { marginTop: SIZES.lg, padding: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
    delete: { marginTop: SIZES.md, padding: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md },
    sheet: { backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusLg, padding: SIZES.lg, width: '100%', maxWidth: 560, maxHeight: '92%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.md },
    sheetTitle: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
  });
