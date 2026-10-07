import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { type DayRoutine, DaySheet } from '@/components/home/day-sheet';
import { DietCard } from '@/components/home/diet-card';
import { LiveWorkoutCard } from '@/components/home/live-workout-card';
import { MuscleSetsCard } from '@/components/home/muscle-sets-card';
import { type PickRoutine, RoutinePickSheet } from '@/components/home/routine-pick-sheet';
import { SupplementCard } from '@/components/home/supplement-card';
import { WeekRange } from '@/components/home/week-range';
import { WeekStrip } from '@/components/home/week-strip';
import { Badge, Button, ConfirmDialog, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { completedWorkoutsQuery } from '@/db/history';
import * as schema from '@/db/schema';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useHistory } from '@/db/use-history';
import { useRoutineSections } from '@/db/use-routine-sections';
import { useStatsData } from '@/db/use-stats';
import { useActiveWorkout } from '@/db/use-workout';
import { addPastWorkout, startWorkout } from '@/db/workout';
import type { HistoryItem } from '@/domain/history';
import {
  daysAgo,
  dayWhen,
  latestPr,
  MAX_WEEKS_AHEAD,
  minWeekOffset,
  pastWorkoutStart,
  routinesOn,
  streakWeeks,
  todaysRoutine,
  todaysWorkout,
  weekStrip,
  workoutsOn,
  workoutsThisWeek,
} from '@/domain/home';
import { formatClock } from '@/domain/rest-timer';
import type { SummarySet } from '@/domain/session-summary';
import { resolveSetTargets, type TargetGroup } from '@/domain/set-targets';
import { BALANCE_GROUPS, groupBalance } from '@/domain/stats';
import { useAppLanguage } from '@/i18n/use-app-language';
import { openWorkout } from '@/lib/open-workout';
import { useToday } from '@/lib/use-today';
import { useProfile } from '@/stores/profile';
import { useSettings, workoutDefaults } from '@/stores/settings';

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const NAMES_SHOWN = 3;
/** 날짜 창의 운동 줄에 이름을 보여 줄 종목 수 */
const DAY_NAMES_SHOWN = 2;
/** 빈 운동으로 지난 기록을 추가할 때의 기본 운동 시간(분) */
const EMPTY_PAST_MINUTES = 60;

