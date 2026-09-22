import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, max, ne, sql } from 'drizzle-orm';

import { MUSCLES } from '@/data/muscles';
import {
  type Best,
  bestOf,
  convertWeight,
  defaultBarWeight,
  type PastSet,
  suggestNext,
  warmupSets,
} from '@/domain/strength';
import { newId } from '@/lib/id';
import type { WeightUnit } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

type IdFn = () => string;

const groupOf = new Map<string, string>(MUSCLES.map((m) => [m.id, m.group]));

export function getActiveWorkout(db: AppDatabase) {
  return db
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.status, 'in_progress'), isNull(schema.workouts.deletedAt)))
    .orderBy(desc(schema.workouts.startedAt))
    .get();
}

export type PastSession = {
  workoutId: string;
  sets: (PastSet & { unit: WeightUnit; durationSec: number | null })[];
};

/** 이 종목을 한 최근 완료 세션들의 완료 본세트 (최근 순) */
export function lastSessions(
  db: AppDatabase,
  exerciseId: string,
  limit: number,
  excludeWorkoutId?: string,
): PastSession[] {
  const rows = db
    .select({
      workoutId: schema.workouts.id,
      startedAt: schema.workouts.startedAt,
      position: schema.sets.position,
      weight: schema.sets.weight,
      unit: schema.sets.weightUnit,
      reps: schema.sets.reps,
      durationSec: schema.sets.durationSec,
    })
    .from(schema.sets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
    )
    .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutExercises.workoutId))
    .where(
      and(
        eq(schema.workoutExercises.exerciseId, exerciseId),
        eq(schema.workouts.status, 'completed'),
        isNull(schema.workouts.deletedAt),
        isNull(schema.workoutExercises.deletedAt),
        isNull(schema.sets.deletedAt),
        isNotNull(schema.sets.completedAt),
        ne(schema.sets.kind, 'warmup'),
        excludeWorkoutId ? ne(schema.workouts.id, excludeWorkoutId) : undefined,
      ),
    )
    .orderBy(desc(schema.workouts.startedAt), asc(schema.sets.position))
    .all();
  const sessions: PastSession[] = [];
  for (const r of rows) {
    let s = sessions[sessions.length - 1];
    if (!s || s.workoutId !== r.workoutId) {
      if (sessions.length === limit) break;
      s = { workoutId: r.workoutId, sets: [] };
      sessions.push(s);
    }
    s.sets.push({ weight: r.weight, reps: r.reps, unit: r.unit, durationSec: r.durationSec });
  }
  return sessions;
}

/** 종목별 지난 최고 기록 (현재 세션 제외). PR 판정용 */
export function exerciseBests(
  db: AppDatabase,
  exerciseIds: readonly string[],
  excludeWorkoutId: string,
): Map<string, Best> {
  if (exerciseIds.length === 0) return new Map();
  const rows = db
    .select({
      exerciseId: schema.workoutExercises.exerciseId,
      weight: schema.sets.weight,
      unit: schema.sets.weightUnit,
      reps: schema.sets.reps,
    })
    .from(schema.sets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
    )
    .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutExercises.workoutId))
    .where(
      and(
        inArray(schema.workoutExercises.exerciseId, [...exerciseIds]),
        eq(schema.workouts.status, 'completed'),
        ne(schema.workouts.id, excludeWorkoutId),
        isNull(schema.workouts.deletedAt),
        isNull(schema.workoutExercises.deletedAt),
        isNull(schema.sets.deletedAt),
        isNotNull(schema.sets.completedAt),
        ne(schema.sets.kind, 'warmup'),
      ),
    )
    .all();
  const byExercise = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byExercise.get(r.exerciseId);
    if (list) list.push(r);
    else byExercise.set(r.exerciseId, [r]);
  }
  const out = new Map<string, Best>();
  for (const [id, list] of byExercise) {
    const best = bestOf(list);
    if (best) out.set(id, best);
  }
  return out;
}

