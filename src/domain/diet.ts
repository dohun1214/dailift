/** 식단 계산: 먹은 양의 영양값, 하루 합계, 목표와 진행, 양 단위. 모두 순수 함수. */
import type { FoodSrc, Meal } from '@/db/schema';

import { type Goal, proteinTargetGrams } from './profile';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type Nutrients = { kcal: number; protein: number; carb: number; fat: number };
export const NO_NUTRIENTS: Nutrients = { kcal: 0, protein: 0, carb: 0, fat: 0 };

/** 1회 양 단위. `name`이 null이면 이름 없는 1회 양('1인분') */
export type FoodUnit = { name: string | null; grams: number };

/** 고를 수 있는 음식 한 가지(음식 DB · 내 음식 · 지난 기록에서 만든다). 영양값은 100 g(ml)당 */
export type FoodItem = Nutrients & {
  src: FoodSrc;
  sid: string;
  name: string;
  /** 만든 회사 (가공식품만. 화면에 보이기만 하고 기록에는 남기지 않는다) */
  maker?: string | null;
  basis: 'g' | 'ml';
  /** 고를 수 있는 1회 양 단위 (g 말고) */
  units: readonly FoodUnit[];
};

/** 먹은 양. `unit`이 null이면 g(ml)으로 넣은 것 */
export type Amount = { grams: number; unit: FoodUnit | null };

export type FoodLog = Nutrients & {
  id: string;
  date: string;
  meal: Meal;
  position: number;
  src: FoodSrc;
  sid: string;
  name: string;
  basis: 'g' | 'ml';
  grams: number;
  unit: FoodUnit | null;
  createdAt: number;
};

export const LIMITS = {
  /** 한 번에 넣을 수 있는 가장 큰 양(g) */
  grams: 5000,
  /** 1회 양 단위로 넣을 때 가장 큰 개수 */
  count: 99,
  foodName: 40,
  servingName: 12,
  customFoods: 300,
  sets: 50,
  setItems: 20,
  setName: 30,
  /** 100 g당 넣을 수 있는 가장 큰 값 */
  kcalPer100: 900,
  gramsPer100: 100,
  /** 목표 */
  kcalTarget: 9999,
  macroTarget: 999,
} as const;

/** 100 g당 값에 양을 곱한다 */
export function nutrientsFor(per100: Nutrients, grams: number): Nutrients {
  const k = grams / 100;
  return {
    kcal: per100.kcal * k,
    protein: per100.protein * k,
    carb: per100.carb * k,
    fat: per100.fat * k,
  };
}

export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  return list.reduce<Nutrients>(
    (a, n) => ({
      kcal: a.kcal + n.kcal,
      protein: a.protein + n.protein,
      carb: a.carb + n.carb,
      fat: a.fat + n.fat,
    }),
    NO_NUTRIENTS,
  );
}

export type MealGroup = { meal: Meal; logs: FoodLog[]; total: Nutrients };

/** 하루 기록을 끼니별로 묶고 합계를 낸다(끼니 순서는 고정, 끼니 안은 넣은 순서) */
export function dayView(logs: readonly FoodLog[]): { meals: MealGroup[]; total: Nutrients } {
  const meals = MEALS.map((meal) => {
    const list = logs
      .filter((l) => l.meal === meal)
      .sort(
        (a, b) => a.position - b.position || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      );
    return { meal, logs: list, total: sumNutrients(list.map((l) => nutrientsFor(l, l.grams))) };
  });
  return { meals, total: sumNutrients(meals.map((m) => m.total)) };
}

// ---------- 목표

export type ProteinMode = 'perKg' | 'direct';

export type DietGoals = {
  proteinMode: ProteinMode;
  /** 몸무게 1 kg당 단백질(g). null이면 운동 목표에 맞춘 값 */
  proteinPerKg: number | null;
  /** 직접 넣은 하루 단백질(g) */
  proteinDirect: number | null;
  kcal: number | null;
  carb: number | null;
  fat: number | null;
};

export type Targets = { [K in keyof Nutrients]: number | null };

/** 지금 쓰는 하루 목표. 없는 것은 null(합계만 보여 준다) */
export function dietTargets(
  goals: DietGoals,
  body: { weight: number | null; weightUnit: 'kg' | 'lb'; goal: Goal | null },
): Targets {
  const protein =
    goals.proteinMode === 'direct'
      ? goals.proteinDirect
      : proteinTargetGrams(body.weight, body.weightUnit, body.goal, goals.proteinPerKg);
  return { kcal: goals.kcal, protein, carb: goals.carb, fat: goals.fat };
}

/** 단백질 · 탄수화물 · 지방 목표를 칼로리로 (4 · 4 · 9 kcal/g). 하나라도 없으면 null */
export function macroKcal(protein: number | null, carb: number | null, fat: number | null) {
  if (protein === null || carb === null || fat === null) return null;
  return Math.round(protein * 4 + carb * 4 + fat * 9);
}

export type Progress = {
  /** 화면에 보이는 값(반올림) */
  value: number;
  target: number;
  /** 막대 0–1 */
  ratio: number;
  /** 남은 양(0 이상) */
  left: number;
  /** 넘은 양(0 이상) */
  over: number;
};

/** 보이는 숫자끼리 맞도록 반올림한 값으로 계산한다 */
export function progress(value: number, target: number): Progress {
  const v = Math.round(value);
  return {
    value: v,
    target,
    ratio: target > 0 ? Math.min(1, Math.max(0, v / target)) : 0,
    left: Math.max(0, target - v),
    over: Math.max(0, v - target),
  };
}

// ---------- 양

