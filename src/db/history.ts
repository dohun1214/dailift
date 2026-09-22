import { and, asc, desc, eq, inArray, isNotNull, isNull, max } from 'drizzle-orm';

import { newId } from '@/lib/id';
import type { WeightUnit } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

/** 지난 운동 삭제: 운동·종목·세트·사진을 툼스톤 처리. 사진 경로를 돌려준다(파일 삭제용). */
export function deleteWorkout(db: AppDatabase, workoutId: string, now = Date.now()): string[] {
  let photoPaths: string[] = [];
  db.transaction((tx) => {
    const weIds = tx
      .select({ id: schema.workoutExercises.id })
      .from(schema.workoutExercises)
      .where(eq(schema.workoutExercises.workoutId, workoutId))
      .all()
      .map((r) => r.id);
    if (weIds.length > 0) {
      tx.update(schema.sets)
        .set({ deletedAt: now, dirty: 1 })
        .where(and(inArray(schema.sets.workoutExerciseId, weIds), isNull(schema.sets.deletedAt)))
        .run();
      tx.update(schema.workoutExercises)
        .set({ deletedAt: now, dirty: 1 })
        .where(
          and(
            inArray(schema.workoutExercises.id, weIds),
            isNull(schema.workoutExercises.deletedAt),
          ),
        )
        .run();
    }
    photoPaths = tx
      .select({ path: schema.workoutPhotos.path })
      .from(schema.workoutPhotos)
      .where(
        and(eq(schema.workoutPhotos.workoutId, workoutId), isNull(schema.workoutPhotos.deletedAt)),
      )
      .all()
      .map((r) => r.path);
    tx.update(schema.workoutPhotos)
      .set({ deletedAt: now, dirty: 1 })
      .where(
        and(eq(schema.workoutPhotos.workoutId, workoutId), isNull(schema.workoutPhotos.deletedAt)),
      )
      .run();
    tx.update(schema.workouts)
      .set({ deletedAt: now, dirty: 1 })
      .where(eq(schema.workouts.id, workoutId))
      .run();
  });
  return photoPaths;
}

/**
 * 지난 운동 수정에서 세트 추가: 마지막 본세트 값을 복사해 바로 완료 상태로 만든다
 * (지난 기록이라 완료 체크 단계가 없다).
 */
export function addRecordedSet(
  db: AppDatabase,
  workoutExerciseId: string,
  unit: WeightUnit,
  completedAt: number,
  makeId = newId,
): string {
  const id = makeId();
  db.transaction((tx) => {
    const list = tx
      .select()
      .from(schema.sets)
      .where(
        and(eq(schema.sets.workoutExerciseId, workoutExerciseId), isNull(schema.sets.deletedAt)),
      )
      .orderBy(asc(schema.sets.position))
      .all();
    const last = [...list].reverse().find((s) => s.kind !== 'warmup');
    const [pos] = tx
      .select({ value: max(schema.sets.position) })
      .from(schema.sets)
      .where(eq(schema.sets.workoutExerciseId, workoutExerciseId))
      .all();
    tx.insert(schema.sets)
      .values({
        id,
        workoutExerciseId,
        position: (pos?.value ?? -1) + 1,
        kind: 'working',
        weight: last?.weight ?? null,
        weightUnit: last?.weightUnit ?? unit,
        reps: last?.reps ?? null,
        durationSec: last?.durationSec ?? null,
        completedAt,
      })
      .run();
  });
  return id;
}

/**
 * 수정을 마칠 때 정리: 완료 해제된 세트와 세트가 없는 종목을 지운다.
 * 상태·시간은 건드리지 않는다. 남은 완료 세트 수를 돌려준다.
 */
export function cleanupRecordedWorkout(
  db: AppDatabase,
  workoutId: string,
  now = Date.now(),
): number {
  let kept = 0;
  db.transaction((tx) => {
    const wes = tx
      .select({ id: schema.workoutExercises.id })
      .from(schema.workoutExercises)
      .where(
        and(
          eq(schema.workoutExercises.workoutId, workoutId),
          isNull(schema.workoutExercises.deletedAt),
        ),
      )
      .all();
    for (const we of wes) {
      tx.update(schema.sets)
        .set({ deletedAt: now, dirty: 1 })
        .where(
          and(
            eq(schema.sets.workoutExerciseId, we.id),
            isNull(schema.sets.completedAt),
            isNull(schema.sets.deletedAt),
          ),
        )
        .run();
      const n = tx
        .select({ id: schema.sets.id })
        .from(schema.sets)
        .where(
          and(
            eq(schema.sets.workoutExerciseId, we.id),
            isNull(schema.sets.deletedAt),
            isNotNull(schema.sets.completedAt),
          ),
        )
        .all().length;
      kept += n;
      if (n === 0) {
        tx.update(schema.workoutExercises)
          .set({ deletedAt: now, dirty: 1 })
          .where(eq(schema.workoutExercises.id, we.id))
          .run();
      }
    }
  });
  return kept;
}

/** 완료된 운동 목록 (최신 순) */
export function completedWorkoutsQuery(db: AppDatabase) {
  return db
    .select({
      id: schema.workouts.id,
      name: schema.workouts.name,
      startedAt: schema.workouts.startedAt,
      endedAt: schema.workouts.endedAt,
    })
    .from(schema.workouts)
    .where(and(eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt)))
    .orderBy(desc(schema.workouts.startedAt));
}