type ExerciseInfo = {
  type: schema.ExerciseType;
  equipment: schema.Equipment;
  primaryGroups: string[];
};

function exerciseInfo(db: AppDatabase, ids: readonly string[]): Map<string, ExerciseInfo> {
  if (ids.length === 0) return new Map();
  const exs = db
    .select({
      id: schema.exercises.id,
      type: schema.exercises.type,
      equipment: schema.exercises.equipment,
    })
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, [...ids]))
    .all();
  const muscles = db
    .select({
      exerciseId: schema.exerciseMuscles.exerciseId,
      muscleId: schema.exerciseMuscles.muscleId,
    })
    .from(schema.exerciseMuscles)
    .where(
      and(
        inArray(schema.exerciseMuscles.exerciseId, [...ids]),
        eq(schema.exerciseMuscles.role, 'primary'),
      ),
    )
    .all();
  return new Map(
    exs.map((e) => [
      e.id,
      {
        type: e.type,
        equipment: e.equipment,
        primaryGroups: muscles
          .filter((m) => m.exerciseId === e.id)
          .map((m) => groupOf.get(m.muscleId) ?? m.muscleId),
      },
    ]),
  );
}

export type PlanItem = {
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  increment: number;
  incrementUnit: WeightUnit;
};

type PlannedSet = {
  kind: schema.SetKind;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
};

/**
 * 종목 하나의 시작 세트(프리필)를 만든다. 지난 기록과 증량 제안으로 무게·횟수를 채우고,
 * withWarmup이면 바벨 무게×횟수 종목에 워밍업 세트를 앞에 붙인다. 프리필은 완료 전까지 기록이 아니다.
 */
export function planSets(
  db: AppDatabase,
  item: PlanItem,
  info: ExerciseInfo | undefined,
  unit: WeightUnit,
  withWarmup: boolean,
): PlannedSet[] {
  const history = lastSessions(db, item.exerciseId, 2);
  const inUnit = history.map((s) =>
    s.sets.map((x) => ({
      ...x,
      weight: x.weight === null ? null : convertWeight(x.weight, x.unit, unit),
    })),
  );
  const increment = convertWeight(item.increment, item.incrementUnit, unit) || item.increment;
  const suggestion = suggestNext(inUnit, { repMin: item.repMin, repMax: item.repMax, increment });
  const last = inUnit[0] ?? [];
  const isTime = info?.type === 'time';

  const working: PlannedSet[] = Array.from({ length: Math.max(1, item.targetSets) }, (_, i) => {
    const prev = last[i] ?? last[last.length - 1];
    if (isTime)
      return { kind: 'working', weight: null, reps: null, durationSec: prev?.durationSec ?? null };
    let weight = suggestion?.weight ?? prev?.weight ?? null;
    let reps = prev?.reps ?? null;
    if (suggestion?.kind === 'increase' || suggestion?.kind === 'decrease') reps = item.repMin;
    if (info?.type === 'bodyweight_reps' && !suggestion) weight = prev?.weight ?? null;
    return { kind: 'working', weight, reps, durationSec: null };
  });

  const top = working[0]?.weight ?? null;
  const warm =
    withWarmup && top !== null && info?.type === 'weight_reps' && info.equipment === 'barbell'
      ? warmupSets(top, unit, defaultBarWeight(unit)).map(
          (w): PlannedSet => ({
            kind: 'warmup',
            weight: w.weight,
            reps: w.reps,
            durationSec: null,
          }),
        )
      : [];
  return [...warm, ...working];
}

