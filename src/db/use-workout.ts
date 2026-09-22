import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from './client';
import * as schema from './schema';

/**
 * 진행 중인 운동 (없으면 undefined). ready는 첫 조회가 끝났는지 —
 * 첫 렌더에는 data가 비어 있어서 "운동 없음"과 구분해야 한다.
 */
export function useActiveWorkout() {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(schema.workouts)
      .where(and(eq(schema.workouts.status, 'in_progress'), isNull(schema.workouts.deletedAt)))
      .orderBy(desc(schema.workouts.startedAt))
      .limit(1),
  );
  return { workout: data[0], ready: updatedAt !== undefined };
}

export type WorkoutSet = typeof schema.sets.$inferSelect;
export type WorkoutExerciseWithSets = typeof schema.workoutExercises.$inferSelect & {
  sets: WorkoutSet[];
};

/** 운동 하나의 종목과 세트 (순서대로). 세트를 바꾸면 자동으로 갱신된다. */
export function useWorkoutExercises(workoutId: string | undefined): WorkoutExerciseWithSets[] {
  const id = workoutId ?? '';
  const { data: exercises } = useLiveQuery(
    db
      .select()
      .from(schema.workoutExercises)
      .where(
        and(eq(schema.workoutExercises.workoutId, id), isNull(schema.workoutExercises.deletedAt)),
      )
      .orderBy(asc(schema.workoutExercises.position)),
    [id],
  );
  const { data: sets } = useLiveQuery(
    db
      .select({ set: schema.sets })
      .from(schema.sets)
      .innerJoin(
        schema.workoutExercises,
        eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
      )
      .where(and(eq(schema.workoutExercises.workoutId, id), isNull(schema.sets.deletedAt)))
      .orderBy(asc(schema.sets.position)),
    [id],
  );
  return useMemo(() => {
    const byExercise = new Map<string, WorkoutSet[]>();
    for (const { set } of sets) {
      const list = byExercise.get(set.workoutExerciseId);
      if (list) list.push(set);
      else byExercise.set(set.workoutExerciseId, [set]);
    }
    return exercises.map((e) => ({ ...e, sets: byExercise.get(e.id) ?? [] }));
  }, [exercises, sets]);
}
