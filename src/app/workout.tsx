import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { ArrowLeftRight, ChevronDown, Ellipsis, Equal, Plus, Trash2, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  ActionSheet,
  Button,
  ConfirmDialog,
  IconButton,
  Snackbar,
  TextButton,
} from '@/components/ui';
import { SHEET_NEXT_MS } from '@/components/ui/use-sheet-motion';
import {
  ActiveExerciseCard,
  CollapsedExerciseCard,
  FieldNavProvider,
  KEYBOARD_BAR_HEIGHT,
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
import { pendingRoutineUpdate, routinePlans } from '@/db/routine-update';
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
  applyToRemainingSets,
  completeSet,
  deleteSet,
  deleteWorkoutExercise,
  discardWorkout,
  exerciseBests,
  finishWorkout,
  lastSessions,
  moveWorkoutExercise,
  replaceWorkoutExercise,
  restoreWorkoutExercise,
  routineHasExercise,
  setCompleted,
  setWorkoutExerciseRest,
  updateSet,
} from '@/db/workout';
import { formatClock, splitDuration } from '@/domain/rest-timer';
import { planAchieved, type SetPlan } from '@/domain/set-plan';
import {
  type Best,
  bestOf,
  convertWeight,
  isPersonalRecord,
  type Suggestion,
  suggestNext,
} from '@/domain/strength';
import {
  applyTargetIds,
  contiguousRange,
  type FillField,
  isStaleWorkout,
} from '@/domain/workout-session';
import { useAppLanguage } from '@/i18n/use-app-language';
import { object as objectJosa } from '@/lib/josa';
import { markRecoveryAsked } from '@/lib/recovery-flag';
import { useKeyboardReveal } from '@/lib/use-keyboard-reveal';
import { useNow } from '@/lib/use-now';
import { openExercisePicker } from '@/stores/exercise-picker';
import { useRestTimer } from '@/stores/rest-timer';
import { useRoutineUpdate } from '@/stores/routine-update';
import { useSettings, workoutDefaults } from '@/stores/settings';

const SET_KINDS: readonly SetKind[] = ['working', 'warmup', 'drop', 'failure'];
/** RPE 선택지: 6–10, 0.5 단위 */
const RPE_VALUES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];

/** 워밍업 세트 뒤 휴식은 짧게 */
const WARMUP_REST_SEC = 60;
/** 종목을 지운 뒤 '되돌리기'를 보여 주는 시간 */
const UNDO_MS = 5000;

const FIELD_OF: Record<string, FillField> = {
  weight: 'weight',
  reps: 'reps',
  time: 'durationSec',
};

/** 확인 창: 운동 버리기 / 기록 없이 완료(버리기 권유) / 남은 세트가 있는 완료 */
type Confirm = { kind: 'discard' } | { kind: 'empty' } | { kind: 'finish'; pending: number };

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function KeepScreenOn() {
  useKeepAwake('workout');
  return null;
}

/** 운동 중 화면. 탭 위에 뜨는 전체 화면이고, 접어도(아래 화살표) 운동은 계속된다. */
/**
 * iOS: 아래 버튼(운동 완료 등)을 키보드와 함께 올라가는 영역 밖에 두어 키보드가 그대로 덮게 한다.
 * 그 영역 안에 두면 키보드가 올라오기 시작할 때 버튼이 먼저 따라 올라오다가, 키보드 위 줄로 바뀌면서 사라지는 것이 보인다
 * (키보드 알림이 포커스 알림보다 먼저 와서 한 번에 바꿀 수 없다).
 * Android는 키보드가 다 올라온 뒤에 한 번에 바뀌므로 예전처럼 줄과 맞바꾼다.
 */
