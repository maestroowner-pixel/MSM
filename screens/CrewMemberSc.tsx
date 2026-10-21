// ===================================
// One crew member — who they are, whether they are aboard, how to reach their
// family, and their certificates (9 Oct 2026: "the crew list must be kept by the
// Master or the Chief Officer, tied to the crew certificate matrix, and hold
// next of kin").
//
// Three parts, and who sees them:
//   Name, rank, aboard / signed off   everyone (it is the signature list)
//   Personal details, next of kin     Officers and the Master — stored apart,
//                                     in `crew_private` (types/crew.ts)
//   Certificates                      everyone; added and edited by Officers
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label, StatusPill } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CrewMember, CrewPrivate, NextOfKin } from '../types/crew';
import { isCountryCode } from '../constants/countries';
import { crewIssues, issueSummary } from '../services/crewIssues';
import { useSdmImport } from '../components/useSdmImport';
import { Certificate } from '../types/certificate';
import { roleAtLeast } from '../types/role';
import { formatDate, statusFromDate } from '../utils/dates';
import { todayIso } from '../services/pms';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { loadCrewPhotos, setCrewPhoto } from '../services/crewPhotos';
import { cardPortraitDataUri } from '../services/images';
import { PhotoCamera } from '../components/PhotoCamera';
import { PhotoEditor } from '../components/PhotoEditor';
import { canEditPhotos } from '../utils/photoEdit';
import { PickedFile, pickFromLibrary } from '../services/attachments';
import { t, useT } from '../utils/i18n';

