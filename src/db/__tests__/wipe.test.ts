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
import {
  createSupplement,
  deleteSupplement,
  type SupplementInput,
  setSupplementTaken,
} from '../supplements';
import { hasUserData, wipeUserData } from '../wipe';
import { startWorkout } from '../workout';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
const SUPPLEMENT: SupplementInput = {
  name: '오메가3',
  dose: '',
  timing: 'time',
  timeMin: 540,
  afterMin: 30,
  notify: true,
  renotify: true,
  active: true,
};
let counter = 0;
const makeId = () => `w-${String(++counter).padStart(5, '0')}`;

describe('wipeUserData', () => {
  it('사용자 데이터는 지우고 참조 데이터는 남긴다', () => {
    const db = createTestDb();
    const baseMappings = db.select({ n: count() }).from(schema.exerciseMuscles).get()?.n;
    expect(hasUserData(db)).toBe(false);
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

    const supplementId = createSupplement(db, SUPPLEMENT, makeId);
    setSupplementTaken(db, supplementId, '2026-10-06', true, 1, makeId);

    expect(hasUserData(db)).toBe(true);
    expect(wipeUserData(db)).toEqual(['photos/a.jpg']);
    expect(hasUserData(db)).toBe(false);

    for (const table of [
      schema.routines,
      schema.routineGroups,
      schema.routineExercises,
      schema.workouts,
      schema.workoutExercises,
      schema.sets,
      schema.workoutPhotos,
      schema.supplements,
      schema.supplementLogs,
    ]) {
      expect(db.select({ n: count() }).from(table).get()?.n).toBe(0);
    }
    expect(db.select({ n: count() }).from(schema.exercises).get()?.n).toBe(BASE_EXERCISES.length);
    expect(db.select({ n: count() }).from(schema.exerciseMuscles).get()?.n).toBe(baseMappings);
  });

  it('영양제만 있어도 기록이 있는 기기로 본다', () => {
    const db = createTestDb();
    const id = createSupplement(db, SUPPLEMENT, makeId);
    expect(hasUserData(db)).toBe(true);
    deleteSupplement(db, id);
    expect(hasUserData(db)).toBe(false);
  });

  it('지운 흔적만 남은 기기는 기록이 없는 것으로 본다', () => {
    const db = createTestDb();
    copyTemplate(db, 'push_pull_legs', { lang: 'ko', weightUnit: 'kg' }, makeId);
    expect(hasUserData(db)).toBe(true);
    db.update(schema.routines).set({ deletedAt: 1 }).run();
    expect(hasUserData(db)).toBe(false);
  });
});
