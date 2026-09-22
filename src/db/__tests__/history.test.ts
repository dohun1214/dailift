import Database from 'better-sqlite3';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { baseExerciseId } from '@/data/exercises';

import {
  addRecordedSet,
  cleanupRecordedWorkout,
  completedWorkoutsQuery,
  deleteWorkout,
} from '../history';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import { addWorkoutPhoto } from '../summary';
import {
  addExercisesToWorkout,
  finishWorkout,
  setCompleted,
  startWorkout,
  updateSet,
} from '../workout';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
type Db = ReturnType<typeof createTestDb>;
let counter = 0;
const makeId = () => `h-${String(++counter).padStart(5, '0')}`;

function liveSets(db: Db, weId: string) {
  return db
    .select()
    .from(schema.sets)
    .where(and(eq(schema.sets.workoutExerciseId, weId), isNull(schema.sets.deletedAt)))
    .all();
}

function finishedWorkout(db: Db) {
  const id = startWorkout(
    db,
    { routineId: null, name: '빈 운동', weightUnit: 'kg', now: 1000 },
    makeId,
  );
  addExercisesToWorkout(db, id, [baseExerciseId('lateral_raise')], 'kg', makeId);
  const [we] = db
    .select()
    .from(schema.workoutExercises)
    .where(eq(schema.workoutExercises.workoutId, id))
    .all();
  const [first] = liveSets(db, we?.id ?? '');
  updateSet(db, first?.id ?? '', { weight: 10, reps: 12 });
  setCompleted(db, first?.id ?? '', true, 2000);
  finishWorkout(db, id, 3000);
  return { id, weId: we?.id ?? '' };
}

describe('history DB', () => {
  it('지난 기록에 세트를 추가하면 값이 복사되고 바로 완료된다', () => {
    const db = createTestDb();
    const { weId } = finishedWorkout(db);
    addRecordedSet(db, weId, 'kg', 3000, makeId);
    expect(liveSets(db, weId).map((s) => [s.weight, s.reps, s.completedAt])).toEqual([
      [10, 12, 2000],
      [10, 12, 3000],
    ]);
  });

  it('정리하면 완료 해제된 세트와 빈 종목이 사라지고 상태·시간은 그대로', () => {
    const db = createTestDb();
    const { id, weId } = finishedWorkout(db);
    const [s] = liveSets(db, weId);
    setCompleted(db, s?.id ?? '', false);
    expect(cleanupRecordedWorkout(db, id)).toBe(0);
    expect(liveSets(db, weId)).toHaveLength(0);
    const w = db.select().from(schema.workouts).where(eq(schema.workouts.id, id)).get();
    expect(w).toMatchObject({ status: 'completed', endedAt: 3000 });
  });

  it('삭제하면 목록에서 빠지고 사진 경로를 돌려준다', () => {
    const db = createTestDb();
    const { id } = finishedWorkout(db);
    addWorkoutPhoto(db, id, 'photos/x.jpg', makeId);
    expect(completedWorkoutsQuery(db).all()).toHaveLength(1);
    expect(deleteWorkout(db, id)).toEqual(['photos/x.jpg']);
    expect(completedWorkoutsQuery(db).all()).toHaveLength(0);
  });
});
