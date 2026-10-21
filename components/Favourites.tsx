// ===================================
// Favourites on screen (utils/favourites.ts): the ★ in the top bar with its
// drop-down — add the page you are on, open a kept one, rename, reorder,
// remove — the small ☆ beside Back on a record, the ☆ beside a page's title on
// a phone, and the list at the top of the menu on a phone.
// ===================================

import React, { useContext, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NavigationRouteContext, useRoute } from '@react-navigation/native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { categoryLabel } from '../services/inspections';
import { storeRooms } from '../types/stores';
import { templatesNow } from '../services/dp';
import { CheckBook } from '../types/dp';
import { MENU_LABEL } from '../utils/navOrder';
import {
  Favourite,
  Place,
  addFavourite,
  cleanParams,
  currentPlace,
  describe,
  findFavourite,
  moveFavourite,
  navRef,
  openFavourite,
  removeFavourite,
  renameFavourite,
  useFavourites,
} from '../utils/favourites';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BOOKS: CheckBook[] = ['dp', 'bridge', 'engine', 'fam-safety', 'fam-bridge', 'fam-engine', 'fam-project', 'fam-pax', 'fam-dp'];

/** Names a place from what the app holds: a document's title, a category's label … */
function useNamer(icons?: Record<string, string>) {
  const data = useData() as any;
  return useMemo(() => {
    const ctx = {
      ...data,
      categoryLabel: (k: string) => categoryLabel(k as any),
      dpTemplateTitle: (id: string) => BOOKS.flatMap((b) => templatesNow(data.dpTemplates ?? [], b)).find((t) => t.id === id)?.title,
    };
    const rooms = storeRooms(data.storeRoomList ?? []).map((r) => ({ view: r.id, label: r.name }));
    return (p: Place) => describe(p, ctx, icons ?? {}, rooms);
  }, [data, icons]);
}

