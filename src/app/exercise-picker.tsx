import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, CheckMark, Chip, Screen, SearchField, TopBar } from '@/components/ui';
import type { MuscleGroup } from '@/db/schema';
import { type CatalogExercise, useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useAppLanguage } from '@/i18n/use-app-language';
import { matchesSearch } from '@/lib/hangul';
import { deliverPickedExercises, openExerciseCreator } from '@/stores/exercise-picker';

const GROUPS: readonly MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];

/** 종목 검색: 초성 검색, 부위 필터, 다중 선택. 행을 누르면 선택(상세로 가지 않음). */
export default function ExercisePickerScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const catalog = useExerciseCatalog(lang);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const filter = useMemo(
    () => (e: CatalogExercise) =>
      (group === null || e.primaryGroups.includes(group)) && matchesSearch(query, e.searchNames),
    [group, query],
  );
  const base = catalog.base.filter(filter);
  const custom = catalog.custom.filter(filter);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const meta = (e: CatalogExercise) =>
    [
      e.primaryGroups[0] ? t(`exercises.group.${e.primaryGroups[0]}`) : null,
      t(`exercises.equipment.${e.equipment}`),
    ]
      .filter(Boolean)
      .join(' · ');

  const confirm = () => {
    deliverPickedExercises(selected);
    router.back();
  };

  const create = () => {
    openExerciseCreator((id) => {
      setSelected((s) => [...s, id]);
    });
  };

  const renderSection = (title: string, list: CatalogExercise[]) =>
    list.length === 0 ? null : (
      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
        {list.map((e, i) => {
          const on = selected.includes(e.id);
          return (
            <Pressable
              key={e.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${e.name}, ${meta(e)}`}
              onPress={() => toggle(e.id)}
              style={[styles.row, i < list.length - 1 && styles.rowLine]}
            >
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {meta(e)}
                </Text>
              </View>
              <CheckMark checked={on} />
            </Pressable>
          );
        })}
      </View>
    );

  return (
    <Screen
      header={<TopBar title={t('exercises.pickerTitle')} leading="close" />}
      footer={
        <Button
          label={
            selected.length
              ? t('exercises.add', { count: selected.length })
              : t('exercises.addNone')
          }
          disabled={selected.length === 0}
          onPress={confirm}
        />
      }
    >
      <View style={styles.top}>
        <SearchField
          label={t('exercises.search')}
          placeholder={t('exercises.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('exercises.filterAll')}
          selected={group === null}
          onPress={() => setGroup(null)}
        />
        {GROUPS.map((g) => (
          <Chip
            key={g}
            label={t(`exercises.group.${g}`)}
            selected={group === g}
            onPress={() => setGroup((cur) => (cur === g ? null : g))}
          />
        ))}
      </ScrollView>

      {renderSection(t('exercises.base'), base)}
      {renderSection(t('exercises.custom'), custom)}
      {base.length === 0 && custom.length === 0 ? (
        <Text style={styles.empty}>{t('exercises.empty')}</Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={create} style={styles.create}>
        <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
        <Text style={styles.createText}>{t('exercises.create')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  top: { marginTop: 4 },
  chipsScroll: { marginHorizontal: -16, flexGrow: 0 },
  chips: { gap: 6, paddingHorizontal: 16 },
  card: {
    paddingTop: 2,
    paddingHorizontal: 18,
    paddingBottom: 4,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  cardTitle: {
    paddingTop: 12,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  body: { flex: 1, gap: 2 },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  empty: {
    paddingHorizontal: 6,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  create: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  createText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
}));
