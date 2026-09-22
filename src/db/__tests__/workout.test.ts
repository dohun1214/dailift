import Database from 'better-sqlite3';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { baseExerciseId } from '@/data/exercises';
import { newDraftItem } from '@/domain/routine-draft';

import { emptyRoutineDraft, saveRoutineDraft } from '../routine-editor';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import {
  addExercisesToWorkout,
  addSet,
  discardWorkout,
  exerciseBests,
  finishWorkout,
  getActiveWorkout,
  replaceWorkoutExercise,
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

function routineWith(db: Db, keys: string[], sets = 3) {
  return saveRoutineDraft(
    db,
    {
      ...emptyRoutineDraft(),
      name: 'R',
      items: keys.map((k, i) => ({
        ...newDraftItem(`k${i}`, baseExerciseId(k), 'kg'),
        targetSets: sets,
        repMin: 8,
        repMax: 10,
      })),
    },
    makeId,
  );
}

function exercisesOf(db: Db, workoutId: string) {
  return db
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
}

function setsOf(db: Db, weId: string) {
  return db
    .select()
    .from(schema.sets)
    .where(and(eq(schema.sets.workoutExerciseId, weId), isNull(schema.sets.deletedAt)))
    .orderBy(asc(schema.sets.position))
    .all();
}

/** 세션 하나를 모든 본세트 weight×reps로 끝낸다 */
function doSession(db: Db, routineId: string, weight: number, reps: number, now: number) {
  const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now }, makeId);
  for (const we of exercisesOf(db, id)) {
    for (const s of setsOf(db, we.id)) {
      if (s.kind === 'warmup') continue;
      updateSet(db, s.id, { weight, reps });
      setCompleted(db, s.id, true, now + 1);
    }
  }
  finishWorkout(db, id, now + 2);
  return id;
}

describe('startWorkout', () => {
  it('루틴 종목과 목표 세트 수만큼 빈 프리필 세트를 만든다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press', 'lateral_raise']);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    expect(getActiveWorkout(db)?.id).toBe(id);
    const wes = exercisesOf(db, id);
    expect(wes.map((w) => [w.exerciseId, w.repMin, w.repMax])).toEqual([
      [baseExerciseId('bench_press'), 8, 10],
      [baseExerciseId('lateral_raise'), 8, 10],
    ]);
    const bench = setsOf(db, wes[0]?.id ?? '');
    expect(bench).toHaveLength(3);
    expect(bench.every((s) => s.completedAt === null && s.weight === null)).toBe(true);
    // 진행 중이면 새로 시작하지 않고 같은 운동을 돌려준다
    expect(startWorkout(db, { routineId: null, name: 'x', weightUnit: 'kg' }, makeId)).toBe(id);
  });

  it('지난 기록으로 증량 제안을 프리필하고 부위별 첫 바벨 종목에만 워밍업을 붙인다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press', 'incline_bench_press']);
    doSession(db, routineId, 60, 10, 1000);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now: 5000 }, makeId);
    const [bench, incline] = exercisesOf(db, id);
    const benchSets = setsOf(db, bench?.id ?? '');
    expect(benchSets.filter((s) => s.kind === 'warmup').map((s) => s.weight)).toEqual([
      20, 27.5, 40, 52.5,
    ]);
    const working = benchSets.filter((s) => s.kind === 'working');
    expect(working.map((s) => [s.weight, s.reps])).toEqual([
      [62.5, 8],
      [62.5, 8],
      [62.5, 8],
    ]);
    expect(setsOf(db, incline?.id ?? '').some((s) => s.kind === 'warmup')).toBe(false);
  });
});

describe('세트 조작', () => {
  it('세트 추가는 마지막 본세트 값을 복사한다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise'], 1);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [we] = exercisesOf(db, id);
    const [first] = setsOf(db, we?.id ?? '');
    updateSet(db, first?.id ?? '', { weight: 10, reps: 12 });
    addSet(db, we?.id ?? '', 'kg', makeId);
    expect(
      setsOf(db, we?.id ?? '').map((s) => [s.position, s.weight, s.reps, s.completedAt]),
    ).toEqual([
      [0, 10, 12, null],
      [1, 10, 12, null],
    ]);
  });
});

describe('finish / discard', () => {
  it('완료 안 한 세트·종목은 지우고 완료 세트 수를 돌려준다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['squat', 'leg_curl'], 2);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [squat, curl] = exercisesOf(db, id);
    const [s1] = setsOf(db, squat?.id ?? '');
    updateSet(db, s1?.id ?? '', { weight: 100, reps: 5 });
    setCompleted(db, s1?.id ?? '', true);
    expect(finishWorkout(db, id)).toBe(1);
    expect(exercisesOf(db, id).map((w) => w.id)).toEqual([squat?.id]);
    expect(setsOf(db, curl?.id ?? '')).toHaveLength(0);
    expect(getActiveWorkout(db)).toBeUndefined();
    const w = db.select().from(schema.workouts).where(eq(schema.workouts.id, id)).get();
    expect(w?.status).toBe('completed');
  });

  it('버리면 기록에서 사라진다', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: '빈 운동', weightUnit: 'kg' }, makeId);
    addExercisesToWorkout(db, id, [baseExerciseId('push_up')], 'kg', makeId);
    discardWorkout(db, id);
    expect(getActiveWorkout(db)).toBeUndefined();
    expect(exercisesOf(db, id)).toHaveLength(0);
  });
});

describe('PR 기준 · 종목 교체', () => {
  it('지난 완료 세션의 최고 기록을 구한다(현재 세션 제외)', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press'], 1);
    doSession(db, routineId, 80, 5, 1000);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now: 9000 }, makeId);
    const best = exerciseBests(db, [baseExerciseId('bench_press')], id).get(
      baseExerciseId('bench_press'),
    );
    expect(best?.weightKg).toBe(80);
  });

  it('교체하면 완료 세트는 원래 종목에 남고 남은 세트 수만큼 새 종목이 뒤에 생긴다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press', 'lateral_raise'], 3);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [bench] = exercisesOf(db, id);
    const [first] = setsOf(db, bench?.id ?? '');
    updateSet(db, first?.id ?? '', { weight: 60, reps: 8 });
    setCompleted(db, first?.id ?? '', true);
    replaceWorkoutExercise(
      db,
      bench?.id ?? '',
      baseExerciseId('dumbbell_bench_press'),
      'kg',
      makeId,
    );
    const wes = exercisesOf(db, id);
    expect(wes.map((w) => [w.exerciseId, w.position])).toEqual([
      [baseExerciseId('bench_press'), 0],
      [baseExerciseId('dumbbell_bench_press'), 1],
      [baseExerciseId('lateral_raise'), 2],
    ]);
    expect(setsOf(db, wes[0]?.id ?? '')).toHaveLength(1);
    expect(setsOf(db, wes[1]?.id ?? '')).toHaveLength(2);
  });
});
