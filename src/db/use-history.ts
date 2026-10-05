import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { buildHistory, groupByMonth } from '@/domain/history';
import type { SummarySet } from '@/domain/session-summary';

import { db } from './client';
import { completedWorkoutsQuery } from './history';
import * as schema from './schema';
import { useTableRev } from './use-table-rev';

/** 히스토리 목록(월별). 운동을 끝내거나 고치면 자동으로 다시 계산된다. */
export function useHistory(unit: schema.WeightUnit) {
  const { data: workouts, updatedAt } = useLiveQuery(completedWorkoutsQuery(db));
  // 운동을 마치면 workouts만 바뀐다(sets는 그대로) → 세트 목록도 그때 다시 읽는다.
  const rev = useTableRev(schema.workouts, schema.workoutExercises);
  const { data: rows } = useLiveQuery(
    db
      .select({
        workoutId: schema.workoutExercises.workoutId,
        exerciseId: schema.workoutExercises.exerciseId,
        kind: schema.sets.kind,
        weight: schema.sets.weight,
        reps: schema.sets.reps,
        unit: schema.sets.weightUnit,
        exercisePosition: schema.workoutExercises.position,
        setPosition: schema.sets.position,
      })
      .from(schema.sets)
      .innerJoin(
        schema.workoutExercises,
        eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
      )
      .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutExercises.workoutId))
      .where(
        and(
          eq(schema.workouts.status, 'completed'),
          isNull(schema.workouts.deletedAt),
          isNull(schema.workoutExercises.deletedAt),
          isNull(schema.sets.deletedAt),
          isNotNull(schema.sets.completedAt),
        ),
      ),
    [rev],
  );
  const months = useMemo(() => {
    const byWorkout = new Map<string, SummarySet[]>();
    // 운동 안에서 한 순서대로 (종목 순서 → 세트 순서)
    const ordered = [...rows].sort(
      (a, b) => a.exercisePosition - b.exercisePosition || a.setPosition - b.setPosition,
    );
    for (const r of ordered) {
      const set: SummarySet = {
        exerciseId: r.exerciseId,
        kind: r.kind,
        weight: r.weight,
        reps: r.reps,
        unit: r.unit,
        completed: true,
      };
      const list = byWorkout.get(r.workoutId);
      if (list) list.push(set);
      else byWorkout.set(r.workoutId, [set]);
    }
    return groupByMonth(buildHistory(workouts, byWorkout, unit));
  }, [workouts, rows, unit]);
  return { months, ready: updatedAt !== undefined };
}
