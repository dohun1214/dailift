import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Check, Clock, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, ConfirmDialog, Screen, TextButton, TopBar } from '@/components/ui';
import { ActiveExerciseCard, SetRow } from '@/components/workout';
import { db } from '@/db/client';
import { addRecordedSet, cleanupRecordedWorkout, deleteWorkout } from '@/db/history';
import * as schema from '@/db/schema';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useWorkoutExercises } from '@/db/use-workout';
import {
  addExercisesToWorkout,
  completeSet,
  deleteSet,
  setCompleted,
  setWorkoutMinutes,
  updateSet,
} from '@/db/workout';
import { useAppLanguage } from '@/i18n/use-app-language';
import { clearPendingAdd, markPendingAdd } from '@/lib/pending-add';
import { removePhotoFile } from '@/lib/photos';
import { openExercisePicker } from '@/stores/exercise-picker';
import { useSettings, workoutDefaults } from '@/stores/settings';

/** 나가려 할 때 띄우는 확인 창 */
type Ask =
  /** 수정: 체크 안 한 세트가 있다(나가면 그 세트는 저장되지 않는다) */
  | 'unchecked'
  /** 수정: 체크한 세트가 하나도 없다(기록을 지울지) */
  | 'empty'
  /** 추가: 체크 없이 저장을 눌렀다 */
  | 'none'
  /** 추가: 체크한 세트가 있는데 닫으려 한다 */
  | 'discard';

/**
 * 지난 운동 기록 수정. 바꾸는 즉시 저장되고, 나갈 때 완료 해제된 세트·빈 종목을 정리한다.
 * 닫기(X)는 없고 '완료'로 나간다. 체크 안 한 세트가 있으면 저장되지 않는다고 알리고,
 * 세트가 하나도 남지 않으면 기록을 지울지 묻는다.
 * `added=1`로 열면 지난 날에 새로 추가하는 기록이다: 운동 시간을 적을 수 있고,
 * '기록 저장'을 눌러야 남는다. 닫기(X)·뒤로 가기는 저장하지 않고 나가는 것이다.
 */
