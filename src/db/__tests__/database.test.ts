import Database from 'better-sqlite3';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { baseExerciseId } from '@/data/exercises';

import * as schema from '../schema';
import { seedReferenceData } from '../seed';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}

describe('로컬 DB', () => {
  it('마이그레이션 후 시드하면 근육 15개, 기본 종목 34개가 들어간다', () => {
    const db = createTestDb();
    seedReferenceData(db);
    expect(db.select().from(schema.muscles).all()).toHaveLength(15);
    const base = db.select().from(schema.exercises).where(eq(schema.exercises.isCustom, 0)).all();
    expect(base).toHaveLength(34);
    expect(base.every((e) => e.dirty === 0)).toBe(true);
  });

  it('시드를 여러 번 실행해도 중복되지 않는다', () => {
    const db = createTestDb();
    seedReferenceData(db);
    seedReferenceData(db);
    expect(db.select().from(schema.exercises).all()).toHaveLength(34);
    const benchMuscles = db
      .select()
      .from(schema.exerciseMuscles)
      .where(eq(schema.exerciseMuscles.exerciseId, baseExerciseId('bench_press')))
      .all();
    expect(benchMuscles.map((m) => `${m.muscleId}:${m.role}`).sort()).toEqual([
      'chest:primary',
      'shoulders:secondary',
      'triceps:secondary',
    ]);
  });

  it('새 행은 기본값으로 dirty = 1, 시각이 채워지고, 수정하면 updatedAt이 갱신된다', () => {
    const db = createTestDb();
    const before = Date.now();
    db.insert(schema.routines).values({ id: 'r1', name: 'Push A', weekdays: 0b1001 }).run();
    const row = db.select().from(schema.routines).where(eq(schema.routines.id, 'r1')).get();
    expect(row?.dirty).toBe(1);
    expect(row?.createdAt).toBeGreaterThanOrEqual(before);

    const t0 = row?.updatedAt ?? 0;
    const spinUntil = t0 + 2;
    while (Date.now() < spinUntil) {
      /* 1ms 이상 지나게 기다린다 */
    }
    db.update(schema.routines).set({ name: 'Push B' }).where(eq(schema.routines.id, 'r1')).run();
    const updated = db.select().from(schema.routines).where(eq(schema.routines.id, 'r1')).get();
    expect(updated?.updatedAt).toBeGreaterThan(t0);
  });

  it('삭제는 툼스톤으로 처리하고 조회에서 제외할 수 있다', () => {
    const db = createTestDb();
    db.insert(schema.routines)
      .values([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ])
      .run();
    db.update(schema.routines)
      .set({ deletedAt: Date.now() })
      .where(eq(schema.routines.id, 'a'))
      .run();
    const alive = db
      .select()
      .from(schema.routines)
      .where(and(isNull(schema.routines.deletedAt)))
      .all();
    expect(alive.map((r) => r.id)).toEqual(['b']);
  });
});
