import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { ArrowLeftRight, ChevronDown, Ellipsis, Equal, Plus, Trash2 } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ActionSheet, Button, ConfirmDialog, IconButton, TextButton } from '@/components/ui';
import {
  ActiveExerciseCard,
  CollapsedExerciseCard,
  FieldNavProvider,
  KeyboardBar,
  RestSheet,
  RestTimerBar,
  SetRow,
  setFieldKeys,
  useFieldNav,
  useKeyboardVisible,
  WorkoutEditList,
  WorkoutMenuSheet,
} from '@/components/workout';
import { db } from '@/db/client';
import type { SetKind } from '@/db/schema';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import {
  useActiveWorkout,
  useWorkoutExercises,
  type WorkoutExerciseWithSets,
} from '@/db/use-workout';
import {
  addExercisesToWorkout,
  addSet,
  completeSet,
  deleteSet,
  deleteWorkoutExercise,
  discardWorkout,
  exerciseBests,
  finishWorkout,
  lastSessions,
  moveWorkoutExercise,
  replaceWorkoutExercise,
  setCompleted,
  setWorkoutExerciseRest,
  updateSet,
} from '@/db/workout';
import { formatClock, splitDuration } from '@/domain/rest-timer';
import {
  type Best,
  bestOf,
  convertWeight,
  isPersonalRecord,
  type Suggestion,
  suggestNext,
} from '@/domain/strength';
import { useAppLanguage } from '@/i18n/use-app-language';
import { object as objectJosa } from '@/lib/josa';
import { useNow } from '@/lib/use-now';
import { openExercisePicker } from '@/stores/exercise-picker';
import { useRestTimer } from '@/stores/rest-timer';
import { useSettings, workoutDefaults } from '@/stores/settings';