export default function WorkoutEditScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const lang = useAppLanguage();
  const unit = useSettings((s) => s.weightUnit);
  const { id, added } = useLocalSearchParams<{ id: string; added?: string }>();
  const isNew = added === '1';
  const workoutId = id ?? '';
  const catalog = useExerciseCatalog(lang);
  const exercises = useWorkoutExercises(workoutId);
  const [leaving, setLeaving] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  // 확인 창에서 고른 뒤에 이어서 할 이동(뒤로 가기 등)
  const pending = useRef<(() => void) | null>(null);
  // '기록 저장'으로 나가는 중이면 묻지 않는다
  const saving = useRef(false);
  const [minutesText, setMinutesText] = useState<string | null>(null);
  const { data: rows } = useLiveQuery(
    db
      .select()
      .from(schema.workouts)
      .where(and(eq(schema.workouts.id, workoutId), isNull(schema.workouts.deletedAt))),
    [workoutId],
  );
  const workout = rows[0];
  const completedAt = workout?.endedAt ?? workout?.startedAt ?? Date.now();
  const doneCount = exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completedAt !== null).length,
    0,
  );

  const undoneCount = exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completedAt === null).length,
    0,
  );

  const remove = () => {
    for (const path of deleteWorkout(db, workoutId)) removePhotoFile(path);
  };
  /** 확인 창을 닫고, 막아 둔 이동을 이어서 한다 */
  const proceed = () => {
    setAsk(null);
    setLeaving(true);
    const go = pending.current ?? (() => router.back());
    pending.current = null;
    saving.current = true;
    go();
  };

  // 나가려 할 때: 저장되지 않는 것이 있으면 먼저 알린다.
  const mustAsk = isNew ? true : doneCount === 0 || undoneCount > 0;
  usePreventRemove(!leaving && !!workout && mustAsk, ({ data }) => {
    const go = () => navigation.dispatch(data.action);
    if (saving.current) {
      go();
      return;
    }
    if (isNew && doneCount === 0) {
      // 아무것도 체크하지 않고 닫으면 추가하지 않은 것이다.
      remove();
      setLeaving(true);
      go();
      return;
    }
    pending.current = go;
    setAsk(isNew ? 'discard' : doneCount === 0 ? 'empty' : 'unchecked');
  });

  // 어떤 방법으로 나가든(완료·닫기·뒤로) 떠날 때 정리한다.
  useEffect(() => () => void cleanupRecordedWorkout(db, workoutId), [workoutId]);

  // 추가하던 중에 앱이 꺼지면 다음에 켤 때 정리할 수 있게 적어 둔다.
  useEffect(() => {
    if (!isNew) return;
    markPendingAdd(workoutId);
    return () => clearPendingAdd();
  }, [isNew, workoutId]);

  // 추가 화면의 '모든 세트 체크': 한 번에 다 체크해 두고 안 한 세트만 푼다. 다 체크돼 있으면 모두 푼다.
  const totalSets = doneCount + undoneCount;
  const allChecked = totalSets > 0 && undoneCount === 0;
  const toggleAll = () => {
    for (const we of exercises) {
      const type = catalog.byId.get(we.exerciseId)?.type ?? 'weight_reps';
      for (const s of we.sets) {
        if (allChecked) setCompleted(db, s.id, false);
        else if (s.completedAt === null) completeSet(db, s.id, type, completedAt);
      }
    }
  };

  const finish = () => router.back();
  /** 기록 저장(추가): 체크한 세트가 있어야 저장된다 */
  const save = () => {
    if (doneCount === 0) {
      pending.current = null;
      setAsk('none');
      return;
    }
    saving.current = true;
    router.back();
  };

  const addExercises = () =>
    openExercisePicker((ids) => {
      // 그날 전에 한 마지막 기록 값으로 채운다(그 뒤에 늘린 무게나 증량 제안을 쓰지 않는다).
      addExercisesToWorkout(db, workoutId, ids, unit, undefined, {
        ...workoutDefaults(),
        recordedBefore: workout?.startedAt,
      });
      // 지난 기록이라 새 세트도 바로 완료 상태로 둔다(프리필 값 그대로).
      for (const we of db
        .select()
        .from(schema.workoutExercises)
        .where(
          and(
            eq(schema.workoutExercises.workoutId, workoutId),
            isNull(schema.workoutExercises.deletedAt),
          ),
        )
        .all()) {
        if (!ids.includes(we.exerciseId)) continue;
        for (const s of db
          .select()
          .from(schema.sets)
          .where(
            and(
              eq(schema.sets.workoutExerciseId, we.id),
              isNull(schema.sets.deletedAt),
              isNull(schema.sets.completedAt),
            ),
          )
          .all()) {
          if (s.kind === 'warmup') deleteSet(db, s.id);
          // 채울 값이 없는(그날 전 기록이 없는) 세트는 체크하지 않고 둔다.
          else if (s.reps !== null || s.durationSec !== null)
            setCompleted(db, s.id, true, completedAt);
        }
      }
    });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        revealInputs
        header={
          <TopBar
            title={t(isNew ? 'history.edit.addTitle' : 'history.edit.title')}
            leading={isNew ? 'close' : 'none'}
            onLeadingPress={finish}
            trailing={
              isNew ? undefined : <TextButton label={t('history.edit.done')} onPress={finish} />
            }
          />
        }
      >
        {workout ? (
          <Text style={styles.name}>
            {isNew
              ? t('history.edit.addSub', {
                  date: new Date(workout.startedAt).toLocaleDateString(
                    lang === 'ko' ? 'ko-KR' : 'en-US',
                    { month: 'long', day: 'numeric', weekday: 'long' },
                  ),
                  name: workout.name,
                })
              : workout.name}
          </Text>
        ) : null}
        {isNew && workout ? (
          <View style={styles.duration}>
            <Clock size={18} color={theme.colors.text2} strokeWidth={1.8} />
            <Text style={styles.durationLabel}>{t('history.edit.duration')}</Text>
            <TextInput
              accessibilityLabel={t('history.edit.duration')}
              value={
                minutesText ??
                String(
                  Math.round(((workout.endedAt ?? workout.startedAt) - workout.startedAt) / 60_000),
                )
              }
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
                setMinutesText(digits);
                if (digits !== '') setWorkoutMinutes(db, workoutId, Number(digits));
              }}
              onBlur={() => setMinutesText(null)}
              keyboardType="number-pad"
              selectTextOnFocus
              maxLength={3}
              style={styles.durationInput}
            />
            <Text style={styles.durationUnit}>{t('history.edit.minutes')}</Text>
          </View>
        ) : null}
        {isNew && exercises.length > 0 && workout?.routineId ? (
          <Text style={styles.hint}>{t('history.edit.addHint')}</Text>
        ) : null}
        {isNew && totalSets > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={toggleAll}
            style={({ pressed }) => [styles.checkAll, pressed && styles.pressed]}
          >
            <Check size={16} color={theme.colors.text} strokeWidth={2.4} />
            <Text style={styles.addText}>
              {t(allChecked ? 'history.edit.uncheckAll' : 'history.edit.checkAll')}
            </Text>
          </Pressable>
        ) : null}
        {exercises.map((we, index) => {
          const info = catalog.byId.get(we.exerciseId);
          const type = info?.type ?? 'weight_reps';
          const group = info?.primaryGroups[0];
          let n = 0;
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
              suggestion={null}
              onAddSet={() => addRecordedSet(db, we.id, unit, completedAt)}
            >
              {we.sets.map((s) => (
                <SetRow
                  key={s.id}
                  label={s.kind === 'warmup' ? t('workout.warmupLabel') : String(++n)}
                  kind={s.kind}
                  type={type}
                  value={{ weight: s.weight, reps: s.reps, durationSec: s.durationSec }}
                  unit={s.weightUnit}
                  completed={s.completedAt !== null}
                  pr={false}
                  onChange={(patch) => updateSet(db, s.id, patch)}
                  onToggle={() =>
                    s.completedAt === null
                      ? completeSet(db, s.id, type, completedAt)
                      : setCompleted(db, s.id, false)
                  }
                  onDelete={() => deleteSet(db, s.id)}
                />
              ))}
            </ActiveExerciseCard>
          );
        })}
        <Pressable accessibilityRole="button" onPress={addExercises} style={styles.add}>
          <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
          <Text style={styles.addText}>{t('history.edit.addExercise')}</Text>
        </Pressable>
        {isNew ? <Button label={t('history.edit.saveButton')} onPress={save} /> : null}
        <View style={styles.bottom} />
      </Screen>
      <ConfirmDialog
        visible={ask === 'unchecked'}
        title={t('history.edit.uncheckedTitle')}
        body={t('history.edit.uncheckedBody', { count: undoneCount })}
        cancelLabel={t('history.edit.keep')}
        confirmLabel={t('history.edit.done')}
        onCancel={() => setAsk(null)}
        onConfirm={proceed}
      />
      <ConfirmDialog
        visible={ask === 'empty'}
        title={t('history.edit.emptyTitle')}
        body={t('history.edit.emptyBody')}
        cancelLabel={t('history.edit.keep')}
        confirmLabel={t('history.edit.delete')}
        destructive
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          remove();
          proceed();
        }}
      />
      <ConfirmDialog
        visible={ask === 'none'}
        title={t('history.edit.noneTitle')}
        body={t('history.edit.noneBody')}
        cancelLabel={t('history.edit.leave')}
        confirmLabel={t('history.edit.keepAdding')}
        onCancel={() => {
          remove();
          proceed();
        }}
        onConfirm={() => setAsk(null)}
        onDismiss={() => setAsk(null)}
      />
      <ConfirmDialog
        visible={ask === 'discard'}
        title={t('history.edit.discardTitle')}
        body={t('history.edit.discardBody', { count: doneCount })}
        cancelLabel={t('history.edit.keepAdding')}
        confirmLabel={t('history.edit.leave')}
        destructive
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          remove();
          proceed();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  name: {
    paddingHorizontal: 4,
    paddingTop: 4,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  durationLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  durationInput: {
    minWidth: 64,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
    backgroundColor: theme.colors.surface2,
  },
  durationUnit: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  hint: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  pressed: { opacity: 0.7 },
  checkAll: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  add: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  addText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  bottom: { height: 8 },
}));
