import Database from 'better-sqlite3';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { baseExerciseId } from '@/data/exercises';
import { cardioTarget, newDraftItem } from '@/domain/routine-draft';

import { emptyRoutineDraft, saveRoutineDraft } from '../routine-editor';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import {
  addExercisesToWorkout,
  addPastWorkout,
  addSet,
  applyToRemainingSets,
  completeSet,
  deleteWorkoutExercise,
  discardWorkout,
  exerciseBests,
  finishWorkout,
  getActiveWorkout,
  moveWorkoutExercise,
  recordCardio,
  replaceWorkoutExercise,
  restoreWorkoutExercise,
  setCompleted,
  setWorkoutExerciseRest,
  setWorkoutMinutes,
  startWorkout,
  updateSet,
  workoutActivity,
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

describe('지난 날 기록 추가', () => {
  it('마친 운동으로 만들고 루틴대로 세트를 채워 둔다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press', 'lateral_raise']);
    const id = addPastWorkout(
      db,
      { routineId, name: 'R', weightUnit: 'kg', startedAt: 1_000_000, minutes: 50 },
      makeId,
    );
    const [w] = db.select().from(schema.workouts).where(eq(schema.workouts.id, id)).all();
    expect(w?.status).toBe('completed');
    expect(w?.startedAt).toBe(1_000_000);
    expect(w?.endedAt).toBe(1_000_000 + 50 * 60_000);
    // 진행 중인 운동이 아니다
    expect(getActiveWorkout(db)).toBeUndefined();
    const wes = exercisesOf(db, id);
    expect(wes).toHaveLength(2);
    expect(setsOf(db, wes[0]?.id ?? '').every((s) => s.completedAt === null)).toBe(true);
  });

  it('지난 기록이 있어 워밍업이 붙는 종목도 본세트만 채운다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press']);
    const first = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now: 1000 }, makeId);
    for (const s of setsOf(db, exercisesOf(db, first)[0]?.id ?? '')) {
      updateSet(db, s.id, { weight: 60, reps: 8 });
      completeSet(db, s.id, 'weight_reps', 2000);
    }
    finishWorkout(db, first, 3000);
    const id = addPastWorkout(
      db,
      { routineId, name: 'R', weightUnit: 'kg', startedAt: 9_000_000, minutes: 40 },
      makeId,
    );
    const sets = setsOf(db, exercisesOf(db, id)[0]?.id ?? '');
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((s) => s.kind === 'working')).toBe(true);
  });

  it('지난 기록에 종목을 더할 때도 그날 전 기록 값을 쓴다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press']);
    const record = (now: number, weight: number, reps: number) => {
      const w = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now }, makeId);
      for (const s of setsOf(db, exercisesOf(db, w)[0]?.id ?? '')) {
        if (s.kind === 'warmup') continue;
        updateSet(db, s.id, { weight, reps });
        completeSet(db, s.id, 'weight_reps', now + 1);
      }
      finishWorkout(db, w, now + 2);
    };
    record(1_000, 60, 12);
    record(9_000_000, 80, 5);
    const empty = routineWith(db, []);
    const id = addPastWorkout(
      db,
      { routineId: empty, name: 'E', weightUnit: 'kg', startedAt: 5_000_000, minutes: 40 },
      makeId,
    );
    addExercisesToWorkout(db, id, [baseExerciseId('bench_press')], 'kg', makeId, {
      recordedBefore: 5_000_000,
    });
    const working = setsOf(db, exercisesOf(db, id)[0]?.id ?? '').filter((x) => x.kind !== 'warmup');
    expect(working.length).toBeGreaterThan(0);
    expect(working.every((x) => x.weight === 60 && x.reps === 12)).toBe(true);
  });

  it('그날 전 마지막 기록 값을 그대로 채우고 증량 제안은 하지 않는다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press']);
    const record = (now: number, weight: number, reps: number) => {
      const w = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now }, makeId);
      for (const s of setsOf(db, exercisesOf(db, w)[0]?.id ?? '')) {
        if (s.kind === 'warmup') continue;
        updateSet(db, s.id, { weight, reps });
        completeSet(db, s.id, 'weight_reps', now + 1);
      }
      finishWorkout(db, w, now + 2);
    };
    // 횟수 범위 위쪽을 모두 채워 평소라면 증량을 제안할 기록
    record(1_000, 60, 12);
    // 추가하려는 날보다 뒤의 기록은 쓰지 않는다
    record(9_000_000, 80, 5);
    const id = addPastWorkout(
      db,
      { routineId, name: 'R', weightUnit: 'kg', startedAt: 5_000_000, minutes: 40 },
      makeId,
    );
    const sets = setsOf(db, exercisesOf(db, id)[0]?.id ?? '');
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((s) => s.weight === 60 && s.reps === 12)).toBe(true);
  });

  it('진행 중인 운동이 있어도 따로 만든다', () => {
    const db = createTestDb();
    const active = startWorkout(db, { routineId: null, name: 'now', weightUnit: 'kg' }, makeId);
    const id = addPastWorkout(
      db,
      { routineId: null, name: 'past', weightUnit: 'kg', startedAt: 5000, minutes: 30 },
      makeId,
    );
    expect(id).not.toBe(active);
    expect(getActiveWorkout(db)?.id).toBe(active);
    expect(exercisesOf(db, id)).toHaveLength(0);
  });

  it('운동 시간을 바꾸면 끝난 시각이 옮겨진다', () => {
    const db = createTestDb();
    const id = addPastWorkout(
      db,
      { routineId: null, name: 'past', weightUnit: 'kg', startedAt: 5000, minutes: 30 },
      makeId,
    );
    setWorkoutMinutes(db, id, 75);
    const [w] = db.select().from(schema.workouts).where(eq(schema.workouts.id, id)).all();
    expect(w?.endedAt).toBe(5000 + 75 * 60_000);
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

  it('빈 칸인 세트도 완료할 수 있고 빈 칸은 0으로 기록한다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise'], 2);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [we] = exercisesOf(db, id);
    const [first, second] = setsOf(db, we?.id ?? '');
    updateSet(db, first?.id ?? '', { weight: null, reps: null });
    updateSet(db, second?.id ?? '', { weight: 7.5, reps: null });
    completeSet(db, first?.id ?? '', 'weight_reps', 5_000);
    completeSet(db, second?.id ?? '', 'weight_reps', 6_000);
    expect(setsOf(db, we?.id ?? '').map((s) => [s.weight, s.reps, s.completedAt])).toEqual([
      [0, 0, 5_000],
      [7.5, 0, 6_000],
    ]);
  });

  it('맨몸 종목은 추가 무게를 비워 두고, 시간 종목은 시간만 채운다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise'], 2);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [we] = exercisesOf(db, id);
    const [first, second] = setsOf(db, we?.id ?? '');
    updateSet(db, first?.id ?? '', { weight: null, reps: null, durationSec: null });
    updateSet(db, second?.id ?? '', { weight: null, reps: null, durationSec: null });
    completeSet(db, first?.id ?? '', 'bodyweight_reps', 1);
    completeSet(db, second?.id ?? '', 'time', 2);
    expect(
      setsOf(db, we?.id ?? '').map((s) => [s.weight, s.reps, s.durationSec, s.completedAt]),
    ).toEqual([
      [null, 0, null, 1],
      [null, null, 0, 2],
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

  it('근력 종목을 유산소로 바꾸면 횟수 범위 · 휴식을 물려받지 않는다(목표 시간 12초가 되지 않게)', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press'], 3);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [bench] = exercisesOf(db, id);
    replaceWorkoutExercise(db, bench?.id ?? '', baseExerciseId('treadmill'), 'kg', makeId);
    const [cardio] = exercisesOf(db, id);
    expect(cardio).toMatchObject({
      exerciseId: baseExerciseId('treadmill'),
      repMin: 0,
      repMax: 0,
      restSec: 0,
    });
    expect(setsOf(db, cardio?.id ?? '')).toHaveLength(1);
  });

  it('유산소를 근력 종목으로 바꾸면 새로 넣을 때의 기본값을 쓴다', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: 'W', weightUnit: 'kg' }, makeId);
    addExercisesToWorkout(db, id, [baseExerciseId('treadmill')], 'kg', makeId);
    const [cardio] = exercisesOf(db, id);
    replaceWorkoutExercise(db, cardio?.id ?? '', baseExerciseId('bench_press'), 'kg', makeId);
    const [bench] = exercisesOf(db, id);
    expect(bench).toMatchObject({ repMin: 8, repMax: 12, restSec: 90 });
    expect(setsOf(db, bench?.id ?? '').length).toBeGreaterThan(0);
  });
});