const SET_KINDS: readonly SetKind[] = ['working', 'warmup', 'drop', 'failure'];
/** RPE 선택지: 6–10, 0.5 단위 */
const RPE_VALUES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];

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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const lang = useAppLanguage();
  const { workout, ready } = useActiveWorkout();
  const exercises = useWorkoutExercises(workout?.id);
  const catalog = useExerciseCatalog(lang);
  const unit = useSettings((s) => s.weightUnit);
  const keepAwake = useSettings((s) => s.keepAwake);
  const dumbbellMode = useSettings((s) => s.dumbbellMode);
  const advanced = useSettings((s) => s.advancedLogging);
  const [setMenu, setSetMenu] = useState<{ id: string; kind: SetKind; rpe: number | null } | null>(
    null,
  );
  const [rpeFor, setRpeFor] = useState<{ id: string; rpe: number | null } | null>(null);
  const startRest = useRestTimer((s) => s.start);
  const stopRest = useRestTimer((s) => s.stop);
  const now = useNow(1000, !!workout);
  const [activeId, setActiveId] = useState<string | null>(null);
  // 지금 하는 종목과 별개로 사용자가 펼쳐 둔 종목(완료한 종목 다시 보기 등)
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  // 종목 편집(순서 · 삭제) 모드. highlightId는 꾹 눌러 들어온 종목
  const [editing, setEditing] = useState<{ highlightId: string | null } | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string; done: number } | null>(
    null,
  );
  const keyboardVisible = useKeyboardVisible();

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
    if (openIds.some((id) => !exercises.some((e) => e.id === id))) {
      setOpenIds((ids) => ids.filter((id) => exercises.some((e) => e.id === id)));
    }
  }, [activeId, openIds, exercises]);
  const collapse = (id: string) => setOpenIds((ids) => ids.filter((x) => x !== id));

  // 화면에 펼쳐진 세트 입력칸을 위에서 아래 순으로 (키보드 위 '다음' 이동 순서)
  const fieldOrder = exercises
    .filter((we) => we.id === active?.id || openIds.includes(we.id))
    .flatMap((we) => {
      const type = catalog.byId.get(we.exerciseId)?.type ?? 'weight_reps';
      return we.sets.flatMap((s) => setFieldKeys(s.id, type));
    });
  const fieldNav = useFieldNav(fieldOrder);

  // 편집 모드에서 안드로이드 뒤로 가기는 편집만 끝낸다.
  const isEditing = editing !== null;
  useEffect(() => {
    if (!isEditing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setEditing(null);
      return true;
    });
    return () => sub.remove();
  }, [isEditing]);

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
    // 빈 칸(0kg · 0회로 보임)이어도 완료할 수 있다. 빈 칸은 0으로 기록된다.
    const type = catalog.byId.get(we.exerciseId)?.type ?? 'weight_reps';
    completeSet(db, set.id, type);
    const pr = prSetIds(we, bests.get(we.exerciseId) ?? null, set.id).has(set.id);
    void (
      pr
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    ).catch(() => {});

    const leftHere = we.sets.filter((s) => s.completedAt === null && s.id !== set.id).length;
    const leftAll = exercises.reduce((n, e) => n + (e.id === we.id ? leftHere : pendingOf(e)), 0);
    const next =
      leftHere === 0 ? exercises.find((e) => e.id !== we.id && pendingOf(e) > 0) : undefined;
    if (leftAll > 0)
      startRest(
        set.kind === 'warmup' ? Math.min(WARMUP_REST_SEC, we.restSec) : we.restSec,
        restMessage(we, set.id, next),
      );
    if (leftHere === 0) {
      // 다 끝낸 종목은 접고, 남은 종목이 있으면 그걸 지금 종목으로
      if (next) setActiveId(next.id);
      setOpenIds((ids) => ids.filter((id) => id !== we.id && id !== next?.id));
    }
  };

  const nameOf = (we: WorkoutExerciseWithSets) => catalog.byId.get(we.exerciseId)?.name ?? '';

  /** 휴식이 끝났을 때 알림에 보일 문장: 다음에 할 세트 또는 종목 */
  const restMessage = (
    we: WorkoutExerciseWithSets,
    doneSetId: string,
    nextExercise: WorkoutExerciseWithSets | undefined,
  ): string | null => {
    const upcoming = we.sets.find((s) => s.completedAt === null && s.id !== doneSetId);
    if (!upcoming) {
      return nextExercise ? t('workout.rest.nextExercise', { name: nameOf(nextExercise) }) : null;
    }
    if (upcoming.kind === 'warmup') return t('workout.rest.nextWarmup', { name: nameOf(we) });
    if (upcoming.kind !== 'working') return null;
    const number = we.sets.filter((s) => s.kind === 'working').indexOf(upcoming) + 1;
    return t('workout.rest.nextSet', { name: nameOf(we), set: number });
  };

  const formatDuration = (sec: number) => {
    const { m, s: rest } = splitDuration(sec);
    if (m > 0 && rest > 0) return t('duration.minSec', { m, s: rest });
    return m > 0 ? t('duration.min', { m }) : t('duration.sec', { s: rest });
  };

  /** 접힌 카드·편집 목록에 보이는 한 줄 요약 */
  const metaOf = (we: WorkoutExerciseWithSets) => {
    const type = catalog.byId.get(we.exerciseId)?.type ?? 'weight_reps';
    const working = we.sets.filter((s) => s.kind !== 'warmup');
    const done = working.filter((s) => s.completedAt !== null).length;
    return done > 0
      ? t('workout.collapsedDone', { done, count: working.length })
      : t(type === 'time' ? 'workout.collapsedMetaTime' : 'workout.collapsedMeta', {
          count: working.length,
          min: we.repMin,
          max: we.repMax,
        });
  };

  const enterEdit = (highlightId: string | null) => {
    Keyboard.dismiss();
    setEditing({ highlightId });
  };

  /** 기록한 세트가 있으면 한 번 확인하고, 없으면 바로 지운다. */
  const removeExercise = (id: string) => {
    const we = exercises.find((e) => e.id === id);
    if (!we) return;
    const done = we.sets.filter((s) => s.completedAt !== null).length;
    if (done > 0) setDeleteFor({ id, name: nameOf(we), done });
    else deleteWorkoutExercise(db, id);
  };

  const addExercises = () =>
    openExercisePicker((ids) => {
      addExercisesToWorkout(db, currentWorkout.id, ids, unit, undefined, workoutDefaults());
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
  const restTarget = exercises.find((e) => e.id === restFor);
  const routineName = currentWorkout.routineId ? currentWorkout.name : null;

  const dialogs = (
    <ConfirmDialog
      visible={deleteFor !== null}
      title={t('workout.edit.deleteTitle', { name: deleteFor?.name ?? '' })}
      body={t('workout.edit.deleteBody', { count: deleteFor?.done ?? 0 })}
      cancelLabel={t('workout.menu.cancel')}
      confirmLabel={t('workout.edit.delete')}
      destructive
      onCancel={() => setDeleteFor(null)}
      onConfirm={() => {
        if (deleteFor) deleteWorkoutExercise(db, deleteFor.id);
        setDeleteFor(null);
      }}
    />
  );

  if (editing) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {keepAwake ? <KeepScreenOn /> : null}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.titleWrap} accessible accessibilityRole="header">
            <Text style={styles.title} numberOfLines={1}>
              {t('workout.edit.title')}
            </Text>
            <Text style={styles.elapsed} numberOfLines={1}>
              {t('workout.edit.subtitle', { name: currentWorkout.name, count: exercises.length })}
            </Text>
          </View>
          <TextButton label={t('workout.edit.done')} onPress={() => setEditing(null)} />
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.editContent}>
          <Text style={styles.editHint}>{t('workout.edit.hint')}</Text>
          <WorkoutEditList
            rows={exercises.map((we) => ({ id: we.id, name: nameOf(we), meta: metaOf(we) }))}
            highlightId={editing.highlightId}
            onMove={(from, to) => {
              setEditing({ highlightId: null });
              moveWorkoutExercise(db, currentWorkout.id, from, to);
            }}
            onRemove={removeExercise}
          />
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <Button
            label={t('workout.addExercise')}
            variant="secondary"
            size="md"
            icon={Plus}
            onPress={addExercises}
          />
        </View>
        {dialogs}
      </View>
    );
  }

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

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <FieldNavProvider value={fieldNav.nav}>
            {exercises.length === 0 ? (
              <Text style={styles.empty}>{t('workout.noExercises')}</Text>
            ) : null}
            {exercises.map((we, index) => {
              const info = catalog.byId.get(we.exerciseId);
              const type = info?.type ?? 'weight_reps';
              const working = we.sets.filter((s) => s.kind !== 'warmup');
              const extra = we.id !== active?.id;
              if (extra && !openIds.includes(we.id)) {
                return (
                  <CollapsedExerciseCard
                    key={we.id}
                    name={info?.name ?? ''}
                    meta={metaOf(we)}
                    onPress={() => setOpenIds((ids) => [...ids, we.id])}
                    onLongPress={() => enterEdit(we.id)}
                  />
                );
              }
              const group = info?.primaryGroups[0];
              const prs = prSetIds(we, bests.get(we.exerciseId) ?? null);
              let workingNo = 0;
              const plateSet =
                working.find((s) => s.completedAt === null && s.weight !== null) ??
                [...working].reverse().find((s) => s.weight !== null);
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
                  onCollapse={extra ? () => collapse(we.id) : undefined}
                  restLabel={t('workout.restChip', { time: formatDuration(we.restSec) })}
                  onRestPress={() => setRestFor(we.id)}
                  onLongPress={() => enterEdit(we.id)}
                  suggestion={
                    <SuggestionLine data={suggestions.get(we.id)} type={type} unit={unit} we={we} />
                  }
                  onAddSet={() => addSet(db, we.id, unit)}
                  onNamePress={() =>
                    router.push({ pathname: '/exercise/[id]', params: { id: we.exerciseId } })
                  }
                  onPlatesPress={
                    info?.equipment === 'barbell' && type === 'weight_reps'
                      ? () =>
                          router.push({
                            pathname: '/plate-calculator',
                            params: {
                              weight: plateSet?.weight != null ? String(plateSet.weight) : '',
                              unit: plateSet?.weightUnit ?? unit,
                            },
                          })
                      : undefined
                  }
                  weightColumn={
                    info?.equipment === 'dumbbell'
                      ? t(dumbbellMode === 'single' ? 'workout.colPerHand' : 'workout.colPair')
                      : undefined
                  }
                >
                  {we.sets.map((s) => {
                    const label =
                      s.kind === 'warmup'
                        ? t('workout.warmupLabel')
                        : s.kind === 'drop'
                          ? t('workout.dropLabel')
                          : s.kind === 'failure'
                            ? t('workout.failureLabel')
                            : String(++workingNo);
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
                        navId={s.id}
                        rpe={advanced ? s.rpe : null}
                        onLabelPress={
                          advanced
                            ? () => setSetMenu({ id: s.id, kind: s.kind, rpe: s.rpe })
                            : undefined
                        }
                      />
                    );
                  })}
                </ActiveExerciseCard>
              );
            })}
          </FieldNavProvider>
          <Pressable
            accessibilityRole="button"
            onPress={addExercises}
            style={({ pressed }) => [styles.addExercise, pressed && styles.pressed]}
          >
            <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
            <Text style={styles.addExerciseText}>{t('workout.addExercise')}</Text>
          </Pressable>
        </ScrollView>

        {keyboardVisible && fieldNav.current ? (
          <KeyboardBar
            label={fieldNav.current.label}
            onNext={fieldNav.next}
            onDone={fieldNav.done}
          />
        ) : (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
            <RestTimerBar />
            <Button label={t('workout.finish')} onPress={finish} />
          </View>
        )}
      </KeyboardAvoidingView>

      <WorkoutMenuSheet
        visible={menuOpen}
        title={t('workout.menu.title')}
        cancelLabel={t('workout.menu.cancel')}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: t('workout.menu.addExercise'), icon: Plus, onPress: addExercises },
          ...(exercises.length > 0
            ? [
                {
                  label: t('workout.menu.editExercises'),
                  icon: Equal,
                  onPress: () => enterEdit(null),
                },
              ]
            : []),
          ...(active
            ? [
                {
                  label: t('workout.menu.replace', {
                    name: lang === 'ko' ? objectJosa(activeName) : activeName,
                  }),
                  icon: ArrowLeftRight,
                  onPress: replaceActive,
                },
              ]
            : []),
          {
            label: t('workout.menu.discard'),
            icon: Trash2,
            onPress: discard,
            destructive: true,
          },
        ]}
      />

      <RestSheet
        visible={restFor !== null && restTarget !== undefined}
        name={restTarget ? nameOf(restTarget) : ''}
        value={restTarget?.restSec ?? 0}
        routineName={routineName}
        formatDuration={formatDuration}
        onClose={() => setRestFor(null)}
        onSave={(restSec, saveToRoutine) => {
          if (restTarget) setWorkoutExerciseRest(db, restTarget.id, restSec, saveToRoutine);
        }}
      />
      {dialogs}

      <ActionSheet
        visible={setMenu !== null}
        title={t('workout.setMenu.title')}
        cancelLabel={t('workout.menu.cancel')}
        onClose={() => setSetMenu(null)}
        actions={[
          ...SET_KINDS.map((kind) => ({
            label: t(`workout.setMenu.kind.${kind}`),
            selected: setMenu?.kind === kind,
            onPress: () => {
              if (setMenu) updateSet(db, setMenu.id, { kind });
            },
          })),
          {
            label: t('workout.setMenu.rpe'),
            onPress: () => {
              const target = setMenu ? { id: setMenu.id, rpe: setMenu.rpe } : null;
              // 앞 시트가 닫힌 뒤에 연다(모달 두 개가 겹치면 안드로이드에서 안 뜬다)
              setTimeout(() => setRpeFor(target), 250);
            },
          },
        ]}
      />

      <ActionSheet
        visible={rpeFor !== null}
        title={t('workout.setMenu.rpeTitle')}
        cancelLabel={t('workout.menu.cancel')}
        onClose={() => setRpeFor(null)}
        actions={[
          ...RPE_VALUES.map((v) => ({
            label: String(v),
            selected: rpeFor?.rpe === v,
            onPress: () => {
              if (rpeFor) updateSet(db, rpeFor.id, { rpe: v });
            },
          })),
          {
            label: t('workout.setMenu.rpeClear'),
            onPress: () => {
              if (rpeFor) updateSet(db, rpeFor.id, { rpe: null });
            },
          },
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
  headerSpacer: { width: 44 },
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
  editContent: { gap: 10, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 12 },
  editHint: {
    paddingHorizontal: 6,
    paddingBottom: 4,
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  addExercise: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
  },
  addExerciseText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  pressed: { opacity: 0.7 },
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
