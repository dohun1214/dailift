import { and, count, desc, eq, gte, isNull, lte, max } from 'drizzle-orm';

import {
  type Amount,
  type CustomFoodInput,
  type FoodItem,
  type FoodLog,
  LIMITS,
  type Nutrients,
  toPer100,
} from '@/domain/diet';
import { newId } from '@/lib/id';

import type { FoodSrc, Meal } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

type IdFn = () => string;
type LogRow = typeof schema.foodLogs.$inferSelect;
type FoodRow = typeof schema.foods.$inferSelect;

export const toFoodLog = (r: LogRow): FoodLog => ({
  id: r.id,
  date: r.date,
  meal: r.meal,
  position: r.position,
  src: r.src,
  sid: r.sid,
  name: r.name,
  basis: r.basis,
  grams: r.grams,
  unit: r.unitGrams !== null && r.unitGrams > 0 ? { name: r.unitName, grams: r.unitGrams } : null,
  kcal: r.kcal,
  protein: r.protein,
  carb: r.carb,
  fat: r.fat,
  createdAt: r.createdAt,
});

const amountColumns = (amount: Amount) => ({
  grams: amount.grams,
  unitGrams: amount.unit?.grams ?? null,
  unitName: amount.unit?.name ?? null,
});

// ---------- 먹은 기록

export function logsOn(db: AppDatabase, date: string): FoodLog[] {
  return db
    .select()
    .from(schema.foodLogs)
    .where(and(eq(schema.foodLogs.date, date), isNull(schema.foodLogs.deletedAt)))
    .all()
    .map(toFoodLog);
}

/** 끼니의 맨 뒤에 넣는다. 만든 기록의 id를 돌려준다(방금 넣은 것을 되돌릴 때 쓴다) */
export function addFoodLog(
  db: AppDatabase,
  entry: { date: string; meal: Meal; item: FoodItem; amount: Amount },
  makeId: IdFn = newId,
): string {
  const { date, meal, item, amount } = entry;
  const id = makeId();
  db.transaction((tx) => {
    const last = tx
      .select({ p: max(schema.foodLogs.position) })
      .from(schema.foodLogs)
      .where(
        and(
          eq(schema.foodLogs.date, date),
          eq(schema.foodLogs.meal, meal),
          isNull(schema.foodLogs.deletedAt),
        ),
      )
      .get();
    tx.insert(schema.foodLogs)
      .values({
        id,
        date,
        meal,
        position: (last?.p ?? -1) + 1,
        src: item.src,
        sid: item.sid,
        name: item.name,
        basis: item.basis,
        kcal: item.kcal,
        protein: item.protein,
        carb: item.carb,
        fat: item.fat,
        ...amountColumns(amount),
      })
      .run();
  });
  return id;
}

export function updateFoodLogAmount(db: AppDatabase, id: string, amount: Amount) {
  db.update(schema.foodLogs).set(amountColumns(amount)).where(eq(schema.foodLogs.id, id)).run();
}

export function deleteFoodLog(db: AppDatabase, id: string, now = Date.now()) {
  db.update(schema.foodLogs).set({ deletedAt: now }).where(eq(schema.foodLogs.id, id)).run();
}

/** 가장 최근에 넣은 기록들(최근 먹은 음식을 뽑는 데 쓴다) */
export function latestFoodLogs(db: AppDatabase, limit = 300): FoodLog[] {
  return db
    .select()
    .from(schema.foodLogs)
    .where(isNull(schema.foodLogs.deletedAt))
    .orderBy(desc(schema.foodLogs.createdAt))
    .limit(limit)
    .all()
    .map(toFoodLog);
}

/** 그 기간에 적은 음식이 있는 날짜들 (달력의 점) */
export function loggedDates(db: AppDatabase, from: string, to: string): Set<string> {
  const rows = db
    .selectDistinct({ date: schema.foodLogs.date })
    .from(schema.foodLogs)
    .where(
      and(
        gte(schema.foodLogs.date, from),
        lte(schema.foodLogs.date, to),
        isNull(schema.foodLogs.deletedAt),
      ),
    )
    .all();
  return new Set(rows.map((r) => r.date));
}

// ---------- 직접 만든 음식

export const customItem = (r: FoodRow): FoodItem => ({
  src: 'custom',
  sid: r.id,
  name: r.name,
  basis: 'g',
  kcal: r.kcal,
  protein: r.protein,
  carb: r.carb,
  fat: r.fat,
  units: r.serving !== null && r.serving > 0 ? [{ name: r.servingName, grams: r.serving }] : [],
});

export function listCustomFoods(db: AppDatabase): FoodItem[] {
  return db
    .select()
    .from(schema.foods)
    .where(isNull(schema.foods.deletedAt))
    .orderBy(desc(schema.foods.createdAt))
    .all()
    .map(customItem);
}