function insertExercises(
  tx: AppDatabase,
  workoutId: string,
  items: readonly PlanItem[],
  startPosition: number,
  unit: WeightUnit,
  makeId: IdFn,
  warmupGroups: Set<string>,
) {
  const infos = exerciseInfo(
    tx,
    items.map((i) => i.exerciseId),
  );
  items.forEach((item, i) => {
    const info = infos.get(item.exerciseId);
    // 부위별 첫 바벨 복합 종목에만 워밍업
    const group = info?.primaryGroups[0];
    const eligible = info?.equipment === 'barbell' && info.type === 'weight_reps' && !!group;
    const withWarmup = eligible && !warmupGroups.has(group);
    if (eligible) warmupGroups.add(group);
    const planned = planSets(tx, item, info, unit, withWarmup);
    const weId = makeId();
    tx.insert(schema.workoutExercises)
      .values({
        id: weId,
        workoutId,
        exerciseId: item.exerciseId,
        position: startPosition + i,
        restSec: item.restSec,
        repMin: item.repMin,
        repMax: item.repMax,
        increment: item.increment,
        incrementUnit: item.incrementUnit,
      })
      .run();
    tx.insert(schema.sets)
      .values(
        planned.map((s, position) => ({
          id: makeId(),
          workoutExerciseId: weId,
          position,
          kind: s.kind,
          weight: s.weight,
          weightUnit: unit,
          reps: s.reps,
          durationSec: s.durationSec,
        })),
      )
      .run();
  });
}

/** 운동 시작. routineId가 없으면 빈 운동. 진행 중인 운동이 있으면 그 id를 돌려준다. */
export function startWorkout(
  db: AppDatabase,
  opts: { routineId: string | null; name: string; weightUnit: WeightUnit; now?: number },
  makeId: IdFn = newId,
): string {
  const active = getActiveWorkout(db);
  if (active) return active.id;
  const workoutId = makeId();
  db.transaction((tx) => {
    tx.insert(schema.workouts)
      .values({
        id: workoutId,
        routineId: opts.routineId,
        name: opts.name,
        status: 'in_progress',
        startedAt: opts.now ?? Date.now(),
      })
      .run();
    if (!opts.routineId) return;
    const items = tx
      .select()
      .from(schema.routineExercises)
      .where(
        and(
          eq(schema.routineExercises.routineId, opts.routineId),
          isNull(schema.routineExercises.deletedAt),
        ),
      )
      .orderBy(asc(schema.routineExercises.position))
      .all();
    insertExercises(tx, workoutId, items, 0, opts.weightUnit, makeId, new Set());
  });
  return workoutId;
}

/** 운동 중 종목 추가 (맨 뒤). 기본 3세트 · 8–12회, 휴식은 무게 종목 90초·나머지 60초 */
export function addExercisesToWorkout(
  db: AppDatabase,
  workoutId: string,
  exerciseIds: readonly string[],
  unit: WeightUnit,
  makeId: IdFn = newId,
) {
  if (exerciseIds.length === 0) return;
  db.transaction((tx) => {
    const infos = exerciseInfo(tx, exerciseIds);
    const [last] = tx
      .select({ value: max(schema.workoutExercises.position) })
      .from(schema.workoutExercises)
      .where(
        and(
          eq(schema.workoutExercises.workoutId, workoutId),
          isNull(schema.workoutExercises.deletedAt),
        ),
      )
      .all();
    const items = exerciseIds.map(
      (exerciseId): PlanItem => ({
        exerciseId,
        targetSets: 3,
        repMin: 8,
        repMax: 12,
        restSec: infos.get(exerciseId)?.type === 'weight_reps' ? 90 : 60,
        increment: unit === 'lb' ? 5 : 2.5,
        incrementUnit: unit,
      }),
    );
    // 이미 운동한 부위에는 워밍업을 다시 붙이지 않는다.
    const existing = tx
      .select({ exerciseId: schema.workoutExercises.exerciseId })
      .from(schema.workoutExercises)
      .where(
        and(
          eq(schema.workoutExercises.workoutId, workoutId),
          isNull(schema.workoutExercises.deletedAt),
        ),
      )
      .all()
      .map((r) => r.exerciseId);
    const warmed = new Set(
      [...exerciseInfo(tx, existing).values()].flatMap((i) => i.primaryGroups.slice(0, 1)),
    );
    insertExercises(tx, workoutId, items, (last?.value ?? -1) + 1, unit, makeId, warmed);
  });
}

