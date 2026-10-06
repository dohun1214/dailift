/** 음식 DB의 음식을 식단에서 쓰는 모양(`FoodItem`)으로 바꾼다. */
import { type FoodItem, type FoodUnit, sameUnit } from '@/domain/diet';

import { type CatalogFood, type FoodDb, type FoodPortion, findFood, foodPortions } from './catalog';

/** 기본 1회 양을 맨 앞에, 그 뒤에 가정 단위("1 cup")를 붙인다(같은 것은 한 번만) */
export function catalogItem(food: CatalogFood, portions: readonly FoodPortion[] = []): FoodItem {
  const units: FoodUnit[] = [];
  const add = (u: FoodUnit) => {
    if (u.grams > 0 && !units.some((x) => sameUnit(x, u))) units.push(u);
  };
  if (food.serving !== null) add({ name: food.servingName, grams: food.serving });
  for (const p of portions) add({ name: p.name, grams: p.grams });
  return {
    src: food.src,
    sid: food.sid,
    name: food.name,
    basis: food.basis,
    kcal: food.kcal,
    protein: food.protein,
    carb: food.carb,
    fat: food.fat,
    units,
  };
}

/** 단위를 모두 채운 음식(양 창을 열 때). 지금 DB에 없으면 null */
export function loadCatalogItem(db: FoodDb, src: 'usda' | 'mfds', sid: string): FoodItem | null {
  const food = findFood(db, src, sid);
  return food ? catalogItem(food, foodPortions(db, food.id)) : null;
}
