import { eq, inArray, sql } from 'drizzle-orm';

import * as schema from './schema';
import type { AppDatabase } from './seed';

/**
 * 이 기기의 사용자 데이터를 모두 지운다(루틴·운동 기록·커스텀 종목·체성분·동기화 커서).
 * 기본 종목·근육 같은 참조 데이터는 남긴다. 지운 사진의 파일 경로를 돌려준다(파일은 호출한 쪽에서 삭제).
 * 게스트 데이터는 서버에 없으므로 툼스톤 없이 바로 지운다.
 */
export function wipeUserData(db: AppDatabase): string[] {
  return db.transaction((tx) => {
    const photos = tx.select({ path: schema.workoutPhotos.path }).from(schema.workoutPhotos).all();
    const custom = tx
      .select({ id: schema.exercises.id })
      .from(schema.exercises)
      .where(eq(schema.exercises.isCustom, 1))
      .all()
      .map((r) => r.id);
    if (custom.length > 0) {
      tx.delete(schema.exerciseMuscles)
        .where(inArray(schema.exerciseMuscles.exerciseId, custom))
        .run();
      tx.delete(schema.exercises).where(inArray(schema.exercises.id, custom)).run();
    }
    for (const table of [
      schema.sets,
      schema.workoutExercises,
      schema.workoutPhotos,
      schema.workouts,
      schema.routineExercises,
      schema.routines,
      schema.routineGroups,
      schema.bodyMetrics,
      schema.syncState,
    ]) {
      // 조건 없이 통째로 지우면 SQLite가 '변경 알림'을 보내지 않아 열려 있는 화면이 옛 기록을 그대로 보여 준다.
      // 항상 참인 조건을 붙여 한 줄씩 지우게 한다.
      tx.delete(table).where(sql`1 = 1`).run();
    }
    return photos.map((p) => p.path);
  });
}

/** 이 기기에 사용자가 만든 기록(루틴·운동·직접 만든 종목·체성분)이 있는지 */
export function hasUserData(db: AppDatabase): boolean {
  const any = (rows: unknown[]) => rows.length > 0;
  return (
    any(db.select({ id: schema.routines.id }).from(schema.routines).limit(1).all()) ||
    any(db.select({ id: schema.workouts.id }).from(schema.workouts).limit(1).all()) ||
    any(db.select({ id: schema.bodyMetrics.id }).from(schema.bodyMetrics).limit(1).all()) ||
    any(
      db
        .select({ id: schema.exercises.id })
        .from(schema.exercises)
        .where(eq(schema.exercises.isCustom, 1))
        .limit(1)
        .all(),
    )
  );
}
