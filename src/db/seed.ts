import { like, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { BASE_EXERCISES, baseExerciseId } from '@/data/exercises';
import { MUSCLES } from '@/data/muscles';

import * as schema from './schema';

export type AppDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/**
 * 근육과 기본 종목을 넣거나 최신 내용으로 갱신한다. 앱을 켤 때마다 실행해도 안전하다.
 * 기본 종목은 동기화 대상이 아니므로 dirty = 0으로 둔다.
 * 시드에서 빠진 기본 종목은 지우지 않는다(과거 기록이 참조할 수 있음).
 */
export function seedReferenceData(db: AppDatabase) {
  db.transaction((tx) => {
    tx.insert(schema.muscles)
      .values(
        MUSCLES.map((m, i) => ({
          id: m.id,
          group: m.group,
          nameKo: m.ko,
          nameEn: m.en,
          sortOrder: i,
        })),
      )
      .onConflictDoUpdate({
        target: schema.muscles.id,
        set: {
          group: sql`excluded."group"`,
          nameKo: sql`excluded.name_ko`,
          nameEn: sql`excluded.name_en`,
          sortOrder: sql`excluded.sort_order`,
        },
      })
      .run();

    tx.insert(schema.exercises)
      .values(
        BASE_EXERCISES.map((e, i) => ({
          id: baseExerciseId(e.key),
          isCustom: 0,
          nameKo: e.ko,
          nameEn: e.en,
          type: e.type,
          equipment: e.equipment,
          sortOrder: i,
          dirty: 0,
        })),
      )
      .onConflictDoUpdate({
        target: schema.exercises.id,
        set: {
          nameKo: sql`excluded.name_ko`,
          nameEn: sql`excluded.name_en`,
          type: sql`excluded.type`,
          equipment: sql`excluded.equipment`,
          sortOrder: sql`excluded.sort_order`,
          deletedAt: null,
          dirty: 0,
        },
      })
      .run();

    // 기본 종목의 근육 매핑은 시드가 정본이므로 통째로 다시 쓴다.
    tx.delete(schema.exerciseMuscles)
      .where(like(schema.exerciseMuscles.exerciseId, 'base:%'))
      .run();
    tx.insert(schema.exerciseMuscles)
      .values(
        BASE_EXERCISES.flatMap((e) =>
          (['primary', 'secondary'] as const).flatMap((role) =>
            e[role].map((muscleId) => ({
              id: `${baseExerciseId(e.key)}:${muscleId}`,
              exerciseId: baseExerciseId(e.key),
              muscleId,
              role,
              dirty: 0,
            })),
          ),
        ),
      )
      .run();
  });
}
