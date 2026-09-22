import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { ChevronDown, Ellipsis } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { ActionSheet, Button, IconButton } from '@/components/ui';
import {
  ActiveExerciseCard,
  CollapsedExerciseCard,
  RestTimerBar,
  SetRow,
} from '@/components/workout';
import { db } from '@/db/client';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import {
  useActiveWorkout,
  useWorkoutExercises,
  type WorkoutExerciseWithSets,
} from '@/db/use-workout';
import {
  addExercisesToWorkout,
  addSet,
  deleteSet,
  discardWorkout,
  exerciseBests,
  finishWorkout,
  lastSessions,
  replaceWorkoutExercise,
  setCompleted,
  updateSet,
} from '@/db/workout';
import { formatClock } from '@/domain/rest-timer';
import {
  type Best,
  bestOf,
  convertWeight,
  isPersonalRecord,
  type Suggestion,
  suggestNext,
} from '@/domain/strength';
import { useAppLanguage } from '@/i18n/use-app-language';
import { useNow } from '@/lib/use-now';
import { openExercisePicker } from '@/stores/exercise-picker';
import { useRestTimer } from '@/stores/rest-timer';
import { useSettings } from '@/stores/settings';

/** 워밍업 세트 뒤 휴식은 짧게 */
const WARMUP_REST_SEC = 60;

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function KeepScreenOn() {
  useKeepAwake('workout');
  return null;
}