export default function CrewMemberSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, crewPrivate, certificates, saveCrewMember, saveCrewPrivate } = useData();
  const sync = useSync();

  // Officers and the Master; a device not joined to any vessel is its owner's.
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const id: string = route.params?.id;
  const existing = crew.find((c) => c.id === id);
  const isNew = !existing;
  const now = Date.now();
  const [m, setM] = useState<CrewMember>(existing ?? { id, name: '', active: true, onBoard: true, signOn: todayIso(), addedAt: now, updatedAt: now });
  const priv0 = crewPrivate.find((p) => p.id === id);
  const [p, setP] = useState<CrewPrivate>(priv0 ?? { id, updatedAt: now });
  const touched = useRef(false);
  // The ID card photo — on this device only (services/crewPhotos).
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    void loadCrewPhotos().then((all) => setPhoto(all[id] ?? null));
  }, [id]);
  const [camOpen, setCamOpen] = useState(false);
  // In the browser the picture opens in the editor first (light, background); a phone keeps it as taken.
  const [editing, setEditing] = useState<string | null>(null);
  const keepPhoto = async (uri: string) => {
    await setCrewPhoto(id, uri);
    setPhoto(uri);
  };
  const usePicture = async (src: string) => {
    const uri = await cardPortraitDataUri(src);
    if (!uri) return Alert.alert(t('sr.photo'), t('crew.photoBad'));
    if (canEditPhotos()) setEditing(uri);
    else await keepPhoto(uri);
  };
  const takePhoto = (picker: () => Promise<PickedFile | null>) => async () => {
    const f = await picker();
    if (f) await usePicture(f.uri);
  };
  useEffect(() => {
    if (existing && !touched.current) setM(existing);
  }, [existing]);
  useEffect(() => {
    if (priv0 && !touched.current) setP(priv0);
  }, [priv0]);
  const setMember = (x: Partial<CrewMember>) => {
    touched.current = true;
    setM((v) => ({ ...v, ...x }));
  };
  const setPriv = (x: Partial<CrewPrivate>) => {
    touched.current = true;
    setP((v) => ({ ...v, ...x }));
  };
  const setKin = (x: Partial<NextOfKin>) => setPriv({ nextOfKin: { ...(p.nextOfKin ?? {}), ...x } });

  const importSdm = useSdmImport();
  const issues = useMemo(() => (existing ? crewIssues(existing, priv0, certificates, canEdit) : []), [existing, priv0, certificates, canEdit]);

  const mine = useMemo(
    () => certificates.filter((c) => c.scope === 'crew' && c.crewId === id).sort((a, b) => (a.expiryDate ?? '9').localeCompare(b.expiryDate ?? '9')),
    [certificates, id]
  );

  const save = async () => {
    if (!m.name.trim()) return Alert.alert(t('crew.nameReq'), t('crew.nameBody'));
    await saveCrewMember({ ...m, name: m.name.trim(), rank: m.rank?.trim() || undefined, cabin: m.cabin?.trim() || undefined });
    // Only what was filled in; Firestore refuses undefined.
    const clean = JSON.parse(JSON.stringify({ ...p, updatedAt: Date.now() }));
    if (canEdit && Object.keys(clean).length > 2) await saveCrewPrivate(clean);
    playSuccessSound();
    goBackOr(nav);
  };

  const toggleAboard = (on: boolean) =>
    setMember(on ? { onBoard: true, signOn: todayIso(), signOff: undefined } : { onBoard: false, signOff: todayIso() });

  const addCert = () => {
    const c: Certificate = { id: uid('cert'), scope: 'crew', crewId: id, holderName: m.name, name: '', itemIds: [], createdAt: Date.now(), updatedAt: Date.now() };
    nav.navigate('CertificateDetail', { id: null, draft: c });
  };

  const F = ({ label, value, onChange, placeholder, kb }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; kb?: any }) => (
    <View style={{ flex: 1, marginTop: SIZES.sm }}>
      <Label>{label}</Label>
      <TextInput
        style={styles.input}
        value={value ?? ''}
        onChangeText={onChange}
        editable={canEdit}
        placeholder={placeholder ?? '—'}
        placeholderTextColor={COLORS.textLight}
        keyboardType={kb}
      />
    </View>
  );

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav)} />
          <Text style={styles.headerTitle} numberOfLines={1}>{isNew ? t('crew.new') : m.name || t('crew.member')}</Text>
          {canEdit ? (
            <TouchableOpacity onPress={() => void save()} hitSlop={12}>
              <Text style={styles.save}>{t('common.save')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          {issues.length ? (
            <View style={[styles.warn, { borderColor: issues[0].level === 'expired' ? COLORS.danger : COLORS.warning }]}>
              <Text style={[styles.title, { color: issues[0].level === 'expired' ? COLORS.danger : COLORS.warning }]}>{`⚠ ${issueSummary(issues)}`}</Text>
              {issues.filter((i) => i.level !== 'missing').map((i) => (
                <Text key={i.text} style={styles.sub}>{`• ${i.text}`}</Text>
              ))}
              {issues.some((i) => i.level === 'missing') ? (
                <Text style={styles.sub}>{`• Not filled in: ${issues.filter((i) => i.level === 'missing').map((i) => i.text).join(', ')}`}</Text>
              ) : null}
            </View>
          ) : null}
          <PhotoEditor src={editing} onClose={() => setEditing(null)} onDone={(u) => { setEditing(null); void keepPhoto(u); }} />
          <PhotoCamera visible={camOpen} title={`${t('sr.photo')} — ${m.name || t('crew.memberL')}`} onClose={() => setCamOpen(false)} onTaken={(u) => { setCamOpen(false); void usePicture(u); }} />
          {/* The photo printed on the crew ID card (Security → ID cards). Kept on this device, never sent. */}
          <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: SIZES.md }]}>
            {photo ? <Image source={{ uri: photo }} style={{ width: 84, height: 106, borderRadius: 6 }} /> : <View style={{ width: 84, height: 106, borderRadius: 6, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.sub}>{t('crew.noPhoto')}</Text></View>}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{t('sr.photo')}</Text>
              <Text style={styles.sub}>{t('crew.photoHint')}</Text>
              {canEdit ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.md, marginTop: 4 }}>
                  <TouchableOpacity onPress={() => setCamOpen(true)} hitSlop={8}><Text style={styles.link}>{t('crew.take')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => void takePhoto(pickFromLibrary)()} hitSlop={8}><Text style={styles.link}>{t('crew.choose')}</Text></TouchableOpacity>
                  {photo && canEditPhotos() ? <TouchableOpacity onPress={() => setEditing(photo)} hitSlop={8}><Text style={styles.link}>{t('crew.adjust')}</Text></TouchableOpacity> : null}
                  {photo ? <TouchableOpacity onPress={() => void setCrewPhoto(id, null).then(() => setPhoto(null))} hitSlop={8}><Text style={[styles.link, { color: COLORS.danger }]}>{t('common.remove')}</Text></TouchableOpacity> : null}
                </View>
              ) : null}
            </View>
          </View>
          {canEdit && !isNew ? (
            <TouchableOpacity
              onPress={() =>
                void importSdm(id, (plan) => {
                  // The form shows what was imported — and a later Save keeps it,
                  // instead of writing back what the form held before.
                  touched.current = false;
                  setM(plan.member);
                  setP(JSON.parse(JSON.stringify(plan.priv)));
                })
              } style={{ alignSelf: 'flex-end', marginBottom: SIZES.sm }} hitSlop={8}>
              <Text style={styles.link}>{t('crew.sdm')}</Text>
            </TouchableOpacity>
          ) : null}
          {F({ label: t('crew.fullName'), value: m.name, onChange: (v) => setMember({ name: v }), placeholder: t('crew.asPassport') })}
          {F({ label: t('crew.rank'), value: m.rank, onChange: (v) => setMember({ rank: v }), placeholder: t('crew.rankPh') })}
          {F({ label: t('pax.cabin'), value: m.cabin, onChange: (v) => setMember({ cabin: v }), placeholder: t('crew.cabinPh') })}

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{m.onBoard === false ? t('cm.signedOff') : t('pax.onBoard')}</Text>
                <Text style={styles.sub}>{t('crew.onBoardHint')}</Text>
              </View>
              <Switch value={m.onBoard !== false} disabled={!canEdit} onValueChange={toggleAboard} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
            </View>
            <View style={styles.pair}>
              <View style={{ flex: 1 }}>
                <SimpleDatePicker label={t('crew.signedOn')} value={m.signOn} onChange={(d) => setMember({ signOn: d })} disabled={!canEdit} />
              </View>
              <View style={{ flex: 1 }}>
                <SimpleDatePicker label={t('cm.signedOff')} value={m.signOff} onChange={(d) => setMember({ signOff: d })} onClear={() => setMember({ signOff: undefined })} disabled={!canEdit} />
              </View>
            </View>
            {F({ label: t('crew.portEmb'), value: m.signOnPort, onChange: (v) => setMember({ signOnPort: v }), placeholder: 'Palma de Mallorca' })}
          </View>

          {canEdit ? (
            <>
              <Text style={styles.section}>{t('crew.personal')}</Text>
              <Text style={styles.sub}>{t('crew.personalHint')}</Text>
              <View style={styles.pair}>
                <View style={{ flex: 1 }}><SimpleDatePicker label={t('pax.dob')} value={p.dateOfBirth} onChange={(d) => setPriv({ dateOfBirth: d })} defaultYear={1990} /></View>
                {F({ label: t('crew.pob'), value: p.placeOfBirth, onChange: (v) => setPriv({ placeOfBirth: v }), placeholder: t('crew.pobPh') })}
              </View>
              {F({ label: t('crew.nat'), value: p.nationality, onChange: (v) => setPriv({ nationality: v.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() }), placeholder: 'GB' })}
              {p.nationality && !isCountryCode(p.nationality) ? (
                <Text style={[styles.sub, { color: COLORS.danger }]}>{`“${p.nationality}” is not an ISO country code.`}</Text>
              ) : null}
              <View style={styles.pair}>
                {F({ label: t('crew.passportNo'), value: p.passportNo, onChange: (v) => setPriv({ passportNo: v }) })}
                <View style={{ flex: 1 }}>
                  <SimpleDatePicker label={t('crew.passportExp')} value={p.passportExpiry} onChange={(d) => setPriv({ passportExpiry: d })} onClear={() => setPriv({ passportExpiry: undefined })} />
                </View>
              </View>
              {p.passportExpiry && statusFromDate(p.passportExpiry) !== 'ok' ? (
                <Text style={[styles.sub, { color: statusFromDate(p.passportExpiry) === 'expired' ? COLORS.danger : COLORS.warning, fontWeight: '700' }]}>
                  {statusFromDate(p.passportExpiry) === 'expired' ? t('crew.passportExpired') : t('crew.passportSoon')}
                </Text>
              ) : null}
              {F({ label: t('crew.seamansBook'), value: p.seamansBookNo, onChange: (v) => setPriv({ seamansBookNo: v }) })}
              <View style={styles.pair}>
                {F({ label: t('pax.phone'), value: p.phone, onChange: (v) => setPriv({ phone: v }), kb: 'phone-pad' })}
                {F({ label: t('crew.email'), value: p.email, onChange: (v) => setPriv({ email: v }), kb: 'email-address' })}
              </View>
              {F({ label: t('crew.home'), value: p.homeAddress, onChange: (v) => setPriv({ homeAddress: v }) })}

              <Text style={styles.section}>{t('crew.nok')}</Text>
              <View style={styles.pair}>
                {F({ label: t('crew.familyName'), value: p.nextOfKin?.lastName ?? (p.nextOfKin?.firstName ? '' : p.nextOfKin?.name), onChange: (v) => setKin({ lastName: v }) })}
                {F({ label: t('crew.givenNames'), value: p.nextOfKin?.firstName, onChange: (v) => setKin({ firstName: v }) })}
              </View>
              <View style={styles.pair}>
                {F({ label: t('crew.relationship'), value: p.nextOfKin?.relationship, onChange: (v) => setKin({ relationship: v }), placeholder: t('crew.relPh') })}
                {F({ label: t('crew.phoneReq'), value: p.nextOfKin?.phone, onChange: (v) => setKin({ phone: v }), kb: 'phone-pad' })}
              </View>
              {F({ label: t('crew.homeReq'), value: p.nextOfKin?.address, onChange: (v) => setKin({ address: v }) })}
              {F({ label: t('crew.emailOpt'), value: p.nextOfKin?.email, onChange: (v) => setKin({ email: v }), kb: 'email-address' })}
            </>
          ) : null}

          <View style={styles.certHead}>
            <Text style={styles.section}>{t('crew.certsN', { n: mine.length })}</Text>
            {canEdit && !isNew ? (
              <TouchableOpacity onPress={addCert} hitSlop={8}>
                <Text style={styles.link}>{t('crew.addCert')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {isNew ? <Text style={styles.sub}>{t('crew.saveFirst')}</Text> : null}
          {mine.map((c) => (
            <TouchableOpacity key={c.id} style={styles.certRow} onPress={() => nav.navigate('CertificateDetail', { id: c.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.sub}>{[c.number, c.expiryDate ? t('crew.expires', { date: formatDate(c.expiryDate) }) : t('cm.noExpiry')].filter(Boolean).join(' · ')}</Text>
              </View>
              <StatusPill status={statusFromDate(c.expiryDate)} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    pair: { flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-end' },
    card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginTop: SIZES.lg },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    section: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.xl },
    certHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    warn: { borderWidth: 1, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    certRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginTop: SIZES.sm },
  });
