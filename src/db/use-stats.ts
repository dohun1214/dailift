import { and, eq, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import type { StatSet } from '@/domain/stats';

import { db } from './client';
import * as schema from './schema';
import { useTableRev } from './use-table-rev';

/**
 * 통계용 데이터: 완료한 운동의 완료 본세트 전체와 종목→부위 연결. 기록이 바뀌면 갱신된다.
 * 유산소는 세트 · 볼륨으로 세지 않으므로 뺀다.
 */
export function useStatsData() {
  // 운동을 마치면 workouts만 바뀐다(sets는 그대로) → 그때도 다시 읽는다.
  const rev = useTableRev(schema.workouts, schema.workoutExercises);
  const { data: rows, updatedAt } = useLiveQuery(
    db
      .select({
        workoutId: schema.workouts.id,
        startedAt: schema.workouts.startedAt,
        exerciseId: schema.workoutExercises.exerciseId,
        weight: schema.sets.weight,
        reps: schema.sets.reps,
        unit: schema.sets.weightUnit,
      })
      .from(schema.sets)
      .innerJoin(
        schema.workoutExercises,
        eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
      )
      .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutExercises.workoutId))
      .leftJoin(schema.exercises, eq(schema.exercises.id, schema.workoutExercises.exerciseId))
      .where(
        and(
          or(isNull(schema.exercises.type), ne(schema.exercises.type, 'cardio')),
          eq(schema.workouts.status, 'completed'),
          isNull(schema.workouts.deletedAt),
          isNull(schema.workoutExercises.deletedAt),
          isNull(schema.sets.deletedAt),
          isNotNull(schema.sets.completedAt),
          ne(schema.sets.kind, 'warmup'),
        ),
      ),
    [rev],
  );
  const { data: muscles } = useLiveQuery(
    db
      .select({
        exerciseId: schema.exerciseMuscles.exerciseId,
        group: schema.muscles.group,
        role: schema.exerciseMuscles.role,
      })
      .from(schema.exerciseMuscles)
      .innerJoin(schema.muscles, eq(schema.muscles.id, schema.exerciseMuscles.muscleId))
      .where(isNull(schema.exerciseMuscles.deletedAt)),
  );
  const musclesOf = useMemo(() => {
    const map = new Map<string, { group: schema.MuscleGroup; role: schema.MuscleRole }[]>();
    for (const m of muscles) {
      const list = map.get(m.exerciseId);
      if (list) list.push(m);
      else map.set(m.exerciseId, [m]);
    }
    return map;
  }, [muscles]);
  return { sets: rows as StatSet[], musclesOf, ready: updatedAt !== undefined };
}
