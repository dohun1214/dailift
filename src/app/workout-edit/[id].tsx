import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Screen, TextButton, TopBar } from '@/components/ui';
import { ActiveExerciseCard, SetRow } from '@/components/workout';
import { db } from '@/db/client';
import { addRecordedSet, cleanupRecordedWorkout, deleteWorkout } from '@/db/history';
import * as schema from '@/db/schema';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useWorkoutExercises } from '@/db/use-workout';
import { addExercisesToWorkout, deleteSet, setCompleted, updateSet } from '@/db/workout';
import { useAppLanguage } from '@/i18n/use-app-language';
import { removePhotoFile } from '@/lib/photos';
import { openExercisePicker } from '@/stores/exercise-picker';
import { useSettings, workoutDefaults } from '@/stores/settings';

/**
 * 지난 운동 기록 수정. 바꾸는 즉시 저장되고, 나갈 때 완료 해제된 세트·빈 종목을 정리한다.
 * 세트가 하나도 남지 않으면 기록을 지울지 묻는다.
 */
export default function WorkoutEditScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const lang = useAppLanguage();
  const unit = useSettings((s) => s.weightUnit);
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = id ?? '';
  const catalog = useExerciseCatalog(lang);
  const exercises = useWorkoutExercises(workoutId);
  const [leaving, setLeaving] = useState(false);
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

  // 나갈 때 정리. 완료 세트가 없으면 지울지 먼저 묻는다.
  usePreventRemove(!leaving && !!workout && doneCount === 0, ({ data }) => {
    Alert.alert(t('history.edit.emptyTitle'), t('history.edit.emptyBody'), [
      { text: t('history.edit.keep'), style: 'cancel' },
      {
        text: t('history.edit.delete'),
        style: 'destructive',
        onPress: () => {
          for (const path of deleteWorkout(db, workoutId)) removePhotoFile(path);
          setLeaving(true);
          navigation.dispatch(data.action);
        },
      },
    ]);
  });

  // 어떤 방법으로 나가든(완료·닫기·뒤로) 떠날 때 정리한다.
  useEffect(() => () => void cleanupRecordedWorkout(db, workoutId), [workoutId]);

  const finish = () => router.back();

  const addExercises = () =>
    openExercisePicker((ids) => {
      addExercisesToWorkout(db, workoutId, ids, unit, undefined, workoutDefaults());
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
          else setCompleted(db, s.id, true, completedAt);
        }
      }
    });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        header={
          <TopBar
            title={t('history.edit.title')}
            leading="close"
            onLeadingPress={finish}
            trailing={<TextButton label={t('history.edit.done')} onPress={finish} />}
          />
        }
      >
        {workout ? <Text style={styles.name}>{workout.name}</Text> : null}
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
                  onToggle={() => setCompleted(db, s.id, s.completedAt === null, completedAt)}
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
        <View style={styles.bottom} />
      </Screen>
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
