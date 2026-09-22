import Database from 'better-sqlite3';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { baseExerciseId } from '@/data/exercises';
import { newDraftItem } from '@/domain/routine-draft';

import { emptyRoutineDraft, saveRoutineDraft } from '../routine-editor';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import { addWorkoutPhoto, deleteWorkoutPhoto, loadSummary, setWorkoutNote } from '../summary';
import { finishWorkout, setCompleted, startWorkout, updateSet } from '../workout';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
type Db = ReturnType<typeof createTestDb>;
let counter = 0;
const makeId = () => `s-${String(++counter).padStart(5, '0')}`;

function session(db: Db, routineId: string, weight: number, reps: number, now: number) {
  const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now }, makeId);
  const wes = db
    .select()
    .from(schema.workoutExercises)
    .where(
      and(eq(schema.workoutExercises.workoutId, id), isNull(schema.workoutExercises.deletedAt)),
    )
    .all();
  for (const we of wes) {
    const sets = db
      .select()
      .from(schema.sets)
      .where(and(eq(schema.sets.workoutExerciseId, we.id), isNull(schema.sets.deletedAt)))
      .orderBy(asc(schema.sets.position))
      .all();
    for (const s of sets) {
      if (s.kind === 'warmup') continue;
      updateSet(db, s.id, { weight, reps });
      setCompleted(db, s.id, true, now + 1);
    }
  }
  finishWorkout(db, id, now + 60 * 60000);
  return id;
}

describe('loadSummary', () => {
  it('완료 세트·근육·이 운동 전까지의 최고 기록을 읽는다', () => {
    const db = createTestDb();
    const routineId = saveRoutineDraft(
      db,
      {
        ...emptyRoutineDraft(),
        name: 'R',
        items: [{ ...newDraftItem('a', baseExerciseId('bench_press'), 'kg'), targetSets: 2 }],
      },
      makeId,
    );
    const first = session(db, routineId, 60, 10, 1_000);
    const second = session(db, routineId, 65, 8, 10_000_000);
    session(db, routineId, 80, 5, 20_000_000);

    const s = loadSummary(db, second);
    expect(s?.exerciseIds).toEqual([baseExerciseId('bench_press')]);
    expect(s?.sets.filter((x) => x.kind === 'working').map((x) => [x.weight, x.reps])).toEqual([
      [65, 8],
      [65, 8],
    ]);
    // 세 번째(나중) 운동의 80kg은 기준에 들어가지 않는다
    expect(s?.bests.get(baseExerciseId('bench_press'))?.weightKg).toBe(60);
    expect(
      s?.musclesOf.get(baseExerciseId('bench_press'))?.some((m) => m.muscleId === 'chest'),
    ).toBe(true);
    expect(loadSummary(db, first)?.bests.size).toBe(0);
    expect(loadSummary(db, 'nope')).toBeNull();
  });

  it('메모와 사진', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: 'x', weightUnit: 'kg' }, makeId);
    setWorkoutNote(db, id, '좋았다');
    expect(loadSummary(db, id)?.workout.note).toBe('좋았다');
    setWorkoutNote(db, id, '   ');
    expect(loadSummary(db, id)?.workout.note).toBeNull();
    const photo = addWorkoutPhoto(db, id, 'photos/a.jpg', makeId);
    deleteWorkoutPhoto(db, photo);
    const rows = db.select().from(schema.workoutPhotos).all();
    expect(rows[0]?.deletedAt).not.toBeNull();
  });
});
