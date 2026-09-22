import Database from 'better-sqlite3';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { BASE_EXERCISES, baseExerciseId } from '@/data/exercises';
import { ROUTINE_TEMPLATES } from '@/data/templates';
import { toMask } from '@/lib/weekdays';

import { copyTemplate, duplicateRoutine } from '../routines';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}

let counter = 0;
const makeId = () => `id-${++counter}`;

describe('추천 루틴 데이터', () => {
  it('모든 템플릿 종목이 기본 종목에 있다', () => {
    const keys = new Set(BASE_EXERCISES.map((e) => e.key));
    for (const t of ROUTINE_TEMPLATES) {
      for (const r of t.routines) {
        for (const e of r.exercises) expect(keys.has(e.key)).toBe(true);
      }
    }
  });

  it('렙 범위와 세트 수가 올바르다', () => {
    for (const t of ROUTINE_TEMPLATES) {
      for (const r of t.routines) {
        expect(r.weekdays.length).toBeGreaterThan(0);
        for (const e of r.exercises) {
          expect(e.repMin).toBeLessThanOrEqual(e.repMax);
          expect(e.sets).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('copyTemplate', () => {
  it('묶음째 복사하고 언어·단위를 반영한다', () => {
    const db = createTestDb();
    const groupId = copyTemplate(db, 'upper_lower', { lang: 'ko', weightUnit: 'lb' }, makeId);
    const group = db
      .select()
      .from(schema.routineGroups)
      .where(eq(schema.routineGroups.id, groupId))
      .get();
    expect(group).toMatchObject({ name: '상하체 2분할', templateKey: 'upper_lower', dirty: 1 });

    const routines = db
      .select()
      .from(schema.routines)
      .where(eq(schema.routines.groupId, groupId))
      .orderBy(asc(schema.routines.sortOrder))
      .all();
    expect(routines.map((r) => r.name)).toEqual(['상체 A', '하체 A', '상체 B', '하체 B']);
    expect(routines[0]?.weekdays).toBe(toMask(['mon']));

    const first = db
      .select()
      .from(schema.routineExercises)
      .where(eq(schema.routineExercises.routineId, routines[0]?.id ?? ''))
      .orderBy(asc(schema.routineExercises.position))
      .all();
    expect(first.map((e) => e.exerciseId)).toEqual(
      ['bench_press', 'barbell_row', 'overhead_press', 'lat_pulldown'].map(baseExerciseId),
    );
    expect(first[0]).toMatchObject({
      targetSets: 4,
      repMin: 6,
      repMax: 10,
      increment: 5,
      incrementUnit: 'lb',
    });
  });

  it('같은 템플릿을 두 번 복사하면 묶음이 두 개가 되고 순서가 뒤로 붙는다', () => {
    const db = createTestDb();
    copyTemplate(db, 'full_body', { lang: 'en', weightUnit: 'kg' }, makeId);
    copyTemplate(db, 'full_body', { lang: 'en', weightUnit: 'kg' }, makeId);
    const groups = db
      .select()
      .from(schema.routineGroups)
      .orderBy(asc(schema.routineGroups.sortOrder))
      .all();
    expect(groups.map((g) => [g.name, g.sortOrder])).toEqual([
      ['Full Body', 0],
      ['Full Body', 1],
    ]);
  });

  it('없는 템플릿은 오류', () => {
    const db = createTestDb();
    expect(() => copyTemplate(db, 'nope', { lang: 'ko', weightUnit: 'kg' }, makeId)).toThrow();
  });
});

describe('duplicateRoutine', () => {
  it('종목 설정까지 복사하고 요일은 비운 채 원본 바로 뒤에 둔다', () => {
    const db = createTestDb();
    const groupId = copyTemplate(db, 'push_pull_legs', { lang: 'ko', weightUnit: 'kg' }, makeId);
    const [push] = db
      .select()
      .from(schema.routines)
      .where(eq(schema.routines.groupId, groupId))
      .orderBy(asc(schema.routines.sortOrder))
      .all();
    if (!push) throw new Error('no routine');

    const copyId = duplicateRoutine(db, push.id, 'Push A 복사본', makeId);
    const ordered = db
      .select()
      .from(schema.routines)
      .where(eq(schema.routines.groupId, groupId))
      .orderBy(asc(schema.routines.sortOrder))
      .all();
    expect(ordered.map((r) => r.name)).toEqual(['Push A', 'Push A 복사본', 'Pull A', 'Legs']);
    expect(ordered[1]?.weekdays).toBe(0);

    const copied = db
      .select()
      .from(schema.routineExercises)
      .where(eq(schema.routineExercises.routineId, copyId))
      .all();
    expect(copied).toHaveLength(5);
  });
});
