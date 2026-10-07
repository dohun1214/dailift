import { and, asc, eq, inArray, isNull, max, notInArray } from 'drizzle-orm';

import { type DraftItem, LIMITS, type RoutineDraft } from '@/domain/routine-draft';
import { parseSetPlan, rangeFromPlan, serializeSetPlan } from '@/domain/set-plan';
import { newId } from '@/lib/id';

import * as schema from './schema';
import type { AppDatabase } from './seed';

type IdFn = () => string;

/** 저장된 루틴을 편집용 초안으로 읽는다. 없거나 지워졌으면 null */
export function loadRoutineDraft(db: AppDatabase, id: string): RoutineDraft | null {
  const routine = db
    .select()
    .from(schema.routines)
    .where(and(eq(schema.routines.id, id), isNull(schema.routines.deletedAt)))
    .get();
  if (!routine) return null;
  const rows = db
    .select()
    .from(schema.routineExercises)
    .where(
      and(eq(schema.routineExercises.routineId, id), isNull(schema.routineExercises.deletedAt)),
    )
    .orderBy(asc(schema.routineExercises.position))
    .all();
  return {
    id: routine.id,
    groupId: routine.groupId,
    name: routine.name,
    weekdays: routine.weekdays,
    items: rows.map(
      (r): DraftItem => ({
        key: r.id,
        rowId: r.id,
        exerciseId: r.exerciseId,
        targetSets: r.targetSets,
        repMin: r.repMin,
        repMax: r.repMax,
        restSec: r.restSec,
        increment: r.increment,
        incrementUnit: r.incrementUnit,
        note: r.note,
        plan: parseSetPlan(r.setPlan),
      }),
    ),
  };
}

export function emptyRoutineDraft(): RoutineDraft {
  return { id: null, groupId: null, name: '', weekdays: 0, items: [] };
}

/**
 * 초안을 저장한다. 새 루틴이면 단독 루틴 맨 뒤에 만든다.
 * 초안에서 빠진 종목은 툼스톤 처리하고, 남은 종목은 화면 순서대로 position을 다시 매긴다.
 * 저장된 루틴 id를 돌려준다.
 */
export function saveRoutineDraft(
  db: AppDatabase,
  draft: RoutineDraft,
  makeId: IdFn = newId,
): string {
  const routineId = draft.id ?? makeId();
  const now = Date.now();
  db.transaction((tx) => {
    const name = draft.name.trim();
    if (draft.id === null) {
      const [last] = tx
        .select({ value: max(schema.routines.sortOrder) })
        .from(schema.routines)
        .where(isNull(schema.routines.groupId))
        .all();
      tx.insert(schema.routines)
        .values({
          id: routineId,
          groupId: draft.groupId,
          name,
          weekdays: draft.weekdays,
          sortOrder: (last?.value ?? -1) + 1,
        })
        .run();
    } else {
      tx.update(schema.routines)
        .set({ name, weekdays: draft.weekdays, dirty: 1 })
        .where(eq(schema.routines.id, routineId))
        .run();
    }

    const keep = draft.items.map((i) => i.rowId).filter((id): id is string => id !== null);
    tx.update(schema.routineExercises)
      .set({ deletedAt: now, dirty: 1 })
      .where(
        and(
          eq(schema.routineExercises.routineId, routineId),
          isNull(schema.routineExercises.deletedAt),
          keep.length > 0 ? notInArray(schema.routineExercises.id, keep) : undefined,
        ),
      )
      .run();

    draft.items.forEach((item, position) => {
      const reps = savedRepRange(item);
      const values = {
        exerciseId: item.exerciseId,
        position,
        // 세트별로 정한 종목은 목록 · 예상 시간 계산이 맞도록 본 세트 수를 같이 적어 둔다.
        targetSets: item.plan ? rangeFromPlan(item.plan, false).targetSets : item.targetSets,
        repMin: reps.min,
        repMax: reps.max,
        restSec: item.restSec,
        increment: item.increment,
        incrementUnit: item.incrementUnit,
        note: item.note,
        setPlan: serializeSetPlan(item.plan),
      };
      if (item.rowId) {
        tx.update(schema.routineExercises)
          .set({ ...values, dirty: 1 })
          .where(eq(schema.routineExercises.id, item.rowId))
          .run();
      } else {
        tx.insert(schema.routineExercises)
          .values({ id: makeId(), routineId, ...values })
          .run();
      }
    });
  });
  return routineId;
}

/** 루틴과 그 종목을 툼스톤 처리한다. 지난 운동 기록은 이름 스냅샷이 있어 그대로 남는다. */
export function deleteRoutine(db: AppDatabase, id: string) {
  const now = Date.now();
  db.transaction((tx) => {
    tx.update(schema.routines)
      .set({ deletedAt: now, dirty: 1 })
      .where(eq(schema.routines.id, id))
      .run();
    tx.update(schema.routineExercises)
      .set({ deletedAt: now, dirty: 1 })
      .where(
        and(eq(schema.routineExercises.routineId, id), isNull(schema.routineExercises.deletedAt)),
      )
      .run();
  });
}

export type CustomExerciseInput = {
  name: string;
  type: schema.ExerciseType;
  equipment: schema.Equipment;
  primary: readonly string[];
  secondary: readonly string[];
};

