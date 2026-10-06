/**
 * 온보딩 답변으로 만드는 추천. 추천이 바꾸는 것은 딱 세 가지다:
 * 루틴 정렬(추천 배지), 부위별 주간 목표 세트(`set-targets.ts`), 단백질 목표.
 */
import { toKg } from '@/lib/number';

export type Experience = 'new' | 'under6m' | 'over1y';
export type DaysPerWeek = 2 | 3 | 4 | 5;
export type Goal = 'muscle' | 'strength' | 'fat_loss' | 'consistency';
export type BodyType = 'male' | 'female';
export type TemplateKey = 'full_body' | 'upper_lower' | 'push_pull_legs';

export type ProfileAnswers = {
  experience: Experience | null;
  daysPerWeek: DaysPerWeek | null;
  goal: Goal | null;
};

/** 추천 루틴 A(전신 주3회)·B(상하체 2분할)·C(푸시풀레그) 중 하나를 고른다. */
export function recommendTemplate({
  experience,
  daysPerWeek,
}: Pick<ProfileAnswers, 'experience' | 'daysPerWeek'>): TemplateKey {
  if (daysPerWeek !== null && daysPerWeek >= 5) return 'push_pull_legs';
  if (daysPerWeek === 4) return experience === 'new' ? 'full_body' : 'upper_lower';
  if (experience === 'over1y' && daysPerWeek === 3) return 'push_pull_legs';
  return 'full_body';
}

/** 목표별 체중 1kg당 단백질(g). 감량 중에는 근손실을 줄이려고 높게 잡는다. */
const PROTEIN_PER_KG: Record<Goal, number> = {
  muscle: 1.6,
  strength: 1.6,
  fat_loss: 2.0,
  consistency: 1.2,
};

/** 식단 목표 화면에서 고를 수 있는 '몸무게 1 kg당 단백질(g)' */
export const PROTEIN_PER_KG_OPTIONS = [1.2, 1.6, 2.0, 2.2] as const;

/** 따로 고르지 않았을 때의 1 kg당 단백질: 운동 목표를 따른다 */
export function defaultProteinPerKg(goal: Goal | null): number {
  return PROTEIN_PER_KG[goal ?? 'consistency'];
}

/**
 * 하루 단백질 목표(g, 5g 단위). 체중을 모르면 null → 목표를 숨긴다.
 * `perKg`를 주면 그 값을, 없으면 운동 목표에 맞춘 값을 쓴다.
 */
export function proteinTargetGrams(
  weight: number | null,
  unit: 'kg' | 'lb',
  goal: Goal | null,
  perKg: number | null = null,
): number | null {
  if (weight === null || weight <= 0) return null;
  return Math.round((toKg(weight, unit) * (perKg ?? defaultProteinPerKg(goal))) / 5) * 5;
}

/** 입력 가능한 범위. 벗어나면 저장하지 않고 오류를 보여준다. */
export const HEIGHT_CM_RANGE = { min: 100, max: 250 } as const;
export const WEIGHT_RANGE = {
  kg: { min: 25, max: 300 },
  lb: { min: 55, max: 660 },
} as const;
