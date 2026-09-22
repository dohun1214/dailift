import { and, asc, eq, gt, isNull, max, sql } from 'drizzle-orm';

import { baseExerciseId } from '@/data/exercises';
import { findTemplate } from '@/data/templates';
import type { AppLanguage } from '@/i18n/resolve-language';
import { newId } from '@/lib/id';
import { toMask } from '@/lib/weekdays';
import type { WeightUnit } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

type IdFn = () => string;

/** 증량 제안 기본값: kg 2.5 / lb 5 */
export function defaultIncrement(unit: WeightUnit): number {
  return unit === 'lb' ? 5 : 2.5;
}

/**
 * 추천 루틴을 묶음째 내 루틴으로 복사한다. 원본(템플릿)은 코드에 있어서 바뀌지 않는다.
 * 같은 템플릿을 여러 번 복사해도 각각 새 묶음이 된다. 새 묶음 id를 돌려준다.
 */
export function copyTemplate(
  db: AppDatabase,
  key: string,
  opts: { lang: AppLanguage; weightUnit: WeightUnit },
  makeId: IdFn = newId,
): string {
  const template = findTemplate(key);
  if (!template) throw new Error(`unknown template: ${key}`);
  const groupId = makeId();
  db.transaction((tx) => {
    const [last] = tx
      .select({ value: max(schema.routineGroups.sortOrder) })
      .from(schema.routineGroups)
      .all();
    tx.insert(schema.routineGroups)
      .values({
        id: groupId,
        name: opts.lang === 'ko' ? template.ko : template.en,
        templateKey: template.key,
        sortOrder: (last?.value ?? -1) + 1,
      })
      .run();
    template.routines.forEach((r, i) => {
      const routineId = makeId();
      tx.insert(schema.routines)
        .values({
          id: routineId,
          groupId,
          name: opts.lang === 'ko' ? r.ko : r.en,
          weekdays: toMask(r.weekdays),
          sortOrder: i,
        })
        .run();
      tx.insert(schema.routineExercises)
        .values(
          r.exercises.map((e, position) => ({
            id: makeId(),
            routineId,
            exerciseId: baseExerciseId(e.key),
            position,
            targetSets: e.sets,
            repMin: e.repMin,
            repMax: e.repMax,
            restSec: e.restSec,
            increment: defaultIncrement(opts.weightUnit),
            incrementUnit: opts.weightUnit,
          })),
        )
        .run();
    });
  });
  return groupId;
}

/**
 * 루틴을 같은 묶음 안에 복제한다(바로 뒤 순서). 종목 설정까지 복사하고 요일은 비운다
 * — 같은 요일에 루틴이 둘 생기지 않게. 새 루틴 id를 돌려준다.
 */
export function duplicateRoutine(
  db: AppDatabase,
  routineId: string,
  name: string,
  makeId: IdFn = newId,
): string {
  const newRoutineId = makeId();
  db.transaction((tx) => {
    const source = tx
      .select()
      .from(schema.routines)
      .where(and(eq(schema.routines.id, routineId), isNull(schema.routines.deletedAt)))
      .get();
    if (!source) throw new Error(`routine not found: ${routineId}`);
    // 뒤따르는 루틴을 한 칸씩 밀어 복제본이 원본 바로 뒤에 오게 한다.
    tx.update(schema.routines)
      .set({ sortOrder: sql`${schema.routines.sortOrder} + 1`, dirty: 1 })
      .where(
        and(
          source.groupId === null
            ? isNull(schema.routines.groupId)
            : eq(schema.routines.groupId, source.groupId),
          gt(schema.routines.sortOrder, source.sortOrder),
          isNull(schema.routines.deletedAt),
        ),
      )
      .run();
    tx.insert(schema.routines)
      .values({
        id: newRoutineId,
        groupId: source.groupId,
        name,
        weekdays: 0,
        reminderTime: null,
        sortOrder: source.sortOrder + 1,
      })
      .run();
    const items = tx
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
    if (items.length > 0) {
      tx.insert(schema.routineExercises)
        .values(
          items.map((e) => ({
            id: makeId(),
            routineId: newRoutineId,
            exerciseId: e.exerciseId,
            position: e.position,
            targetSets: e.targetSets,
            repMin: e.repMin,
            repMax: e.repMax,
            restSec: e.restSec,
            increment: e.increment,
            incrementUnit: e.incrementUnit,
            note: e.note,
          })),
        )
        .run();
    }
  });
  return newRoutineId;
}
