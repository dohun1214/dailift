import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';

import { type FoodSet, LIMITS, type SetItem } from '@/domain/diet';
import { newId } from '@/lib/id';

import { addFoodLog } from './diet';
import type { Meal } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

type IdFn = () => string;
type SetRow = typeof schema.foodSets.$inferSelect;
type ItemRow = typeof schema.foodSetItems.$inferSelect;

export const toSetItem = (r: ItemRow): SetItem => {
  const unit =
    r.unitGrams !== null && r.unitGrams > 0 ? { name: r.unitName, grams: r.unitGrams } : null;
  return {
    item: {
      src: r.src,
      sid: r.sid,
      name: r.name,
      basis: r.basis,
      kcal: r.kcal,
      protein: r.protein,
      carb: r.carb,
      fat: r.fat,
      units: unit ? [unit] : [],
    },
    amount: { grams: r.grams, unit },
  };
};

/** 세트 줄과 음식 줄을 묶는다(최근에 만든 세트가 먼저, 세트 안은 담은 순서) */
export function buildSets(sets: readonly SetRow[], items: readonly ItemRow[]): FoodSet[] {
  const bySet = new Map<string, ItemRow[]>();
  for (const r of items) {
    const list = bySet.get(r.setId) ?? [];
    list.push(r);
    bySet.set(r.setId, list);
  }
  return [...sets]
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      items: (bySet.get(s.id) ?? [])
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .map(toSetItem),
    }));
}

export function listSets(db: AppDatabase): FoodSet[] {
  const sets = db
    .select()
    .from(schema.foodSets)
    .where(isNull(schema.foodSets.deletedAt))
    .orderBy(desc(schema.foodSets.createdAt))
    .all();
  const items = db
    .select()
    .from(schema.foodSetItems)
    .where(isNull(schema.foodSetItems.deletedAt))
    .orderBy(asc(schema.foodSetItems.position))
    .all();
  return buildSets(sets, items);
}

export function getSet(db: AppDatabase, id: string): FoodSet | null {
  const row = db
    .select()
    .from(schema.foodSets)
    .where(and(eq(schema.foodSets.id, id), isNull(schema.foodSets.deletedAt)))
    .get();
  if (!row) return null;
  const items = db
    .select()
    .from(schema.foodSetItems)
    .where(and(eq(schema.foodSetItems.setId, id), isNull(schema.foodSetItems.deletedAt)))
    .all();
  return buildSets([row], items)[0] ?? null;
}

export function setCount(db: AppDatabase): number {
  return (
    db.select({ n: count() }).from(schema.foodSets).where(isNull(schema.foodSets.deletedAt)).get()
      ?.n ?? 0
  );
}

export const canAddSet = (db: AppDatabase) => setCount(db) < LIMITS.sets;

const cleanName = (name: string) => name.trim().slice(0, LIMITS.setName);

const itemValues = (setId: string, position: number, { item, amount }: SetItem, id: string) => ({
  id,
  setId,
  position,
  src: item.src,
  sid: item.sid,
  name: item.name,
  basis: item.basis,
  kcal: item.kcal,
  protein: item.protein,
  carb: item.carb,
  fat: item.fat,
  grams: amount.grams,
  unitGrams: amount.unit?.grams ?? null,
  unitName: amount.unit?.name ?? null,
});

/** 이름이 비었거나 담은 음식이 없으면 만들지 않는다(null) */
export function createSet(
  db: AppDatabase,
  name: string,
  items: readonly SetItem[],
  makeId: IdFn = newId,
): string | null {
  const list = items.slice(0, LIMITS.setItems);
  if (!cleanName(name) || list.length === 0) return null;
  const id = makeId();
  db.transaction((tx) => {
    tx.insert(schema.foodSets)
      .values({ id, name: cleanName(name) })
      .run();
    list.forEach((it, i) => {
      tx.insert(schema.foodSetItems)
        .values(itemValues(id, i, it, makeId()))
        .run();
    });
  });
  return id;
}

/** 이름과 담은 음식을 통째로 바꾼다(전의 음식 줄은 지운 것으로 표시하고 새로 넣는다). 이미 적은 기록은 그대로다 */
export function updateSet(
  db: AppDatabase,
  id: string,
  name: string,
  items: readonly SetItem[],
  now = Date.now(),
  makeId: IdFn = newId,
): boolean {
  const list = items.slice(0, LIMITS.setItems);
  if (!cleanName(name) || list.length === 0) return false;
  db.transaction((tx) => {
    tx.update(schema.foodSets)
      .set({ name: cleanName(name) })
      .where(eq(schema.foodSets.id, id))
      .run();
    tx.update(schema.foodSetItems)
      .set({ deletedAt: now })
      .where(and(eq(schema.foodSetItems.setId, id), isNull(schema.foodSetItems.deletedAt)))
      .run();
    list.forEach((it, i) => {
      tx.insert(schema.foodSetItems)
        .values(itemValues(id, i, it, makeId()))
        .run();
    });
  });
  return true;
}

export function deleteSet(db: AppDatabase, id: string, now = Date.now()) {
  db.transaction((tx) => {
    tx.update(schema.foodSetItems)
      .set({ deletedAt: now })
      .where(and(eq(schema.foodSetItems.setId, id), isNull(schema.foodSetItems.deletedAt)))
      .run();
    tx.update(schema.foodSets).set({ deletedAt: now }).where(eq(schema.foodSets.id, id)).run();
  });
}

/** 세트의 음식을 끼니에 하나씩 넣는다. 만든 기록의 id들을 돌려준다(되돌릴 때 쓴다) */
export function addItemsToMeal(
  db: AppDatabase,
  entry: { date: string; meal: Meal; items: readonly SetItem[] },
  makeId: IdFn = newId,
): string[] {
  return db.transaction((tx) =>
    entry.items.map(({ item, amount }) =>
      addFoodLog(tx, { date: entry.date, meal: entry.meal, item, amount }, makeId),
    ),
  );
}

/** 방금 넣은 기록들을 한꺼번에 지운다(되돌리기) */
export function deleteFoodLogs(db: AppDatabase, ids: readonly string[], now = Date.now()) {
  if (ids.length === 0) return;
  db.update(schema.foodLogs)
    .set({ deletedAt: now })
    .where(inArray(schema.foodLogs.id, [...ids]))
    .run();
}