const FOOTER_UNDER_KEYBOARD = Platform.OS === 'ios';

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
  const [confirm, setConfirm] = useState<Confirm>({ kind: 'discard' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 방금 지운 종목 (되돌리기)
  const [undo, setUndo] = useState<{ id: string; name: string; deletedAt: number } | null>(null);
  // '남은 세트에도 적용'을 누른 칸과 그 안내 문장
  const [applied, setApplied] = useState<{ key: string; text: string } | null>(null);
  // ⋯를 누른 종목 카드
  const [exerciseMenu, setExerciseMenu] = useState<{ id: string; name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintSeen = useSettings((s) => s.editHintSeen);
  const markHintSeen = useSettings((s) => s.markEditHintSeen);

  const exerciseKey = exercises.map((e) => e.exerciseId).join(',');
  const workoutId = workout?.id;
  const routineId = workout?.routineId ?? null;

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
    const map = new Map<string, SuggestionData>();
    // 세트별로 정해 둔 종목은 증량 제안 대신, 지난번에 계획을 다 채웠을 때만 안내한다.
    const plans = routineId ? routinePlans(db, routineId) : new Map<string, SetPlan>();
    for (const we of exercises) {
      const history = lastSessions(db, we.exerciseId, 2).map((s) =>
        s.sets.map((x) => ({
          ...x,
          weight: x.weight === null ? null : convertWeight(x.weight, x.unit, unit),
        })),
      );
      const plan = plans.get(we.exerciseId);
      if (plan) {
        map.set(we.id, {
          suggestion: null,
          hasHistory: history.length > 0,
          plan: planAchieved(plan, history[0] ?? [], unit) ? 'achieved' : 'planned',
        });
        continue;
      }
      const increment = convertWeight(we.increment, we.incrementUnit, unit) || we.increment;
      map.set(we.id, {
        suggestion: suggestNext(history, { repMin: we.repMin, repMax: we.repMax, increment }),
        hasHistory: history.length > 0,
      });
    }
    return map;
  }, [exerciseKey, unit, routineId]);

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
  const fieldKey = fieldNav.current?.key;
  // 입력 중이면 키보드 위에 '다음 · 완료' 줄을 보인다.
  // Android는 키보드만 닫고 칸은 그대로일 수 있어서(뒤로 가기) 키보드가 보일 때만.
  const typing = fieldNav.current !== null && (Platform.OS === 'ios' || keyboardVisible);
  // 입력 중인 칸이 키보드 뒤에 있으면 보이는 곳까지 올린다. '다음'으로 칸을 옮길 때도.
  const scrollRef = useRef<ScrollView>(null);
  const { reveal } = useKeyboardReveal(scrollRef, true, KEYBOARD_BAR_HEIGHT);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 칸이 바뀔 때마다 본다
  useEffect(() => {
    if (!fieldKey || !keyboardVisible) return;
    const handle = setTimeout(() => reveal(), 120);
    return () => clearTimeout(handle);
  }, [fieldKey]);
  // 이 화면으로 바로 열렸으면(잠금 화면의 휴식 표시) 홈에서 '진행 중인 운동' 안내를 다시 하지 않는다.
  useEffect(markRecoveryAsked, []);
  // 끝내기 · 버리기가 두 번 실행되지 않게
  const ending = useRef(false);
  useEffect(() => {
    // 다른 칸으로 옮기면 적용 안내를 지운다
    setApplied((a) => (a && a.key !== fieldKey ? null : a));
  }, [fieldKey]);

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

  // 편집 모드를 나가면 되돌리기도 사라진다.
  useEffect(() => {
    if (isEditing) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
  }, [isEditing]);
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

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
    if (leftAll > 0) {
      const text = restMessage(we, set.id, next);
      startRest(
        set.kind === 'warmup' ? Math.min(WARMUP_REST_SEC, we.restSec) : we.restSec,
        text.message,
        text.label,
      );
    }
    if (leftHere === 0) {
      // 다 끝낸 종목은 접고, 남은 종목이 있으면 그걸 지금 종목으로
      if (next) setActiveId(next.id);
      setOpenIds((ids) => ids.filter((id) => id !== we.id && id !== next?.id));
    }
  };

  const nameOf = (we: WorkoutExerciseWithSets) => catalog.byId.get(we.exerciseId)?.name ?? '';

  /**
   * 다음에 할 세트 또는 종목을 알려 주는 문장.
   * message: 휴식이 끝났을 때 알림에, label: 쉬는 동안 잠금 화면·알림창에 보인다.
   */
  const restMessage = (
    we: WorkoutExerciseWithSets,
    doneSetId: string,
    nextExercise: WorkoutExerciseWithSets | undefined,
  ): { message: string | null; label: string | null } => {
    const upcoming = we.sets.find((s) => s.completedAt === null && s.id !== doneSetId);
    if (!upcoming) {
      if (!nextExercise) return { message: null, label: null };
      const name = nameOf(nextExercise);
      return {
        message: t('workout.rest.nextExercise', { name }),
        label: t('workout.rest.liveNextExercise', { name }),
      };
    }
    const name = nameOf(we);
    if (upcoming.kind === 'warmup') {
      return {
        message: t('workout.rest.nextWarmup', { name }),
        label: t('workout.rest.liveNextWarmup', { name }),
      };
    }
    if (upcoming.kind !== 'working') {
      return { message: null, label: t('workout.rest.liveNextExercise', { name }) };
    }
    const number = we.sets.filter((s) => s.kind === 'working').indexOf(upcoming) + 1;
    return {
      message: t('workout.rest.nextSet', { name, set: number }),
      label: t('workout.rest.liveNextSet', { name, set: number }),
    };
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
    markHintSeen();
    setEditing({ highlightId });
  };

  /** 종목을 지우고 잠깐 '되돌리기'를 띄운다. */
  const deleteExercise = (id: string, name: string) => {
    const deletedAt = deleteWorkoutExercise(db, id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id, name, deletedAt });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };
  const undoDelete = () => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    restoreWorkoutExercise(db, undo.id, undo.deletedAt);
    setUndo(null);
  };

  // 종목을 뺀 직후 잠깐 보이는 되돌리기 (편집 모드와 카드 메뉴 어디서 빼든 같다)
  const undoBar = undo ? (
    <Snackbar
      message={t('workout.edit.deleted', {
        name: lang === 'ko' ? objectJosa(undo.name) : undo.name,
      })}
      actionLabel={t('workout.edit.undo')}
      onAction={undoDelete}
    />
  ) : null;

  /** 기록한 세트가 있으면 한 번 확인하고, 없으면 바로 지운다. */
  const removeExercise = (id: string) => {
    const we = exercises.find((e) => e.id === id);
    if (!we) return;
    const done = we.sets.filter((s) => s.completedAt !== null).length;
    if (done > 0) setDeleteFor({ id, name: nameOf(we), done });
    else deleteExercise(id, nameOf(we));
  };

  /** 지금 입력 중인 칸: 세트 id · 칸 · 그 종목 */
  const fieldTarget = (key: string | undefined) => {
    if (!key) return null;
    const [setId, part] = key.split(':');
    const field = part ? FIELD_OF[part] : undefined;
    const we = exercises.find((e) => e.sets.some((x) => x.id === setId));
    return setId && field && we ? { setId, field, we } : null;
  };
  const target = keyboardVisible ? fieldTarget(fieldKey) : null;
  /** 아래 세트와 값이 다를 때만 '남은 세트에도 적용'을 보인다. */
  const canApply = target
    ? applyTargetIds(target.we.sets, target.setId, target.field).length > 0
    : false;
  const applyToRest = () => {
    if (!target || !fieldKey) return;
    const working = target.we.sets.filter((x) => x.kind === 'working');
    const ids = applyToRemainingSets(db, target.setId, target.field);
    if (ids.length === 0) return;
    const numbers = ids.map((id) => working.findIndex((x) => x.id === id) + 1);
    const range = contiguousRange(numbers);
    const text = !range
      ? t('workout.keyboard.appliedCount', { count: numbers.length })
      : range[0] === range[1]
        ? t('workout.keyboard.appliedOne', { set: range[0] })
        : t('workout.keyboard.appliedRange', { from: range[0], to: range[1] });
    setApplied({ key: fieldKey, text });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const addExercises = () =>
    openExercisePicker((ids) => {
      addExercisesToWorkout(db, currentWorkout.id, ids, unit, undefined, workoutDefaults());
    });

  /** 이 종목을 다른 종목으로 바꾼다(완료한 세트는 그대로 두고 남은 세트만 새 종목으로). */
  const replaceExercise = (id: string) => {
    openExercisePicker(
      (ids) => {
        const [first] = ids;
        if (!first) return;
        const next = replaceWorkoutExercise(db, id, first, unit);
        // 지금 종목이었거나 펼쳐 둔 카드였으면 새 종목도 그대로 펼쳐 둔다.
        if (active?.id === id) setActiveId(next);
        else setOpenIds((open) => (open.includes(id) ? [...open, next] : open));
      },
      { single: true },
    );
  };

  // 알림 · 잠금 화면에서 바로 열렸으면 돌아갈 화면이 없다 → 홈으로.
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const ask = (next: Confirm) => {
    setConfirm(next);
    setConfirmOpen(true);
  };
  const discardNow = () => {
    if (ending.current) return;
    ending.current = true;
    stopRest();
    setFinished(true);
    discardWorkout(db, currentWorkout.id);
    leave();
  };
  const complete = () => {
    if (ending.current) return;
    ending.current = true;
    // 마지막 세트를 마친 지 오래됐으면(끝내는 걸 잊었으면) 그 시각을 운동이 끝난 시각으로 친다.
    const last = Math.max(0, ...exercises.flatMap((e) => e.sets.map((x) => x.completedAt ?? 0)));
    const at = Date.now();
    stopRest();
    setFinished(true);
    // 루틴과 다르게 했는지는 끝내기 전에 본다(끝내면 안 한 세트 · 종목이 지워진다).
    useRoutineUpdate.getState().set(pendingRoutineUpdate(db, currentWorkout.id, unit));
    finishWorkout(db, currentWorkout.id, at, last > 0 && isStaleWorkout(last, at) ? last : at);
    router.replace({ pathname: '/workout-summary/[id]', params: { id: currentWorkout.id } });
  };
  const discard = () => ask({ kind: 'discard' });
  const finish = () => {
    const done = exercises.reduce(
      (n, e) => n + e.sets.filter((s) => s.completedAt !== null).length,
      0,
    );
    const pending = exercises.reduce((n, e) => n + pendingOf(e), 0);
    if (done === 0) ask({ kind: 'empty' });
    else if (pending === 0) complete();
    else ask({ kind: 'finish', pending });
  };

  const restTarget = exercises.find((e) => e.id === restFor);
  // 루틴에 없는 종목(운동 중에 추가한 종목)에는 '루틴에도 저장'을 보이지 않는다.
  const restInRoutine =
    !!restTarget &&
    !!currentWorkout.routineId &&
    routineHasExercise(db, currentWorkout.routineId, restTarget.exerciseId);
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
        if (deleteFor) deleteExercise(deleteFor.id, deleteFor.name);
        setDeleteFor(null);
      }}
    />
  );
  const confirmDialog = (
    <ConfirmDialog
      visible={confirmOpen}
      title={t(
        confirm.kind === 'finish'
          ? 'workout.finishConfirmTitle'
          : confirm.kind === 'empty'
            ? 'workout.emptyTitle'
            : 'workout.discardTitle',
      )}
      body={
        confirm.kind === 'finish'
          ? t('workout.finishPending', { count: confirm.pending })
          : t(confirm.kind === 'empty' ? 'workout.emptyBody' : 'workout.discardBody')
      }
      cancelLabel={t('workout.keepGoing')}
      confirmLabel={t(confirm.kind === 'finish' ? 'workout.finishConfirm' : 'workout.discard')}
      destructive={confirm.kind !== 'finish'}
      onCancel={() => setConfirmOpen(false)}
      onConfirm={() => {
        setConfirmOpen(false);
        if (confirm.kind === 'finish') complete();
        else discardNow();
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
          {undoBar}
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

  // 아래 버튼들. iOS에서는 입력 중에도 제자리에 그대로 둔다(키보드 뒤에 가려진다).
  // 숨기지 않는다 — 키보드가 덮기 전에 먼저 사라지는 것도 깜빡임으로 보인다.
  const footer = (
    <View
      style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}
      pointerEvents={typing ? 'none' : 'auto'}
    >
      {undoBar}
      <RestTimerBar />
      <Button label={t('workout.finish')} onPress={finish} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {keepAwake ? <KeepScreenOn /> : null}
      <View style={styles.header}>
        <IconButton icon={ChevronDown} label={t('workout.collapse')} onPress={leave} />
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
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollToOverflowEnabled
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
                    onMenuPress={() => setExerciseMenu({ id: we.id, name: info?.name ?? '' })}
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
                  onMenuPress={() => setExerciseMenu({ id: we.id, name: info?.name ?? '' })}
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
          {!hintSeen && exercises.length > 1 ? (
            <View style={styles.hint} accessibilityRole="text">
              <Text style={styles.hintText}>{t('workout.editHint')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('workout.editHintClose')}
                onPress={markHintSeen}
                style={({ pressed }) => [styles.hintClose, pressed && styles.pressed]}
              >
                <X size={18} color={theme.colors.text2} strokeWidth={1.8} />
              </Pressable>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={addExercises}
            style={({ pressed }) => [styles.addExercise, pressed && styles.pressed]}
          >
            <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
            <Text style={styles.addExerciseText}>{t('workout.addExercise')}</Text>
          </Pressable>
        </ScrollView>

        {typing && fieldNav.current ? (
          <KeyboardBar
            label={fieldNav.current.label}
            onApply={canApply ? applyToRest : undefined}
            applied={applied?.key === fieldNav.current.key ? applied.text : undefined}
            onNext={fieldNav.next}
            onDone={fieldNav.done}
          />
        ) : FOOTER_UNDER_KEYBOARD ? null : (
          footer
        )}
      </KeyboardAvoidingView>
      {FOOTER_UNDER_KEYBOARD ? footer : null}

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
          {
            label: t('workout.menu.discard'),
            icon: X,
            onPress: discard,
            destructive: true,
          },
        ]}
      />

      <WorkoutMenuSheet
        visible={exerciseMenu !== null}
        title={exerciseMenu?.name ?? ''}
        cancelLabel={t('workout.menu.cancel')}
        onClose={() => setExerciseMenu(null)}
        items={[
          {
            label: t('workout.menu.replaceThis'),
            icon: ArrowLeftRight,
            onPress: () => {
              if (exerciseMenu) replaceExercise(exerciseMenu.id);
            },
          },
          {
            label: t('workout.menu.removeThis'),
            icon: Trash2,
            onPress: () => {
              if (exerciseMenu) removeExercise(exerciseMenu.id);
            },
            destructive: true,
          },
        ]}
      />

      <RestSheet
        visible={restFor !== null && restTarget !== undefined}
        name={restTarget ? nameOf(restTarget) : ''}
        value={restTarget?.restSec ?? 0}
        routineName={restInRoutine ? routineName : null}
        formatDuration={formatDuration}
        onClose={() => setRestFor(null)}
        onSave={(restSec, saveToRoutine) => {
          if (restTarget) setWorkoutExerciseRest(db, restTarget.id, restSec, saveToRoutine);
        }}
      />
      {dialogs}
      {confirmDialog}

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
              setTimeout(() => setRpeFor(target), SHEET_NEXT_MS);
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

type SuggestionData = {
  suggestion: Suggestion | null;
  hasHistory: boolean;
  /** 세트별로 정해 둔 종목: 지난번에 계획을 다 채웠는지 */
  plan?: 'planned' | 'achieved';
};

function SuggestionLine({
  data,
  type,
  unit,
  we,
}: {
  data: SuggestionData | undefined;
  type: string;
  unit: string;
  we: WorkoutExerciseWithSets;
}): ReactNode {
  const { t } = useTranslation();
  if (data?.plan) {
    return data.plan === 'achieved' ? (
      <Text style={styles.suggest}>
        <Trans
          i18nKey="workout.suggest.planAchieved"
          components={{ b: <Text style={styles.suggestStrong} /> }}
        />
      </Text>
    ) : null;
  }
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
  hint: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 18,
    backgroundColor: theme.colors.accentSoft,
  },
  hintText: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text,
  },
  hintClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