/**
 * 종목 교체. 완료한 세트는 원래 종목에 남기고(기록 분리), 남은 세트 수만큼 새 종목을 바로 뒤에 만든다.
 * 완료한 세트가 하나도 없으면 원래 종목은 지운다.
 */
export function replaceWorkoutExercise(
  db: AppDatabase,
  workoutExerciseId: string,
  newExerciseId: string,
  unit: WeightUnit,
  makeId: IdFn = newId,
): string {
  const newWeId = makeId();
  const now = Date.now();
  db.transaction((tx) => {
    const old = tx
      .select()
      .from(schema.workoutExercises)
      .where(eq(schema.workoutExercises.id, workoutExerciseId))
      .get();
    if (!old) throw new Error('workout exercise not found');
    const oldSets = tx
      .select()
      .from(schema.sets)
      .where(and(eq(schema.sets.workoutExerciseId, old.id), isNull(schema.sets.deletedAt)))
      .all();
    const done = oldSets.filter((s) => s.completedAt !== null);
    const remaining = oldSets.filter((s) => s.completedAt === null && s.kind !== 'warmup').length;

    tx.update(schema.sets)
      .set({ deletedAt: now, dirty: 1 })
      .where(
        and(
          eq(schema.sets.workoutExerciseId, old.id),
          isNull(schema.sets.completedAt),
          isNull(schema.sets.deletedAt),
        ),
      )
      .run();
    if (done.length === 0) {
      tx.update(schema.workoutExercises)
        .set({ deletedAt: now, dirty: 1 })
        .where(eq(schema.workoutExercises.id, old.id))
        .run();
    }
    tx.update(schema.workoutExercises)
      .set({ position: sql`${schema.workoutExercises.position} + 1`, dirty: 1 })
      .where(
        and(
          eq(schema.workoutExercises.workoutId, old.workoutId),
          gt(schema.workoutExercises.position, old.position),
          isNull(schema.workoutExercises.deletedAt),
        ),
      )
      .run();

    const info = exerciseInfo(tx, [newExerciseId]).get(newExerciseId);
    const item: PlanItem = {
      exerciseId: newExerciseId,
      targetSets: Math.max(1, remaining),
      repMin: old.repMin,
      repMax: old.repMax,
      restSec: old.restSec,
      increment: old.increment,
      incrementUnit: old.incrementUnit,
    };
    const planned = planSets(tx, item, info, unit, false);
    tx.insert(schema.workoutExercises)
      .values({ id: newWeId, workoutId: old.workoutId, ...item, position: old.position + 1 })
      .run();
    tx.insert(schema.sets)
      .values(
        planned.map((s, position) => ({
          id: makeId(),
          workoutExerciseId: newWeId,
          position,
          kind: s.kind,
          weight: s.weight,
          weightUnit: unit,
          reps: s.reps,
          durationSec: s.durationSec,
        })),
      )
      .run();
  });
  return newWeId;
}

/** 세트 추가: 마지막 본세트 값을 프리필로 복사 */
export function addSet(
  db: AppDatabase,
  workoutExerciseId: string,
  unit: WeightUnit,
  makeId: IdFn = newId,
): string {
  const id = makeId();
  db.transaction((tx) => {
    const list = tx
      .select()
      .from(schema.sets)
      .where(
        and(eq(schema.sets.workoutExerciseId, workoutExerciseId), isNull(schema.sets.deletedAt)),
      )
      .orderBy(asc(schema.sets.position))
      .all();
    const lastWorking = [...list].reverse().find((s) => s.kind !== 'warmup');
    const lastPos = list[list.length - 1]?.position ?? -1;
    tx.insert(schema.sets)
      .values({
        id,
        workoutExerciseId,
        position: lastPos + 1,
        kind: 'working',
        weight: lastWorking?.weight ?? null,
        weightUnit: lastWorking?.weightUnit ?? unit,
        reps: lastWorking?.reps ?? null,
        durationSec: lastWorking?.durationSec ?? null,
      })
      .run();
  });
  return id;
}

