import { and, asc, eq, isNotNull, isNull, ne } from 'drizzle-orm';

import type { ExportSetRow } from '@/domain/export';
import type { AppLanguage } from '@/i18n/resolve-language';

import { exerciseName } from './names';
import type { SYNCED_TABLES } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

/** 완료한 운동의 완료한 세트를 시간순으로 (워밍업 포함, 세트 번호는 종목 안 순서) */
export function exportSetRows(db: AppDatabase, lang: AppLanguage): ExportSetRow[] {
  const rows = db
    .select({
      workoutId: schema.workouts.id,
      startedAt: schema.workouts.startedAt,
      workoutName: schema.workouts.name,
      weId: schema.workoutExercises.id,
      wePosition: schema.workoutExercises.position,
      isCustom: schema.exercises.isCustom,
      name: schema.exercises.name,
      nameKo: schema.exercises.nameKo,
      nameEn: schema.exercises.nameEn,
      kind: schema.sets.kind,
      weight: schema.sets.weight,
      unit: schema.sets.weightUnit,
      reps: schema.sets.reps,
      durationSec: schema.sets.durationSec,
      rpe: schema.sets.rpe,
    })
    .from(schema.sets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
    )
    .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutExercises.workoutId))
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.workoutExercises.exerciseId))
    .where(
      and(
        eq(schema.workouts.status, 'completed'),
        isNull(schema.workouts.deletedAt),
        isNull(schema.workoutExercises.deletedAt),
        isNull(schema.sets.deletedAt),
        isNotNull(schema.sets.completedAt),
      ),
    )
    .orderBy(
      asc(schema.workouts.startedAt),
      asc(schema.workoutExercises.position),
      asc(schema.sets.position),
    )
    .all();

  const counters = new Map<string, number>();
  return rows.map((r) => {
    const n = (counters.get(r.weId) ?? 0) + 1;
    counters.set(r.weId, n);
    return {
      startedAt: r.startedAt,
      workoutName: r.workoutName,
      exercise: exerciseName(r, lang),
      setNumber: n,
      kind: r.kind,
      weight: r.weight,
      unit: r.unit,
      reps: r.reps,
      durationSec: r.durationSec,
      rpe: r.rpe,
    };
  });
}

const TABLES = {
  exercises: schema.exercises,
  exercise_muscles: schema.exerciseMuscles,
  routine_groups: schema.routineGroups,
  routines: schema.routines,
  routine_exercises: schema.routineExercises,
  workouts: schema.workouts,
  workout_exercises: schema.workoutExercises,
  sets: schema.sets,
  workout_photos: schema.workoutPhotos,
  body_metrics: schema.bodyMetrics,
} as const satisfies Record<(typeof SYNCED_TABLES)[number], unknown>;

/** 전체 백업: 지우지 않은 사용자 행 전부(기본 종목 제외, 기기 전용 표시 컬럼 제외) */
export function exportAllTables(db: AppDatabase): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  out.exercises = db
    .select()
    .from(schema.exercises)
    .where(and(eq(schema.exercises.isCustom, 1), isNull(schema.exercises.deletedAt)))
    .all();
  const customIds = new Set(out.exercises.map((e) => e.id as string));
  out.exercise_muscles = db
    .select()
    .from(schema.exerciseMuscles)
    .where(isNull(schema.exerciseMuscles.deletedAt))
    .all()
    .filter((m) => customIds.has(m.exerciseId));
  out.routine_groups = db
    .select()
    .from(TABLES.routine_groups)
    .where(isNull(TABLES.routine_groups.deletedAt))
    .all();
  out.routines = db.select().from(TABLES.routines).where(isNull(TABLES.routines.deletedAt)).all();
  out.routine_exercises = db
    .select()
    .from(TABLES.routine_exercises)
    .where(isNull(TABLES.routine_exercises.deletedAt))
    .all();
  out.workouts = db
    .select()
    .from(TABLES.workouts)
    .where(and(isNull(TABLES.workouts.deletedAt), ne(TABLES.workouts.status, 'discarded')))
    .all();
  out.workout_exercises = db
    .select()
    .from(TABLES.workout_exercises)
    .where(isNull(TABLES.workout_exercises.deletedAt))
    .all();
  out.sets = db.select().from(TABLES.sets).where(isNull(TABLES.sets.deletedAt)).all();
  out.workout_photos = db
    .select()
    .from(TABLES.workout_photos)
    .where(isNull(TABLES.workout_photos.deletedAt))
    .all();
  out.body_metrics = db
    .select()
    .from(TABLES.body_metrics)
    .where(isNull(TABLES.body_metrics.deletedAt))
    .all();
  for (const rows of Object.values(out)) {
    for (const r of rows) {
      delete r.dirty;
      delete r.uploadedAt;
      delete r.deletedAt;
    }
  }
  return out;
}