/** The ★ in the top bar, and its drop-down. */
export function FavStar({ icons, color }: { icons?: Record<string, string>; color?: string }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const favs = useFavourites();
  const name = useNamer(icons);
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState<Place | null>(null);
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const kept = findFavourite(favs, here);

  const show = () => {
    setHere(currentPlace());
    setEditing(false);
    setRenaming(null);
    setOpen(true);
  };
  const go = (f: Favourite) => {
    setOpen(false);
    openFavourite(f);
  };
  const add = () => {
    if (!here) return;
    const d = name(here);
    addFavourite(here, d.label, d.icon);
  };

  return (
    <>
      <Pressable onPress={show} hitSlop={10} style={({ hovered }: any) => [styles.starBtn, hovered && { backgroundColor: COLORS.primary + '14' }]} accessibilityRole="button" accessibilityLabel="Favourites">
        <MciIcon name={favs.length ? 'star' : 'star-outline'} size={22} color={color ?? COLORS.tabActive} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setOpen(false)} accessibilityLabel="Close favourites" />
        <View style={[styles.panel, Platform.OS !== 'web' && styles.panelPhone]}>
          <View style={styles.head}>
            <MciIcon name="star" size={18} color={COLORS.warning} />
            <Text style={styles.title}>Favourites</Text>
            {favs.length ? (
              <TouchableOpacity onPress={() => (setEditing((e) => !e), setRenaming(null))} hitSlop={8}>
                <Text style={styles.link}>{editing ? 'Done' : 'Edit'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {here ? (
            kept ? (
              <TouchableOpacity style={styles.addRow} onPress={() => removeFavourite(kept.id)}>
                <MciIcon name="star-off-outline" size={18} color={COLORS.textLight} />
                <Text style={[styles.addText, { color: COLORS.textLight }]} numberOfLines={1}>{`Remove this page — ${kept.label}`}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.addRow} onPress={add}>
                <MciIcon name="star-plus-outline" size={18} color={COLORS.primary} />
                <Text style={styles.addText} numberOfLines={1}>{`Add this page — ${name(here).label}`}</Text>
              </TouchableOpacity>
            )
          ) : null}
          <ScrollView style={{ maxHeight: 420 }}>
            {!favs.length ? <Text style={styles.empty}>Nothing kept yet. Open a folder, a document or a record and press “Add this page” — or the ☆ beside Back.</Text> : null}
            {favs.map((f, i) => (
              <View key={f.id} style={[styles.row, kept?.id === f.id && styles.rowOn]}>
                {renaming?.id === f.id ? (
                  <TextInput
                    value={renaming.text}
                    onChangeText={(t) => setRenaming({ id: f.id, text: t })}
                    onSubmitEditing={() => (renameFavourite(f.id, renaming.text), setRenaming(null))}
                    onBlur={() => (renameFavourite(f.id, renaming.text), setRenaming(null))}
                    autoFocus
                    style={styles.input}
                  />
                ) : (
                  <TouchableOpacity style={styles.open} onPress={() => (editing ? undefined : go(f))} disabled={editing} activeOpacity={0.7}>
                    <MciIcon name={f.icon} size={20} color={COLORS.primary} />
                    <Text style={styles.label} numberOfLines={2}>{f.label}</Text>
                  </TouchableOpacity>
                )}
                {editing ? (
                  <View style={styles.tools}>
                    <TouchableOpacity onPress={() => setRenaming({ id: f.id, text: f.label })} hitSlop={6} accessibilityLabel={`Rename ${f.label}`}>
                      <MciIcon name="pencil-outline" size={18} color={COLORS.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveFavourite(f.id, -1)} disabled={i === 0} hitSlop={6} style={i === 0 && { opacity: 0.25 }} accessibilityLabel={`Move ${f.label} up`}>
                      <MciIcon name="arrow-up" size={18} color={COLORS.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveFavourite(f.id, 1)} disabled={i === favs.length - 1} hitSlop={6} style={i === favs.length - 1 && { opacity: 0.25 }} accessibilityLabel={`Move ${f.label} down`}>
                      <MciIcon name="arrow-down" size={18} color={COLORS.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeFavourite(f.id)} hitSlop={6} accessibilityLabel={`Remove ${f.label}`}>
                      <MciIcon name="close" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/**
 * The ☆ beside Back on a record — a document, a certificate, a checklist, an
 * equipment category. Not on a form for something new: there is nothing yet to return to.
 */
export function FavToggle() {
  const COLORS = useTheme();
  const route = useRoute<any>();
  const favs = useFavourites();
  const name = useNamer();
  const params = cleanParams(route.params);
  const root = navRef.isReady() ? navRef.getRootState() : undefined;
  const tab = !!MENU_LABEL[route.name] && root?.routes?.[root.index ?? 0]?.name === 'Main';
  const place: Place = { tab, route: route.name, params };
  const kept = findFavourite(favs, place);
  if (route.params?.isNew || !(params?.id || params?.category || params?.templateId)) return null;
  return (
    <TouchableOpacity
      onPress={() => {
        if (kept) removeFavourite(kept.id);
        else {
          const d = name(place);
          addFavourite(place, d.label, d.icon);
        }
      }}
      hitSlop={10}
      style={{ marginLeft: SIZES.sm, padding: 2 }}
      accessibilityRole="button"
      accessibilityLabel={kept ? 'Remove from favourites' : 'Add to favourites'}
    >
      <MciIcon name={kept ? 'star' : 'star-outline'} size={20} color={kept ? COLORS.warning : COLORS.textLight} />
    </TouchableOpacity>
  );
}

/**
 * The ☆ beside a page's title on a phone — a section or one of its pages
 * (Equipment, Drills → Calendar …). The phone has no top bar with the ★, so
 * without it only a record could be kept. A record keeps its ☆ beside Back.
 */
export function FavPageChip({ style }: { style?: any }) {
  const COLORS = useTheme();
  const route = useContext(NavigationRouteContext) as any;
  const favs = useFavourites();
  const name = useNamer();
  if (Platform.OS === 'web' || !route) return null;
  const params = cleanParams(route.params);
  if (route.params?.isNew || params?.id || params?.category || params?.templateId) return null;
  const root = navRef.isReady() ? navRef.getRootState() : undefined;
  const tab = !!MENU_LABEL[route.name] && root?.routes?.[root.index ?? 0]?.name === 'Main';
  const place: Place = { tab, route: route.name, params };
  const kept = findFavourite(favs, place);
  return (
    <TouchableOpacity
      onPress={() => {
        if (kept) removeFavourite(kept.id);
        else {
          const d = name(place);
          addFavourite(place, d.label, d.icon);
        }
      }}
      hitSlop={10}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={kept ? 'Remove from favourites' : 'Add to favourites'}
    >
      <MciIcon name={kept ? 'star' : 'star-outline'} size={22} color={kept ? COLORS.warning : COLORS.primary} />
    </TouchableOpacity>
  );
}

/** At the top of the menu: what is kept, one tap away (on a phone the menu is the way in). */
export function FavMenuSection({ onPicked, itemStyle, textStyle, headStyle }: { onPicked: () => void; itemStyle: any; textStyle: any; headStyle: any }) {
  const COLORS = useTheme();
  const favs = useFavourites();
  if (!favs.length) return null;
  return (
    <View>
      <Text style={headStyle}>Favourites</Text>
      {favs.map((f) => (
        <TouchableOpacity key={f.id} style={itemStyle} onPress={() => (onPicked(), openFavourite(f))} activeOpacity={0.7}>
          <MciIcon name={f.icon} size={20} color={COLORS.warning} />
          <Text style={textStyle} numberOfLines={1}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    starBtn: { padding: 6, borderRadius: 18 },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
    panel: {
      position: 'absolute', top: 58, right: 12, width: 360, maxWidth: '94%', backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.sm, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, elevation: 14,
      borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderLight,
    },
    panelPhone: { top: 70, left: 12, right: 12, width: undefined },
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    title: { flex: 1, fontWeight: '800', fontSize: SIZES.body, color: COLORS.textDark },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    addRow: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingHorizontal: SIZES.md, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight, marginBottom: SIZES.xs,
    },
    addText: { flex: 1, color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    empty: { color: COLORS.textLight, fontSize: SIZES.small, padding: SIZES.md },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.md },
    rowOn: { backgroundColor: COLORS.primary + '10' },
    open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 10 },
    label: { flex: 1, color: COLORS.textDark, fontWeight: '600' },
    tools: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, paddingLeft: SIZES.sm },
    input: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginVertical: 4, color: COLORS.textDark },
  });
