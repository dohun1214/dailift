import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Chip } from '@/components/ui';
import type { MuscleGroup } from '@/db/schema';
import { type CatalogExercise, useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useExerciseRecords } from '@/db/use-exercise-records';
import { type ExerciseSummary, summarizeExercises } from '@/domain/exercise-progress';
import { formatClock } from '@/domain/rest-timer';
import { useAppLanguage } from '@/i18n/use-app-language';
import { matchesSearch } from '@/lib/hangul';
import { openExerciseCreator } from '@/stores/exercise-picker';
import { useSettings } from '@/stores/settings';

import { ExerciseSearchRow, NoExerciseCard } from './exercise-search';

const GROUPS: readonly MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];
const fmt = (n: number) => String(Math.round(n * 100) / 100);

type Row = { exercise: CatalogExercise; summary?: ExerciseSummary };

/** 기록 탭의 종목 목록: 검색, 부위 고르기, 기록한 종목(최근 순) + 다른 종목. 누르면 종목 상세 */
export function ExerciseListView() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const unit = useSettings((s) => s.weightUnit);
  const catalog = useExerciseCatalog(lang);
  const { sets, ready } = useExerciseRecords();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [thisYear] = useState(() => new Date().getFullYear());

  const summaries = useMemo(
    () => summarizeExercises(sets, (id) => catalog.byId.get(id)?.type, unit),
    [sets, catalog, unit],
  );

  const { done, other } = useMemo(() => {
    const match = (e: CatalogExercise) =>
      (group === null || e.primaryGroups.includes(group)) && matchesSearch(query, e.searchNames);
    const doneRows: Row[] = [];
    const otherRows: Row[] = [];
    for (const exercise of [...catalog.base, ...catalog.custom]) {
      if (!match(exercise)) continue;
      const summary = summaries.get(exercise.id);
      if (summary) doneRows.push({ exercise, summary });
      else otherRows.push({ exercise });
    }
    doneRows.sort((a, b) => (b.summary?.lastAt ?? 0) - (a.summary?.lastAt ?? 0));
    return { done: doneRows, other: otherRows };
  }, [catalog, summaries, group, query]);

  const groupName = (e: CatalogExercise) =>
    e.primaryGroups[0] ? t(`exercises.group.${e.primaryGroups[0]}`) : null;
  const dateLabel = (at: number) => {
    const d = new Date(at);
    return d.toLocaleDateString(locale, {
      year: d.getFullYear() === thisYear ? undefined : 'numeric',
      month: lang === 'ko' ? 'long' : 'short',
      day: 'numeric',
    });
  };
  const bestLabel = (e: CatalogExercise, s: ExerciseSummary) => {
    if (e.type === 'time') return formatClock(s.best.max);
    if (e.type === 'bodyweight_reps')
      return t('exerciseDetail.progress.reps', { reps: s.best.max });
    return `${fmt(s.best.max)}${unit} × ${s.best.maxReps}`;
  };

  const renderSection = (title: string, note: string | null, rows: Row[]) =>
    rows.length === 0 ? null : (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, styles.flex]} accessibilityRole="header">
            {title}
          </Text>
          {note ? <Text style={styles.cardNote}>{note}</Text> : null}
        </View>
        {rows.map(({ exercise: e, summary }, i) => {
          const sub = [
            groupName(e),
            summary ? dateLabel(summary.lastAt) : t(`exercises.equipment.${e.equipment}`),
          ]
            .filter(Boolean)
            .join(' · ');
          const best = summary ? bestLabel(e, summary) : null;
          const count = summary ? t('exerciseList.sessions', { count: summary.count }) : null;
          return (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={t('exerciseList.rowA11y', {
                name: e.name,
                sub,
                record: best && count ? t('exerciseList.recordA11y', { best, count }) : '',
              })}
              accessibilityHint={t('exerciseList.rowHint')}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}
              style={({ pressed }) => [
                styles.row,
                i < rows.length - 1 && styles.rowLine,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {sub}
                </Text>
              </View>
              {best ? (
                <View style={styles.record}>
                  <Text style={styles.best} numberOfLines={1}>
                    {best}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {count}
                  </Text>
                </View>
              ) : null}
              <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
            </Pressable>
          );
        })}
      </View>
    );

  const searching = query.trim().length > 0;
  // 만든 종목이 목록에 보이도록 검색과 부위 고르기를 푼다.
  const create = (name: string | null = null) =>
    openExerciseCreator(() => {
      setQuery('');
      setGroup(null);
    }, name);
  const none = done.length === 0 && other.length === 0;
  const noRecords = ready && summaries.size === 0;

  return (
    <>
      <ExerciseSearchRow query={query} onChangeQuery={setQuery} onCreate={() => create()} />
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
        {GROUPS.map((g) => (
          <Chip
            key={g}
            label={t(`exercises.group.${g}`)}
            selected={group === g}
            onPress={() => setGroup((cur) => (cur === g ? null : g))}
          />
        ))}
      </ScrollView>

      {noRecords && !searching ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{t('exerciseList.none')}</Text>
        </View>
      ) : null}

      {searching ? (
        renderSection(
          t('exerciseList.results'),
          t('exerciseList.resultsNote', { count: done.length + other.length }),
          [...done, ...other],
        )
      ) : (
        <>
          {renderSection(
            t('exerciseList.done'),
            t('exerciseList.doneNote', { count: done.length }),
            done,
          )}
          {renderSection(noRecords ? t('exerciseList.all') : t('exerciseList.other'), null, other)}
        </>
      )}

      {none && searching ? <NoExerciseCard query={query} onCreate={create} /> : null}
      {none && !searching ? <Text style={styles.empty}>{t('exercises.empty')}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  chipsScroll: { marginHorizontal: -16, flexGrow: 0 },
  chips: { gap: 6, paddingHorizontal: 16 },
  card: {
    paddingTop: 2,
    paddingRight: 16,
    paddingBottom: 4,
    paddingLeft: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', paddingTop: 12 },
  cardTitle: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  cardNote: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
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
  record: { alignItems: 'flex-end', gap: 2 },
  best: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  note: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19.5,
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
}));