describe('운동 중 종목 편집', () => {
  it('순서를 바꾸면 position을 0부터 다시 매긴다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['bench_press', 'lateral_raise', 'squat'], 1);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const before = exercisesOf(db, id).map((e) => e.id);
    moveWorkoutExercise(db, id, 0, 2);
    const after = exercisesOf(db, id);
    expect(after.map((e) => e.id)).toEqual([before[1], before[2], before[0]]);
    expect(after.map((e) => e.position)).toEqual([0, 1, 2]);
    // 범위를 벗어나면 그대로
    moveWorkoutExercise(db, id, 0, 5);
    expect(exercisesOf(db, id).map((e) => e.id)).toEqual([before[1], before[2], before[0]]);
  });

  it('종목을 지우면 그 세트도 함께 지워진다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise', 'squat'], 2);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [first, second] = exercisesOf(db, id);
    completeSet(db, setsOf(db, first?.id ?? '')[0]?.id ?? '', 'weight_reps', 1);
    deleteWorkoutExercise(db, first?.id ?? '', 2);
    expect(exercisesOf(db, id).map((e) => e.id)).toEqual([second?.id]);
    expect(setsOf(db, first?.id ?? '')).toEqual([]);
    expect(setsOf(db, second?.id ?? '').length).toBeGreaterThan(0);
  });

  it('휴식 시간은 이 운동에만, 원하면 루틴에도 저장한다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise'], 1);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [we] = exercisesOf(db, id);
    const routineRest = () =>
      db
        .select({ restSec: schema.routineExercises.restSec })
        .from(schema.routineExercises)
        .where(eq(schema.routineExercises.routineId, routineId))
        .all()
        .map((r) => r.restSec);
    const original = routineRest();

    setWorkoutExerciseRest(db, we?.id ?? '', 150);
    expect(exercisesOf(db, id)[0]?.restSec).toBe(150);
    expect(routineRest()).toEqual(original);

    setWorkoutExerciseRest(db, we?.id ?? '', 45, true);
    expect(exercisesOf(db, id)[0]?.restSec).toBe(45);
    expect(routineRest()).toEqual([45]);
  });
});