/** 처음 보여 줄 양: 1회 양이 있으면 그것 하나, 없으면 100 g */
export function defaultAmount(food: Pick<FoodItem, 'units'>): Amount {
  const [unit] = food.units;
  return unit ? { grams: unit.grams, unit } : { grams: 100, unit: null };
}

/** 1회 양 단위로 몇 개인지 (소수 둘째 자리까지) */
export function unitCount(amount: Amount): number {
  if (!amount.unit || amount.unit.grams <= 0) return 0;
  return Math.round((amount.grams / amount.unit.grams) * 100) / 100;
}

/** 숫자판에 처음 보여 줄 글자 */
export function amountText(amount: Amount): string {
  return trimNumber(amount.unit ? unitCount(amount) : Math.round(amount.grams * 10) / 10);
}

/** 숫자판 글자를 양으로. 비었거나 0이거나 너무 크면 null */
export function parseAmount(text: string, unit: FoodUnit | null): Amount | null {
  if (!/^\d*\.?\d*$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return null;
  const grams = unit ? n * unit.grams : n;
  if (grams > LIMITS.grams || (unit !== null && n > LIMITS.count)) return null;
  return { grams: Math.round(grams * 10) / 10, unit };
}

/** 숫자판 한 번 누르기. 자릿수(정수 4자리, 소수 1자리 · 단위는 2자리)를 넘으면 그대로 둔다 */
export function pressKey(text: string, key: string, decimals: number): string {
  if (key === 'back') return text.slice(0, -1);
  if (key === '.') return text.includes('.') ? text : `${text === '' ? '0' : text}.`;
  if (!/^\d$/.test(key)) return text;
  const [int = '', frac] = text.split('.');
  if (frac !== undefined) return frac.length >= decimals ? text : text + key;
  if (int === '0') return key;
  return int.length >= 4 ? text : text + key;
}

export function trimNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** "1 cup" → "cup", "1개" → "개". 1로 시작하지 않으면("3 oz") null */
export function unitNoun(name: string): string | null {
  const m = /^1\s*(?=[^\d.,])(.+)$/.exec(name.trim());
  return m?.[1]?.trim() || null;
}

/** 같은 음식인지 (출처 + 출처 id) */
export const foodKey = (f: { src: FoodSrc; sid: string }) => `${f.src}:${f.sid}`;

/** 최근 먹은 음식: 음식마다 가장 최근 기록 하나(그때의 양 포함), 최근 순 */
export function recentFoods(
  logs: readonly FoodLog[],
  limit = 30,
): { item: FoodItem; amount: Amount }[] {
  const seen = new Set<string>();
  const out: { item: FoodItem; amount: Amount }[] = [];
  for (const l of [...logs].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = foodKey(l);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ item: logItem(l), amount: { grams: l.grams, unit: l.unit } });
    if (out.length >= limit) break;
  }
  return out;
}

/** 기록에 남은 것만으로 만든 음식(단위는 그때 쓴 것 하나) */
export function logItem(l: FoodLog): FoodItem {
  return {
    src: l.src,
    sid: l.sid,
    name: l.name,
    basis: l.basis,
    kcal: l.kcal,
    protein: l.protein,
    carb: l.carb,
    fat: l.fat,
    units: l.unit ? [l.unit] : [],
  };
}

/** 단위 목록에 지금 쓰는 단위가 없으면 끼워 넣는다(이름 · 무게가 같으면 같은 단위) */
export function withUnit(units: readonly FoodUnit[], unit: FoodUnit | null): FoodUnit[] {
  if (!unit || units.some((u) => sameUnit(u, unit))) return [...units];
  return [unit, ...units];
}

export const sameUnit = (a: FoodUnit | null, b: FoodUnit | null) =>
  a === b || (a !== null && b !== null && a.name === b.name && a.grams === b.grams);

// ---------- 세트

/** 세트에 담은 음식 하나: 음식과 그 양 */
export type SetItem = { item: FoodItem; amount: Amount };

export type FoodSet = { id: string; name: string; items: SetItem[]; createdAt: number };

/** 세트(또는 담은 음식들)의 영양값 합계 */
export function setTotal(items: readonly SetItem[]): Nutrients {
  return sumNutrients(items.map(({ item, amount }) => nutrientsFor(item, amount.grams)));
}

// ---------- 직접 만든 음식

export type CustomFoodInput = {
  name: string;
  /** 영양성분표의 기준: 1회 제공량당 또는 100 g당 */
  per: 'serving' | '100g';
  /** 1회 제공량(g). per가 serving이면 꼭 있어야 한다 */
  serving: number | null;
  servingName: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
};

/** 넣은 숫자를 100 g당 값으로 바꾼다. 넣을 수 없는 값이면 무엇이 틀렸는지 돌려준다 */
export function toPer100(
  input: CustomFoodInput,
): { ok: true; per100: Nutrients } | { ok: false; error: 'serving' | 'range' } {
  if (input.per === 'serving' && (input.serving === null || input.serving <= 0))
    return { ok: false, error: 'serving' };
  const k = input.per === 'serving' ? 100 / (input.serving as number) : 1;
  const per100 = {
    kcal: input.kcal * k,
    protein: input.protein * k,
    carb: input.carb * k,
    fat: input.fat * k,
  };
  const bad =
    per100.kcal > LIMITS.kcalPer100 ||
    [per100.protein, per100.carb, per100.fat].some((v) => v > LIMITS.gramsPer100) ||
    per100.protein + per100.carb + per100.fat > LIMITS.gramsPer100 + 0.5;
  return bad ? { ok: false, error: 'range' } : { ok: true, per100 };
}
