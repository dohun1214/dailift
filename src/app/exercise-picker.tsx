import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ExerciseSearchRow, NoExerciseCard } from '@/components/exercise/exercise-search';
import { Button, CheckMark, Chip, Screen, TopBar } from '@/components/ui';
import type { MuscleGroup } from '@/db/schema';
import { type CatalogExercise, useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useAppLanguage } from '@/i18n/use-app-language';
import { matchesSearch } from '@/lib/hangul';
import {
  deliverPickedExercises,
  openExerciseCreator,
  pickerIsSingle,
  pickerStartsCardio,
} from '@/stores/exercise-picker';

const GROUPS: readonly MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];

/**
 * 종목 검색: 초성 검색, 부위 필터. 행을 누르면 선택(상세로 가지 않음).
 * 추가할 때는 여러 개, 종목을 바꿀 때는 하나만 고른다.
 */
export default function ExercisePickerScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const catalog = useExerciseCatalog(lang);
  const [query, setQuery] = useState('');
  // '유산소 추가'로 열면 유산소만 보이게 시작한다
  const [group, setGroup] = useState<MuscleGroup | 'cardio' | null>(() =>
    pickerStartsCardio() ? 'cardio' : null,
  );
  const [selected, setSelected] = useState<string[]>([]);
  // 화면이 열릴 때 정해진다
  const [single] = useState(pickerIsSingle);
  const [cardioFirst] = useState(pickerStartsCardio);

  const filter = useMemo(
    () => (e: CatalogExercise) =>
      (group === null ||
        (group === 'cardio' ? e.type === 'cardio' : e.primaryGroups.includes(group))) &&
      matchesSearch(query, e.searchNames),
    [group, query],
  );
  const base = catalog.base.filter(filter);
  const custom = catalog.custom.filter(filter);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : single ? [id] : [...s, id]));

  const meta = (e: CatalogExercise) =>
    [
      e.type === 'cardio'
        ? t('exercises.cardio')
        : e.primaryGroups[0]
          ? t(`exercises.group.${e.primaryGroups[0]}`)
          : null,
      t(`exercises.equipment.${e.equipment}`),
    ]
      .filter(Boolean)
      .join(' · ');

  // 고른 뒤에 지운 종목(직접 만든 종목)은 빼고 넘긴다.
  const picked = selected.filter((id) => {
    const e = catalog.byId.get(id);
    return e !== undefined && !e.deleted;
  });

  const confirm = () => {
    deliverPickedExercises(picked);
    router.back();
  };

  const create = (name: string | null = null) => {
    openExerciseCreator((id) => {
      setSelected((s) => (single ? [id] : [...s, id]));
      // 새로 만든 종목이 목록에 보이도록 검색과 부위 고르기를 푼다.
      setQuery('');
      setGroup(null);
    }, name);
  };
  const searching = query.trim().length > 0;
  const none = base.length === 0 && custom.length === 0;

  // '유산소 추가'로 열었으면 유산소 칩을 앞에 둔다(줄 끝에 있으면 화면 밖이라 골라진 것이 안 보인다).
  const cardioChip = (
    <Chip
      key="cardio"
      label={t('exercises.cardio')}
      selected={group === 'cardio'}
      onPress={() => setGroup((cur) => (cur === 'cardio' ? null : 'cardio'))}
    />
  );

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
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${e.name}, ${meta(e)}`}
              onPress={() => toggle(e.id)}
              onLongPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}
              accessibilityHint={t('exerciseDetail.openHint')}
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
      avoidKeyboard
      dismissKeyboardOnDrag
      header={
        <TopBar
          title={t(
            single
              ? 'exercises.pickerTitleReplace'
              : cardioFirst
                ? 'workout.addCardio'
                : 'exercises.pickerTitle',
          )}
          leading="close"
        />
      }
      footer={
        <Button
          label={
            single
              ? t('exercises.replaceConfirm')
              : picked.length
                ? t('exercises.add', { count: picked.length })
                : t('exercises.addNone')
          }
          disabled={picked.length === 0}
          onPress={confirm}
        />
      }
    >
      <View style={styles.top}>
        <ExerciseSearchRow query={query} onChangeQuery={setQuery} onCreate={() => create()} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('exercises.filterAll')}
          selected={group === null}
          onPress={() => setGroup(null)}
        />
        {cardioFirst ? cardioChip : null}
        {GROUPS.map((g) => (
          <Chip
            key={g}
            label={t(`exercises.group.${g}`)}
            selected={group === g}
            onPress={() => setGroup((cur) => (cur === g ? null : g))}
          />
        ))}
        {cardioFirst ? null : cardioChip}
      </ScrollView>

      {renderSection(t('exercises.base'), base)}
      {renderSection(t('exercises.custom'), custom)}
      {none && searching ? <NoExerciseCard query={query} onCreate={create} /> : null}
      {none && !searching ? <Text style={styles.empty}>{t('exercises.empty')}</Text> : null}

      <Pressable accessibilityRole="button" onPress={() => create()} style={styles.create}>
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
