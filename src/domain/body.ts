/** 체성분 기록 계산: 단위 맞추기, 그래프 점, 입력 검사, 단백질 목표 묻기. 모두 순수 함수. */
import type { WeightUnit } from '@/db/schema';

import { type ProgressPeriod, periodStart } from './exercise-progress';
import { type Goal, proteinTargetGrams, WEIGHT_RANGE } from './profile';

/** 그래프로 보는 세 가지 */
export type BodyMetric = 'weight' | 'muscle' | 'fat';
export const BODY_METRICS: readonly BodyMetric[] = ['weight', 'muscle', 'fat'];

/** '더 적기'의 값. 순서가 화면 순서다 */
export const BODY_EXTRA_KEYS = [
  'bmi',
  'bmr',
  'visceralFat',
  'whr',
  'water',
  'protein',
  'mineral',
  'leanRightArm',
  'leanLeftArm',
  'leanRightLeg',
  'leanLeftLeg',
  'leanTrunk',
] as const;
export type BodyExtraKey = (typeof BODY_EXTRA_KEYS)[number];
export type BodyExtras = Partial<Record<BodyExtraKey, number>>;

/** 무게인 값(줄의 무게 단위를 따른다). 나머지는 단위가 정해져 있다(BMI · kcal · 레벨 · 비율 · L) */
export const MASS_EXTRAS: readonly BodyExtraKey[] = [
  'protein',
  'mineral',
  'leanRightArm',
  'leanLeftArm',
  'leanRightLeg',
  'leanLeftLeg',
  'leanTrunk',
];
/** 정수로만 적는 값 */
export const INTEGER_EXTRAS: readonly BodyExtraKey[] = ['bmr', 'visceralFat'];

/** 화면의 묶음 */
export const EXTRA_GROUPS: readonly {
  id: 'index' | 'composition' | 'segments';
  keys: readonly BodyExtraKey[];
}[] = [
  { id: 'index', keys: ['bmi', 'bmr', 'visceralFat', 'whr'] },
  { id: 'composition', keys: ['water', 'protein', 'mineral'] },
  {
    id: 'segments',
    keys: ['leanRightArm', 'leanLeftArm', 'leanRightLeg', 'leanLeftLeg', 'leanTrunk'],
  },
];

/** 한 번 잰 기록(저장된 단위 그대로) */
export type BodyEntry = {
  id: string;
  measuredAt: number;
  weight: number | null;
  weightUnit: WeightUnit;
  skeletalMuscle: number | null;
  bodyFatPct: number | null;
  extras: BodyExtras;
  source: 'manual' | 'ocr' | 'health';
};

type Range = { min: number; max: number };
/** 입력 범위(kg 기준. 무게인 값은 lb일 때 바꿔서 본다) */
const KG_RANGE: Record<'muscle' | BodyExtraKey, Range> = {
  muscle: { min: 5, max: 100 },
  bmi: { min: 5, max: 80 },
  bmr: { min: 300, max: 6000 },
  visceralFat: { min: 1, max: 30 },
  whr: { min: 0.4, max: 1.6 },
  water: { min: 10, max: 120 },
  protein: { min: 1, max: 50 },
  mineral: { min: 0.3, max: 15 },
  leanRightArm: { min: 0.3, max: 20 },
  leanLeftArm: { min: 0.3, max: 20 },
  leanRightLeg: { min: 1, max: 40 },
  leanLeftLeg: { min: 1, max: 40 },
  leanTrunk: { min: 3, max: 80 },
};
export const BODY_FAT_PCT_RANGE: Range = { min: 1, max: 75 };

const LB = 2.2046226218;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** 무게를 다른 단위로(소수 한 자리). 운동 무게와 달리 0.5 단위로 깎지 않는다 */
export function bodyMass(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return round1(to === 'lb' ? value * LB : value / LB);
}

/** 그 값의 입력 범위(무게인 값은 단위에 맞춰서) */
export function bodyRange(field: BodyMetric | BodyExtraKey, unit: WeightUnit): Range {
  if (field === 'weight') return WEIGHT_RANGE[unit];
  if (field === 'fat') return BODY_FAT_PCT_RANGE;
  const r = KG_RANGE[field];
  const mass = field === 'muscle' || MASS_EXTRAS.includes(field as BodyExtraKey);
  return mass && unit === 'lb' ? { min: round1(r.min * LB), max: round1(r.max * LB) } : r;
}

