import { and, asc, eq, inArray, isNull, max, notInArray } from 'drizzle-orm';

import type { DraftItem, RoutineDraft } from '@/domain/routine-draft';
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
      const values = {
        exerciseId: item.exerciseId,
        position,
        targetSets: item.targetSets,
        repMin: item.repMin,
        repMax: item.repMax,
        restSec: item.restSec,
        increment: item.increment,
        incrementUnit: item.incrementUnit,
        note: item.note,
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
  if (input.primary.length === 0) throw new Error('primary muscle required');
  const id = makeId();
  const secondary = input.secondary.filter((m) => !input.primary.includes(m));
  db.transaction((tx) => {
    tx.insert(schema.exercises)
      .values({ id, isCustom: 1, name, type: input.type, equipment: input.equipment })
      .run();
    tx.insert(schema.exerciseMuscles)
      .values([
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
      ])
      .run();
  });
  return id;
}

/** 종목 id 목록 → 휴식 기본값(맨몸·시간 종목은 60초, 나머지 90초) */
export function defaultRestFor(db: AppDatabase, ids: readonly string[]): Map<string, number> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: schema.exercises.id, type: schema.exercises.type })
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, [...ids]))
    .all();
  return new Map(rows.map((r) => [r.id, r.type === 'weight_reps' ? 90 : 60]));
}
