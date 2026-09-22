import Database from 'better-sqlite3';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { BASE_EXERCISES } from '@/data/exercises';

import { createCustomExercise } from '../routine-editor';
import { copyTemplate } from '../routines';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import { addWorkoutPhoto } from '../summary';
import { wipeUserData } from '../wipe';
import { startWorkout } from '../workout';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
let counter = 0;
const makeId = () => `w-${String(++counter).padStart(5, '0')}`;

describe('wipeUserData', () => {
  it('사용자 데이터는 지우고 참조 데이터는 남긴다', () => {
    const db = createTestDb();
    const baseMappings = db.select({ n: count() }).from(schema.exerciseMuscles).get()?.n;
    copyTemplate(db, 'push_pull_legs', { lang: 'ko', weightUnit: 'kg' }, makeId);
    const routine = db.select().from(schema.routines).get();
    const workoutId = startWorkout(
      db,
      { routineId: routine?.id ?? null, name: 'R', weightUnit: 'kg' },
      makeId,
    );
    addWorkoutPhoto(db, workoutId, 'photos/a.jpg', makeId);
    createCustomExercise(
      db,
      {
        name: '내 종목',
        type: 'weight_reps',
        equipment: 'machine',
        primary: ['chest'],
        secondary: ['triceps'],
      },
      makeId,
    );

    expect(wipeUserData(db)).toEqual(['photos/a.jpg']);

    for (const table of [
      schema.routines,
      schema.routineGroups,
      schema.routineExercises,
      schema.workouts,
      schema.workoutExercises,
      schema.sets,
      schema.workoutPhotos,
    ]) {
      expect(db.select({ n: count() }).from(table).get()?.n).toBe(0);
    }
    expect(db.select({ n: count() }).from(schema.exercises).get()?.n).toBe(BASE_EXERCISES.length);
    expect(db.select({ n: count() }).from(schema.exerciseMuscles).get()?.n).toBe(baseMappings);
  });
});