/** 운동 중 화면. 탭 위에 뜨는 전체 화면이고, 접어도(아래 화살표) 운동은 계속된다. */
export default function WorkoutScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useAppLanguage();
  const { workout, ready } = useActiveWorkout();
  const exercises = useWorkoutExercises(workout?.id);
  const catalog = useExerciseCatalog(lang);
  const unit = useSettings((s) => s.weightUnit);
  const keepAwake = useSettings((s) => s.keepAwake);
  const startRest = useRestTimer((s) => s.start);
  const stopRest = useRestTimer((s) => s.stop);
  const now = useNow(1000, !!workout);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [finished, setFinished] = useState(false);

  const exerciseKey = exercises.map((e) => e.exerciseId).join(',');
  const workoutId = workout?.id;

  // 지난 최고 기록(PR 기준)과 증량 제안은 종목 구성이 바뀔 때만 다시 계산한다.
  const bests = useMemo(
    () =>
      workoutId
        ? exerciseBests(db, exerciseKey ? exerciseKey.split(',') : [], workoutId)
        : new Map<string, Best>(),
    [workoutId, exerciseKey],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 세트 값이 바뀔 때마다가 아니라 종목 구성이 바뀔 때만 다시 계산한다.
  const suggestions = useMemo(() => {
    const map = new Map<string, { suggestion: Suggestion | null; hasHistory: boolean }>();
    for (const we of exercises) {
      const history = lastSessions(db, we.exerciseId, 2).map((s) =>
        s.sets.map((x) => ({
          ...x,
          weight: x.weight === null ? null : convertWeight(x.weight, x.unit, unit),
        })),
      );
      const increment = convertWeight(we.increment, we.incrementUnit, unit) || we.increment;
      map.set(we.id, {
        suggestion: suggestNext(history, { repMin: we.repMin, repMax: we.repMax, increment }),
        hasHistory: history.length > 0,
      });
    }
    return map;
  }, [exerciseKey, unit]);

  // 펼칠 종목: 고른 게 없으면 아직 안 끝난 첫 종목
  const pendingOf = (we: WorkoutExerciseWithSets) =>
    we.sets.filter((s) => s.completedAt === null).length;
  const active =
    exercises.find((e) => e.id === activeId) ??
    exercises.find((e) => pendingOf(e) > 0) ??
    exercises[0];

  useEffect(() => {
    if (activeId && !exercises.some((e) => e.id === activeId)) setActiveId(null);
  }, [activeId, exercises]);

  if (!workout) {
    // 첫 조회 전이거나, 운동이 끝났거나 버려졌다.
    return !ready || finished ? <View style={styles.root} /> : <Redirect href="/" />;
  }
  const currentWorkout = workout;

  const toggleSet = (we: WorkoutExerciseWithSets, setId: string) => {
    const set = we.sets.find((s) => s.id === setId);
    if (!set) return;
    if (set.completedAt !== null) {
      setCompleted(db, set.id, false);
      return;
    }
    const type = catalog.byId.get(we.exerciseId)?.type ?? 'weight_reps';
    const missing = type === 'time' ? set.durationSec === null : set.reps === null;
    if (missing) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    setCompleted(db, set.id, true);
    const pr = prSetIds(we, bests.get(we.exerciseId) ?? null, set.id).has(set.id);
    void (
      pr
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    ).catch(() => {});

    const leftHere = we.sets.filter((s) => s.completedAt === null && s.id !== set.id).length;
    const leftAll = exercises.reduce((n, e) => n + (e.id === we.id ? leftHere : pendingOf(e)), 0);
    if (leftAll > 0)
      startRest(set.kind === 'warmup' ? Math.min(WARMUP_REST_SEC, we.restSec) : we.restSec);
    if (leftHere === 0) {
      const next = exercises.find((e) => e.id !== we.id && pendingOf(e) > 0);
      if (next) setActiveId(next.id);
    }
  };

  const addExercises = () =>
    openExercisePicker((ids) => {
      addExercisesToWorkout(db, currentWorkout.id, ids, unit);
    });

  const replaceActive = () => {
    if (!active) return;
    const target = active.id;
    openExercisePicker((ids) => {
      const [first] = ids;
      if (first) setActiveId(replaceWorkoutExercise(db, target, first, unit));
    });
  };

  const discard = () =>
    Alert.alert(t('workout.discardTitle'), t('workout.discardBody'), [
      { text: t('workout.keepGoing'), style: 'cancel' },
      {
        text: t('workout.discard'),
        style: 'destructive',
        onPress: () => {
          stopRest();
          setFinished(true);
          discardWorkout(db, currentWorkout.id);
          router.back();
        },
      },
    ]);

  const finish = () => {
    const done = exercises.reduce(
      (n, e) => n + e.sets.filter((s) => s.completedAt !== null).length,
      0,
    );
    const pending = exercises.reduce((n, e) => n + pendingOf(e), 0);
    if (done === 0) {
      Alert.alert(t('workout.emptyTitle'), t('workout.emptyBody'), [
        { text: t('workout.keepGoing'), style: 'cancel' },
        {
          text: t('workout.discard'),
          style: 'destructive',
          onPress: () => {
            stopRest();
            setFinished(true);
            discardWorkout(db, currentWorkout.id);
            router.back();
          },
        },
      ]);
      return;
    }
    const complete = () => {
      stopRest();
      setFinished(true);
      finishWorkout(db, currentWorkout.id);
      router.replace({ pathname: '/workout-summary/[id]', params: { id: currentWorkout.id } });
    };
    if (pending === 0) {
      complete();
      return;
    }
    Alert.alert(t('workout.finishConfirmTitle'), t('workout.finishPending', { count: pending }), [
      { text: t('workout.keepGoing'), style: 'cancel' },
      { text: t('workout.finishConfirm'), onPress: complete },
    ]);
  };

  const activeName = active ? (catalog.byId.get(active.exerciseId)?.name ?? '') : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {keepAwake ? <KeepScreenOn /> : null}
      <View style={styles.header}>
        <IconButton
          icon={ChevronDown}
          label={t('workout.collapse')}
          onPress={() => router.back()}
        />
        <View style={styles.titleWrap} accessible accessibilityRole="header">
          <Text style={styles.title} numberOfLines={1}>
            {currentWorkout.name}
          </Text>
          <Text style={styles.elapsed}>{formatClock((now - currentWorkout.startedAt) / 1000)}</Text>
        </View>
        <IconButton icon={Ellipsis} label={t('workout.more')} onPress={() => setMenuOpen(true)} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {exercises.length === 0 ? (
            <Text style={styles.empty}>{t('workout.noExercises')}</Text>
          ) : null}
          {exercises.map((we, index) => {
            const info = catalog.byId.get(we.exerciseId);
            const type = info?.type ?? 'weight_reps';
            const working = we.sets.filter((s) => s.kind !== 'warmup');
            if (we.id !== active?.id) {
              const done = working.filter((s) => s.completedAt !== null).length;
              const metaKey =
                type === 'time' ? 'workout.collapsedMetaTime' : 'workout.collapsedMeta';
              const meta =
                done > 0
                  ? t('workout.collapsedDone', { done, count: working.length })
                  : t(metaKey, { count: working.length, min: we.repMin, max: we.repMax });
              return (
                <CollapsedExerciseCard
                  key={we.id}
                  name={info?.name ?? ''}
                  meta={meta}
                  onPress={() => setActiveId(we.id)}
                />
              );
            }
            const group = info?.primaryGroups[0];
            const prs = prSetIds(we, bests.get(we.exerciseId) ?? null);
            let workingNo = 0;
            return (
              <ActiveExerciseCard
                key={we.id}
                position={
                  group
                    ? t('workout.position', {
                        index: index + 1,
                        total: exercises.length,
                        group: t(`exercises.group.${group}`),
                      })
                    : t('workout.positionNoGroup', { index: index + 1, total: exercises.length })
                }
                name={info?.name ?? ''}
                type={type}
                suggestion={
                  <SuggestionLine data={suggestions.get(we.id)} type={type} unit={unit} we={we} />
                }
                onAddSet={() => addSet(db, we.id, unit)}
              >
                {we.sets.map((s) => {
                  const label =
                    s.kind === 'warmup' ? t('workout.warmupLabel') : String(++workingNo);
                  return (
                    <SetRow
                      key={s.id}
                      label={label}
                      kind={s.kind}
                      type={type}
                      value={{ weight: s.weight, reps: s.reps, durationSec: s.durationSec }}
                      unit={s.weightUnit}
                      completed={s.completedAt !== null}
                      pr={prs.has(s.id)}
                      onChange={(patch) => updateSet(db, s.id, patch)}
                      onToggle={() => toggleSet(we, s.id)}
                      onDelete={() => deleteSet(db, s.id)}
                    />
                  );
                })}
              </ActiveExerciseCard>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <RestTimerBar />
          <Button label={t('workout.finish')} onPress={finish} />
        </View>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={menuOpen}
        title={t('workout.menu.title')}
        cancelLabel={t('workout.menu.cancel')}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: t('workout.menu.addExercise'), onPress: addExercises },
          ...(active
            ? [{ label: t('workout.menu.replace', { name: activeName }), onPress: replaceActive }]
            : []),
          { label: t('workout.menu.discard'), onPress: discard, destructive: true },
        ]}
      />
    </View>
  );
}

