/** 가공식품(식약처 가공식품 · USDA 포장 제품, 서버에서 찾는다)을 식단에서 쓰는 모양으로 바꾼다. 순수 함수. */
import type { Amount, FoodItem, FoodUnit } from './diet';
import type { FoodSource } from './food-search';

/** 서버에서 찾는 출처. mfdsp: 식약처 가공식품(한국어), usdab: USDA 포장 제품(영어 — 미국 제품이 대부분) */
export type ServerFoodSrc = 'mfdsp' | 'usdab';
export const isServerFood = (src: string): src is ServerFoodSrc =>
  src === 'mfdsp' || src === 'usdab';

/** 서버 표 `processed_foods` · `branded_foods`의 한 줄. 영양값은 100 g(ml)당 */
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

/** 포장 하나 · 1회 섭취참고량을 고르는 단위 이름. 식약처 가공식품은 한국에서만 보이므로 한국어로 둔다 */
export const PACK_UNIT = '1개';
export const SERVING_UNIT = '1회';
/** USDA 포장 제품의 라벨 1회 제공량. 이름이 영어뿐인 자료라 영어로 둔다 */
export const LABEL_SERVING_UNIT = '1 serving';

/** 한 번에 받는 줄 수 */
export const PROCESSED_PAGE = 30;
const MIN_QUERY = 2;
const BRANDED_MIN_WORD = 3;
const MAX_QUERY = 40;

/**
 * 단위 — 식약처: 포장 하나(1개)가 먼저, 그다음 1회 섭취참고량(포장과 같으면 뺀다).
 * USDA 포장 제품: 라벨의 1회 제공량 하나(포장 무게는 쓰지 않는다).
 */
export function processedItem(f: ProcessedFood, src: ServerFoodSrc = 'mfdsp'): FoodItem {
  const units: FoodUnit[] = [];
  if (src === 'usdab') {
    if (f.serv !== null && f.serv > 0) units.push({ name: LABEL_SERVING_UNIT, grams: f.serv });
  } else {
    if (f.size !== null && f.size > 0) units.push({ name: PACK_UNIT, grams: f.size });
    if (f.serv !== null && f.serv > 0 && f.serv !== f.size) {
      units.push({ name: SERVING_UNIT, grams: f.serv });
    }
  }
  return {
    src,
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
 * 가공식품을 고르면 처음 보여 줄 양.
 * - 식약처: 포장 하나(1개). 포장 무게를 모르면 100 g
 *   (1회 섭취참고량은 고를 수는 있지만 처음 값으로 쓰지 않는다 — 2026-10-07 사용자 결정).
 * - USDA 포장 제품: 라벨의 1회 제공량. 없으면 100 g.
 */
export function processedDefaultAmount(item: Pick<FoodItem, 'units'>): Amount {
  const [first] = item.units;
  return first?.name === PACK_UNIT || first?.name === LABEL_SERVING_UNIT
    ? { grams: first.grams, unit: first }
    : { grams: 100, unit: null };
}

/**
 * 이 검색어로 USDA 포장 제품도 찾을지.
 * - 한국 밖(식약처 자료가 안 보이는 곳): 항상.
 * - 두 곳 모두 세 글자 이상인 낱말이 있어야 한다.
 * - 한국: 영어로 찾을 때만 — 로마자가 있고 한글이 없을 때(2026-10-07 사용자 결정). 한글 검색에는 지금처럼 한국 가공식품만 나온다.
 */
export function wantsBranded(text: string, sources: readonly FoodSource[]): boolean {
  // 서버는 가장 긴 낱말이 세 글자 이상일 때만 찾는다(두 글자는 결과가 수만 개라 느리다).
  if (!text.split(/[\s,·|]+/).some((w) => w.length >= BRANDED_MIN_WORD)) return false;
  if (!sources.includes('mfds')) return true;
  return /[a-z]/i.test(text) && !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

/**
 * 서버에 보낼 검색어. 띄어쓰기를 뺀 길이가 두 글자보다 짧으면 null(찾지 않는다 — 한 글자는 결과가 수만 개다).
 */
export function processedQuery(text: string): string | null {
  const q = text.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY);
  return q.replace(/[\s,·|]/g, '').length >= MIN_QUERY ? q : null;
}