describe('v1.2: 따라 채우기 · 되돌리기 · 오래된 운동', () => {
  it('남은 세트에도 적용: 아래 미완료 본 세트의 그 칸만 바꾼다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise'], 4);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [we] = exercisesOf(db, id);
    const ids = setsOf(db, we?.id ?? '').map((s) => s.id);
    const weights = () => setsOf(db, we?.id ?? '').map((s) => s.weight);
    const reps = () => setsOf(db, we?.id ?? '').map((s) => s.reps);

    // 값을 고치면 그 세트만 바뀐다
    updateSet(db, ids[0] ?? '', { weight: 60, reps: 12 });
    expect(weights()).toEqual([60, null, null, null]);

    // 누르면 아래 세트의 무게만 따라온다 (횟수는 그대로)
    expect(applyToRemainingSets(db, ids[0] ?? '', 'weight')).toEqual(ids.slice(1));
    expect(weights()).toEqual([60, 60, 60, 60]);
    expect(reps()).toEqual([12, null, null, null]);
    expect(applyToRemainingSets(db, ids[0] ?? '', 'weight')).toEqual([]);

    // 완료한 세트와 위쪽 세트는 그대로
    setCompleted(db, ids[3] ?? '', true, 1);
    updateSet(db, ids[1] ?? '', { weight: 62.5 });
    expect(applyToRemainingSets(db, ids[1] ?? '', 'weight')).toEqual([ids[2]]);
    expect(weights()).toEqual([60, 62.5, 62.5, 60]);
  });

  it('워밍업 세트나 빈 칸에서는 적용할 세트가 없다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise'], 2);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [we] = exercisesOf(db, id);
    const ids = setsOf(db, we?.id ?? '').map((s) => s.id);
    expect(applyToRemainingSets(db, ids[0] ?? '', 'weight')).toEqual([]);
    updateSet(db, ids[0] ?? '', { kind: 'warmup', weight: 20 });
    expect(applyToRemainingSets(db, ids[0] ?? '', 'weight')).toEqual([]);
    expect(setsOf(db, we?.id ?? '').map((s) => s.weight)).toEqual([20, null]);
  });

  it('지운 종목을 되돌리면 그때 같이 지운 세트만 살아난다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise', 'squat'], 3);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    const [first] = exercisesOf(db, id);
    const before = setsOf(db, first?.id ?? '').map((s) => s.id);
    // 세트 하나는 종목을 지우기 전에 따로 지웠다
    db.update(schema.sets)
      .set({ deletedAt: 5 })
      .where(eq(schema.sets.id, before[2] ?? ''))
      .run();
    completeSet(db, before[0] ?? '', 'weight_reps', 6);

    const at = deleteWorkoutExercise(db, first?.id ?? '', 10);
    expect(at).toBe(10);
    expect(exercisesOf(db, id)).toHaveLength(1);

    restoreWorkoutExercise(db, first?.id ?? '', at);
    expect(exercisesOf(db, id).map((e) => e.id)[0]).toBe(first?.id);
    const restored = setsOf(db, first?.id ?? '');
    expect(restored.map((s) => s.id)).toEqual([before[0], before[1]]);
    expect(restored[0]?.completedAt).toBe(6);
  });

  it('마지막 기록 시각을 구하고, 그 시각으로 운동을 마칠 수 있다', () => {
    const db = createTestDb();
    const routineId = routineWith(db, ['lateral_raise'], 3);
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg', now: 1000 }, makeId);
    expect(workoutActivity(db, id)).toEqual({ lastAt: null, completedSets: 0 });
    const [we] = exercisesOf(db, id);
    const ids = setsOf(db, we?.id ?? '').map((s) => s.id);
    completeSet(db, ids[0] ?? '', 'weight_reps', 2000);
    completeSet(db, ids[1] ?? '', 'weight_reps', 3000);
    expect(workoutActivity(db, id)).toEqual({ lastAt: 3000, completedSets: 2 });

    finishWorkout(db, id, 999_999, 3000);
    const w = db.select().from(schema.workouts).where(eq(schema.workouts.id, id)).get();
    expect(w?.status).toBe('completed');
    expect(w?.endedAt).toBe(3000);
  });
});

