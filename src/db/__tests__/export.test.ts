import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { exportAllTables, exportSetRows } from '../export';
import { createCustomExercise } from '../routine-editor';
import { copyTemplate } from '../routines';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import { finishWorkout, setCompleted, startWorkout, updateSet } from '../workout';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
let n = 0;
const makeId = () => `e-${String(++n).padStart(5, '0')}`;

describe('내보내기', () => {
  it('완료한 운동의 완료한 세트만, 종목 안 세트 번호로', () => {
    const db = createTestDb();
    copyTemplate(db, 'full_body', { lang: 'ko', weightUnit: 'kg' }, makeId);
    const routine = db.select().from(schema.routines).get();
    const id = startWorkout(
      db,
      { routineId: routine?.id ?? null, name: routine?.name ?? 'x', weightUnit: 'kg', now: 1_000 },
      makeId,
    );
    const sets = db.select().from(schema.sets).all().slice(0, 2);
    for (const s of sets) {
      updateSet(db, s.id, { weight: 50, reps: 10 });
      setCompleted(db, s.id, true, 2_000);
    }
    expect(exportSetRows(db, 'ko')).toHaveLength(0); // 아직 진행 중
    finishWorkout(db, id, 3_000);

    const rows = exportSetRows(db, 'ko');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.setNumber)).toEqual([1, 2]);
    expect(rows[0]?.exercise).not.toBe('');
  });

  it('전체 백업에는 기본 종목·기기 전용 컬럼이 없다', () => {
    const db = createTestDb();
    createCustomExercise(
      db,
      {
        name: '내 종목',
        type: 'weight_reps',
        equipment: 'machine',
        primary: ['chest'],
        secondary: [],
      },
      makeId,
    );
    const data = exportAllTables(db);
    expect(data.exercises).toHaveLength(1);
    expect(data.exercise_muscles).toHaveLength(1);
    expect(Object.keys(data.exercises?.[0] ?? {})).not.toContain('dirty');
  });
});
