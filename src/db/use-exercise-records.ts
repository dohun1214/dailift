import { and, asc, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import type { ProgressSet } from '@/domain/exercise-progress';

import { db } from './client';
import * as schema from './schema';

/** 종목 목록용: 완료한 운동의 완료 본세트 전체(시간 포함, 세트 순서대로). 기록이 바뀌면 갱신된다. */
export function useExerciseRecords() {
  const { data, updatedAt } = useLiveQuery(
    db
      .select({
        workoutId: schema.workouts.id,
        startedAt: schema.workouts.startedAt,
        exerciseId: schema.workoutExercises.exerciseId,
        weight: schema.sets.weight,
        reps: schema.sets.reps,
        durationSec: schema.sets.durationSec,
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
          ne(schema.sets.kind, 'warmup'),
        ),
      )
      .orderBy(
        asc(schema.workouts.startedAt),
        asc(schema.workoutExercises.position),
        asc(schema.sets.position),
      ),
  );
  return {
    sets: data as (ProgressSet & { exerciseId: string })[],
    ready: updatedAt !== undefined,
  };
}