/**
 * 이 종목에서 PR인 세트 id. 지난 기록이 있어야 하고, 앞 세트 기록도 기준에 더해 가며
 * 기준을 넘은 완료 본세트만 PR로 친다. justCompleted는 방금 완료 처리해 아직 DB에 반영 전인 세트.
 */
function prSetIds(
  we: WorkoutExerciseWithSets,
  history: Best | null,
  justCompleted?: string,
): Set<string> {
  const out = new Set<string>();
  if (!history) return out;
  let best: Best = history;
  for (const s of we.sets) {
    const done = s.completedAt !== null || s.id === justCompleted;
    if (!done || s.kind === 'warmup') continue;
    const value = { weight: s.weight, reps: s.reps, unit: s.weightUnit };
    if (isPersonalRecord(value, best)) out.add(s.id);
    const b = bestOf([value]);
    if (b)
      best = {
        weightKg: Math.max(best.weightKg, b.weightKg),
        e1rmKg: Math.max(best.e1rmKg, b.e1rmKg),
      };
  }
  return out;
}

function SuggestionLine({
  data,
  type,
  unit,
  we,
}: {
  data: { suggestion: Suggestion | null; hasHistory: boolean } | undefined;
  type: string;
  unit: string;
  we: WorkoutExerciseWithSets;
}): ReactNode {
  const { t } = useTranslation();
  if (!data || type === 'time') return null;
  const { suggestion, hasHistory } = data;
  if (!suggestion) {
    return hasHistory ? null : <Text style={styles.suggest}>{t('workout.suggest.first')}</Text>;
  }
  const weight = `${fmt(suggestion.weight)}${unit}`;
  const values =
    suggestion.kind === 'increase'
      ? { sets: suggestion.sets, reps: suggestion.reps, weight }
      : { weight, min: we.repMin, max: we.repMax };
  return (
    <Text style={styles.suggest}>
      <Trans
        i18nKey={
          suggestion.kind === 'increase' && suggestion.sets === 1
            ? 'workout.suggest.increaseOne'
            : `workout.suggest.${suggestion.kind}`
        }
        values={values}
        components={{ b: <Text style={styles.suggestStrong} /> }}
      />
    </Text>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  elapsed: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  content: { gap: 12, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 12 },
  empty: {
    paddingHorizontal: 6,
    paddingTop: 12,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  suggest: {
    marginRight: 4,
    marginBottom: 4,
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  suggestStrong: { fontFamily: theme.fonts.semibold, color: theme.colors.text },
  footer: { gap: 10, paddingTop: 10, paddingHorizontal: 16 },
}));
