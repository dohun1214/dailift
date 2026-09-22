import { eq, inArray } from 'drizzle-orm';

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
      tx.delete(table).run();
    }
    return photos.map((p) => p.path);
  });
}
