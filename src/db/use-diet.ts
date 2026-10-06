import { and, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { dayView, dietTargets, type FoodItem, recentFoods } from '@/domain/diet';
import type { ProcessedFood } from '@/domain/processed-food';
import { useDietGoals } from '@/stores/diet-goals';
import { useProfile } from '@/stores/profile';

import { db } from './client';
import { customItem, toFoodLog } from './diet';
import { buildSets } from './diet-sets';
import { toProcessedFood } from './food-cache';
import * as schema from './schema';

/** 그날의 끼니별 기록과 합계. DB가 바뀌면 다시 계산된다. */
export function useDietDay(date: string) {
  const { data: rows } = useLiveQuery(
    db
      .select()
      .from(schema.foodLogs)
      .where(and(eq(schema.foodLogs.date, date), isNull(schema.foodLogs.deletedAt))),
    [date],
  );
  return useMemo(() => dayView(rows.map(toFoodLog)), [rows]);
}

/** 식단을 한 번이라도 적은 적이 있는지 (홈 카드 · 처음 안내) */
export function useHasDietLogs(): boolean {
  const { data } = useLiveQuery(
    db
      .select({ id: schema.foodLogs.id })
      .from(schema.foodLogs)
      .where(isNull(schema.foodLogs.deletedAt))
      .limit(1),
  );
  return data.length > 0;
}

/** 지금 쓰는 하루 목표(없는 것은 null) */
export function useDietTargets() {
  const goals = useDietGoals();
  const weight = useProfile((s) => s.weight);
  const weightUnit = useProfile((s) => s.weightUnit);
  const goal = useProfile((s) => s.goal);
  return useMemo(
    () =>
      dietTargets(
        {
          proteinMode: goals.proteinMode,
          proteinPerKg: goals.proteinPerKg,
          proteinDirect: goals.proteinDirect,
          kcal: goals.kcal,
          carb: goals.carb,
          fat: goals.fat,
        },
        { weight, weightUnit, goal },
      ),
    [
      goals.proteinMode,
      goals.proteinPerKg,
      goals.proteinDirect,
      goals.kcal,
      goals.carb,
      goals.fat,
      weight,
      weightUnit,
      goal,
    ],
  );
}

/** 음식 찾기 화면에 쓰는 것: 내 음식, 최근 먹은 음식, 즐겨찾기 목록(출처 + id) */
export function useFoodLists() {
  const { data: foodRows } = useLiveQuery(
    db
      .select()
      .from(schema.foods)
      .where(isNull(schema.foods.deletedAt))
      .orderBy(desc(schema.foods.createdAt)),
  );
  const { data: logRows } = useLiveQuery(
    db
      .select()
      .from(schema.foodLogs)
      .where(isNull(schema.foodLogs.deletedAt))
      .orderBy(desc(schema.foodLogs.createdAt))
      .limit(300),
  );
  const { data: favRows } = useLiveQuery(
    db
      .select({ src: schema.foodFavorites.src, sid: schema.foodFavorites.sid })
      .from(schema.foodFavorites)
      .where(isNull(schema.foodFavorites.deletedAt))
      .orderBy(desc(schema.foodFavorites.createdAt)),
  );
  return useMemo(() => {
    const mine: FoodItem[] = foodRows.map(customItem);
    const seen = new Set<string>();
    const favorites = favRows.filter((r) => {
      const key = `${r.src}:${r.sid}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { mine, recent: recentFoods(logRows.map(toFoodLog)), favorites };
  }, [foodRows, logRows, favRows]);
}

/** 이 기기에 사본이 있는 가공식품 (식품코드 → 음식). 즐겨찾기 목록과 만든 회사 표시에 쓴다 */
export function useProcessedCache(): ReadonlyMap<string, ProcessedFood> {
  const { data } = useLiveQuery(db.select().from(schema.foodCache));
  return useMemo(() => new Map(data.map((r) => [r.sid, toProcessedFood(r)])), [data]);
}

/** 세트 목록(담은 음식 포함). 두 표 가운데 어느 쪽이 바뀌어도 다시 계산된다. */
export function useFoodSets() {
  const { data: sets } = useLiveQuery(
    db.select().from(schema.foodSets).where(isNull(schema.foodSets.deletedAt)),
  );
  const { data: items } = useLiveQuery(
    db.select().from(schema.foodSetItems).where(isNull(schema.foodSetItems.deletedAt)),
  );
  return useMemo(() => buildSets(sets, items), [sets, items]);
}