/** 저장된 JSON 글자 → 값. 모르는 칸 · 숫자가 아닌 값은 버린다 */
export function parseExtras(text: string | null | undefined): BodyExtras {
  if (!text) return {};
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object') return {};
    const out: BodyExtras = {};
    for (const key of BODY_EXTRA_KEYS) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** 값 → 저장할 JSON 글자. 적은 것이 없으면 null */
export function serializeExtras(extras: BodyExtras): string | null {
  const out: BodyExtras = {};
  for (const key of BODY_EXTRA_KEYS) {
    const v = extras[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

/** 체지방량 = 체중 × 체지방률 (소수 한 자리). 둘 중 하나라도 없으면 null */
export function fatMass(weight: number | null, bodyFatPct: number | null): number | null {
  if (weight === null || bodyFatPct === null) return null;
  return round1((weight * bodyFatPct) / 100);
}

/** 기록 하나에서 그 항목의 값(무게는 보여 줄 단위로 바꿔서). 안 적었으면 null */
export function metricValue(entry: BodyEntry, metric: BodyMetric, unit: WeightUnit): number | null {
  if (metric === 'fat') return entry.bodyFatPct;
  const raw = metric === 'weight' ? entry.weight : entry.skeletalMuscle;
  return raw === null ? null : bodyMass(raw, entry.weightUnit, unit);
}

export type BodyPoint = { id: string; at: number; value: number };

/** 그 항목을 적은 기록만, 오래된 순으로. 기간을 주면 그 안의 것만 */
export function bodyPoints(
  entries: readonly BodyEntry[],
  metric: BodyMetric,
  unit: WeightUnit,
  period: ProgressPeriod = 'all',
  now = Date.now(),
): BodyPoint[] {
  const from = periodStart(period, now);
  const out: BodyPoint[] = [];
  for (const e of entries) {
    if (from !== null && e.measuredAt < from) continue;
    const value = metricValue(e, metric, unit);
    if (value !== null) out.push({ id: e.id, at: e.measuredAt, value });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** 위 세 칸에 보일 값: 항목마다 가장 최근에 적은 값(가장 최근 기록에 그 항목이 없을 수 있다) */
export function latestBody(
  entries: readonly BodyEntry[],
  unit: WeightUnit,
): { at: number | null; values: Record<BodyMetric, number | null> } {
  const sorted = [...entries].sort((a, b) => b.measuredAt - a.measuredAt);
  const values: Record<BodyMetric, number | null> = { weight: null, muscle: null, fat: null };
  for (const metric of BODY_METRICS) {
    for (const e of sorted) {
      const v = metricValue(e, metric, unit);
      if (v !== null) {
        values[metric] = v;
        break;
      }
    }
  }
  return { at: sorted[0]?.measuredAt ?? null, values };
}

/** 처음 보여 줄 기간: 최근 3개월에 점이 둘 이상이면 3개월, 아니면 전체 */
export function defaultBodyPeriod(points: readonly BodyPoint[], now: number): ProgressPeriod {
  const from = periodStart('3m', now) ?? 0;
  return points.filter((p) => p.at >= from).length >= 2 ? '3m' : 'all';
}

export type BodyInput = {
  weight: number | null;
  skeletalMuscle: number | null;
  bodyFatPct: number | null;
  extras: BodyExtras;
};
export type BodyField = BodyMetric | BodyExtraKey;

/**
 * 저장하기 전 검사. 범위를 벗어난 칸들을 돌려준다.
 * 체중 · 골격근량 · 체지방률 가운데 하나도 안 적었으면 'empty'.
 */
export function bodyIssues(input: BodyInput, unit: WeightUnit): BodyField[] | 'empty' {
  if (input.weight === null && input.skeletalMuscle === null && input.bodyFatPct === null) {
    return 'empty';
  }
  const bad: BodyField[] = [];
  const check = (field: BodyField, v: number | null | undefined) => {
    if (v === null || v === undefined) return;
    const r = bodyRange(field, unit);
    if (!(v >= r.min && v <= r.max)) bad.push(field);
    else if (INTEGER_EXTRAS.includes(field as BodyExtraKey) && !Number.isInteger(v))
      bad.push(field);
  };
  check('weight', input.weight);
  check('muscle', input.skeletalMuscle);
  check('fat', input.bodyFatPct);
  for (const key of BODY_EXTRA_KEYS) check(key, input.extras[key]);
  // 골격근량이 체중보다 클 수는 없다.
  if (
    input.weight !== null &&
    input.skeletalMuscle !== null &&
    input.skeletalMuscle >= input.weight &&
    !bad.includes('muscle') &&
    !bad.includes('weight')
  ) {
    bad.push('muscle');
  }
  return bad;
}

/**
 * 가장 최근 체중을 프로필 몸무게로 쓸 때 단백질 목표가 어떻게 바뀌는지.
 * 목표를 직접 숫자로 정했거나 목표가 그대로면 null(묻지 않는다).
 */
export function proteinChange(
  prev: { weight: number | null; unit: WeightUnit },
  next: { weight: number; unit: WeightUnit },
  goal: Goal | null,
  goals: { proteinMode: 'perKg' | 'direct'; proteinPerKg: number | null },
): { from: number | null; to: number } | null {
  if (goals.proteinMode === 'direct') return null;
  const from = proteinTargetGrams(prev.weight, prev.unit, goal, goals.proteinPerKg);
  const to = proteinTargetGrams(next.weight, next.unit, goal, goals.proteinPerKg);
  return to === null || to === from ? null : { from, to };
}
