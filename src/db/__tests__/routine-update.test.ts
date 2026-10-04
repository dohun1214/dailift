import Database from 'better-sqlite3';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { baseExerciseId } from '@/data/exercises';
import { newDraftItem } from '@/domain/routine-draft';
import { parseSetPlan, type SetPlan } from '@/domain/set-plan';

import { emptyRoutineDraft, loadRoutineDraft, saveRoutineDraft } from '../routine-editor';
import { applyRoutineUpdate, pendingRoutineUpdate, routinePlans } from '../routine-update';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import {
  addExercisesToWorkout,
  deleteSet,
  deleteWorkoutExercise,
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
const makeId = () => `id-${String(++counter).padStart(5, '0')}`;

const bench = baseExerciseId('bench_press');
const raise = baseExerciseId('lateral_raise');
const squat = baseExerciseId('squat');

const set = (kind: 'warmup' | 'working', weight: number, reps: number) => ({
  kind,
  weight,
  reps,
  durationSec: null,
});
const PLAN: SetPlan = {
  unit: 'kg',
  sets: [set('warmup', 40, 5), set('working', 60, 10), set('working', 62.5, 8)],
};

/** 벤치프레스는 세트별로, 사이드 레터럴 레이즈는 범위로 정한 루틴 */
function makeRoutine(db: Db) {
  return saveRoutineDraft(
    db,
    {
      ...emptyRoutineDraft(),
      name: 'Push',
      items: [
        { ...newDraftItem('a', bench, 'kg'), plan: PLAN },
        { ...newDraftItem('b', raise, 'kg'), targetSets: 2 },
      ],
    },
    makeId,
  );
}

const exercisesOf = (db: Db, workoutId: string) =>
  db
    .select()
    .from(schema.workoutExercises)
    .where(
      and(
        eq(schema.workoutExercises.workoutId, workoutId),
        isNull(schema.workoutExercises.deletedAt),
      ),
    )
    .orderBy(asc(schema.workoutExercises.position))
    .all();
const setsOf = (db: Db, workoutExerciseId: string) =>
  db
    .select()
    .from(schema.sets)
    .where(and(eq(schema.sets.workoutExerciseId, workoutExerciseId), isNull(schema.sets.deletedAt)))
    .orderBy(asc(schema.sets.position))
    .all();
const completeAll = (db: Db, workoutExerciseId: string) => {
  for (const s of setsOf(db, workoutExerciseId)) setCompleted(db, s.id, true, 1);
};

describe('세트별로 정한 루틴', () => {
  it('저장하고 다시 읽으면 계획이 그대로이고 본 세트 수가 적힌다', () => {
    const db = createTestDb();
    const routineId = makeRoutine(db);
    const draft = loadRoutineDraft(db, routineId);
    expect(draft?.items.map((i) => i.plan)).toEqual([PLAN, null]);
    expect(draft?.items[0]?.targetSets).toBe(2);
    expect([...routinePlans(db, routineId).keys()]).toEqual([bench]);
  });

  it('운동을 시작하면 정해 둔 세트가 그대로 채워진다(자동 워밍업 없이)', () => {
    const db = createTestDb();
    const routineId = makeRoutine(db);
    const id = startWorkout(db, { routineId, name: 'Push', weightUnit: 'kg' }, makeId);
    const [first, second] = exercisesOf(db, id);
    expect(setsOf(db, first?.id ?? '').map((s) => [s.kind, s.weight, s.reps])).toEqual([
      ['warmup', 40, 5],
      ['working', 60, 10],
      ['working', 62.5, 8],
    ]);
    expect(setsOf(db, second?.id ?? '')).toHaveLength(2);
  });

  it('다른 단위로 운동하면 무게를 바꿔서 채운다', () => {
    const db = createTestDb();
    const routineId = makeRoutine(db);
    const id = startWorkout(db, { routineId, name: 'Push', weightUnit: 'lb' }, makeId);
    const [first] = exercisesOf(db, id);
    expect(setsOf(db, first?.id ?? '').map((s) => [s.weight, s.weightUnit])).toEqual([
      [88, 'lb'],
      [132, 'lb'],
      [138, 'lb'],
    ]);
  });
});

describe('오늘 한 대로 루틴 바꾸기', () => {
  it('루틴대로 했으면 물어볼 것이 없다', () => {
    const db = createTestDb();
    const routineId = makeRoutine(db);
    const id = startWorkout(db, { routineId, name: 'Push', weightUnit: 'kg' }, makeId);
    for (const we of exercisesOf(db, id)) completeAll(db, we.id);
    expect(pendingRoutineUpdate(db, id, 'kg')).toBeNull();
  });

  it('세트를 일부만 하고 끝내도 묻지 않고, 세트 줄을 지우면 묻는다', () => {
    const db = createTestDb();
    const routineId = makeRoutine(db);
    const id = startWorkout(db, { routineId, name: 'Push', weightUnit: 'kg' }, makeId);
    const [first] = exercisesOf(db, id);
    const benchSets = setsOf(db, first?.id ?? '');
    setCompleted(db, benchSets[0]?.id ?? '', true, 1);
    setCompleted(db, benchSets[1]?.id ?? '', true, 2);
    expect(pendingRoutineUpdate(db, id, 'kg')).toBeNull();

    deleteSet(db, benchSets[2]?.id ?? '');
    const pending = pendingRoutineUpdate(db, id, 'kg');
    expect(pending?.changes.map((c) => c.type)).toEqual(['sets']);
  });

  it('루틴 없이 시작한 운동은 묻지 않는다', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: '빈 운동', weightUnit: 'kg' }, makeId);
    addExercisesToWorkout(db, id, [squat], 'kg', makeId);
    for (const we of exercisesOf(db, id)) completeAll(db, we.id);
    expect(pendingRoutineUpdate(db, id, 'kg')).toBeNull();
  });

  it('바꾼 세트 · 추가한 종목 · 뺀 종목을 루틴에 반영한다', () => {
    const db = createTestDb();
    const routineId = makeRoutine(db);
    const id = startWorkout(db, { routineId, name: 'Push', weightUnit: 'kg' }, makeId);
    const [first, second] = exercisesOf(db, id);

    // 벤치프레스: 마지막 세트 무게를 올려서 완료
    const benchSets = setsOf(db, first?.id ?? '');
    updateSet(db, benchSets[2]?.id ?? '', { weight: 65 });
    completeAll(db, first?.id ?? '');
    // 사이드 레터럴 레이즈는 빼고, 스쿼트를 추가해서 두 세트만 완료
    deleteWorkoutExercise(db, second?.id ?? '');
    addExercisesToWorkout(db, id, [squat], 'kg', makeId);
    const added = exercisesOf(db, id).find((e) => e.exerciseId === squat);
    const squatSets = setsOf(db, added?.id ?? '').filter((s) => s.kind === 'working');
    for (const s of squatSets.slice(0, 2)) {
      updateSet(db, s.id, { weight: 80, reps: 5 });
      setCompleted(db, s.id, true, 1);
    }

    const pending = pendingRoutineUpdate(db, id, 'kg');
    expect(pending?.routineName).toBe('Push');
    expect(pending?.changes.map((c) => [c.type, c.exerciseId])).toEqual([
      ['sets', bench],
      ['added', squat],
      ['removed', raise],
    ]);

    if (pending) applyRoutineUpdate(db, pending, makeId);
    const items = db
      .select()
      .from(schema.routineExercises)
      .where(
        and(
          eq(schema.routineExercises.routineId, routineId),
          isNull(schema.routineExercises.deletedAt),
        ),
      )
      .orderBy(asc(schema.routineExercises.position))
      .all();
    expect(items.map((i) => [i.exerciseId, i.position, i.targetSets])).toEqual([
      [bench, 0, 2],
      [squat, 1, 2],
    ]);
    expect(parseSetPlan(items[0]?.setPlan)?.sets.map((s) => s.weight)).toEqual([40, 60, 65]);
    expect(items[1]?.setPlan).toBeNull();

    // 반영한 루틴으로 다시 운동하면 다른 점이 없다
    db.update(schema.workouts).set({ status: 'completed' }).where(eq(schema.workouts.id, id)).run();
    const next = startWorkout(db, { routineId, name: 'Push', weightUnit: 'kg' }, makeId);
    for (const we of exercisesOf(db, next)) completeAll(db, we.id);
    expect(pendingRoutineUpdate(db, next, 'kg')).toBeNull();
  });
});
