import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import type { SummarySet } from '@/domain/session-summary';
import type { Best } from '@/domain/strength';
import { newId } from '@/lib/id';

import * as schema from './schema';
import type { AppDatabase } from './seed';
import { exerciseBests } from './workout';

export type SummaryData = {
  workout: typeof schema.workouts.$inferSelect;
  /** 종목 순서대로 */
  exerciseIds: string[];
  sets: SummarySet[];
  musclesOf: Map<string, { muscleId: string; role: schema.MuscleRole }[]>;
  /** 이 운동 전까지의 최고 기록 */
  bests: Map<string, Best>;
};

/** 세션 요약에 필요한 것을 한 번에 읽는다. 없거나 지워졌으면 null */
export function loadSummary(db: AppDatabase, workoutId: string): SummaryData | null {
  const workout = db
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.id, workoutId), isNull(schema.workouts.deletedAt)))
    .get();
  if (!workout) return null;

  const rows = db
    .select({
      exerciseId: schema.workoutExercises.exerciseId,
      position: schema.workoutExercises.position,
      kind: schema.sets.kind,
      weight: schema.sets.weight,
      reps: schema.sets.reps,
      unit: schema.sets.weightUnit,
      setPosition: schema.sets.position,
    })
    .from(schema.sets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
    )
    .where(
      and(
        eq(schema.workoutExercises.workoutId, workoutId),
        isNull(schema.workoutExercises.deletedAt),
        isNull(schema.sets.deletedAt),
        isNotNull(schema.sets.completedAt),
      ),
    )
    .all()
    .sort((a, b) => a.position - b.position || a.setPosition - b.setPosition);

  const exerciseIds = [...new Set(rows.map((r) => r.exerciseId))];
  const muscles =
    exerciseIds.length === 0
      ? []
      : db
          .select({
            exerciseId: schema.exerciseMuscles.exerciseId,
            muscleId: schema.exerciseMuscles.muscleId,
            role: schema.exerciseMuscles.role,
          })
          .from(schema.exerciseMuscles)
          .where(inArray(schema.exerciseMuscles.exerciseId, exerciseIds))
          .all();
  const musclesOf = new Map<string, { muscleId: string; role: schema.MuscleRole }[]>();
  for (const m of muscles) {
    const list = musclesOf.get(m.exerciseId);
    if (list) list.push(m);
    else musclesOf.set(m.exerciseId, [m]);
  }

  return {
    workout,
    exerciseIds,
    sets: rows.map((r) => ({
      exerciseId: r.exerciseId,
      kind: r.kind,
      weight: r.weight,
      reps: r.reps,
      unit: r.unit,
      completed: true,
    })),
    musclesOf,
    bests: exerciseBests(db, exerciseIds, workoutId, workout.startedAt),
  };
}

export function setWorkoutNote(db: AppDatabase, workoutId: string, note: string) {
  db.update(schema.workouts)
    .set({ note: note.trim() ? note : null, dirty: 1 })
    .where(eq(schema.workouts.id, workoutId))
    .run();
}

export function addWorkoutPhoto(
  db: AppDatabase,
  workoutId: string,
  path: string,
  makeId = newId,
): string {
  const id = makeId();
  db.insert(schema.workoutPhotos).values({ id, workoutId, path }).run();
  return id;
}

export function deleteWorkoutPhoto(db: AppDatabase, photoId: string) {
  db.update(schema.workoutPhotos)
    .set({ deletedAt: Date.now(), dirty: 1 })
    .where(eq(schema.workoutPhotos.id, photoId))
    .run();
}