describe('유산소', () => {
  const setsOf = (db: Db, workoutId: string) =>
    db
      .select({ set: schema.sets, exerciseId: schema.workoutExercises.exerciseId })
      .from(schema.sets)
      .innerJoin(
        schema.workoutExercises,
        eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
      )
      .where(and(eq(schema.workoutExercises.workoutId, workoutId), isNull(schema.sets.deletedAt)))
      .orderBy(asc(schema.workoutExercises.position), asc(schema.sets.position))
      .all();

  it('운동 중에 넣으면 세트 세 줄이 아니라 한 줄이고, 단위는 무게 단위를 따라간다', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: 'W', weightUnit: 'lb' }, makeId);
    addExercisesToWorkout(db, id, [baseExerciseId('treadmill')], 'lb', makeId);
    const rows = setsOf(db, id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.set).toMatchObject({
      kind: 'working',
      weight: null,
      reps: null,
      durationSec: null,
      completedAt: null,
      distanceUnit: 'mi',
    });
    const we = db.select().from(schema.workoutExercises).all();
    expect(we[0]).toMatchObject({ repMin: 0, repMax: 0, restSec: 0 });
  });

  it('루틴의 목표 시간이 운동 종목에 실린다', () => {
    const db = createTestDb();
    const routineId = saveRoutineDraft(
      db,
      {
        ...emptyRoutineDraft(),
        name: 'R',
        items: [
          {
            ...newDraftItem('k0', baseExerciseId('stationary_bike'), 'kg', 90, false, true),
            ...cardioTarget(20),
          },
        ],
      },
      makeId,
    );
    const id = startWorkout(db, { routineId, name: 'R', weightUnit: 'kg' }, makeId);
    expect(setsOf(db, id)).toHaveLength(1);
    expect(db.select().from(schema.workoutExercises).all()[0]).toMatchObject({
      repMax: 1200,
      restSec: 0,
    });
  });

  it('잰 시간을 적으면 기록되고, 거리 · 속도 · 경사는 골라 적는다', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: 'W', weightUnit: 'kg' }, makeId);
    addExercisesToWorkout(db, id, [baseExerciseId('treadmill')], 'kg', makeId);
    const setId = setsOf(db, id)[0]?.set.id ?? '';
    expect(recordCardio(db, setId, 0)).toBe(false);
    expect(recordCardio(db, setId, 1500.9, 5000)).toBe(true);
    updateSet(db, setId, { distance: 3.2, incline: 2 });
    expect(setsOf(db, id)[0]?.set).toMatchObject({
      durationSec: 1500,
      completedAt: 5000,
      distance: 3.2,
      speed: null,
      incline: 2,
      distanceUnit: 'km',
    });
    expect(finishWorkout(db, id)).toBe(1);
  });

  it('재지 않은 유산소는 운동을 끝낼 때 빠진다', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: 'W', weightUnit: 'kg' }, makeId);
    addExercisesToWorkout(
      db,
      id,
      [baseExerciseId('bench_press'), baseExerciseId('treadmill')],
      'kg',
      makeId,
    );
    const rows = setsOf(db, id);
    const bench = rows.find((r) => r.exerciseId === baseExerciseId('bench_press'));
    completeSet(db, bench?.set.id ?? '', 'weight_reps');
    expect(finishWorkout(db, id)).toBe(1);
    const left = db
      .select()
      .from(schema.workoutExercises)
      .where(
        and(eq(schema.workoutExercises.workoutId, id), isNull(schema.workoutExercises.deletedAt)),
      )
      .all();
    expect(left.map((e) => e.exerciseId)).toEqual([baseExerciseId('bench_press')]);
  });

  it('유산소 기록은 최고 기록(PR) 기준에 들어가지 않는다', () => {
    const db = createTestDb();
    const id = startWorkout(db, { routineId: null, name: 'W', weightUnit: 'kg' }, makeId);
    addExercisesToWorkout(db, id, [baseExerciseId('treadmill')], 'kg', makeId);
    recordCardio(db, setsOf(db, id)[0]?.set.id ?? '', 600);
    finishWorkout(db, id);
    expect(exerciseBests(db, [baseExerciseId('treadmill')], 'other').size).toBe(0);
  });
});
