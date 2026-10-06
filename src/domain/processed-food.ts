/** 가공식품(식약처 가공식품 자료, 서버에서 찾는다)을 식단에서 쓰는 모양으로 바꾼다. 순수 함수. */
import type { Amount, FoodItem, FoodUnit } from './diet';

/** 서버 표 `processed_foods`의 한 줄. 영양값은 100 g(ml)당 */
export type ProcessedFood = {
  sid: string;
  name: string;
  /** 만든 회사(없으면 빈 글자) */
  maker: string;
  basis: 'g' | 'ml';
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  /** 식품중량: 포장 하나의 양 */
  size: number | null;
  /** 1회 섭취참고량 */
  serv: number | null;
};

/** 포장 하나 · 1회 섭취참고량을 고르는 단위 이름. 가공식품은 한국에서만 보이므로 한국어로 둔다 */
export const PACK_UNIT = '1개';
export const SERVING_UNIT = '1회';

/** 한 번에 받는 줄 수 */
export const PROCESSED_PAGE = 30;
const MIN_QUERY = 2;
const MAX_QUERY = 40;

/** 단위: 포장 하나(1개)가 먼저, 그다음 1회 섭취참고량(포장과 같으면 뺀다) */
export function processedItem(f: ProcessedFood): FoodItem {
  const units: FoodUnit[] = [];
  if (f.size !== null && f.size > 0) units.push({ name: PACK_UNIT, grams: f.size });
  if (f.serv !== null && f.serv > 0 && f.serv !== f.size) {
    units.push({ name: SERVING_UNIT, grams: f.serv });
  }
  return {
    src: 'mfdsp',
    sid: f.sid,
    name: f.name,
    maker: f.maker || null,
    basis: f.basis,
    kcal: f.kcal,
    protein: f.protein,
    carb: f.carb,
    fat: f.fat,
    units,
  };
}

/**
 * 가공식품을 고르면 처음 보여 줄 양: 포장 하나(1개). 포장 무게를 모르면 100 g
 * (1회 섭취참고량은 고를 수는 있지만 처음 값으로 쓰지 않는다 — 2026-10-07 사용자 결정).
 */
export function processedDefaultAmount(item: Pick<FoodItem, 'units'>): Amount {
  const [first] = item.units;
  return first?.name === PACK_UNIT
    ? { grams: first.grams, unit: first }
    : { grams: 100, unit: null };
}

/**
 * 서버에 보낼 검색어. 띄어쓰기를 뺀 길이가 두 글자보다 짧으면 null(찾지 않는다 — 한 글자는 결과가 수만 개다).
 */
export function processedQuery(text: string): string | null {
  const q = text.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY);
  return q.replace(/[\s,·|]/g, '').length >= MIN_QUERY ? q : null;
}