export function getCustomFood(db: AppDatabase, id: string): FoodRow | null {
  return (
    db
      .select()
      .from(schema.foods)
      .where(and(eq(schema.foods.id, id), isNull(schema.foods.deletedAt)))
      .get() ?? null
  );
}

export function customFoodCount(db: AppDatabase): number {
  return (
    db.select({ n: count() }).from(schema.foods).where(isNull(schema.foods.deletedAt)).get()?.n ?? 0
  );
}

export const canAddCustomFood = (db: AppDatabase) => customFoodCount(db) < LIMITS.customFoods;

const foodValues = (input: CustomFoodInput, per100: Nutrients) => ({
  name: input.name.trim().slice(0, LIMITS.foodName),
  serving: input.serving !== null && input.serving > 0 ? input.serving : null,
  servingName:
    input.serving !== null && input.serving > 0
      ? input.servingName.trim().slice(0, LIMITS.servingName) || null
      : null,
  ...per100,
});

/** 저장하고 id를 돌려준다. 넣을 수 없는 값이면 null(화면이 먼저 `toPer100`으로 확인한다) */
export function createCustomFood(
  db: AppDatabase,
  input: CustomFoodInput,
  makeId: IdFn = newId,
): string | null {
  const r = toPer100(input);
  if (!r.ok || !input.name.trim()) return null;
  const id = makeId();
  db.insert(schema.foods)
    .values({ id, ...foodValues(input, r.per100) })
    .run();
  return id;
}

/** 고쳐도 이미 적은 기록은 그때 값 그대로 둔다 */
export function updateCustomFood(db: AppDatabase, id: string, input: CustomFoodInput): boolean {
  const r = toPer100(input);
  if (!r.ok || !input.name.trim()) return false;
  db.update(schema.foods).set(foodValues(input, r.per100)).where(eq(schema.foods.id, id)).run();
  return true;
}

/** 내 음식을 지운다. 즐겨찾기에서도 빠지고, 이미 적은 기록은 남는다 */
export function deleteCustomFood(db: AppDatabase, id: string, now = Date.now()) {
  db.transaction((tx) => {
    tx.update(schema.foodFavorites)
      .set({ deletedAt: now })
      .where(
        and(
          eq(schema.foodFavorites.src, 'custom'),
          eq(schema.foodFavorites.sid, id),
          isNull(schema.foodFavorites.deletedAt),
        ),
      )
      .run();
    tx.update(schema.foods).set({ deletedAt: now }).where(eq(schema.foods.id, id)).run();
  });
}

// ---------- 즐겨찾기

const sameFood = (src: FoodSrc, sid: string) =>
  and(eq(schema.foodFavorites.src, src), eq(schema.foodFavorites.sid, sid));

export function isFavorite(db: AppDatabase, src: FoodSrc, sid: string): boolean {
  return (
    db
      .select({ id: schema.foodFavorites.id })
      .from(schema.foodFavorites)
      .where(and(sameFood(src, sid), isNull(schema.foodFavorites.deletedAt)))
      .limit(1)
      .all().length > 0
  );
}

/** 켜면 한 줄을 만들고(전에 껐던 줄이 있으면 되살린다), 끄면 그 음식의 줄을 모두 지운 것으로 표시한다 */
export function setFavorite(
  db: AppDatabase,
  src: FoodSrc,
  sid: string,
  on: boolean,
  now = Date.now(),
  makeId: IdFn = newId,
) {
  db.transaction((tx) => {
    if (!on) {
      tx.update(schema.foodFavorites)
        .set({ deletedAt: now })
        .where(and(sameFood(src, sid), isNull(schema.foodFavorites.deletedAt)))
        .run();
      return;
    }
    const rows = tx
      .select({ id: schema.foodFavorites.id, deletedAt: schema.foodFavorites.deletedAt })
      .from(schema.foodFavorites)
      .where(sameFood(src, sid))
      .all();
    if (rows.some((r) => r.deletedAt === null)) return;
    const [old] = rows;
    if (old) {
      tx.update(schema.foodFavorites)
        .set({ deletedAt: null, createdAt: now })
        .where(eq(schema.foodFavorites.id, old.id))
        .run();
    } else {
      tx.insert(schema.foodFavorites).values({ id: makeId(), src, sid, createdAt: now }).run();
    }
  });
}

/** 즐겨찾기한 음식(최근에 넣은 순, 같은 음식은 한 번만) */
export function listFavorites(db: AppDatabase): { src: FoodSrc; sid: string }[] {
  const rows = db
    .select({ src: schema.foodFavorites.src, sid: schema.foodFavorites.sid })
    .from(schema.foodFavorites)
    .where(isNull(schema.foodFavorites.deletedAt))
    .orderBy(desc(schema.foodFavorites.createdAt))
    .all();
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.src}:${r.sid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