/** 커스텀 종목을 만든다. 주동근은 1개 이상 필수, 주동근과 겹친 협응근은 버린다. */
export function createCustomExercise(
  db: AppDatabase,
  input: CustomExerciseInput,
  makeId: IdFn = newId,
): string {
  const name = input.name.trim();
  if (!name) throw new Error('name required');
  // 유산소는 근육을 지정하지 않는다.
  if (input.type !== 'cardio' && input.primary.length === 0)
    throw new Error('primary muscle required');
  const id = makeId();
  const secondary = input.secondary.filter((m) => !input.primary.includes(m));
  db.transaction((tx) => {
    tx.insert(schema.exercises)
      .values({ id, isCustom: 1, name, type: input.type, equipment: input.equipment })
      .run();
    const muscles = [
      ...input.primary.map((muscleId) => ({
        id: makeId(),
        exerciseId: id,
        muscleId,
        role: 'primary' as const,
      })),
      ...secondary.map((muscleId) => ({
        id: makeId(),
        exerciseId: id,
        muscleId,
        role: 'secondary' as const,
      })),
    ];
    if (muscles.length > 0) tx.insert(schema.exerciseMuscles).values(muscles).run();
  });
  return id;
}

/** 같은 이름의 직접 만든 종목이 이미 있는지 (대소문자 · 앞뒤 공백 무시, `exceptId`는 자기 자신) */
export function customNameTaken(db: AppDatabase, name: string, exceptId?: string): boolean {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return false;
  return db
    .select({ id: schema.exercises.id, name: schema.exercises.name })
    .from(schema.exercises)
    .where(and(eq(schema.exercises.isCustom, 1), isNull(schema.exercises.deletedAt)))
    .all()
    .some((e) => e.id !== exceptId && (e.name ?? '').trim().toLowerCase() === wanted);
}

/** 직접 만든 종목의 이름을 바꾼다. 지난 기록에도 바뀐 이름으로 보인다. */
export function renameCustomExercise(
  db: AppDatabase,
  exerciseId: string,
  name: string,
): 'ok' | 'empty' | 'duplicate' {
  const next = name.trim();
  if (!next) return 'empty';
  if (customNameTaken(db, next, exerciseId)) return 'duplicate';
  db.update(schema.exercises)
    .set({ name: next, dirty: 1 })
    .where(and(eq(schema.exercises.id, exerciseId), eq(schema.exercises.isCustom, 1)))
    .run();
  return 'ok';
}

/**
 * 직접 만든 종목을 지운다. 종목 목록과 루틴에서 빠지고, 지난 운동 기록은 그대로 남는다
 * (종목 행은 지워진 것으로 표시만 해서 기록의 이름 · 부위를 계속 보여 준다).
 */
export function deleteCustomExercise(db: AppDatabase, exerciseId: string, now = Date.now()) {
  db.transaction((tx) => {
    tx.update(schema.exercises)
      .set({ deletedAt: now, dirty: 1 })
      .where(and(eq(schema.exercises.id, exerciseId), eq(schema.exercises.isCustom, 1)))
      .run();
    tx.update(schema.routineExercises)
      .set({ deletedAt: now, dirty: 1 })
      .where(
        and(
          eq(schema.routineExercises.exerciseId, exerciseId),
          isNull(schema.routineExercises.deletedAt),
        ),
      )
      .run();
  });
}

/** 종목 id 목록 → 휴식 기본값(설정값, 없으면 맨몸·시간 종목 60초·나머지 90초) */
export function defaultRestFor(
  db: AppDatabase,
  ids: readonly string[],
  restSec?: number,
): Map<string, number> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: schema.exercises.id, type: schema.exercises.type })
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, [...ids]))
    .all();
  return new Map(rows.map((r) => [r.id, restSec ?? (r.type === 'weight_reps' ? 90 : 60)]));
}

/** 종목 id 목록 → 유산소 종목들 (방금 만든 종목도 맞게 나오도록 DB에서 바로 읽는다) */
export function cardioExerciseIds(db: AppDatabase, ids: readonly string[]): Set<string> {
  if (ids.length === 0) return new Set();
  const rows = db
    .select({ id: schema.exercises.id, type: schema.exercises.type })
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, [...ids]))
    .all();
  return new Set(rows.filter((r) => r.type === 'cardio').map((r) => r.id));
}

/** 종목 id 목록 → 시간으로 재는 종목들. 방금 만든 종목도 맞게 나오도록 DB에서 바로 읽는다. */
export function timeExerciseIds(db: AppDatabase, ids: readonly string[]): Set<string> {
  if (ids.length === 0) return new Set();
  const rows = db
    .select({ id: schema.exercises.id, type: schema.exercises.type })
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, [...ids]))
    .all();
  return new Set(rows.filter((r) => r.type === 'time').map((r) => r.id));
}

/**
 * 저장할 횟수 범위. 세트별로 정한 종목은 그 세트들의 값에서 가져오고(목록에 옛 범위가 남지 않게),
 * 값이 없으면 화면에 있던 범위를, 그것도 비어 있으면 기본 범위를 쓴다.
 */
function savedRepRange(item: DraftItem): { min: number; max: number } {
  const ok = (v: number) => Number.isInteger(v) && v >= LIMITS.reps.min;
  const fallback = {
    min: ok(item.repMin) ? item.repMin : 8,
    max: ok(item.repMax) ? item.repMax : Math.max(12, ok(item.repMin) ? item.repMin : 12),
  };
  if (!item.plan) return fallback;
  const range = rangeFromPlan(item.plan, false).range ?? rangeFromPlan(item.plan, true).range;
  return range ?? fallback;
}
