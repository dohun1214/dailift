import { db } from '@/db/client';
import { customItem, getCustomFood } from '@/db/diet';
import { type FoodItem, type FoodUnit, withUnit } from '@/domain/diet';

import type { FoodDb } from './catalog';
import { loadCatalogItem } from './items';

/**
 * 양 창에 넘길 음식: 고를 수 있는 단위를 모두 채운다(음식 DB의 가정 단위, 내 음식의 1회 제공량).
 * 영양값과 이름은 받은 그대로 둔다 — 기록 · 세트에 남긴 그때 값을 써야 하기 때문이다.
 * `current`(지금 쓰고 있는 단위)가 목록에 없으면 앞에 끼워 넣는다. 음식이 없어졌으면 받은 단위만 남는다.
 */
export function withAllUnits(
  item: FoodItem,
  current: FoodUnit | null,
  foodDb: FoodDb | null,
): FoodItem {
  let found: FoodItem | null = null;
  if (item.src === 'custom') {
    const row = getCustomFood(db, item.sid);
    found = row ? customItem(row) : null;
  } else if (foodDb) {
    found = loadCatalogItem(foodDb, item.src, item.sid);
  }
  return { ...item, units: withUnit(found?.units ?? item.units, current) };
}