export function updateSet(
  db: AppDatabase,
  setId: string,
  patch: Partial<{ weight: number | null; reps: number | null; durationSec: number | null }>,
) {
  db.update(schema.sets)
    .set({ ...patch, dirty: 1 })
    .where(eq(schema.sets.id, setId))
    .run();
}

/** 세트 완료 체크/해제. 완료해야 기록으로 인정된다. */
export function setCompleted(db: AppDatabase, setId: string, done: boolean, now = Date.now()) {
  db.update(schema.sets)
    .set({ completedAt: done ? now : null, dirty: 1 })
    .where(eq(schema.sets.id, setId))
    .run();
}

export function deleteSet(db: AppDatabase, setId: string) {
  db.update(schema.sets)
    .set({ deletedAt: Date.now(), dirty: 1 })
    .where(eq(schema.sets.id, setId))
    .run();
}

/**
 * 운동 완료: 완료 안 한 세트와 완료 세트가 없는 종목은 지우고 상태를 completed로.
 * 기록된 세트 수를 돌려준다(0이면 호출 쪽에서 버리기를 권한다).
 */
export function finishWorkout(db: AppDatabase, workoutId: string, now = Date.now()): number {
  let completed = 0;
  db.transaction((tx) => {
    const wes = tx
      .select({ id: schema.workoutExercises.id })
      .from(schema.workoutExercises)
      .where(
        and(
          eq(schema.workoutExercises.workoutId, workoutId),
          isNull(schema.workoutExercises.deletedAt),
        ),
      )
      .all();
    for (const we of wes) {
      tx.update(schema.sets)
        .set({ deletedAt: now, dirty: 1 })
        .where(
          and(
            eq(schema.sets.workoutExerciseId, we.id),
            isNull(schema.sets.completedAt),
            isNull(schema.sets.deletedAt),
          ),
        )
        .run();
      const kept = tx
        .select({ id: schema.sets.id })
        .from(schema.sets)
        .where(and(eq(schema.sets.workoutExerciseId, we.id), isNull(schema.sets.deletedAt)))
        .all().length;
      completed += kept;
      if (kept === 0) {
        tx.update(schema.workoutExercises)
          .set({ deletedAt: now, dirty: 1 })
          .where(eq(schema.workoutExercises.id, we.id))
          .run();
      }
    }
    tx.update(schema.workouts)
      .set({ status: 'completed', endedAt: now, dirty: 1 })
      .where(eq(schema.workouts.id, workoutId))
      .run();
  });
  return completed;
}

/** 운동 버리기: 상태 discarded + 툼스톤 */
export function discardWorkout(db: AppDatabase, workoutId: string, now = Date.now()) {
  db.transaction((tx) => {
    const wes = tx
      .select({ id: schema.workoutExercises.id })
      .from(schema.workoutExercises)
      .where(eq(schema.workoutExercises.workoutId, workoutId))
      .all();
    const ids = wes.map((w) => w.id);
    if (ids.length > 0) {
      tx.update(schema.sets)
        .set({ deletedAt: now, dirty: 1 })
        .where(and(inArray(schema.sets.workoutExerciseId, ids), isNull(schema.sets.deletedAt)))
        .run();
      tx.update(schema.workoutExercises)
        .set({ deletedAt: now, dirty: 1 })
        .where(
          and(inArray(schema.workoutExercises.id, ids), isNull(schema.workoutExercises.deletedAt)),
        )
        .run();
    }
    tx.update(schema.workouts)
      .set({ status: 'discarded', endedAt: now, deletedAt: now, dirty: 1 })
      .where(eq(schema.workouts.id, workoutId))
      .run();
  });
}
