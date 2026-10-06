/** 앱에 넣은 음식 DB(읽기 전용)에서 찾기. DB를 여는 것은 `food-db.ts`, 여기는 열린 DB만 받는다(테스트는 better-sqlite3로). */
import { buildFoodQuery, type FoodSource } from '@/domain/food-search';
import { matchesSearch } from '@/lib/hangul';

/** 열린 음식 DB. expo-sqlite와 better-sqlite3를 같은 모양으로 쓴다. */
export interface FoodDb {
  all<T>(sql: string, params: (string | number)[]): T[];
}

export type CatalogFood = {
  /** 음식 DB 안의 줄 번호. DB를 새로 만들면 바뀔 수 있으니 기록에는 `src` + `sid`를 남긴다 */
  id: number;
  src: FoodSource;
  /** 출처에서 쓰는 id (USDA fdc_id, 식약처 식품코드) */
  sid: string;
  name: string;
  /** 아래 넷은 100g(또는 100ml)당 */
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  basis: 'g' | 'ml';
  /** 기본 1회 양(g 또는 ml). 모르면 null */
  serving: number | null;
  /** 그 양의 이름 ("1 cup"). 없으면 null */
  servingName: string | null;
};

export type FoodPortion = { name: string; grams: number };

const COLUMNS =
  'id, src, sid, name, kcal, protein, carb, fat, basis, serving, serving_name AS servingName';

export function searchFoods(
  db: FoodDb,
  query: string,
  sources: readonly FoodSource[],
  limit = 50,
): CatalogFood[] {
  const q = buildFoodQuery(query, sources, limit);
  if (!q) return [];
  const rows = db.all<CatalogFood>(q.sql, q.params);
  if (q.refine === null) return rows;
  const refine = q.refine;
  // 이름의 밑줄 · 쉼표 같은 구분 글자는 빼고 견준다(초성 칸도 그렇게 만들어져 있다).
  return rows
    .filter((r) =>
      matchesSearch(refine, [r.name.replace(/[^0-9a-zA-Z%\u3131-\u318e\uac00-\ud7a3]/g, '')]),
    )
    .slice(0, limit);
}

/** 기록에 남긴 출처 + id로 다시 찾는다(즐겨찾기 · 최근 음식). 지금 DB에 없으면 null */
export function findFood(db: FoodDb, src: FoodSource, sid: string): CatalogFood | null {
  const [row] = db.all<CatalogFood>(`SELECT ${COLUMNS} FROM foods WHERE src = ? AND sid = ?`, [
    src,
    sid,
  ]);
  return row ?? null;
}

/** 가정 단위("1 cup", "1 banana")와 그 무게. USDA 음식에만 있다 */
export function foodPortions(db: FoodDb, foodId: number): FoodPortion[] {
  return db.all<FoodPortion>('SELECT name, grams FROM portions WHERE food_id = ? ORDER BY seq', [
    foodId,
  ]);
}

/** 출처별 음식 수 (데이터 출처 화면) */
export function foodCounts(db: FoodDb): Record<FoodSource, number> {
  const rows = db.all<{ key: string; value: string }>('SELECT key, value FROM meta', []);
  const of = (key: FoodSource) => Number(rows.find((r) => r.key === key)?.value ?? 0);
  return { usda: of('usda'), mfds: of('mfds') };
}
