import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';

import {
  parseSetPlan,
  type RoutineChange,
  rangeFromPlan,
  routineChanges,
  type SetPlan,
  serializeSetPlan,
} from '@/domain/set-plan';
import { newId } from '@/lib/id';

import * as schema from './schema';
import type { AppDatabase } from './seed';

export type PendingRoutineUpdate = {
  workoutId: string;
  routineId: string;
  routineName: string;
  unit: schema.WeightUnit;
  changes: RoutineChange[];
};

/**
 * 진행 중인 운동이 루틴과 어떻게 다른지. 운동을 끝내기 직전에 부른다
 * (끝내면 안 한 세트 · 종목이 지워져 뺀 종목과 구분할 수 없다).
 * 루틴 없이 시작했거나 루틴이 지워졌거나 다른 점이 없으면 null.
 */
export function pendingRoutineUpdate(
  db: AppDatabase,
  workoutId: string,
  unit: schema.WeightUnit,
): PendingRoutineUpdate | null {
  const workout = db.select().from(schema.workouts).where(eq(schema.workouts.id, workoutId)).get();
  if (!workout?.routineId) return null;
  const routine = db
    .select()
    .from(schema.routines)
    .where(and(eq(schema.routines.id, workout.routineId), isNull(schema.routines.deletedAt)))
    .get();
  if (!routine) return null;
  const items = db
    .select()
    .from(schema.routineExercises)
    .where(
      and(
        eq(schema.routineExercises.routineId, routine.id),
        isNull(schema.routineExercises.deletedAt),
      ),
    )
    .orderBy(asc(schema.routineExercises.position))
    .all();
  const exercises = db
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
  // 남아 있는 세트 줄 전부(완료 여부와 상관없이). 지운 줄은 빠진다.
  const sets = db
    .select({ set: schema.sets })
    .from(schema.sets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
    )
    .where(and(eq(schema.workoutExercises.workoutId, workoutId), isNull(schema.sets.deletedAt)))
    .orderBy(asc(schema.sets.position))
    .all()
    .map((r) => r.set);

  // 유산소는 세트 계획이 없어 견주지 않는다(루틴에 넣고 빼는 것은 루틴 편집에서 한다).
  const cardio = new Set(
    db
      .select({ id: schema.exercises.id })
      .from(schema.exercises)
      .where(eq(schema.exercises.type, 'cardio'))
      .all()
      .map((r) => r.id),
  );
  const changes = routineChanges(
    items
      .filter((i) => !cardio.has(i.exerciseId))
      .map((i) => ({ id: i.id, exerciseId: i.exerciseId, plan: parseSetPlan(i.setPlan) })),
    exercises
      .filter((e) => !cardio.has(e.exerciseId))
      .map((e) => {
        const own = sets.filter((x) => x.workoutExerciseId === e.id);
        const done = own.filter((x) => x.completedAt !== null);
        return {
          exerciseId: e.exerciseId,
          restSec: e.restSec,
          sets: own,
          doneCount: done.length,
          doneWorking: done.filter((x) => x.kind !== 'warmup').length,
        };
      }),
    unit,
  );
  if (changes.length === 0) return null;
  return { workoutId, routineId: routine.id, routineName: routine.name, unit, changes };
}

/** 루틴에서 세트별로 정해 둔 종목의 계획 (종목 id → 계획) */
export function routinePlans(db: AppDatabase, routineId: string): Map<string, SetPlan> {
  const rows = db
    .select({
      exerciseId: schema.routineExercises.exerciseId,
      setPlan: schema.routineExercises.setPlan,
    })
    .from(schema.routineExercises)
    .where(
      and(
        eq(schema.routineExercises.routineId, routineId),
        isNull(schema.routineExercises.deletedAt),
        isNotNull(schema.routineExercises.setPlan),
      ),
    )
    .orderBy(asc(schema.routineExercises.position))
    .all();
  const map = new Map<string, SetPlan>();
  for (const r of rows) {
    const plan = parseSetPlan(r.setPlan);
    if (plan && !map.has(r.exerciseId)) map.set(r.exerciseId, plan);
  }
  return map;
}

/** '루틴 바꾸기': 오늘 한 대로 루틴을 고친다(세트별 계획, 추가한 종목, 뺀 종목). */
export function applyRoutineUpdate(
  db: AppDatabase,
  update: Pick<PendingRoutineUpdate, 'routineId' | 'unit' | 'changes'>,
  makeId: () => string = newId,
) {
  const now = Date.now();
  db.transaction((tx) => {
    for (const c of update.changes) {
      if (c.type === 'removed') {
        tx.update(schema.routineExercises)
          .set({ deletedAt: now, dirty: 1 })
          .where(eq(schema.routineExercises.id, c.routineExerciseId))
          .run();
      } else if (c.type === 'sets') {
        tx.update(schema.routineExercises)
          .set({
            setPlan: serializeSetPlan(c.plan),
            targetSets: rangeFromPlan(c.plan, false).targetSets,
            dirty: 1,
          })
          .where(eq(schema.routineExercises.id, c.routineExerciseId))
          .run();
      }
    }

    const added = update.changes.filter((c) => c.type === 'added');
    if (added.length === 0) return;
    const live = tx
      .select({ id: schema.routineExercises.id, exerciseId: schema.routineExercises.exerciseId })
      .from(schema.routineExercises)
      .where(
        and(
          eq(schema.routineExercises.routineId, update.routineId),
          isNull(schema.routineExercises.deletedAt),
        ),
      )
      .orderBy(asc(schema.routineExercises.position))
      .all();
    // 새 종목을 운동에서 바로 앞에 있던 종목 뒤에 끼운다(앞 종목이 없으면 맨 앞).
    const order: { id: string; exerciseId: string }[] = [...live];
    for (const c of added) {
      const id = makeId();
      tx.insert(schema.routineExercises)
        .values({
          id,
          routineId: update.routineId,
          exerciseId: c.exerciseId,
          position: order.length,
          targetSets: c.targetSets,
          restSec: c.restSec,
          increment: update.unit === 'lb' ? 5 : 2.5,
          incrementUnit: update.unit,
        })
        .run();
      const after = c.afterExerciseId
        ? order.findIndex((o) => o.exerciseId === c.afterExerciseId)
        : -1;
      order.splice(after + 1, 0, { id, exerciseId: c.exerciseId });
    }
    order.forEach((o, position) => {
      tx.update(schema.routineExercises)
        .set({ position, dirty: 1 })
        .where(eq(schema.routineExercises.id, o.id))
        .run();
    });
    tx.update(schema.routines)
      .set({ dirty: 1 })
      .where(eq(schema.routines.id, update.routineId))
      .run();
  });
}
