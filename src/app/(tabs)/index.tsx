import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { LiveWorkoutCard } from '@/components/home/live-workout-card';
import { MuscleSetsCard } from '@/components/home/muscle-sets-card';
import { type PickRoutine, RoutinePickSheet } from '@/components/home/routine-pick-sheet';
import { WeekStrip } from '@/components/home/week-strip';
import { Badge, Button, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { completedWorkoutsQuery } from '@/db/history';
import * as schema from '@/db/schema';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useHistory } from '@/db/use-history';
import { useRoutineSections } from '@/db/use-routine-sections';
import { useStatsData } from '@/db/use-stats';
import { useActiveWorkout } from '@/db/use-workout';
import { startWorkout } from '@/db/workout';
import {
  daysAgo,
  latestPr,
  streakWeeks,
  todaysRoutine,
  todaysWorkout,
  weekStrip,
  workoutsThisWeek,
} from '@/domain/home';
import type { SummarySet } from '@/domain/session-summary';
import { BALANCE_GROUPS, groupBalance } from '@/domain/stats';
import { useAppLanguage } from '@/i18n/use-app-language';
import { useToday } from '@/lib/use-today';
import { useProfile } from '@/stores/profile';
import { useSettings, workoutDefaults } from '@/stores/settings';

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const NAMES_SHOWN = 3;

