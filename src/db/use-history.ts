import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { buildHistory, groupByMonth } from '@/domain/history';
import type { SummarySet } from '@/domain/session-summary';

import { db } from './client';
import { completedWorkoutsQuery } from './history';
import * as schema from './schema';

/** 히스토리 목록(월별). 운동을 끝내거나 고치면 자동으로 다시 계산된다. */
export function useHistory(unit: schema.WeightUnit) {
  const { data: workouts, updatedAt } = useLiveQuery(completedWorkoutsQuery(db));
  const { data: rows } = useLiveQuery(
    db
      .select({
        workoutId: schema.workoutExercises.workoutId,
        exerciseId: schema.workoutExercises.exerciseId,
        kind: schema.sets.kind,
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
      .where(
        and(
          eq(schema.workouts.status, 'completed'),
          isNull(schema.workouts.deletedAt),
          isNull(schema.workoutExercises.deletedAt),
          isNull(schema.sets.deletedAt),
          isNotNull(schema.sets.completedAt),
        ),
      ),
  );
  const months = useMemo(() => {
    const byWorkout = new Map<string, SummarySet[]>();
    for (const r of rows) {
      const set: SummarySet = { ...r, completed: true };
      const list = byWorkout.get(r.workoutId);
      if (list) list.push(set);
      else byWorkout.set(r.workoutId, [set]);
    }
    return groupByMonth(buildHistory(workouts, byWorkout, unit));
  }, [workouts, rows, unit]);
  return { months, ready: updatedAt !== undefined };
}