/** 홈: 날짜·오늘 루틴 제목, 주간 스트립, 오늘 루틴 카드(운동 시작·운동 중), 이번 주 횟수·연속 기록, 이번 주 부위별 세트, 최근 PR */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const unit = useSettings((s) => s.weightUnit);
  const target = useProfile((s) => s.daysPerWeek);
  const experience = useProfile((s) => s.experience);
  const customTargets = useSettings((s) => s.setTargets);
  const countSecondary = useSettings((s) => s.countSecondarySets);
  const catalog = useExerciseCatalog(lang);
  const sections = useRoutineSections();
  const { workout: active } = useActiveWorkout();
  const { data: workouts } = useLiveQuery(completedWorkoutsQuery(db));
  const { sets, musclesOf } = useStatsData();
  const now = useToday();
  const [picking, setPicking] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  // 다른 주를 보다가 홈을 떠나면 이번 주로 되돌린다(돌아오는 단추가 없으므로).
  // 지난 날 기록을 추가하러 갔다 오는 동안에는 보던 주를 그대로 둔다(여러 날을 이어서 채울 수 있게).
  const keepWeek = useRef(false);
  useFocusEffect(
    useCallback(
      () => () => {
        setOpenDay(null);
        if (keepWeek.current) keepWeek.current = false;
        else setWeekOffset(0);
      },
      [],
    ),
  );
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
  // 유산소만 한 날에는 '0세트 · 0kg' 대신 유산소 시간을 보여 준다(기록 탭과 같은 규칙).
  const doneCardio =
    doneToday && doneToday.cardioSec > 0
      ? t('cardio.history', { time: formatClock(doneToday.cardioSec) })
      : null;
  const doneBase = doneToday
    ? t('history.meta', {
        minutes: doneToday.minutes,
        sets: t('summary.setCount', { count: doneToday.sets }),
        volume: `${doneToday.volume.toLocaleString(locale)}${unit}`,
      })
    : '';
  const doneMeta = !doneToday
    ? ''
    : doneCardio && doneToday.sets === 0
      ? `${t('duration.min', { m: doneToday.minutes })} · ${doneCardio}`
      : doneCardio
        ? `${doneBase} · ${doneCardio}`
        : doneBase;
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
  const masks = routines.map((r) => r.weekdays);
  const minOffset = minWeekOffset(starts, now);
  const thisWeek = workoutsThisWeek(starts, now);
  const muscleRows = useMemo(() => {
    const balance = groupBalance(sets, now.getTime(), musclesOf, countSecondary);
    const targets = resolveSetTargets(experience, customTargets);
    return BALANCE_GROUPS.map((g) => ({
      name: t(`exercises.group.${g}`),
      value: balance.get(g) ?? 0,
      target: targets[g as TargetGroup] ?? 0,
    }));
  }, [sets, now, musclesOf, t, experience, customTargets, countSecondary]);
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
      meta: t('home.meta', {
        count: r.exerciseCount,
        sets: t('summary.setCount', { count: r.setCount }),
        minutes: r.minutes,
      }),
    }));

  // 다른 운동이 진행 중일 때 시작을 누르면 그 운동의 이름을 담아 알린다.
  const [busyWith, setBusyWith] = useState<string | null>(null);
  const start = (routineId: string | null, name: string) => {
    if (active && active.routineId !== routineId) {
      setBusyWith(active.name);
      return;
    }
    if (!active)
      startWorkout(db, {
        routineId,
        name,
        weightUnit: unit,
        barWeight: workoutDefaults().barWeight,
      });
    openWorkout();
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
  const joinNames2 = (ids: readonly string[]) => {
    const list = ids.map((id) => catalog.byId.get(id)?.name ?? '').filter(Boolean);
    return list.length > DAY_NAMES_SHOWN
      ? t('home.more', {
          names: list.slice(0, DAY_NAMES_SHOWN).join(' · '),
          count: list.length - DAY_NAMES_SHOWN,
        })
      : list.join(' · ');
  };

  // 날짜 창: 한 번 연 날을 닫히는 동안에도 그대로 보여 준다.
  const [shownDay, setShownDay] = useState<Date>(now);
  const showDay = (date: Date) => {
    setShownDay(date);
    setOpenDay(date);
  };
  const allItems = months.flatMap((m) => m.items);
  const dayWorkouts = workoutsOn(allItems, shownDay);
  const dayPlanned = routinesOn(routines, shownDay);
  const addRecord = (routine: DayRoutine | null) => {
    const id = addPastWorkout(db, {
      routineId: routine?.id ?? null,
      name: routine?.name ?? t('workout.emptyName'),
      weightUnit: unit,
      barWeight: workoutDefaults().barWeight,
      startedAt: pastWorkoutStart(shownDay),
      minutes: routine?.minutes || EMPTY_PAST_MINUTES,
    });
    keepWeek.current = true;
    router.push({ pathname: '/workout-edit/[id]', params: { id, added: '1' } });
  };

  const namesLine = joinNames(todayItems.map((i) => i.exerciseId));
  const doneNamesLine = joinNames(doneItems.map((i) => i.exerciseId));
  // 루틴 요약의 세트 수를 쓴다(유산소는 세트로 세지 않는다).
  const totalSets = today?.setCount ?? 0;

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

  // 다른 주를 볼 때 보여 줄 날짜 범위: "9월 7일 – 13일", 달이 바뀌면 "9월 28일 – 10월 4일"
  const shownWeek = weekStrip(now, masks, starts, weekOffset);
  const weekFrom = shownWeek[0]?.date ?? now;
  const weekTo = shownWeek[shownWeek.length - 1]?.date ?? now;
  const monthDay = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' });
  const weekRange =
    weekFrom.getMonth() === weekTo.getMonth()
      ? t('home.weekRangeSame', { start: monthDay.format(weekFrom), day: weekTo.getDate() })
      : t('home.weekRange', { start: monthDay.format(weekFrom), end: monthDay.format(weekTo) });

  return (
    <Screen inTabs>
      <View style={styles.page}>
        <View style={styles.head}>
          <Text style={styles.date}>{dateLine}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        </View>

        <WeekRange label={weekOffset === 0 ? null : weekRange} />
        <WeekStrip
          daysFor={(offset) => weekStrip(now, masks, starts, offset)}
          dateFormat={dayFmt}
          weekOffset={weekOffset}
          minOffset={minOffset}
          maxOffset={MAX_WEEKS_AHEAD}
          selected={openDay}
          onShift={(dir) => setWeekOffset((w) => w + dir)}
          onDayPress={(d) => showDay(d.date)}
        />

        {active ? (
          <LiveWorkoutCard workout={active} />
        ) : doneToday ? (
          <View style={[styles.todayCard, styles.doneCard]}>
            <View style={styles.todayMeta}>
              <View>
                <Badge label={t('home.doneBadge')} kind="solid" />
              </View>
              <Text style={styles.metaText}>{doneMeta}</Text>
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
                  sets: t('summary.setCount', { count: totalSets }),
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

        {/* 오늘 챙길 것(식단 · 영양제)을 운동 카드 바로 아래에 둔다 — 화면을 넘기지 않고 보이게 */}
        <DietCard now={now} />
        <SupplementCard now={now} />

        <View style={styles.stats}>
          <View style={styles.stat} accessible>
            <Text style={styles.statLabel}>{t('home.week')}</Text>
            <Text style={styles.statValue}>
              {thisWeek}
              <Text style={styles.statSmall}>
                {target
                  ? t('home.weekTarget', { target })
                  : t('home.weekNoTarget', { count: thisWeek })}
              </Text>
            </Text>
          </View>
          {target ? (
            <View style={styles.stat} accessible>
              <Text style={styles.statLabel}>{t('home.streak')}</Text>
              <Text style={styles.statValue}>
                {streak}
                <Text style={styles.statSmall}>{t('home.streakUnit')}</Text>
              </Text>
            </View>
          ) : (
            // 주 목표가 없으면 연속 기록을 셀 수 없다 → 정하러 가는 길을 보여 준다.
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/onboarding', params: { redo: '1' } })}
              style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
            >
              <Text style={styles.statLabel}>{t('home.streak')}</Text>
              <Text style={styles.statHint}>{t('home.streakNoTarget')}</Text>
            </Pressable>
          )}
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
              <View style={styles.prLine}>
                <Text style={[styles.prText, styles.prName]} numberOfLines={1}>
                  {prName}
                </Text>
                <Text style={styles.prText}>{prValue}</Text>
              </View>
              <Text style={styles.prWhen}>{prWhen}</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>
      <DaySheet
        day={openDay}
        when={dayWhen(shownDay, now)}
        dateLabel={dayFmt.format(shownDay)}
        workouts={dayWorkouts}
        planned={dayPlanned}
        routines={routines}
        active={!!active}
        exerciseName={(id) => catalog.byId.get(id)?.name ?? ''}
        exerciseType={(id) => catalog.byId.get(id)?.type}
        workoutMeta={(i: HistoryItem) =>
          t('history.meta', {
            minutes: i.minutes,
            sets: t('summary.setCount', { count: i.sets }),
            volume: `${i.volume.toLocaleString(locale)}${unit}`,
          })
        }
        workoutNames={(i: HistoryItem) => joinNames2(i.exerciseIds)}
        onClose={() => setOpenDay(null)}
        onOpenWorkout={(id) => router.push({ pathname: '/workout-summary/[id]', params: { id } })}
        onStart={(r) => start(r.id, r.name)}
        onResume={() => openWorkout()}
        onPickStart={() => setTimeout(() => setPicking(true), 320)}
        onViewRoutine={(id) =>
          id ? router.push({ pathname: '/routine/[id]', params: { id } }) : router.push('/routines')
        }
        onAddRecord={addRecord}
      />
      <RoutinePickSheet
        visible={picking}
        routines={pickList}
        onPick={(r) => start(r.id, r.name)}
        onEmpty={() => start(null, t('workout.emptyName'))}
        onClose={() => setPicking(false)}
      />
      <ConfirmDialog
        visible={busyWith !== null}
        title={t('workout.recoverTitle')}
        body={t('workout.busyBody', { name: busyWith ?? '' })}
        cancelLabel={t('common.close')}
        confirmLabel={t('workout.resume')}
        onCancel={() => setBusyWith(null)}
        onConfirm={() => {
          setBusyWith(null);
          openWorkout();
        }}
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
  statHint: {
    minHeight: 31,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text,
  },
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
  // 이름이 길면 이름만 줄이고 기록 값은 끝까지 보여 준다.
  prLine: { flexDirection: 'row', gap: 5 },
  prName: { flexShrink: 1 },
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