/** 홈: 날짜·오늘 루틴 제목, 주간 스트립, 오늘 루틴 카드(운동 시작·운동 중), 이번 주 횟수·연속 기록, 이번 주 부위별 세트, 최근 PR */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const unit = useSettings((s) => s.weightUnit);
  const target = useProfile((s) => s.daysPerWeek);
  const catalog = useExerciseCatalog(lang);
  const sections = useRoutineSections();
  const { workout: active } = useActiveWorkout();
  const { data: workouts } = useLiveQuery(completedWorkoutsQuery(db));
  const { sets, musclesOf } = useStatsData();
  const now = useToday();
  const [picking, setPicking] = useState(false);
  const { months } = useHistory(unit);

  const routines = useMemo(() => sections.flatMap((s) => s.routines), [sections]);
  const today = todaysRoutine(routines, now);
  const { data: todayItems } = useLiveQuery(
    db
      .select({
        exerciseId: schema.routineExercises.exerciseId,
        targetSets: schema.routineExercises.targetSets,
      })
      .from(schema.routineExercises)
      .where(
        and(
          eq(schema.routineExercises.routineId, today?.id ?? ''),
          isNull(schema.routineExercises.deletedAt),
        ),
      )
      .orderBy(asc(schema.routineExercises.position)),
    [today?.id],
  );

  // 오늘 이미 마친 운동(가장 최근 것). 있으면 '운동 시작' 대신 완료 카드를 보여 준다.
  const doneToday = todaysWorkout(
    months.flatMap((m) => m.items),
    now,
  );
  const { data: doneItems } = useLiveQuery(
    db
      .select({ exerciseId: schema.workoutExercises.exerciseId })
      .from(schema.workoutExercises)
      .where(
        and(
          eq(schema.workoutExercises.workoutId, doneToday?.id ?? ''),
          isNull(schema.workoutExercises.deletedAt),
        ),
      )
      .orderBy(asc(schema.workoutExercises.position)),
    [doneToday?.id],
  );

  const starts = workouts.map((w) => w.startedAt);
  const strip = weekStrip(
    now,
    routines.map((r) => r.weekdays),
    starts,
  );
  const thisWeek = workoutsThisWeek(starts, now);
  const muscleRows = useMemo(() => {
    const balance = groupBalance(sets, now.getTime(), musclesOf);
    return BALANCE_GROUPS.map((g) => ({
      name: t(`exercises.group.${g}`),
      value: balance.get(g) ?? 0,
    }));
  }, [sets, now, musclesOf, t]);
  const streak = target ? streakWeeks(starts, target, now) : 0;

  const pr = useMemo(() => {
    const byWorkout = new Map<string, SummarySet[]>();
    for (const s of sets) {
      const set: SummarySet = {
        exerciseId: s.exerciseId,
        kind: 'working',
        weight: s.weight,
        reps: s.reps,
        unit: s.unit,
        completed: true,
      };
      const list = byWorkout.get(s.workoutId);
      if (list) list.push(set);
      else byWorkout.set(s.workoutId, [set]);
    }
    return latestPr(workouts, byWorkout, unit);
  }, [sets, workouts, unit]);

  const dateLine = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now);
  const dayFmt = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const title = active
    ? t('home.inProgress', { name: active.name })
    : doneToday
      ? t('home.doneTitle', { name: doneToday.name })
      : today
        ? t('home.todayRoutine', { name: today.name })
        : t('home.restDay');

  // 고를 루틴: 오늘 요일 루틴을 맨 위로
  const pickList: PickRoutine[] = [...routines]
    .sort((a, b) => Number(b.id === today?.id) - Number(a.id === today?.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      today: r.id === today?.id,
      meta: t('home.meta', { count: r.exerciseCount, sets: r.setCount, minutes: r.minutes }),
    }));

  const start = (routineId: string | null, name: string) => {
    if (!active)
      startWorkout(db, {
        routineId,
        name,
        weightUnit: unit,
        barWeight: workoutDefaults().barWeight,
      });
    router.push('/workout');
  };

  const joinNames = (ids: readonly string[]) => {
    const list = ids.map((id) => catalog.byId.get(id)?.name ?? '').filter(Boolean);
    return list.length > NAMES_SHOWN
      ? t('home.more', {
          names: list.slice(0, NAMES_SHOWN).join(' · '),
          count: list.length - NAMES_SHOWN,
        })
      : list.join(' · ');
  };
  const namesLine = joinNames(todayItems.map((i) => i.exerciseId));
  const doneNamesLine = joinNames(doneItems.map((i) => i.exerciseId));
  const totalSets = todayItems.reduce((n, i) => n + i.targetSets, 0);

  const prName = pr ? (catalog.byId.get(pr.entry.exerciseId)?.name ?? '') : '';
  const prValue = pr
    ? pr.entry.kind === 'weight'
      ? `${fmt(pr.entry.weight)}${pr.entry.unit} × ${pr.entry.reps}`
      : t('summary.prE1rm', { weight: `${pr.entry.e1rm.toFixed(1)}${pr.entry.unit}` })
    : '';
  // Hermes에는 Intl.RelativeTimeFormat이 없어 직접 만든다.
  const ago = pr ? daysAgo(pr.startedAt, now) : 0;
  const prWhen = !pr
    ? ''
    : ago <= 0
      ? t('relative.today')
      : ago === 1
        ? t('relative.yesterday')
        : ago === 2
          ? t('relative.twoDays')
          : t('relative.daysAgo', { count: ago });

  return (
    <Screen inTabs>
      <View style={styles.page}>
        <View style={styles.head}>
          <Text style={styles.date}>{dateLine}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        </View>

        <WeekStrip days={strip} dateFormat={dayFmt} />

        {active ? (
          <LiveWorkoutCard workout={active} />
        ) : doneToday ? (
          <View style={[styles.todayCard, styles.doneCard]}>
            <View style={styles.todayMeta}>
              <View>
                <Badge label={t('home.doneBadge')} kind="solid" />
              </View>
              <Text style={styles.metaText}>
                {t('history.meta', {
                  minutes: doneToday.minutes,
                  sets: doneToday.sets,
                  volume: `${doneToday.volume.toLocaleString(locale)}${unit}`,
                })}
              </Text>
            </View>
            <View style={styles.todayBody}>
              <Text style={styles.routineName}>{doneToday.name}</Text>
              {doneNamesLine ? <Text style={styles.names}>{doneNamesLine}</Text> : null}
            </View>
            <View style={styles.doneActions}>
              <Button
                label={t('home.viewRecord')}
                onPress={() =>
                  router.push({ pathname: '/workout-summary/[id]', params: { id: doneToday.id } })
                }
              />
              <Button
                label={t('home.startMore')}
                variant="ghost"
                size="sm"
                onPress={() => setPicking(true)}
              />
            </View>
          </View>
        ) : today ? (
          <View style={styles.todayCard}>
            <View style={styles.todayMeta}>
              <View>
                <Badge label={t('home.today')} />
              </View>
              <Text style={styles.metaText}>
                {t('home.meta', {
                  count: todayItems.length,
                  sets: totalSets,
                  minutes: today.minutes,
                })}
              </Text>
            </View>
            <View style={styles.todayBody}>
              <Text style={styles.routineName}>{today.name}</Text>
              {namesLine ? <Text style={styles.names}>{namesLine}</Text> : null}
            </View>
            <Button label={t('home.start')} onPress={() => setPicking(true)} />
          </View>
        ) : (
          <View style={styles.todayCard}>
            <View style={styles.todayBody}>
              <Text style={styles.routineName}>{t('home.restTitle')}</Text>
              <Text style={styles.names}>
                {routines.length ? t('home.restBody') : t('home.noRoutinesBody')}
              </Text>
            </View>
            {routines.length > 0 ? (
              <Button label={t('home.start')} onPress={() => setPicking(true)} />
            ) : (
              <Button
                label={t('home.quickStart')}
                onPress={() => start(null, t('workout.emptyName'))}
              />
            )}
            {routines.length === 0 ? (
              <Button
                label={t('home.goRoutines')}
                variant="secondary"
                size="md"
                onPress={() => router.push('/routines')}
              />
            ) : null}
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.stat} accessible>
            <Text style={styles.statLabel}>{t('home.week')}</Text>
            <Text style={styles.statValue}>
              {thisWeek}
              <Text style={styles.statSmall}>
                {target ? t('home.weekTarget', { target }) : t('home.weekNoTarget')}
              </Text>
            </Text>
          </View>
          <View style={styles.stat} accessible>
            <Text style={styles.statLabel}>{t('home.streak')}</Text>
            <Text style={styles.statValue}>
              {streak}
              <Text style={styles.statSmall}>{t('home.streakUnit')}</Text>
            </Text>
          </View>
        </View>

        <MuscleSetsCard
          rows={muscleRows}
          onPress={() => router.navigate({ pathname: '/log', params: { view: 'stats' } })}
        />

        {pr ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.prA11y', { name: prName, value: prValue, when: prWhen })}
            onPress={() =>
              router.push({ pathname: '/workout-summary/[id]', params: { id: pr.workoutId } })
            }
            style={({ pressed }) => [styles.prRow, pressed && styles.pressed]}
          >
            <View>
              <Badge label="PR" kind="pr" />
            </View>
            <View style={styles.prBody}>
              <Text style={styles.prText} numberOfLines={1}>
                {t('home.prRecent', { name: prName, value: prValue })}
              </Text>
              <Text style={styles.prWhen}>{prWhen}</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>
      <RoutinePickSheet
        visible={picking}
        routines={pickList}
        onPick={(r) => start(r.id, r.name)}
        onEmpty={() => start(null, t('workout.emptyName'))}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { gap: 18, paddingTop: 8 },
  head: { gap: 4, paddingHorizontal: 4 },
  date: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.26,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  todayCard: {
    gap: 16,
    padding: 20,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  doneCard: { paddingBottom: 12 },
  doneActions: { gap: 4 },
  todayMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  todayBody: { gap: 6 },
  routineName: {
    fontSize: 24,
    lineHeight: 31,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  names: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    gap: 8,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 31,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  statSmall: { fontSize: 14, fontFamily: theme.fonts.medium, color: theme.colors.text2 },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  prBody: { flex: 1, gap: 2 },
  prText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  prWhen: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
